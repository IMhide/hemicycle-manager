/**
 * Smoke test pour valider l'output du pipeline.
 * Lance après `npm run data:fetch`.
 *
 * Phase 2 : couvre les législatures 15ᵉ + 16ᵉ + 17ᵉ (ère Macron complète).
 *
 * Vérifie :
 *  - comptes globaux (personnes, mandats, groupes par leg, scrutins)
 *  - cas concrets connus (Habib, Vallaud, Le Pen, vétérans 15+16+17)
 *  - cohérence des stats (rate ∈ [0,1], denominator ≥ numerator)
 *  - détection NI-bridge correcte
 */

import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
	Personne,
	Groupe,
	LegislatureMeta,
	ScrutinIndex,
	BuildMeta,
	Texte,
	ActeurNom,
	TexteUnifie
} from '../src/lib/types.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'static', 'data');

async function loadJson<T>(rel: string): Promise<T> {
	return JSON.parse(await readFile(join(DATA, rel), 'utf8')) as T;
}

let pass = 0;
let fail = 0;

function check(label: string, ok: boolean, detail?: string) {
	if (ok) {
		pass++;
		console.log(`  ✓ ${label}`);
	} else {
		fail++;
		console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
	}
}

async function main() {
	console.log('🔬 Smoke test PolitiDex (15ᵉ + 16ᵉ + 17ᵉ)\n');

	// ─── Meta + comptes globaux
	const meta = await loadJson<BuildMeta>('meta.json');
	console.log(`Meta : généré ${meta.generatedAt}, législatures ${meta.legislatures.join('+')}`);
	console.log(
		`Counts : ${meta.counts.personnes} personnes, ${meta.counts.mandats} mandats, ${meta.counts.groupes} groupes, ${meta.counts.scrutins} scrutins\n`
	);

	console.log('1. Comptes globaux');
	check('legislatures = [15, 16, 17]', JSON.stringify(meta.legislatures) === '[15,16,17]');
	// Réalité empirique attendue sur 15+16+17 :
	//  - 577 sièges × 3 = 1731
	//  - chevauchement réélus 15→16 (~250-300) et 16→17 (~430)
	//  - turnover ~10% par leg
	// Estimation : 1200-1500 personnes uniques.
	check(
		'≈ 1200-1500 personnes uniques sur 3 legs',
		meta.counts.personnes >= 1100 && meta.counts.personnes <= 1600,
		`got ${meta.counts.personnes}`
	);
	check(
		'≈ 1750-2050 mandats (un mandat = une personne × une législature)',
		meta.counts.mandats >= 1700 && meta.counts.mandats <= 2100,
		`got ${meta.counts.mandats}`
	);

	// ─── Légistlatures
	console.log('\n2. Légistlatures');
	const legislatures = await loadJson<LegislatureMeta[]>('legislatures.json');
	check('3 législatures dans legislatures.json', legislatures.length === 3);
	const leg15 = legislatures.find((l) => l.num === 15);
	const leg16 = legislatures.find((l) => l.num === 16);
	const leg17 = legislatures.find((l) => l.num === 17);
	check('leg 15 présente', !!leg15);
	check('leg 16 présente', !!leg16);
	check('leg 17 présente', !!leg17);
	for (const [name, l] of [['15', leg15], ['16', leg16], ['17', leg17]] as const) {
		check(
			`leg ${name} nbPersonnes ≈ 577-650`,
			!!l && l.nbPersonnes >= 577 && l.nbPersonnes <= 700,
			l ? `got ${l.nbPersonnes}` : 'n/a'
		);
	}

	// ─── Groupes par législature
	console.log('\n3. Groupes par législature');
	const groupes15 = await loadJson<Groupe[]>('groupes/15.json');
	const groupes16 = await loadJson<Groupe[]>('groupes/16.json');
	const groupes17 = await loadJson<Groupe[]>('groupes/17.json');
	// 15ᵉ : 17 groupes incluant les éphémères (NG, LC, EDS, deux UDI-AGIR successifs, deux UDI-I, MODEM/Dem rebrand, AE)
	check('groupes/15.json contient 15-19 groupes', groupes15.length >= 15 && groupes15.length <= 19, `got ${groupes15.length}`);
	check('groupes/16.json contient 12 groupes', groupes16.length === 12, `got ${groupes16.length}`);
	check('groupes/17.json contient 14 groupes', groupes17.length === 14, `got ${groupes17.length}`);
	check(
		'tous les groupes 15 ont legislature=15',
		groupes15.every((g) => g.legislature === 15)
	);
	check(
		'tous les groupes 15 ont une couleur',
		groupes15.every((g) => /^#[0-9A-Fa-f]{6}$/.test(g.couleur))
	);
	const lremGr15 = groupes15.find((g) => /LREM|REM/.test(g.libelleAbrege));
	check('LREM/REM présent en 15', !!lremGr15);
	const ldGr16 = groupes16.find((g) => g.libelleAbrege.includes('LFI'));
	check('LFI-NUPES présent en 16', !!ldGr16);
	const epr17 = groupes17.find((g) => g.libelleAbrege === 'EPR');
	check('EPR présent en 17', !!epr17);

	// ─── Personnes : cas concrets
	console.log('\n4. Cas concrets');
	const personnes = await loadJson<Personne[]>('personnes.json');
	const habib = personnes.find((p) => p.id === 'PA1592');
	check('PA1592 (David Habib) présent', !!habib);
	if (habib) {
		const legs = habib.mandats.map((m) => m.legislature).sort();
		// David Habib est un vétéran, élu sur 15+16+17 (et au-delà historiquement)
		check(
			'Habib a au moins 2 mandats 16e + 17e (vétéran si 15+16+17)',
			legs.includes(16) && legs.includes(17),
			`got ${legs.join(',')}`
		);
		check('Habib carriere.nbMandats ≥ 2', habib.carriere.nbMandats >= 2);
		check('Habib badge réélu', habib.carriere.badgesCarriere.includes('reelu'));
		if (legs.includes(15)) {
			check('Habib badge vétéran (3+ legs)', habib.carriere.badgesCarriere.includes('veteran'));
		}
	}

	const vallaud = personnes.find((p) => p.id === 'PA719930');
	check('PA719930 (Boris Vallaud) présent', !!vallaud);
	if (vallaud) {
		const m16 = vallaud.mandats.find((m) => m.legislature === 16);
		check('Vallaud a un mandat 16e', !!m16);
		if (m16) {
			const stables = m16.appartenancesGroupe.filter((a) => !a.isTransitoireNI);
			const distincts = new Set(stables.map((a) => a.groupeId));
			check(
				'Vallaud 16e a 2 groupes stables (SOC → SOC nouveau)',
				distincts.size === 2,
				`got ${distincts.size}`
			);
		}
		// Sémantique post-ADR 0034 : le badge transfuge se calcule sur les
		// **familles politiques** (pas les groupeId bruts). Vallaud passe de
		// SOC NUPES (PO800496) à SOC scission (PO830170) en 16ᵉ — deux groupes
		// distincts mais même famille FAMILLE_PS → pas transfuge. Idem côté
		// 15ᵉ : NG (PO730946) → SOC (PO758835) sont aussi FAMILLE_PS.
		check(
			'Vallaud PAS transfuge (NG/SOC/SOC NUPES = même famille PS, ADR 0034)',
			!vallaud.carriere.badgesCarriere.includes('transfuge')
		);
	}

	const lepen = personnes.find((p) => p.id === 'PA720614');
	check('PA720614 (Marine Le Pen) présente', !!lepen);
	if (lepen) {
		check('Le Pen badge réélu', lepen.carriere.badgesCarriere.includes('reelu'));
	}

	// ─── Cohérence stats
	console.log('\n5. Cohérence stats');
	let okPresence = true;
	let okPart = true;
	let okLoy = true;
	let nNI = 0;
	let nWithMandat17 = 0;
	for (const p of personnes) {
		for (const m of p.mandats) {
			if (m.stats.presence.rate < 0 || m.stats.presence.rate > 1) okPresence = false;
			if (m.stats.presence.numerator > m.stats.presence.denominator) okPresence = false;
			if (m.stats.participation.numerator > m.stats.participation.denominator) okPart = false;
			if (m.stats.loyaute.rate !== null && (m.stats.loyaute.rate < 0 || m.stats.loyaute.rate > 1))
				okLoy = false;
			if (m.legislature === 17) nWithMandat17++;
			for (const a of m.appartenancesGroupe) if (a.isTransitoireNI) nNI++;
		}
	}
	check('toutes les présences ∈ [0,1] et num ≤ denom', okPresence);
	check('toutes les participations num ≤ denom', okPart);
	check('toutes les loyautés ∈ [0,1]', okLoy);
	check(`NI-bridge filtrés ≥ 500 (517 attendus 16e + ~570 17e)`, nNI >= 500, `got ${nNI}`);

	// ─── Carrière agrégée
	console.log('\n6. Carrière agrégée (cumul pondéré, cf ADR 0017)');
	let okCarriere = true;
	for (const p of personnes) {
		const c = p.carriere;
		const sumNum = p.mandats.reduce((s, m) => s + m.stats.presence.numerator, 0);
		const sumDen = p.mandats.reduce((s, m) => s + m.stats.presence.denominator, 0);
		if (c.presence.numerator !== sumNum || c.presence.denominator !== sumDen) okCarriere = false;
	}
	check('carriere.presence = somme des mandat.presence (cumul pondéré)', okCarriere);

	// ─── Scrutins
	console.log('\n7. Scrutins');
	const scrutinsIdx = await loadJson<ScrutinIndex[]>('scrutins-index.json');
	const sc15 = scrutinsIdx.filter((s) => s.legislature === 15).length;
	const sc16 = scrutinsIdx.filter((s) => s.legislature === 16).length;
	const sc17 = scrutinsIdx.filter((s) => s.legislature === 17).length;
	check(`scrutins 15 ≥ 2500 (got ${sc15})`, sc15 >= 2500);
	check(`scrutins 16 ≥ 1500 (got ${sc16})`, sc16 >= 1500);
	check(`scrutins 17 ≥ 500 (got ${sc17})`, sc17 >= 500);
	check(
		'toutes les entrées de scrutins-index.json ont un champ legislature ∈ {15,16,17}',
		scrutinsIdx.every((s) => [15, 16, 17].includes(s.legislature))
	);

	// ─── Vétérans (au moins une personne 15+16+17)
	console.log('\n8. Vétérans (Phase 2)');
	const veterans = personnes.filter((p) => {
		const legs = new Set(p.mandats.map((m) => m.legislature));
		return legs.has(15) && legs.has(16) && legs.has(17);
	});
	check(
		`au moins 50 vétérans (3 legs consécutives)`,
		veterans.length >= 50,
		`got ${veterans.length}`
	);
	if (veterans.length > 0) {
		check(
			'tous les vétérans ont le badge veteran',
			veterans.every((v) => v.carriere.badgesCarriere.includes('veteran')),
			`${veterans.filter((v) => !v.carriere.badgesCarriere.includes('veteran')).length} sans badge`
		);
	}

	// ─── Textes législatifs (cf ADR à venir, scripts/lib/textes-an.ts)
	console.log('\n9. Textes législatifs');
	const textes = await loadJson<Texte[]>('textes.json');
	check(`textes.json non vide`, textes.length > 0, `got ${textes.length}`);
	check(`≈ 800-1500 textes sur 15+16+17`, textes.length >= 800 && textes.length <= 1500, `got ${textes.length}`);

	// Cas canonique 1 : PLF 2026 a >900 scrutins liés (gros texte)
	const plf26 = textes.find(
		(t) =>
			t.legislature === 17 &&
			t.type === 'projet-loi-finances' &&
			/pour\s*2026/i.test(t.titre)
	);
	check('PLF 2026 (17ᵉ) trouvé dans textes.json', !!plf26);
	check(
		'PLF 2026 ≥ 800 scrutins liés (le plus gros texte 17ᵉ)',
		!!plf26 && plf26.nbScrutins >= 800,
		`got ${plf26?.nbScrutins}`
	);
	check(
		'PLF 2026 dateDebut < dateFin (chronologie)',
		!!plf26 && plf26.dateDebut < plf26.dateFin
	);

	// Cas canonique 2 : la loi sécurité a un dossierRef Etalab → id = DLR…, enrichie
	const secu = textes.find((t) => t.id === 'DLR5L17N53284');
	check('Loi sécurité-rétention (DLR5L17N53284) trouvée', !!secu);
	check(
		'Loi sécurité a titre officiel (enrichi par dump dossiers)',
		!!secu && /Renforcer la s[ée]curit[ée]/.test(secu.titre)
	);
	check('Loi sécurité enrichie = true', !!secu && secu.enrichiDossiersAN);
	check(
		'Loi sécurité a un initiateur (proposition de loi)',
		!!secu && secu.initiateurs.length >= 1
	);
	check(
		'Loi sécurité ≥ 80 scrutins liés',
		!!secu && secu.nbScrutins >= 80,
		`got ${secu?.nbScrutins}`
	);

	// Cas canonique 3 : scrutins-index a un champ texteId
	check(
		'scrutins-index.json a un champ texteId sur chaque entrée',
		scrutinsIdx.every((s) => 'texteId' in s)
	);
	const scAvec = scrutinsIdx.filter((s) => s.texteId);
	check(
		'≥ 95% des scrutins ont un texteId (cible 99,3%)',
		scAvec.length / scrutinsIdx.length >= 0.95,
		`got ${((scAvec.length / scrutinsIdx.length) * 100).toFixed(1)}%`
	);

	// Cas canonique 4 : motions de censure → texteId null
	const motions = scrutinsIdx.filter((s) =>
		/motion de censure/i.test(s.titre)
	);
	check(
		`Aucune motion de censure n'a de texteId (got ${motions.filter((s) => s.texteId).length}/${motions.length})`,
		motions.every((s) => s.texteId === null)
	);

	// Cas canonique 5 : cohérence dateDebut/dateFin sur tous les textes
	const datesIncoherentes = textes.filter((t) => t.dateDebut > t.dateFin);
	check(
		'Tous les textes ont dateDebut ≤ dateFin',
		datesIncoherentes.length === 0,
		`${datesIncoherentes.length} textes incohérents`
	);

	// Cas canonique 6 : nbScrutins = scrutins.length
	const tailleIncoherente = textes.filter((t) => t.nbScrutins !== t.scrutins.length);
	check(
		'Tous les textes ont nbScrutins == scrutins.length',
		tailleIncoherente.length === 0,
		`${tailleIncoherente.length} textes incohérents`
	);

	// Cas canonique 7 : ids commençant par "DLR" sont enrichis, ids "sig-" sont non enrichis
	const dlrNonEnrichi = textes.filter((t) => t.id.startsWith('DLR') && !t.enrichiDossiersAN);
	check(
		'Tous les textes id=DLR* sont enrichis',
		dlrNonEnrichi.length === 0,
		`${dlrNonEnrichi.length} avec id DLR mais non enrichi`
	);
	const sigEnrichi = textes.filter((t) => t.id.startsWith('sig-') && t.enrichiDossiersAN);
	check(
		'Aucun texte id=sig-* n\'est marqué enrichi',
		sigEnrichi.length === 0,
		`${sigEnrichi.length} avec id sig- mais enrichi`
	);

	// Cas canonique 8 : navette cross-chambre (N3.a) — senatUrl propagé depuis dump AN.
	// Mesuré : 32% des dossiers AN 17ᵉ ont un senatChemin → on attend ≥ 25% sur les
	// textes enrichis 17ᵉ (le pool de textes ayant un DLR officiel).
	const textes17Enrichis = textes.filter((t) => t.legislature === 17 && t.enrichiDossiersAN);
	const textes17AvecSenat = textes17Enrichis.filter((t) => t.senatUrl !== null);
	const pctSenat =
		textes17Enrichis.length === 0 ? 0 : textes17AvecSenat.length / textes17Enrichis.length;
	check(
		'≥ 25% des textes 17ᵉ enrichis ont un senatUrl (navette N3.a, cible ~32%)',
		pctSenat >= 0.25,
		`got ${(pctSenat * 100).toFixed(1)}% (${textes17AvecSenat.length}/${textes17Enrichis.length})`
	);
	check(
		'Tous les senatUrl sont des URL absolues http(s)://',
		textes17AvecSenat.every((t) => /^https?:\/\//.test(t.senatUrl!)),
		'au moins un senatUrl est mal formé'
	);
	const sigAvecSenat = textes.filter((t) => t.id.startsWith('sig-') && t.senatUrl !== null);
	check(
		'Aucun texte id=sig-* n\'a de senatUrl (ne peut venir que du dump dossiers)',
		sigAvecSenat.length === 0,
		`${sigAvecSenat.length} avec id sig- mais senatUrl renseigné`
	);

	// Cas canonique 9 : matching cross-chambre N3.c (versionAutreChambre)
	// Mesuré 2026-05-13 : 64/201 (31,8%) des textes 17ᵉ sont matchés au Sénat.
	const textes17AvecMatch = textes.filter((t) => t.legislature === 17 && t.versionAutreChambre);
	const pctMatch17 = textes17AvecMatch.length / textes17Enrichis.length;
	check(
		'≥ 15% des textes 17ᵉ enrichis ont une versionAutreChambre Sénat (N3.c, cible ~30%)',
		pctMatch17 >= 0.15,
		`got ${(pctMatch17 * 100).toFixed(1)}% (${textes17AvecMatch.length}/${textes17Enrichis.length})`
	);
	check(
		'Chaque versionAutreChambre AN a un texteSenatId non vide',
		textes17AvecMatch.every(
			(t) => !!t.versionAutreChambre && !!t.versionAutreChambre.texteSenatId
		),
		'au moins un versionAutreChambre est mal formé'
	);
	check(
		'matchedVia ∈ {slug, titre} pour tous les matches',
		textes17AvecMatch.every(
			(t) =>
				!!t.versionAutreChambre &&
				(t.versionAutreChambre.matchedVia === 'slug' || t.versionAutreChambre.matchedVia === 'titre')
		),
		'matchedVia invalide'
	);

	// ─── Manifest acteurs-noms (cf ADR 0035)
	console.log('\n10. Manifest des noms d\'acteurs (députés + ministres + sénateurs)');
	const acteursNoms = await loadJson<ActeurNom[]>('acteurs-noms.json');
	check(`acteurs-noms.json non vide`, acteursNoms.length > 0, `got ${acteursNoms.length}`);
	check(
		`≈ 2 500-15 000 acteurs (députés + ministres + sénateurs + anciens)`,
		acteursNoms.length >= 2500 && acteursNoms.length <= 15000,
		`got ${acteursNoms.length}`
	);
	// Cas canonique : Sébastien Lecornu (PA643210) doit y figurer car il est
	// initiateur du PLF 2026 alors qu'il n'est PAS député (= absent de personnes.json).
	const lecornu = acteursNoms.find((a) => a.id === 'PA643210');
	check('Sébastien Lecornu (PA643210, ministre non-député) présent', !!lecornu);
	check(
		'Lecornu a un nom complet',
		!!lecornu && !!lecornu.nom && !!lecornu.prenom
	);
	// Tous les initiateurs de tous les textes doivent être trouvables (sinon UX cassée)
	const acteursIdsManifest = new Set(acteursNoms.map((a) => a.id));
	const initiateursOrphelins: string[] = [];
	for (const tx of textes) {
		for (const pa of tx.initiateurs) {
			if (!acteursIdsManifest.has(pa)) initiateursOrphelins.push(pa);
		}
	}
	check(
		'Tous les initiateurs de textes sont dans le manifest acteurs-noms',
		initiateursOrphelins.length === 0,
		`${initiateursOrphelins.length} orphelins (échantillon: ${initiateursOrphelins.slice(0, 3).join(', ')})`
	);

	// ─── Manifest unifié cross-chambre (N3.d, cf ADR 0036)
	console.log('\n11. Textes unifiés cross-chambre (TexteUnifie)');
	const textesUnifies = await loadJson<TexteUnifie[]>('textes-unifies.json');
	check('textes-unifies.json non vide', textesUnifies.length > 0, `got ${textesUnifies.length}`);
	check(
		'≈ 1000-2000 textes unifiés (961 AN + 571 Sénat − 86 doublons ≈ 1446)',
		textesUnifies.length >= 1000 && textesUnifies.length <= 2000,
		`got ${textesUnifies.length}`
	);

	const bicameraux = textesUnifies.filter((t) => t.bicameral);
	check(
		'≥ 50 textes bicaméraux (cible 86 sur ère Macron)',
		bicameraux.length >= 50,
		`got ${bicameraux.length}`
	);
	check(
		'Tous les bicaméraux ont an ET senat remplis',
		bicameraux.every((t) => !!t.an && !!t.senat),
		'au moins un bicaméral est mal formé'
	);
	check(
		'Tous les bicaméraux ont an.texteId === t.id (id canonique = AN)',
		bicameraux.every((t) => t.an?.texteId === t.id),
		'id canonique violé'
	);

	const anSeulCount = textesUnifies.filter((t) => t.an && !t.senat).length;
	const senSeulCount = textesUnifies.filter((t) => !t.an && t.senat).length;
	check(
		'Distribution : ~70% AN-seul, ~30% Sénat-seul + bicaméraux',
		anSeulCount + senSeulCount + bicameraux.length === textesUnifies.length,
		`somme ${anSeulCount + senSeulCount + bicameraux.length} ≠ total ${textesUnifies.length}`
	);

	// Cas canonique : PPL Nouvelle-Calédonie doit être bicamérale avec id AN
	const ncTexte = textesUnifies.find(
		(t) =>
			t.bicameral &&
			t.an?.texteId === 'DLR5L17N50450' &&
			t.senat?.texteId === '74884'
	);
	check(
		'PPL Nouvelle-Calédonie (DLR5L17N50450 ↔ 74884) présente en bicaméral',
		!!ncTexte,
		ncTexte ? '' : 'introuvable'
	);
	if (ncTexte) {
		check(
			'PPL Nouvelle-Calédonie : numéroLoi côté Sénat propagé',
			!!ncTexte.numeroLoi,
			`got ${ncTexte.numeroLoi}`
		);
		check(
			'PPL Nouvelle-Calédonie : état promulgue',
			ncTexte.etat === 'promulgue',
			`got ${ncTexte.etat}`
		);
	}

	// Invariants généraux
	check(
		'Tous les textes ont dateDebut ≤ dateFin',
		textesUnifies.every((t) => t.dateDebut <= t.dateFin),
		'au moins un texte a une chronologie invalide'
	);
	check(
		'Tous les états sont valides (promulgue/rejete/retire/caduc/fusionne/en-cours/inconnu)',
		textesUnifies.every((t) =>
			['promulgue', 'rejete', 'retire', 'caduc', 'fusionne', 'en-cours', 'inconnu'].includes(t.etat)
		),
		'au moins un état invalide'
	);

	console.log(`\n──────────────────`);
	console.log(`✅ ${pass} passed   ❌ ${fail} failed`);
	if (fail > 0) process.exit(1);
}

main().catch((e) => {
	console.error('💥', e);
	process.exit(1);
});
