/**
 * Builder du manifest bicaméral `elus.json` (cf ADR 0031 + ADR 0032).
 *
 * Croise `personnes.json` (AN) et `senat/senateurs.json` (Sénat) pour produire
 * un référentiel cross-chambre. Une personne politique = un `Elu` unique
 * identifié par `eluId` synthétique (hash sha256-8 d'une clé déterministe
 * `prénom + nom + dateNaissance` normalisés).
 *
 * Module pur, testé en TDD strict (`elus-manifest.test.ts`). Le driver
 * `scripts/build-elus-manifest.ts` se contente de lire les JSON, appeler
 * `buildElusManifest`, écrire le manifest en sortie.
 *
 * Politique de matching (cf ADR 0031 §"Politique de matching") :
 *  1. Match strict : même clé normalisée + dateNaissance non null des deux
 *     côtés → 1 `Elu` bicaméral
 *  2. Date manquante d'un côté → pas de fusion (warning logué)
 *  3. Homonymes parfaits intra-chambre → 1ère gardée + warning
 *  4. Overrides `forceFusion` / `forceSeparation` priorisés sur la clé
 */

import { createHash } from 'node:crypto';

// ────────────────────────────────────────────────────────────────────────────
// Types d'entrée — sous-ensemble structurel des types AN/Sénat (`src/lib/types.ts`)
// ────────────────────────────────────────────────────────────────────────────

export interface PersonneIdentite {
	civ: string;
	prenom: string;
	nom: string;
	sexe: string;
	dateNaissance: string | null;
	villeNaissance: string | null;
	photoUrl: string;
	professionDeclaree: string | null;
}

export interface MandatStats {
	overall: number;
	presence: { numerator: number; denominator: number; rate: number };
	participation: { numerator: number; denominator: number; rate: number };
	loyaute: { numerator: number; denominator: number; rate: number | null };
	frondes: { count: number; rate: number };
	volume: number;
}

export interface PersonneMandat {
	legislature: number;
	datePriseFonction: string;
	dateFinFonction: string | null;
	stats: MandatStats;
	appartenancesGroupe: unknown[];
}

export interface PersonneCarriere {
	overall: number;
	presence: { numerator: number; denominator: number; rate: number };
	participation: { numerator: number; denominator: number; rate: number };
	loyaute: { numerator: number; denominator: number; rate: number | null };
	frondes: { count: number; rate: number };
	volume: number;
	nbMandats: number;
	legislatures: number[];
	badgesCarriere: string[];
}

export interface Personne {
	id: string;
	identite: PersonneIdentite;
	mandats: PersonneMandat[];
	carriere: PersonneCarriere;
}

export interface SenateurIdentite extends PersonneIdentite {
	dateDeces: string | null;
	categorieProfessionnelle: string | null;
	etat: string;
}

export interface TriennatStats {
	triennat: string;
	stats: MandatStats;
}

export interface MandatSenat {
	datePriseFonction: string;
	dateFinFonction: string | null;
	triennats: TriennatStats[];
	appartenancesGroupe: unknown[];
}

export interface SenateurCarriere {
	overall: number;
	presence: { numerator: number; denominator: number; rate: number };
	participation: { numerator: number; denominator: number; rate: number };
	loyaute: { numerator: number; denominator: number; rate: number | null };
	frondes: { count: number; rate: number };
	volume: number;
	nbMandats: number;
	sessions: number[];
	triennats: string[];
	badgesCarriere: string[];
}

export interface Senateur {
	id: string;
	identite: SenateurIdentite;
	mandats: MandatSenat[];
	carriere: SenateurCarriere;
}

// ────────────────────────────────────────────────────────────────────────────
// Types de sortie — schéma `elus.json` (cf ADR 0031)
// ────────────────────────────────────────────────────────────────────────────

export type EluMandatRef =
	| {
			chambre: 'AN';
			legislature: number;
			debut: string;
			fin: string | null;
			overall: number;
	  }
	| {
			chambre: 'SENAT';
			triennat: string;
			debut: string;
			fin: string | null;
			overall: number;
	  };

export type BadgeCarriereCross = 'Recomposition' | 'Transfuge' | 'Veteran' | 'Reelu' | 'Bicameral';

export interface EluRadar {
	presence: number;
	participation: number;
	loyaute: number;
	volume: number;
	frondes: number;
}

export interface Elu {
	id: string; // elu_<8 hex>
	prenom: string;
	nom: string;
	civ: string;
	sexe: string;
	dateNaissance: string | null;
	photoUrl: string;
	paId: string | null;
	matricule: string | null;
	mandats: EluMandatRef[];
	overallCarriere: number;
	radarCarriere: EluRadar;
	badgesCarriere: BadgeCarriereCross[];
}

export interface EluManifest {
	generatedAt: string;
	count: number;
	countBicameral: number;
	elus: Elu[];
	warnings: string[];
}

export interface EluOverrides {
	forceFusion: { paId: string; matricule: string; comment: string }[];
	forceSeparation: { paId: string; matricule: string; comment: string }[];
}

// ────────────────────────────────────────────────────────────────────────────
// Normalisation — clé déterministe pour matching cross-chambre
// ────────────────────────────────────────────────────────────────────────────

const PARTICULES = new Set(['de', 'du', 'des', 'le', 'la']);

function stripDiacritics(s: string): string {
	return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function expandLigatures(s: string): string {
	return s.replace(/œ/g, 'oe').replace(/Œ/g, 'OE').replace(/æ/g, 'ae').replace(/Æ/g, 'AE');
}

function normaliseTokenSequence(s: string): string {
	const cleaned = stripDiacritics(expandLigatures(s.toLowerCase()))
		.replace(/['’\-]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	if (!cleaned) return '';
	const tokens = cleaned.split(' ').map((t) => (PARTICULES.has(t) ? '_' : t));
	return tokens.join(' ');
}

/**
 * Génère la clé de matching `prenom|nom|dateNaissance`. Lowercase, sans
 * accents, avec particules `de/du/des/le/la` remplacées par `_` (réversible
 * et déterministe). dateNaissance manquante → suffixe `NA`.
 */
export function normaliseKey(prenom: string, nom: string, dateNaissance: string | null): string {
	const p = normaliseTokenSequence(prenom);
	const n = normaliseTokenSequence(nom);
	const d = dateNaissance ?? 'NA';
	return `${p}|${n}|${d}`;
}

/** Génère l'`eluId` synthétique = `elu_<8 premiers hex de sha256(key)>`. */
export function eluId(key: string): string {
	const hex = createHash('sha256').update(key).digest('hex');
	return `elu_${hex.slice(0, 8)}`;
}

// ────────────────────────────────────────────────────────────────────────────
// Builder principal
// ────────────────────────────────────────────────────────────────────────────

interface BuildElusBucket {
	personnes: Personne[];
	senateurs: Senateur[];
}

function emptyBucket(): BuildElusBucket {
	return { personnes: [], senateurs: [] };
}

/**
 * Vrai si le sénateur a au moins un mandat avec un triennat dans le scope
 * ère Macron (cf ADR 0029). Les sénateurs hors scope n'apparaissent pas dans
 * le manifest (un mandat se terminant le 2017-09-24 = avant l'ère Macron).
 */
function senateurInScope(s: Senateur): boolean {
	for (const m of s.mandats) {
		if (m.triennats.length > 0) return true;
	}
	return false;
}

/**
 * Croise `personnes` AN et `senateurs` Sénat avec les `overrides` éventuels
 * pour produire un `EluManifest` cross-chambre stable.
 */
export function buildElusManifest(
	personnes: Personne[],
	senateurs: Senateur[],
	overrides: EluOverrides
): EluManifest {
	const warnings: string[] = [];

	// Filtrer les sénateurs hors scope ère Macron — pas d'Elu généré pour eux.
	const senateursScoped = senateurs.filter(senateurInScope);
	const skipped = senateurs.length - senateursScoped.length;
	if (skipped > 0) {
		warnings.push(
			`${skipped} sénateur(s) hors scope ère Macron filtrés (aucun triennat couvert, cf ADR 0029)`
		);
	}

	// Index O(1) par PA-id et par matricule.
	const personneByPa = new Map<string, Personne>();
	for (const p of personnes) personneByPa.set(p.id, p);
	const senateurByMatricule = new Map<string, Senateur>();
	for (const s of senateursScoped) senateurByMatricule.set(s.id, s);

	// Index des overrides : un PA-id ou matricule fusionné force la séparation
	// d'avec d'autres entrées qui auraient la même clé. La table forceFusion
	// override la clé naturelle → on construit un eluId basé sur la PA-id du
	// couple en force pour rendre stables les attributions.
	const fusionByPa = new Map<string, { paId: string; matricule: string }>();
	const fusionByMatricule = new Map<string, { paId: string; matricule: string }>();
	for (const f of overrides.forceFusion) {
		fusionByPa.set(f.paId, f);
		fusionByMatricule.set(f.matricule, f);
	}
	const separationPairs = new Set<string>();
	for (const s of overrides.forceSeparation) {
		separationPairs.add(`${s.paId}|${s.matricule}`);
	}

	// Bucketing par clé naturelle, en respectant les overrides.
	// Une "clé de fusion override" prend précédence sur la clé naturelle.
	const buckets = new Map<string, BuildElusBucket>();
	const consumed = new Set<string>(); // PA-ids/matricules déjà rangés via forceFusion

	// 1) Traiter les forceFusion d'abord — clé synthétique distincte.
	for (const f of overrides.forceFusion) {
		const p = personneByPa.get(f.paId);
		const s = senateurByMatricule.get(f.matricule);
		if (!p && !s) {
			warnings.push(
				`forceFusion ignoré : ni PA-id ${f.paId} ni matricule ${f.matricule} trouvés`
			);
			continue;
		}
		// Clé de bucket = override:<paId>:<matricule> pour différencier de la clé naturelle.
		const key = `override:${f.paId}:${f.matricule}`;
		const bucket = emptyBucket();
		if (p) {
			bucket.personnes.push(p);
			consumed.add(`pa:${p.id}`);
		}
		if (s) {
			bucket.senateurs.push(s);
			consumed.add(`mat:${s.id}`);
		}
		buckets.set(key, bucket);
	}

	// 2) Bucketing des personnes par clé naturelle.
	for (const p of personnes) {
		if (consumed.has(`pa:${p.id}`)) continue;
		const key = normaliseKey(p.identite.prenom, p.identite.nom, p.identite.dateNaissance);
		const bucket = buckets.get(key) ?? emptyBucket();
		// Détection homonymes intra-chambre : si une personne avec la même clé est
		// déjà dans le bucket on conserve la première et logge un warning.
		if (bucket.personnes.length > 0) {
			warnings.push(
				`homonyme AN : PA-id ${p.id} (${p.identite.prenom} ${p.identite.nom}) ignoré ` +
					`au profit de PA-id ${bucket.personnes[0].id} (clé identique)`
			);
			continue;
		}
		bucket.personnes.push(p);
		buckets.set(key, bucket);
	}

	// 3) Bucketing des sénateurs par clé naturelle (en évitant les fusions ambiguës).
	for (const s of senateursScoped) {
		if (consumed.has(`mat:${s.id}`)) continue;
		const key = normaliseKey(s.identite.prenom, s.identite.nom, s.identite.dateNaissance);
		const bucket = buckets.get(key) ?? emptyBucket();

		// Cas matching ambigu : la clé naturelle existe déjà côté AN avec
		// dateNaissance manquante d'un côté → refuser la fusion (cf ADR 0031 §2).
		if (bucket.personnes.length > 0) {
			const an = bucket.personnes[0];
			const anHasDate = an.identite.dateNaissance != null;
			const senHasDate = s.identite.dateNaissance != null;

			// Vérifier forceSeparation manuelle.
			if (separationPairs.has(`${an.id}|${s.id}`)) {
				// Crée un nouveau bucket pour le sénateur avec une clé synthétique
				// (force séparation, on ne touche pas à `bucket` AN).
				const sepKey = `separation:${s.id}`;
				const sepBucket = emptyBucket();
				sepBucket.senateurs.push(s);
				buckets.set(sepKey, sepBucket);
				continue;
			}

			if (anHasDate && senHasDate) {
				// Clé déjà identique avec dates des deux côtés → match strict, on fusionne.
				if (bucket.senateurs.length > 0) {
					warnings.push(
						`homonyme parfait Sénat : matricule ${s.id} (${s.identite.prenom} ${s.identite.nom}) ` +
							`ignoré au profit de ${bucket.senateurs[0].id}`
					);
					continue;
				}
				bucket.senateurs.push(s);
				continue;
			}

			// Match ambigu (date manquante d'un côté) → séparation par défaut.
			warnings.push(
				`matching ambigu : AN PA-id ${an.id} (date ${an.identite.dateNaissance ?? 'manquante'}) ↔ ` +
					`Sénat matricule ${s.id} (date ${s.identite.dateNaissance ?? 'manquante'}) — ` +
					`séparés par défaut (cf ADR 0031)`
			);
			const sepKey = `ambigu:${s.id}`;
			const sepBucket = emptyBucket();
			sepBucket.senateurs.push(s);
			buckets.set(sepKey, sepBucket);
			continue;
		}

		// Pas de personne AN sur cette clé → bucket Sénat seul.
		// Vérifier d'abord les homonymes Sénat parfaits déjà bucketés.
		if (bucket.senateurs.length > 0) {
			warnings.push(
				`homonyme Sénat : matricule ${s.id} (${s.identite.prenom} ${s.identite.nom}) ` +
					`ignoré au profit de ${bucket.senateurs[0].id}`
			);
			continue;
		}
		bucket.senateurs.push(s);
		buckets.set(key, bucket);
	}

	// 3.5) Détection des matchings ambigus (date manquante d'un côté).
	// Pour chaque bucket mono-chambre, on regarde si un autre bucket mono-chambre
	// a la même base `prenom|nom` mais une date différente (ou null vs non-null).
	// C'est le cas typique où on aurait pu fusionner avec une date, mais l'absence
	// de date d'un côté empêche la fusion stricte. On garde la séparation et on
	// loggue un warning (cf ADR 0031 §"Politique de matching").
	const baseKeyToBuckets = new Map<string, string[]>();
	for (const [bucketKey, bucket] of buckets) {
		if (bucketKey.startsWith('override:') || bucketKey.startsWith('separation:')) continue;
		const ident =
			bucket.personnes[0]?.identite ?? bucket.senateurs[0]?.identite ?? null;
		if (!ident) continue;
		const baseKey = `${normaliseTokenSequence(ident.prenom)}|${normaliseTokenSequence(ident.nom)}`;
		const arr = baseKeyToBuckets.get(baseKey) ?? [];
		arr.push(bucketKey);
		baseKeyToBuckets.set(baseKey, arr);
	}
	for (const [baseKey, bucketKeys] of baseKeyToBuckets) {
		if (bucketKeys.length < 2) continue;
		// Au moins deux buckets sur la même base prénom/nom : c'est ambigu.
		// On vérifie qu'au moins un AN et un Sénat sont en jeu (sinon ce sont
		// des homonymes intra-chambre, déjà gérés ailleurs).
		const anIds: string[] = [];
		const matIds: string[] = [];
		for (const bk of bucketKeys) {
			const b = buckets.get(bk)!;
			if (b.personnes[0]) anIds.push(b.personnes[0].id);
			if (b.senateurs[0]) matIds.push(b.senateurs[0].id);
		}
		if (anIds.length === 0 || matIds.length === 0) continue;
		warnings.push(
			`matching ambigu (${baseKey}) : AN [${anIds.join(', ')}] ↔ Sénat [${matIds.join(', ')}] — ` +
				`séparés par défaut (dateNaissance discordante ou manquante, cf ADR 0031)`
		);
	}

	// 4) Conversion des buckets en `Elu` finaux.
	const elus: Elu[] = [];
	let countBicameral = 0;

	for (const [bucketKey, bucket] of buckets) {
		const elu = bucketToElu(bucketKey, bucket);
		if (!elu) continue;
		if (bucket.personnes.length > 0 && bucket.senateurs.length > 0) countBicameral++;
		elus.push(elu);
	}

	// Tri stable par nom puis prénom pour rendre l'output déterministe.
	elus.sort((a, b) => {
		const cmpNom = a.nom.localeCompare(b.nom, 'fr');
		if (cmpNom !== 0) return cmpNom;
		return a.prenom.localeCompare(b.prenom, 'fr');
	});

	return {
		generatedAt: new Date().toISOString(),
		count: elus.length,
		countBicameral,
		elus,
		warnings
	};
}

// ────────────────────────────────────────────────────────────────────────────
// Conversion bucket → Elu
// ────────────────────────────────────────────────────────────────────────────

function bucketToElu(bucketKey: string, bucket: BuildElusBucket): Elu | null {
	const personne = bucket.personnes[0] ?? null;
	const senateur = bucket.senateurs[0] ?? null;
	if (!personne && !senateur) return null;

	// Identité de référence : priorité Personne AN si disponible, sinon Senateur.
	const ident = personne?.identite ?? senateur!.identite;

	// Clé d'identité pour le hash (stable même quand bucket = override).
	const dateNaissance =
		personne?.identite.dateNaissance ?? senateur?.identite.dateNaissance ?? null;
	let key: string;
	if (bucketKey.startsWith('override:')) {
		// Pour les fusions forcées, on hash sur le couple (paId|matricule) afin
		// de rester stable même si les noms diffèrent côté sources.
		const [, paId, matricule] = bucketKey.split(':');
		key = `override:${paId}:${matricule}`;
	} else if (bucketKey.startsWith('separation:') || bucketKey.startsWith('ambigu:')) {
		// Sénateur isolé d'un bucket AN partagé → on intègre le matricule pour
		// différencier l'eluId d'avec le bucket AN voisin.
		const matricule = bucketKey.split(':')[1];
		key = `${normaliseKey(ident.prenom, ident.nom, dateNaissance)}|sep:${matricule}`;
	} else {
		key = normaliseKey(ident.prenom, ident.nom, dateNaissance);
	}

	const id = eluId(key);

	const mandats: EluMandatRef[] = [];
	if (personne) {
		for (const m of personne.mandats) {
			mandats.push({
				chambre: 'AN',
				legislature: m.legislature,
				debut: m.datePriseFonction,
				fin: m.dateFinFonction,
				overall: m.stats.overall
			});
		}
	}
	if (senateur) {
		// Côté Sénat, un mandat couvre potentiellement plusieurs triennats et
		// un même triennat peut être traversé par plusieurs mandats successifs
		// (réélection au milieu d'un triennat). Pour la fiche Élu (cf ADR 0028
		// + ADR 0032 §"Sélecteur de mandat"), un onglet = un triennat unique.
		// On dédoublonne en gardant le `TriennatStats` du **dernier** mandat
		// qui couvre ce triennat (le plus récent reflète le scoring final), et
		// on retient la date de prise de fonction la plus ancienne pour le tri.
		const byTriennat = new Map<
			string,
			{ debut: string; fin: string | null; overall: number }
		>();
		for (const m of senateur.mandats) {
			for (const tri of m.triennats) {
				const existing = byTriennat.get(tri.triennat);
				if (!existing || m.datePriseFonction > existing.debut) {
					// Dernier mandat qui touche ce triennat → on garde ses stats.
					byTriennat.set(tri.triennat, {
						debut: existing
							? existing.debut < m.datePriseFonction
								? existing.debut
								: m.datePriseFonction
							: m.datePriseFonction,
						fin: m.dateFinFonction,
						overall: tri.stats.overall
					});
				}
			}
		}
		for (const [triennat, ref] of byTriennat) {
			mandats.push({
				chambre: 'SENAT',
				triennat,
				debut: ref.debut,
				fin: ref.fin,
				overall: ref.overall
			});
		}
	}

	mandats.sort((a, b) => a.debut.localeCompare(b.debut));

	// Pour la sémantique carrière (cf ADR 0032), on veut la moyenne sur les
	// mandats Élu (triennats Sénat dédupliqués), pas sur tous les TriennatStats
	// bruts (qui peuvent compter un même triennat plusieurs fois en cas de
	// réélection à mi-parcours).
	const stats = collectMandatStatsForElu(personne, senateur, mandats);
	const overallCarriere = computeOverallCarriere(stats);
	const radarCarriere = computeRadarCarriere(stats);
	const badgesCarriere = computeBadgesCarriere(mandats);

	return {
		id,
		prenom: ident.prenom,
		nom: ident.nom,
		civ: ident.civ,
		sexe: ident.sexe,
		dateNaissance,
		photoUrl: ident.photoUrl,
		paId: personne?.id ?? null,
		matricule: senateur?.id ?? null,
		mandats,
		overallCarriere,
		radarCarriere,
		badgesCarriere
	};
}

// ────────────────────────────────────────────────────────────────────────────
// Sémantique carrière (cf ADR 0032)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Collecte les `MandatStats` correspondant aux mandats Élu (un par législature
 * AN, un par triennat Sénat unique). Aligné sur la dédup faite par
 * `bucketToElu` pour que les agrégations carrière (moyenne, radar) soient
 * cohérentes avec la liste de mandats exposée.
 */
function collectMandatStatsForElu(
	personne: Personne | null,
	senateur: Senateur | null,
	mandats: EluMandatRef[]
): MandatStats[] {
	const stats: MandatStats[] = [];

	// AN : un mandat = une législature, déjà unique côté Personne (cf ADR 0015).
	if (personne) {
		for (const m of personne.mandats) stats.push(m.stats);
	}

	// Sénat : pour chaque triennat dans les mandats Élu, retrouver le `TriennatStats`
	// correspondant — celui du dernier mandat Sénat qui couvre ce triennat (cohérent
	// avec la dédup faite dans bucketToElu).
	if (senateur) {
		const triennats = new Set(
			mandats.filter((m) => m.chambre === 'SENAT').map((m) => (m as { triennat: string }).triennat)
		);
		for (const triennat of triennats) {
			let chosen: MandatStats | null = null;
			let chosenStart = '';
			for (const m of senateur.mandats) {
				for (const t of m.triennats) {
					if (t.triennat !== triennat) continue;
					if (!chosen || m.datePriseFonction > chosenStart) {
						chosen = t.stats;
						chosenStart = m.datePriseFonction;
					}
				}
			}
			if (chosen) stats.push(chosen);
		}
	}

	return stats;
}

function computeOverallCarriere(stats: MandatStats[]): number {
	if (stats.length === 0) return 0;
	const sum = stats.reduce((acc, s) => acc + s.overall, 0);
	return Math.round(sum / stats.length);
}

function computeRadarCarriere(stats: MandatStats[]): EluRadar {
	if (stats.length === 0) {
		return { presence: 0, participation: 0, loyaute: 0, volume: 0, frondes: 0 };
	}
	const presence = avg(stats.map((s) => s.presence.rate));
	const participation = avg(stats.map((s) => s.participation.rate));
	const loyaute = avg(stats.map((s) => s.loyaute.rate ?? 0));
	const volume = avg(stats.map((s) => s.volume));
	const frondes = avg(stats.map((s) => s.frondes.rate));
	return { presence, participation, loyaute, volume, frondes };
}

function avg(xs: number[]): number {
	if (xs.length === 0) return 0;
	const s = xs.reduce((a, b) => a + b, 0);
	return s / xs.length;
}

function computeBadgesCarriere(mandats: EluMandatRef[]): BadgeCarriereCross[] {
	const badges: BadgeCarriereCross[] = [];

	// Bicameral : ≥1 mandat AN ET ≥1 mandat Sénat
	const hasAN = mandats.some((m) => m.chambre === 'AN');
	const hasSenat = mandats.some((m) => m.chambre === 'SENAT');
	if (hasAN && hasSenat) badges.push('Bicameral');

	// Veteran : ≥3 mandats toutes chambres confondues (cf ADR 0032)
	if (mandats.length >= 3) badges.push('Veteran');

	// Reelu : 2 mandats consécutifs DANS LA MÊME CHAMBRE (cf ADR 0032)
	// "Consécutifs" : deux items mandats triés chrono asc dans la même chambre,
	// sans gap d'une autre chambre entre eux.
	const reelu = mandatsContainConsecutiveSameChambre(mandats);
	if (reelu) badges.push('Reelu');

	return badges;
}

function mandatsContainConsecutiveSameChambre(mandats: EluMandatRef[]): boolean {
	for (let i = 1; i < mandats.length; i++) {
		if (mandats[i].chambre === mandats[i - 1].chambre) {
			return true;
		}
	}
	return false;
}
