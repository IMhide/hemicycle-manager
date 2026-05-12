/**
 * PolitiDex — pipeline data multi-législature.
 *
 * Source unique pour les acteurs et leurs mandats : AMO30 historique
 * (`tous_acteurs_tous_mandats_tous_organes_historique`) — cf ADR 0018.
 * Source pour les scrutins : un export par législature.
 *
 * Outputs (sous static/data/) — modèle Personne unique cross-législature (cf ADR 0015) :
 *  - personnes.json              : Personne[] avec mandats[] + carriere agrégée
 *  - groupes/{leg}.json          : Groupe[] scopés par législature (cf ADR 0016)
 *  - legislatures.json           : LegislatureMeta[]
 *  - scrutins-index.json         : ScrutinIndex[] cross-législature (avec champ legislature)
 *  - scrutins/{uid}.json         : ScrutinDetail
 *  - stats-personnes.json        : pour debug/inspection — stats par mandat sont déjà dans personnes.json
 *  - historique/{paId}.json      : VoteHistoryItem[] tous mandats confondus
 *  - meta.json                   : build metadata
 *
 * Le tableau LEGISLATURES contrôle la couverture. Phase 1 = [16, 17].
 * Pour étendre Phase 2, ajouter 15 ; Phase 3 ajoute le sénat (modèle à généraliser).
 */

import { writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

import type {
	Personne,
	Mandat,
	AppartenanceGroupe,
	MandatStats,
	MandatRangs,
	CarriereAggregee,
	BadgeCarriere,
	BadgeMandat,
	Groupe,
	LegislatureMeta,
	ScrutinIndex,
	ScrutinDetail,
	Texte,
	VotePosition,
	VoteHistoryItem,
	BuildMeta
} from '../src/lib/types.ts';
import { asArray, daysBetween, downloadZip, ensureDir, extractIfNeeded } from './lib/cache.ts';
import {
	buildFamillesIndex,
	familleAN,
	type FamillesIndex,
	type FamillesManifest
} from './lib/groupes-familles.ts';
import { parseDossiersDir } from './lib/dossiers-an.ts';
import { aggregeTextesAN, type ScrutinPourAgreg } from './lib/textes-an.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'static', 'data');
const CACHE_DIR = join(tmpdir(), 'politidex-cache');

/** Législatures couvertes.
 *  Phase 1 = [16, 17] (Borne→Macron II)
 *  Phase 2 = [15, 16, 17] (toute l'ère Macron, depuis juin 2017) — cf NEXT_STEPS.md */
const LEGISLATURES: number[] = [15, 16, 17];

/** Source historique d'identité (PA-id stable, cross-leg) — cf ADR 0018. */
const SOURCE_ACTEURS =
	'https://data.assemblee-nationale.fr/static/openData/repository/17/amo/tous_acteurs_mandats_organes_xi_legislature/AMO30_tous_acteurs_tous_mandats_tous_organes_historique.json.zip';

/**
 * Sources d'enrichissement par législature (AMO10 / AMO20). Cf ADR 0019 :
 * AMO10 (legis. en cours) et AMO20 (legis. passées) sont prioritaires sur AMO30
 * pour les champs précis (placeHemicycle notamment).
 *
 * Pour Phase 1 :
 *   - 17ᵉ législature → AMO10 (snapshot temps réel)
 *   - 16ᵉ législature → AMO20 (snapshot figé à la dissolution 2024-06-09)
 */
const SOURCES_ENRICHISSEMENT = new Map<number, string>([
	[
		17,
		'https://data.assemblee-nationale.fr/static/openData/repository/17/amo/deputes_actifs_mandats_actifs_organes/AMO10_deputes_actifs_mandats_actifs_organes.json.zip'
	],
	[
		16,
		'https://data.assemblee-nationale.fr/static/openData/repository/16/amo/deputes_senateurs_ministres_legislature/AMO20_dep_sen_min_tous_mandats_et_organes.json.zip'
	],
	[
		15,
		'https://data.assemblee-nationale.fr/static/openData/repository/15/amo/deputes_senateurs_ministres_legislature/AMO20_dep_sen_min_tous_mandats_et_organes_XV.json.zip'
	]
]);

// ⚠️  L'archive Scrutins.json.zip de la 17ᵉ législature est servie extrêmement
//     lentement par le CDN AN (POP 46.105.202.26 / Rouen) : ~25-30 KB/s, identique
//     en navigateur. Un fresh download peut prendre 10-12 minutes pour ~20 MB.
//     Le cache `politidex-cache/` dans tmpdir est notre garde-fou : NE PAS le purger
//     entre deux runs si tu n'as pas explicitement besoin de re-fetch.
//     Côté Coolify : prévoir un build timeout ≥ 15 min.

const sourceScrutins = (leg: number) => {
	// La 15ᵉ législature a un nom de fichier différent : `Scrutins_XV.json.zip`
	// (suffixe romain), alors que 16ᵉ et 17ᵉ utilisent simplement `Scrutins.json.zip`.
	const filename = leg === 15 ? 'Scrutins_XV.json.zip' : 'Scrutins.json.zip';
	return `https://data.assemblee-nationale.fr/static/openData/repository/${leg}/loi/scrutins/${filename}`;
};

/** Dump des dossiers parlementaires (~9 MB). Contient les métadonnées officielles
 *  des textes : titre propre, code procédure, initiateurs, dates clés. Sert à
 *  enrichir les `Texte` aggrégés (cf scripts/lib/dossiers-an.ts). */
const SOURCE_DOSSIERS =
	'https://data.assemblee-nationale.fr/static/openData/repository/17/loi/dossiers_legislatifs/Dossiers_Legislatifs.json.zip';

/** Seuil pour identifier le NI-bridge transitoire (en jours).
 *  En 16ᵉ le délai d'inscription au groupe a été ~6 jours (22→28 juin 2022).
 *  En 17ᵉ il a été plus long (~10 jours : 8→18 juillet 2024) car élections
 *  législatives anticipées + congés d'été. On garde une marge à 21 jours
 *  pour absorber les variations futures. */
const NI_BRIDGE_MAX_DURATION_DAYS = 21;

// ────────────────────────────────────────────────────────────────────────────
// Utilitaires
// ────────────────────────────────────────────────────────────────────────────

/** Compare deux qualités GP par préséance. Plus haut = meilleur. */
function qualiteRank(qualite: string | null | undefined): number {
	if (!qualite) return 0;
	const q = qualite.toLowerCase();
	if (q.includes('président') && !q.includes('vice')) return 5;
	if (q.includes('vice-président')) return 4;
	if (q.includes('secrétaire')) return 3;
	if (q.includes('trésorier')) return 2;
	if (q.includes('membre')) return 1;
	return 0;
}

// ────────────────────────────────────────────────────────────────────────────
// Étape 1 — extraction des groupes politiques par législature
// ────────────────────────────────────────────────────────────────────────────

interface RawOrgane {
	uid: string;
	codeType: string;
	libelle: string;
	libelleAbrege?: string;
	libelleAbrev?: string;
	couleurAssociee?: string;
	preseance?: string;
	legislature?: string;
	viMoDe?: { dateDebut?: string; dateFin?: string | null };
}

async function parseGroupes(extractDir: string): Promise<Map<number, Groupe[]>> {
	const organeDir = join(extractDir, 'json', 'organe');
	const { readdirSync } = await import('node:fs');

	const byLegislature = new Map<number, Groupe[]>();
	for (const leg of LEGISLATURES) byLegislature.set(leg, []);

	for (const file of readdirSync(organeDir)) {
		const raw = JSON.parse(await readFile(join(organeDir, file), 'utf8'));
		const o: RawOrgane = raw.organe;
		if (o.codeType !== 'GP') continue;
		const leg = o.legislature ? parseInt(o.legislature, 10) : NaN;
		if (!LEGISLATURES.includes(leg)) continue;

		const list = byLegislature.get(leg)!;
		list.push({
			id: o.uid,
			legislature: leg,
			libelle: o.libelle,
			libelleAbrege: o.libelleAbrege ?? o.libelleAbrev ?? o.libelle.slice(0, 6).toUpperCase(),
			couleur: o.couleurAssociee ?? '#888888',
			preseance: parseInt(o.preseance ?? '999', 10),
			presidentId: null, // rempli plus tard à partir des mandats
			dateDebut: o.viMoDe?.dateDebut ?? '',
			dateFin: o.viMoDe?.dateFin ?? null,
			effectifFin: 0, // calculé plus tard
			overallMoyen: 0, // calculé après les overalls par mandat
			overallEffectif: 0
		});
	}

	for (const list of byLegislature.values()) {
		list.sort((a, b) => a.preseance - b.preseance);
	}
	return byLegislature;
}

// ────────────────────────────────────────────────────────────────────────────
// Étape 2 — extraction des personnes + mandats parlementaires + appartenances groupe
// ────────────────────────────────────────────────────────────────────────────

interface RawActeur {
	uid: { '#text': string };
	etatCivil: {
		ident: { civ: string; prenom: string; nom: string };
		infoNaissance?: { dateNais?: string | null; villeNais?: string | null };
	};
	profession?: { libelleCourant?: string | null };
	mandats?: { mandat?: any | any[] };
}

interface RawMandat {
	'@xsi:type'?: string;
	uid?: string;
	acteurRef?: string;
	legislature?: string | null;
	typeOrgane?: string;
	dateDebut?: string;
	dateFin?: string | null;
	infosQualite?: { libQualite?: string };
	organes?: { organeRef?: string };
	mandature?: {
		datePriseFonction?: string;
		causeFin?: string | null;
		premiereElection?: string;
		placeHemicycle?: string;
	};
	election?: {
		lieu?: {
			region?: string;
			departement?: string;
			numDepartement?: string;
			numCirco?: string;
		};
	};
}

interface PartialPersonne {
	id: string;
	identite: Personne['identite'];
	mandatsByLeg: Map<number, Mandat>; // legislature → Mandat
}

async function parsePersonnesAndMandats(
	extractDir: string,
	groupesByLeg: Map<number, Groupe[]>
): Promise<Map<string, PartialPersonne>> {
	const acteurDir = join(extractDir, 'json', 'acteur');
	const { readdirSync } = await import('node:fs');

	const groupeIdsByLeg = new Map<number, Set<string>>();
	for (const [leg, list] of groupesByLeg) {
		groupeIdsByLeg.set(leg, new Set(list.map((g) => g.id)));
	}

	const personnes = new Map<string, PartialPersonne>();

	for (const file of readdirSync(acteurDir)) {
		const raw = JSON.parse(await readFile(join(acteurDir, file), 'utf8'));
		const a: RawActeur = raw.acteur;
		const id = a.uid['#text'];
		const allMandats = asArray(a.mandats?.mandat) as RawMandat[];

		// Pour chaque législature visée, retenir les mandats parlementaires
		// (typeOrgane=ASSEMBLEE) qui matchent.
		const mandatsByLeg = new Map<number, Mandat>();

		for (const leg of LEGISLATURES) {
			const mandatsParl = allMandats.filter(
				(m) =>
					m['@xsi:type'] === 'MandatParlementaire_type' &&
					m.typeOrgane === 'ASSEMBLEE' &&
					m.legislature === String(leg)
			);
			if (mandatsParl.length === 0) continue;

			// On prend le premier (typiquement il y en a un seul, ou plusieurs si
			// substitution successive — on garde le plus précoce dateDebut).
			mandatsParl.sort((x, y) => (x.dateDebut ?? '').localeCompare(y.dateDebut ?? ''));
			const parl = mandatsParl[0];

			const datePriseFonction = parl.mandature?.datePriseFonction ?? parl.dateDebut ?? '';
			const dateFinFonction = parl.dateFin ?? null;
			const lieu = parl.election?.lieu;

			// Extraire les appartenances GP de cette législature.
			const appartenances = extractAppartenancesGroupe(
				allMandats,
				leg,
				groupeIdsByLeg.get(leg)!,
				datePriseFonction
			);

			const mandat: Mandat = {
				legislature: leg,
				datePriseFonction,
				dateFinFonction,
				premiereElection: parl.mandature?.premiereElection === '1',
				circonscription: lieu
					? {
							dep: lieu.departement ?? '',
							depNum: lieu.numDepartement ?? '',
							num: lieu.numCirco ?? '',
							region: lieu.region ?? ''
						}
					: null,
				place: parl.mandature?.placeHemicycle
					? parseInt(parl.mandature.placeHemicycle, 10)
					: null,
				appartenancesGroupe: appartenances,
				scrutinsEligibles: 0, // rempli après parse scrutins
				stats: emptyStats(),
				rangs: emptyRangs(),
				badgesMandat: []
			};
			mandatsByLeg.set(leg, mandat);
		}

		if (mandatsByLeg.size === 0) continue;

		const ec = a.etatCivil.ident;
		const sexe: 'F' | 'M' = ec.civ === 'Mme' ? 'F' : 'M';

		personnes.set(id, {
			id,
			identite: {
				civ: ec.civ,
				prenom: ec.prenom,
				nom: ec.nom,
				sexe,
				dateNaissance: a.etatCivil.infoNaissance?.dateNais ?? null,
				villeNaissance: a.etatCivil.infoNaissance?.villeNais ?? null,
				photoUrl: photoUrl(id, mandatsByLeg),
				professionDeclaree: a.profession?.libelleCourant ?? null
			},
			mandatsByLeg
		});
	}

	return personnes;
}

/** URL de la photo officielle. Préférer la législature la plus récente où la
 *  personne a siégé (les photos sont versionnées par législature côté AN). */
function photoUrl(id: string, mandatsByLeg: Map<number, Mandat>): string {
	const legs = [...mandatsByLeg.keys()].sort((a, b) => b - a);
	const leg = legs[0] ?? 17;
	const num = id.replace(/^PA/, '');
	return `https://www2.assemblee-nationale.fr/static/tribun/${leg}/photos/${num}.jpg`;
}

/**
 * Enrichit les mandats existants avec les champs précis venus d'AMO10/AMO20
 * (cf ADR 0019). Lecture par législature : pour chaque acteur trouvé dans la
 * source d'enrichissement, on cherche son mandat parlementaire de la légis.
 * et on remplace les champs `place`/`circonscription`/`premiereElection`
 * quand AMO30 n'avait que des valeurs nulles ou moins précises.
 *
 * Renvoie un compteur de champs enrichis (pour log).
 */
async function enrichMandatsFromSource(
	extractDir: string,
	leg: number,
	personnes: Map<string, PartialPersonne>
): Promise<{ placeAjoute: number; circoAjoutee: number; total: number }> {
	const acteurDir = join(extractDir, 'json', 'acteur');
	const { readdirSync } = await import('node:fs');
	if (!existsSync(acteurDir)) {
		console.log(`    ⚠ pas de dossier acteur dans la source d'enrichissement leg ${leg}`);
		return { placeAjoute: 0, circoAjoutee: 0, total: 0 };
	}

	let placeAjoute = 0;
	let circoAjoutee = 0;
	let total = 0;

	for (const file of readdirSync(acteurDir)) {
		const raw = JSON.parse(await readFile(join(acteurDir, file), 'utf8'));
		const a: RawActeur = raw.acteur;
		const id = a.uid['#text'];
		const partial = personnes.get(id);
		if (!partial) continue;
		const m = partial.mandatsByLeg.get(leg);
		if (!m) continue;

		const allMandats = asArray(a.mandats?.mandat) as RawMandat[];
		const mandatsParl = allMandats.filter(
			(md) =>
				md['@xsi:type'] === 'MandatParlementaire_type' &&
				md.typeOrgane === 'ASSEMBLEE' &&
				md.legislature === String(leg)
		);
		if (mandatsParl.length === 0) continue;
		mandatsParl.sort((x, y) => (x.dateDebut ?? '').localeCompare(y.dateDebut ?? ''));
		const parl = mandatsParl[0];

		// placeHemicycle : remplace si AMO30 n'avait pas de place et que la nouvelle source en a une.
		const newPlace = parl.mandature?.placeHemicycle
			? parseInt(parl.mandature.placeHemicycle, 10)
			: null;
		if (newPlace !== null && !Number.isNaN(newPlace) && m.place === null) {
			m.place = newPlace;
			placeAjoute++;
		}

		// Circonscription : si AMO30 ne l'avait pas mais la nouvelle source oui.
		if (m.circonscription === null && parl.election?.lieu) {
			const lieu = parl.election.lieu;
			m.circonscription = {
				dep: lieu.departement ?? '',
				depNum: lieu.numDepartement ?? '',
				num: lieu.numCirco ?? '',
				region: lieu.region ?? ''
			};
			circoAjoutee++;
		}

		total++;
	}

	return { placeAjoute, circoAjoutee, total };
}

/** Extrait, dédoublonne et marque les appartenances GP d'une législature donnée.
 *  - Filtre sur typeOrgane=GP + organeRef ∈ groupes connus de la législature
 *  - Dédoublonne sur (organeRef, dateDebut) en gardant la qualité la plus haute
 *  - Marque isTransitoireNI = true pour les mandats NI ≤ 7 jours en début de législature
 *  - Trie chronologiquement
 */
function extractAppartenancesGroupe(
	mandats: RawMandat[],
	legislature: number,
	groupeIds: Set<string>,
	legDatePriseFonction: string
): AppartenanceGroupe[] {
	const candidats = mandats.filter((m) => {
		if (m['@xsi:type'] !== 'MandatSimple_Type') return false;
		if (m.typeOrgane !== 'GP') return false;
		const ref = m.organes?.organeRef;
		if (!ref) return false;
		// On filtre sur l'appartenance au set de groupes de cette législature.
		// Le champ m.legislature est parfois absent, on s'en passe.
		return groupeIds.has(ref);
	});

	// Dédoublonnage sur (organeRef, dateDebut) — garder la qualité la plus haute.
	const dedupKey = (m: RawMandat) => `${m.organes?.organeRef}|${m.dateDebut}`;
	const best = new Map<string, RawMandat>();
	for (const m of candidats) {
		const k = dedupKey(m);
		const cur = best.get(k);
		if (!cur || qualiteRank(m.infosQualite?.libQualite) > qualiteRank(cur.infosQualite?.libQualite)) {
			best.set(k, m);
		}
	}

	const out: AppartenanceGroupe[] = [];
	for (const m of best.values()) {
		const dateDebut = m.dateDebut!;
		const dateFin = m.dateFin ?? null;
		const qualite = m.infosQualite?.libQualite ?? 'Membre';

		// NI-bridge : appartenance "Député non-inscrit" courte au tout début de la législature.
		const isNI = qualite.toLowerCase().includes('non-inscrit');
		const isAtStart = legDatePriseFonction
			? Math.abs(daysBetween(legDatePriseFonction, dateDebut)) <= 1
			: false;
		const duration =
			dateFin && dateDebut ? daysBetween(dateDebut, dateFin) : Number.POSITIVE_INFINITY;
		const isTransitoireNI = isNI && isAtStart && duration <= NI_BRIDGE_MAX_DURATION_DAYS;

		out.push({
			groupeId: m.organes!.organeRef!,
			dateDebut,
			dateFin,
			qualite,
			isTransitoireNI
		});
	}

	out.sort((x, y) => x.dateDebut.localeCompare(y.dateDebut));
	return out;
}

// ────────────────────────────────────────────────────────────────────────────
// Étape 3 — parse scrutins (un export par législature)
// ────────────────────────────────────────────────────────────────────────────

async function parseScrutins(extractDir: string, legislature: number) {
	const dir = join(extractDir, 'json');
	const { readdirSync } = await import('node:fs');
	const files = readdirSync(dir).filter((f) => f.startsWith('VTANR') && f.endsWith('.json'));

	const index: ScrutinIndex[] = [];
	const details = new Map<string, ScrutinDetail>();
	/** Données ancillaires nécessaires à l'agrégation des textes (cf textes-an.ts).
	 *  Conservées séparément pour ne pas alourdir ScrutinIndex public. */
	const aggregInputs: ScrutinPourAgreg[] = [];

	for (const file of files) {
		const raw = JSON.parse(await readFile(join(dir, file), 'utf8'));
		const s = raw.scrutin;
		const decompte = s.syntheseVote?.decompte;
		const dossierRef: string | null = s.objet?.dossierLegislatif?.dossierRef ?? null;
		const typeVote: string = s.typeVote?.libelleTypeVote ?? 'inconnu';

		const idx: ScrutinIndex = {
			uid: s.uid,
			legislature,
			numero: parseInt(s.numero, 10),
			date: s.dateScrutin,
			titre: s.titre ?? s.objet?.libelle ?? '(sans titre)',
			sort: s.sort?.code ?? 'inconnu',
			pour: parseInt(decompte?.pour ?? '0', 10),
			contre: parseInt(decompte?.contre ?? '0', 10),
			abstention: parseInt(decompte?.abstentions ?? '0', 10),
			demandeur: s.demandeur?.texte ?? null,
			texteId: null // rempli après agrégation (cf main)
		};
		index.push(idx);
		aggregInputs.push({
			uid: idx.uid,
			legislature,
			date: idx.date,
			titre: idx.titre,
			dossierRef,
			typeVote,
			sort: idx.sort
		});

		const votes: Record<string, VotePosition> = {};
		const groupesVent: ScrutinDetail['groupes'] = [];
		const frondeurs: string[] = [];
		const groupesArr = asArray(s.ventilationVotes?.organe?.groupes?.groupe);

		for (const g of groupesArr) {
			const dn = g.vote?.decompteNominatif ?? {};
			const decompteG = g.vote?.decompteVoix ?? {};
			const positionMaj = g.vote?.positionMajoritaire as string | undefined;

			const collect = (nodes: any, position: VotePosition) => {
				for (const v of asArray(nodes?.votant)) {
					if (!v?.acteurRef) continue;
					votes[v.acteurRef] = position;
					if (
						(position === 'pour' || position === 'contre') &&
						(positionMaj === 'pour' || positionMaj === 'contre') &&
						position !== positionMaj
					) {
						frondeurs.push(v.acteurRef);
					}
				}
			};
			collect(dn.pours, 'pour');
			collect(dn.contres, 'contre');
			collect(dn.abstentions, 'abstention');
			collect(dn.nonVotants, 'nonVotant');

			groupesVent.push({
				id: g.organeRef,
				effectif: parseInt(g.nombreMembresGroupe ?? '0', 10),
				positionMajoritaire: positionMaj ?? 'abstention',
				decompte: {
					pour: parseInt(decompteG.pour ?? '0', 10),
					contre: parseInt(decompteG.contre ?? '0', 10),
					abstention: parseInt(decompteG.abstentions ?? '0', 10),
					nonVotant: parseInt(decompteG.nonVotants ?? '0', 10)
				}
			});
		}

		details.set(s.uid, {
			...idx,
			objet: s.objet?.libelle ?? idx.titre,
			typeVote,
			votes,
			groupes: groupesVent,
			frondeurs
		});
	}

	return { index, details, aggregInputs };
}

// ────────────────────────────────────────────────────────────────────────────
// Étape 4 — calcul stats par mandat + cumul carrière + rangs + badges
// ────────────────────────────────────────────────────────────────────────────

function emptyStats(): MandatStats {
	return {
		presence: { numerator: 0, denominator: 0, rate: 0 },
		participation: { numerator: 0, denominator: 0, rate: 0 },
		loyaute: { numerator: 0, denominator: 0, rate: null },
		frondes: { count: 0, rate: 0 },
		overall: 0,
		volume: 0
	};
}

function emptyRangs(): MandatRangs {
	return {
		presence: { rank: 0, total: 0 },
		participation: { rank: 0, total: 0 },
		loyaute: { rank: null, total: 0 },
		frondes: { rank: 0, total: 0 }
	};
}

interface ComputedHistoriques {
	historiques: Map<string, VoteHistoryItem[]>;
}

/** Parcourt les scrutins d'une législature et accumule les stats sur chaque mandat correspondant. */
function computeStatsForLegislature(
	legislature: number,
	personnes: Map<string, PartialPersonne>,
	scrutinsIndex: ScrutinIndex[],
	scrutinsDetails: Map<string, ScrutinDetail>,
	historiques: Map<string, VoteHistoryItem[]>
) {
	// Tri chronologique croissant pour l'historique
	const sorted = [...scrutinsIndex].sort((a, b) =>
		a.date < b.date ? -1 : a.date > b.date ? 1 : a.numero - b.numero
	);

	for (const idx of sorted) {
		const detail = scrutinsDetails.get(idx.uid);
		if (!detail) continue;
		const frondeurSet = new Set(detail.frondeurs);

		for (const p of personnes.values()) {
			const mandat = p.mandatsByLeg.get(legislature);
			if (!mandat) continue;
			// Éligibilité : scrutin date >= datePriseFonction du mandat (ADR 0006)
			if (mandat.datePriseFonction && idx.date < mandat.datePriseFonction) continue;

			mandat.scrutinsEligibles += 1;
			const position = detail.votes[p.id];
			const isFronde = frondeurSet.has(p.id);

			const stats = mandat.stats;
			// Présence = position connue (pas 'absent')
			if (position) stats.presence.numerator += 1;
			// Participation = vote exprimé (pour/contre/abstention)
			if (position === 'pour' || position === 'contre' || position === 'abstention') {
				stats.participation.numerator += 1;
			}

			if (isFronde) stats.frondes.count += 1;

			// Loyauté : groupe au moment du vote (cf ADR 0016) → on cherche
			// l'appartenance qui couvre idx.date
			const groupeAuVote = appartenanceAuVote(mandat.appartenancesGroupe, idx.date);
			if (groupeAuVote && (position === 'pour' || position === 'contre')) {
				const grpDetail = detail.groupes.find((g) => g.id === groupeAuVote.groupeId);
				const maj = grpDetail?.positionMajoritaire;
				if (maj === 'pour' || maj === 'contre') {
					stats.loyaute.denominator += 1;
					if (position === maj) stats.loyaute.numerator += 1;
				}
			}

			// Historique compact
			if (position) {
				const histList = historiques.get(p.id) ?? [];
				histList.push([idx.uid, position, isFronde ? 1 : 0, legislature]);
				historiques.set(p.id, histList);
			}
		}
	}
}

/** Retourne l'appartenance groupe qui couvre la date donnée, ou null si aucune
 *  (ne renvoie pas le NI-bridge transitoire, qui ne doit pas servir au calcul de loyauté). */
function appartenanceAuVote(
	apps: AppartenanceGroupe[],
	date: string
): AppartenanceGroupe | null {
	for (const a of apps) {
		if (a.isTransitoireNI) continue;
		if (a.dateDebut > date) continue;
		if (a.dateFin && a.dateFin < date) continue;
		return a;
	}
	return null;
}

/** Finalise les ratios stats sur chaque mandat. */
function finalizeMandatStats(personne: PartialPersonne) {
	for (const mandat of personne.mandatsByLeg.values()) {
		const s = mandat.stats;
		const elig = mandat.scrutinsEligibles;
		s.presence.denominator = elig;
		s.presence.rate = elig > 0 ? s.presence.numerator / elig : 0;
		s.participation.denominator = elig;
		s.participation.rate = elig > 0 ? s.participation.numerator / elig : 0;
		s.loyaute.rate =
			s.loyaute.denominator > 0 ? s.loyaute.numerator / s.loyaute.denominator : null;
		s.frondes.rate = s.participation.numerator > 0 ? s.frondes.count / s.participation.numerator : 0;
	}
}

/** Calcule rangs (par législature, dense rank) sur la cohorte des personnes
 *  ayant un mandat dans cette législature. */
function computeRangsForLegislature(
	legislature: number,
	personnes: Map<string, PartialPersonne>
) {
	const cohort: Mandat[] = [];
	for (const p of personnes.values()) {
		const m = p.mandatsByLeg.get(legislature);
		if (m) cohort.push(m);
	}
	const total = cohort.length;
	for (const m of cohort) {
		m.rangs.presence.total = total;
		m.rangs.participation.total = total;
		m.rangs.loyaute.total = total;
		m.rangs.frondes.total = total;
	}

	const denseRank = (
		key: 'presence' | 'participation' | 'loyaute' | 'frondes',
		valueFn: (m: Mandat) => number | null,
		desc: boolean
	) => {
		const sorted = [...cohort].sort((a, b) => {
			const va = valueFn(a);
			const vb = valueFn(b);
			if (va === null && vb === null) return 0;
			if (va === null) return 1;
			if (vb === null) return -1;
			if (va === vb) return 0;
			return desc ? (va < vb ? 1 : -1) : va < vb ? -1 : 1;
		});
		let rank = 0;
		let lastVal: number | null | undefined = undefined;
		for (let i = 0; i < sorted.length; i++) {
			const v = valueFn(sorted[i]);
			if (v === null) {
				sorted[i].rangs[key].rank = null as never;
				continue;
			}
			if (v !== lastVal) {
				rank = i + 1;
				lastVal = v;
			}
			sorted[i].rangs[key].rank = rank as never;
		}
	};

	denseRank('presence', (m) => m.stats.presence.rate, true);
	denseRank('participation', (m) => m.stats.participation.rate, true);
	denseRank('loyaute', (m) => m.stats.loyaute.rate, true);
	denseRank('frondes', (m) => m.stats.frondes.count, true);
}

/** Calcul des badges mandat (top 10% / bottom 10% par législature). */
function computeBadgesMandat(legislature: number, personnes: Map<string, PartialPersonne>) {
	const cohort: Mandat[] = [];
	for (const p of personnes.values()) {
		const m = p.mandatsByLeg.get(legislature);
		if (m) cohort.push(m);
	}
	const top10 = (n: number) => Math.max(1, Math.floor(n * 0.1));
	const total = cohort.length;
	const t = top10(total);

	// Présence en or
	const sortPres = [...cohort].sort((a, b) => b.stats.presence.rate - a.stats.presence.rate);
	for (let i = 0; i < t; i++) sortPres[i].badgesMandat.push('presence-or');
	// Absent remarquable
	for (let i = total - t; i < total; i++) sortPres[i].badgesMandat.push('absent-remarquable');

	// Top loyaliste
	const withLoy = cohort.filter((m) => m.stats.loyaute.rate !== null);
	const sortLoy = [...withLoy].sort(
		(a, b) => (b.stats.loyaute.rate ?? 0) - (a.stats.loyaute.rate ?? 0)
	);
	const tLoy = top10(withLoy.length);
	for (let i = 0; i < tLoy; i++) sortLoy[i].badgesMandat.push('top-loyaliste');

	// Frondeur (top 10% en nombre absolu de frondes)
	const sortFr = [...cohort].sort((a, b) => b.stats.frondes.count - a.stats.frondes.count);
	for (let i = 0; i < t; i++) {
		if (sortFr[i].stats.frondes.count > 0) sortFr[i].badgesMandat.push('frondeur');
	}
}

// ────────────────────────────────────────────────────────────────────────────
// Score Overall (cf ADR 0022) — sémantique d'exemplarité du parlementaire
// ────────────────────────────────────────────────────────────────────────────

const OVERALL_W_PARTICIPATION = 0.55;
const OVERALL_W_VOLUME = 0.35;
const OVERALL_W_PRESENCE = 0.10;

/** Centile 95 d'une série de nombres (≥ 0). Retourne 0 si la série est vide. */
function percentile95(values: number[]): number {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	// Index linéaire : floor(0.95 * (n - 1)). Pour n=20 → 18ᵉ (index 18, soit la 19ᵉ valeur).
	const idx = Math.floor(0.95 * (sorted.length - 1));
	return sorted[idx];
}

function overallScore(
	participationRate: number,
	presenceRate: number,
	scrutinsVotes: number,
	volumeRef: number
): { overall: number; volume: number } {
	const volume = volumeRef > 0 ? Math.min(1, scrutinsVotes / volumeRef) : 0;
	const score =
		OVERALL_W_PARTICIPATION * participationRate +
		OVERALL_W_VOLUME * volume +
		OVERALL_W_PRESENCE * presenceRate;
	return { overall: Math.round(score * 99), volume };
}

/** Calcul des overalls par législature (mandats). volumeRef = centile 95
 *  du nb de scrutins votés (participation.numerator) sur la cohorte de la législature. */
function computeOverallsForLegislature(
	legislature: number,
	personnes: Map<string, PartialPersonne>
) {
	const cohort: Mandat[] = [];
	for (const p of personnes.values()) {
		const m = p.mandatsByLeg.get(legislature);
		if (m) cohort.push(m);
	}
	const volumeRef = percentile95(cohort.map((m) => m.stats.participation.numerator));
	for (const m of cohort) {
		const { overall, volume } = overallScore(
			m.stats.participation.rate,
			m.stats.presence.rate,
			m.stats.participation.numerator,
			volumeRef
		);
		m.stats.overall = overall;
		m.stats.volume = volume;
	}
}

/** Calcul de la moyenne d'overall par groupe politique pour une législature donnée.
 *  Rattachement = groupe principal (premier appartenance stable hors NI-bridge, cf ADR 0016).
 *  Cohérent avec la convention de la page /classements/.  */
function finalizeGroupesOveralls(
	groupesByLeg: Map<number, Groupe[]>,
	personnes: Map<string, PartialPersonne>
) {
	for (const [leg, groupes] of groupesByLeg) {
		const sumByGroup = new Map<string, { sum: number; count: number }>();
		for (const g of groupes) sumByGroup.set(g.id, { sum: 0, count: 0 });

		for (const p of personnes.values()) {
			const m = p.mandatsByLeg.get(leg);
			if (!m) continue;
			// Groupe principal = première appartenance stable (hors NI-bridge transitoire)
			const principal = m.appartenancesGroupe.find((a) => !a.isTransitoireNI);
			if (!principal) continue;
			const acc = sumByGroup.get(principal.groupeId);
			if (!acc) continue;
			acc.sum += m.stats.overall;
			acc.count += 1;
		}

		for (const g of groupes) {
			const acc = sumByGroup.get(g.id)!;
			g.overallEffectif = acc.count;
			g.overallMoyen = acc.count > 0 ? Math.round(acc.sum / acc.count) : 0;
		}
	}
}

/** Calcul des overalls carrière. volumeRef = centile 95 du nb de scrutins votés
 *  cumulés (toutes législatures confondues) sur l'ensemble des personnes. */
function computeOverallsCarriere(personnes: Personne[]) {
	const volumeRef = percentile95(personnes.map((p) => p.carriere.participation.numerator));
	for (const p of personnes) {
		const { overall, volume } = overallScore(
			p.carriere.participation.rate,
			p.carriere.presence.rate,
			p.carriere.participation.numerator,
			volumeRef
		);
		p.carriere.overall = overall;
		p.carriere.volume = volume;
	}
}

/** Calcul de la carrière agrégée (cumul pondéré, cf ADR 0017) + badges carrière. */
function computeCarriere(personne: PartialPersonne, famillesIdx: FamillesIndex): CarriereAggregee {
	const mandats = [...personne.mandatsByLeg.values()];
	const carriere: CarriereAggregee = {
		presence: { numerator: 0, denominator: 0, rate: 0 },
		participation: { numerator: 0, denominator: 0, rate: 0 },
		loyaute: { numerator: 0, denominator: 0, rate: null },
		frondes: { count: 0, rate: 0 },
		nbMandats: mandats.length,
		legislatures: mandats.map((m) => m.legislature).sort((a, b) => a - b),
		badgesCarriere: [],
		overall: 0,
		volume: 0
	};

	for (const m of mandats) {
		carriere.presence.numerator += m.stats.presence.numerator;
		carriere.presence.denominator += m.stats.presence.denominator;
		carriere.participation.numerator += m.stats.participation.numerator;
		carriere.participation.denominator += m.stats.participation.denominator;
		carriere.loyaute.numerator += m.stats.loyaute.numerator;
		carriere.loyaute.denominator += m.stats.loyaute.denominator;
		carriere.frondes.count += m.stats.frondes.count;
	}
	carriere.presence.rate =
		carriere.presence.denominator > 0
			? carriere.presence.numerator / carriere.presence.denominator
			: 0;
	carriere.participation.rate =
		carriere.participation.denominator > 0
			? carriere.participation.numerator / carriere.participation.denominator
			: 0;
	carriere.loyaute.rate =
		carriere.loyaute.denominator > 0
			? carriere.loyaute.numerator / carriere.loyaute.denominator
			: null;
	carriere.frondes.rate =
		carriere.participation.numerator > 0
			? carriere.frondes.count / carriere.participation.numerator
			: 0;

	// Badges carrière
	if (mandats.length >= 2) carriere.badgesCarriere.push('reelu');
	if (mandats.length >= 3) carriere.badgesCarriere.push('veteran');

	// Recomposition : famille politique principale de chaque mandat différente
	// du précédent. La comparaison passe par la table `groupes-familles.json`
	// (cf ADR 0034) pour neutraliser les renommages d'un même parti entre
	// législatures (LFI/LFI-NUPES/LFI-NFP, LaREM/RE/EPR, MODEM/Dem, etc.).
	if (mandats.length >= 2) {
		const sorted = [...mandats].sort((a, b) => a.legislature - b.legislature);
		const familleOf = (m: Mandat): string | null => {
			const stable = m.appartenancesGroupe.find((a) => !a.isTransitoireNI);
			if (!stable?.groupeId) return null;
			return familleAN(famillesIdx, stable.groupeId);
		};
		for (let i = 1; i < sorted.length; i++) {
			const prev = familleOf(sorted[i - 1]);
			const cur = familleOf(sorted[i]);
			if (prev && cur && prev !== cur) {
				carriere.badgesCarriere.push('recomposition');
				break;
			}
		}
	}

	// Transfuge : ≥ 2 **familles politiques** distinctes en cours de mandat
	// (cf ADR 0016 + ADR 0034). On compare les familles (et non les `groupeId`
	// bruts) pour neutraliser :
	//   - les renommages d'un même parti à mi-mandat (MODEM → Dem en 15ᵉ),
	//   - les passages NI temporaires (membre du gouvernement qui suspend),
	//   - les NI transitoires de début de législature.
	// Sans cette garde, Géraldine Bannier passant de MODEM (PO730970) à Dem
	// (PO774834) en 15ᵉ — même famille — comptait comme transfuge.
	const NI_GROUPS = new Set(['PO723569', 'PO793087', 'PO840056']);
	for (const m of mandats) {
		const familles = new Set<string>();
		for (const a of m.appartenancesGroupe) {
			if (a.isTransitoireNI) continue;
			if (NI_GROUPS.has(a.groupeId)) continue;
			const fam = familleAN(famillesIdx, a.groupeId);
			familles.add(fam);
		}
		if (familles.size >= 2) {
			carriere.badgesCarriere.push('transfuge');
			break;
		}
	}

	return carriere;
}

// ────────────────────────────────────────────────────────────────────────────
// Étape 5 — finalisation des Groupes (effectifs + président)
// ────────────────────────────────────────────────────────────────────────────

function finalizeGroupes(
	groupesByLeg: Map<number, Groupe[]>,
	personnes: Map<string, PartialPersonne>
) {
	for (const [leg, groupes] of groupesByLeg) {
		const byId = new Map(groupes.map((g) => [g.id, g]));

		for (const p of personnes.values()) {
			const m = p.mandatsByLeg.get(leg);
			if (!m) continue;

			// L'effectif final est l'appartenance stable la plus récente (qui couvre
			// la fin du mandat ou est encore ouverte).
			const lastStable = [...m.appartenancesGroupe]
				.filter((a) => !a.isTransitoireNI)
				.pop();
			if (lastStable) {
				const g = byId.get(lastStable.groupeId);
				if (g) g.effectifFin += 1;
			}

			// Présidence : on cherche une appartenance avec qualité "Président" et
			// dateFin null (ou la plus récente).
			for (const a of m.appartenancesGroupe) {
				const q = (a.qualite ?? '').toLowerCase();
				if (q.includes('président') && !q.includes('vice')) {
					const g = byId.get(a.groupeId);
					if (g && !g.presidentId) g.presidentId = p.id;
				}
			}
		}
	}
}

// ────────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────────

async function main() {
	console.log('🏛️  PolitiDex — pipeline data multi-législature');
	console.log(`   Législatures couvertes : ${LEGISLATURES.join(', ')}\n`);

	await ensureDir(CACHE_DIR);
	await ensureDir(OUT_DIR);
	await ensureDir(join(OUT_DIR, 'scrutins'));
	await ensureDir(join(OUT_DIR, 'groupes'));
	await ensureDir(join(OUT_DIR, 'historique'));

	// Table de familles politiques (cf ADR 0034) — utilisée par computeCarriere
	// pour neutraliser les renommages de groupes (LFI-NUPES → LFI-NFP, etc.).
	const famillesPath = join(ROOT, 'static', 'data', 'groupes-familles.json');
	const famillesManifest = JSON.parse(
		await readFile(famillesPath, 'utf8')
	) as FamillesManifest;
	const famillesIdx = buildFamillesIndex(famillesManifest);
	console.log(
		`   Familles politiques : ${Object.keys(famillesManifest.familles).length} familles, ${famillesIdx.an.size} groupes AN mappés\n`
	);

	// ── Stage 1 : download
	console.log('1/5  Téléchargement des sources');
	const acteursZip = join(CACHE_DIR, 'acteurs-historique.json.zip');
	await downloadZip(SOURCE_ACTEURS, acteursZip);

	const scrutinsZips = new Map<number, string>();
	for (const leg of LEGISLATURES) {
		const zp = join(CACHE_DIR, `scrutins-${leg}.json.zip`);
		await downloadZip(sourceScrutins(leg), zp);
		scrutinsZips.set(leg, zp);
	}

	// Sources d'enrichissement (AMO10/AMO20) — cf ADR 0019
	const enrichZips = new Map<number, string>();
	for (const [leg, url] of SOURCES_ENRICHISSEMENT) {
		if (!LEGISLATURES.includes(leg)) continue;
		const zp = join(CACHE_DIR, `enrich-${leg}.json.zip`);
		await downloadZip(url, zp);
		enrichZips.set(leg, zp);
	}

	// Dump dossiers parlementaires (~9 MB) — métadonnées des textes législatifs
	const dossiersZip = join(CACHE_DIR, 'dossiers-an.json.zip');
	await downloadZip(SOURCE_DOSSIERS, dossiersZip);

	// ── Stage 2 : extract (réutilise les dossiers si le ZIP n'a pas bougé)
	console.log('\n2/5  Extraction');
	const acteursDir = join(CACHE_DIR, 'acteurs-extracted');
	await extractIfNeeded(acteursZip, acteursDir, 'json/acteur', 50, 'acteurs');

	const scrutinsDirs = new Map<number, string>();
	for (const leg of LEGISLATURES) {
		const sd = join(CACHE_DIR, `scrutins-${leg}-extracted`);
		await extractIfNeeded(scrutinsZips.get(leg)!, sd, 'json', 50, `scrutins ${leg}`);
		scrutinsDirs.set(leg, sd);
	}

	const enrichDirs = new Map<number, string>();
	for (const [leg, zp] of enrichZips) {
		const ed = join(CACHE_DIR, `enrich-${leg}-extracted`);
		try {
			await extractIfNeeded(zp, ed, 'json/acteur', 50, `enrich ${leg}`);
		} catch (err) {
			console.log(`    ⚠ extraction enrich-${leg} : ${(err as Error).message}`);
		}
		enrichDirs.set(leg, ed);
	}

	const dossiersDir = join(CACHE_DIR, 'dossiers-an-extracted');
	await extractIfNeeded(dossiersZip, dossiersDir, 'json/dossierParlementaire', 50, 'dossiers AN');

	// ── Stage 3 : transform — groupes + personnes + mandats
	console.log('\n3/5  Transformation');
	console.log('  • Groupes politiques par législature…');
	const groupesByLeg = await parseGroupes(acteursDir);
	for (const [leg, list] of groupesByLeg) {
		console.log(`    → ${list.length} groupes en ${leg}ᵉ`);
	}

	console.log('  • Personnes + mandats parlementaires + appartenances groupe…');
	const personnes = await parsePersonnesAndMandats(acteursDir, groupesByLeg);
	console.log(`    → ${personnes.size} personnes uniques sur ${LEGISLATURES.join('+')}`);
	const mandatsTotal = [...personnes.values()].reduce((s, p) => s + p.mandatsByLeg.size, 0);
	console.log(`    → ${mandatsTotal} mandats total`);

	// Passe d'enrichissement AMO10/AMO20 (cf ADR 0019) : on remplit les champs
	// que AMO30 historique laisse souvent vides pour les mandats clos (placeHemicycle).
	console.log('  • Enrichissement AMO10/AMO20 (places hémicycle, etc.)…');
	for (const [leg, dir] of enrichDirs) {
		if (!existsSync(join(dir, 'json', 'acteur'))) {
			console.log(`    ⚠ enrich-${leg} non disponible, skip`);
			continue;
		}
		const stats = await enrichMandatsFromSource(dir, leg, personnes);
		console.log(
			`    → leg ${leg} : ${stats.placeAjoute} places ajoutées, ${stats.circoAjoutee} circo ajoutées (${stats.total} mandats croisés)`
		);
	}

	// ── Stage 4 : scrutins + stats par législature
	console.log('\n4/5  Scrutins et calcul des stats');
	const allScrutinsIndex: ScrutinIndex[] = [];
	const allScrutinsDetails = new Map<string, ScrutinDetail>();
	const historiques = new Map<string, VoteHistoryItem[]>();
	/** Entrées d'agrégation collectées sur toutes les législatures (cf textes-an.ts). */
	const allAggregInputs: ScrutinPourAgreg[] = [];

	for (const leg of LEGISLATURES) {
		console.log(`  • Scrutins ${leg}ᵉ…`);
		const t0 = Date.now();
		const { index, details, aggregInputs } = await parseScrutins(scrutinsDirs.get(leg)!, leg);
		console.log(`    → ${index.length} scrutins en ${((Date.now() - t0) / 1000).toFixed(1)}s`);
		allScrutinsIndex.push(...index);
		for (const [u, d] of details) allScrutinsDetails.set(u, d);
		allAggregInputs.push(...aggregInputs);

		console.log(`    • Stats sur les mandats ${leg}ᵉ…`);
		computeStatsForLegislature(leg, personnes, index, details, historiques);
	}

	// Agrégation des textes législatifs (croise scrutins + dump dossiers)
	console.log('\n  • Agrégation des textes législatifs…');
	const dossiersDirJson = join(dossiersDir, 'json', 'dossierParlementaire');
	const dossiers = await parseDossiersDir(dossiersDirJson, new Set(LEGISLATURES));
	console.log(`    → ${dossiers.length} dossiers parlementaires retenus (légis ${LEGISLATURES.join('+')})`);
	const { textes, scrutinToTexte } = aggregeTextesAN(allAggregInputs, dossiers);
	const nbEnrichis = textes.filter((t) => t.enrichiDossiersAN).length;
	console.log(
		`    → ${textes.length} textes (${nbEnrichis} enrichis par le dump dossiers, ${textes.length - nbEnrichis} sur signature seule)`
	);
	// Injection des texteId dans les index et les details
	for (const idx of allScrutinsIndex) {
		idx.texteId = scrutinToTexte.get(idx.uid) ?? null;
	}
	for (const detail of allScrutinsDetails.values()) {
		detail.texteId = scrutinToTexte.get(detail.uid) ?? null;
	}

	// Finalisation des stats puis rangs, badges et overalls mandat par législature
	for (const p of personnes.values()) finalizeMandatStats(p);
	for (const leg of LEGISLATURES) {
		computeRangsForLegislature(leg, personnes);
		computeBadgesMandat(leg, personnes);
		computeOverallsForLegislature(leg, personnes);
	}

	// Carrière agrégée + badges carrière
	const personnesFull: Personne[] = [];
	for (const p of personnes.values()) {
		const carriere = computeCarriere(p, famillesIdx);
		const mandats = [...p.mandatsByLeg.values()].sort((a, b) => a.legislature - b.legislature);
		personnesFull.push({
			id: p.id,
			identite: p.identite,
			mandats,
			carriere
		});
	}
	personnesFull.sort((a, b) => a.identite.nom.localeCompare(b.identite.nom));

	// Overall carrière (cohorte = toutes personnes, volumeRef = centile 95 cumulé)
	computeOverallsCarriere(personnesFull);

	// Finalisation des groupes (effectif + président) — utilise les appartenances déjà calculées
	finalizeGroupes(groupesByLeg, personnes);

	// Moyenne d'overall par groupe (championnat des groupes, cf ADR 0022)
	finalizeGroupesOveralls(groupesByLeg, personnes);

	// Index scrutins trié desc (plus récent en premier)
	allScrutinsIndex.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.numero - a.numero));

	// Reverse historiques (plus récent en premier) après accumulation chronologique
	for (const list of historiques.values()) list.reverse();

	// ── Stage 5 : write output
	console.log('\n5/5  Écriture des fichiers JSON');

	await writeFile(join(OUT_DIR, 'personnes.json'), JSON.stringify(personnesFull));
	console.log(`  ✓ personnes.json (${personnesFull.length} personnes)`);

	for (const [leg, list] of groupesByLeg) {
		await writeFile(join(OUT_DIR, 'groupes', `${leg}.json`), JSON.stringify(list));
	}
	console.log(`  ✓ groupes/{${LEGISLATURES.join(',')}}.json`);

	const legislaturesMeta: LegislatureMeta[] = LEGISLATURES.map((leg) => {
		const personnesLeg = personnesFull.filter((p) =>
			p.mandats.some((m) => m.legislature === leg)
		);
		const scrutinsLeg = allScrutinsIndex.filter((s) => s.legislature === leg);
		const dates = personnesLeg.flatMap((p) =>
			p.mandats.filter((m) => m.legislature === leg).map((m) => m.datePriseFonction)
		);
		const dateDebut = dates.sort()[0] ?? '';
		const finsConnues = personnesLeg
			.flatMap((p) => p.mandats.filter((m) => m.legislature === leg).map((m) => m.dateFinFonction))
			.filter((d): d is string => !!d);
		const dateFin = finsConnues.length > 0 ? finsConnues.sort().reverse()[0] : null;
		return {
			num: leg,
			dateDebut,
			dateFin,
			nbPersonnes: personnesLeg.length,
			nbScrutins: scrutinsLeg.length
		};
	});
	await writeFile(join(OUT_DIR, 'legislatures.json'), JSON.stringify(legislaturesMeta));
	console.log(`  ✓ legislatures.json`);

	await writeFile(join(OUT_DIR, 'scrutins-index.json'), JSON.stringify(allScrutinsIndex));
	console.log(`  ✓ scrutins-index.json (${allScrutinsIndex.length} scrutins)`);

	await writeFile(join(OUT_DIR, 'textes.json'), JSON.stringify(textes));
	console.log(`  ✓ textes.json (${textes.length} textes)`);

	let written = 0;
	for (const [uid, detail] of allScrutinsDetails) {
		await writeFile(join(OUT_DIR, 'scrutins', `${uid}.json`), JSON.stringify(detail));
		written++;
		if (written % 1000 === 0) console.log(`    … scrutins ${written}/${allScrutinsDetails.size}`);
	}
	console.log(`  ✓ scrutins/{uid}.json (${written} fichiers)`);

	let histWritten = 0;
	for (const [paId, list] of historiques) {
		await writeFile(join(OUT_DIR, 'historique', `${paId}.json`), JSON.stringify(list));
		histWritten++;
		if (histWritten % 200 === 0) console.log(`    … historiques ${histWritten}/${historiques.size}`);
	}
	console.log(`  ✓ historique/{paId}.json (${histWritten} fichiers)`);

	const meta: BuildMeta = {
		generatedAt: new Date().toISOString(),
		legislatures: LEGISLATURES,
		counts: {
			personnes: personnesFull.length,
			mandats: mandatsTotal,
			groupes: [...groupesByLeg.values()].reduce((s, l) => s + l.length, 0),
			scrutins: allScrutinsIndex.length,
			textes: textes.length
		},
		sources: {
			acteurs: SOURCE_ACTEURS,
			dossiers: SOURCE_DOSSIERS,
			...Object.fromEntries(LEGISLATURES.map((leg) => [`scrutins_${leg}`, sourceScrutins(leg)]))
		}
	};
	await writeFile(join(OUT_DIR, 'meta.json'), JSON.stringify(meta, null, 2));
	console.log(`  ✓ meta.json`);

	console.log('\n✅ Terminé.');
	console.log(`   Output : ${OUT_DIR}`);
}

main().catch((err) => {
	console.error('\n❌ Pipeline a échoué :', err);
	process.exit(1);
});
