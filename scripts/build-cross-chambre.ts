/**
 * PolitiDex — build du matching cross-chambre AN ↔ Sénat (N3.c navette).
 *
 * Lance après `data:fetch:an` et `data:fetch:senat`. Lit :
 *  - `static/data/textes.json` (textes AN, ADR 0035)
 *  - `static/data/senat/textes.json` (textes Sénat, N3.b)
 *  - le dump `dosleg.sql` (cache, déjà téléchargé par fetch-data-senat.ts)
 *    pour reconstruire l'index `slug → Set<loicod>` via `texte/lecass/lecture`.
 *
 * Mute les deux `textes.json` en place avec le champ `versionAutreChambre`,
 * symétrique des deux côtés. Cf `scripts/lib/textes-cross-chambre.ts` pour
 * la cascade de matching.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

import type { Texte, TexteSenat, TexteUnifie } from '../src/lib/types.ts';
import { streamCopyBlocks } from './lib/dosleg-parser.ts';
import {
	matchTextesAnSenat,
	type TexteAnPourMatch,
	type TexteSenatPourMatch
} from './lib/textes-cross-chambre.ts';
import { fusionneTextesUnifies } from './lib/textes-unifies.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR_AN = join(ROOT, 'static', 'data');
const OUT_DIR_SENAT = join(ROOT, 'static', 'data', 'senat');
const CACHE_SENAT = join(tmpdir(), 'politidex-cache-senat');
const DOSLEG_SQL = join(CACHE_SENAT, 'dosleg-extracted', 'dosleg.sql');

async function main() {
	console.log('🔀 Build matching cross-chambre AN ↔ Sénat (N3.c navette)\n');

	const textesAN = JSON.parse(
		await readFile(join(OUT_DIR_AN, 'textes.json'), 'utf8')
	) as Texte[];
	const textesSenat = JSON.parse(
		await readFile(join(OUT_DIR_SENAT, 'textes.json'), 'utf8')
	) as TexteSenat[];

	console.log(`  ${textesAN.length} textes AN, ${textesSenat.length} textes Sénat`);

	// ── Reconstruction de l'index `slug → Set<loicod>` ─────────────────────────
	console.log('\n  Reconstruction index slug → loicod (dosleg streaming)…');
	const t0 = Date.now();
	const slugToLoicod = await buildSlugIndex();
	console.log(`  → ${slugToLoicod.size} slugs indexés (${((Date.now() - t0) / 1000).toFixed(1)}s)`);

	// ── Matching cascade ──────────────────────────────────────────────────────
	console.log('\n  Calcul du matching cross-chambre…');
	const anPour: TexteAnPourMatch[] = textesAN.map((t) => ({
		id: t.id,
		titre: t.titre,
		senatUrl: t.senatUrl,
		enrichiDossiersAN: t.enrichiDossiersAN
	}));
	const senPour: TexteSenatPourMatch[] = textesSenat.map((t) => ({
		id: t.id,
		titre: t.titre
	}));
	const { anToSenat, senatToAn } = matchTextesAnSenat(anPour, senPour, slugToLoicod);
	console.log(`  → ${anToSenat.size} matches AN→Sénat, ${senatToAn.size} matches Sénat→AN`);

	// Détail par méthode pour les stats
	let viaSlug = 0;
	let viaTitre = 0;
	for (const an of textesAN) {
		const senId = anToSenat.get(an.id);
		if (!senId) continue;
		// Si le texte AN a un senatUrl avec slug → c'est niveau 1
		if (an.senatUrl) viaSlug++;
		else viaTitre++;
	}
	console.log(`  → ${viaSlug} matches via slug senatUrl, ${viaTitre} via titre fuzzy`);

	// ── Mutation des Texte avec versionAutreChambre ───────────────────────────
	console.log('\n  Mutation des textes.json avec versionAutreChambre…');
	for (const an of textesAN) {
		const senId = anToSenat.get(an.id);
		if (!senId) {
			an.versionAutreChambre = null;
			continue;
		}
		const via = an.senatUrl ? 'slug' : 'titre';
		an.versionAutreChambre = { texteSenatId: senId, matchedVia: via };
	}
	for (const sen of textesSenat) {
		const anId = senatToAn.get(sen.id);
		if (!anId) {
			sen.versionAutreChambre = null;
			continue;
		}
		// Le matchedVia est repris depuis l'autre côté (cohérence symétrique)
		const matchedAn = textesAN.find((t) => t.id === anId);
		const via = matchedAn?.versionAutreChambre?.matchedVia ?? 'titre';
		sen.versionAutreChambre = { texteAnId: anId, matchedVia: via };
	}

	// ── Réécriture ────────────────────────────────────────────────────────────
	await writeFile(join(OUT_DIR_AN, 'textes.json'), JSON.stringify(textesAN));
	await writeFile(join(OUT_DIR_SENAT, 'textes.json'), JSON.stringify(textesSenat));
	console.log(`  ✓ textes.json (AN) muté avec ${anToSenat.size} versionAutreChambre`);
	console.log(`  ✓ senat/textes.json muté avec ${senatToAn.size} versionAutreChambre`);

	// ── Manifest unifié TexteUnifie[] (N3.d, cf ADR 0036) ─────────────────────
	console.log('\n  Construction du manifest unifié /textes/…');
	const textesUnifies: TexteUnifie[] = fusionneTextesUnifies(
		textesAN.map((t) => ({
			id: t.id,
			legislature: t.legislature,
			titre: t.titre,
			type: t.type,
			procedureLibelle: t.procedureLibelle,
			initiateurs: t.initiateurs,
			dateDebut: t.dateDebut,
			dateFin: t.dateFin,
			datePromulgation: t.datePromulgation,
			sortFinal: t.sortFinal,
			nbScrutins: t.nbScrutins,
			nbVotesSolennels: t.nbVotesSolennels,
			enrichiDossiersAN: t.enrichiDossiersAN,
			senatUrl: t.senatUrl,
			versionAutreChambre: t.versionAutreChambre
		})),
		textesSenat.map((t) => ({
			id: t.id,
			triennat: t.triennat,
			titre: t.titre,
			type: t.type,
			typeLibelle: t.typeLibelle,
			etat: t.etat,
			numeroLoi: t.numeroLoi,
			datePromulgation: t.datePromulgation,
			urlJO: t.urlJO,
			dateDebut: t.dateDebut,
			dateFin: t.dateFin,
			sortFinal: t.sortFinal,
			nbScrutins: t.nbScrutins,
			enrichiDosleg: t.enrichiDosleg,
			versionAutreChambre: t.versionAutreChambre
		}))
	);
	await writeFile(
		join(OUT_DIR_AN, 'textes-unifies.json'),
		JSON.stringify(textesUnifies)
	);
	const bicameraux = textesUnifies.filter((t) => t.bicameral).length;
	const anSeul = textesUnifies.filter((t) => t.an && !t.senat).length;
	const senSeul = textesUnifies.filter((t) => !t.an && t.senat).length;
	console.log(
		`  ✓ textes-unifies.json (${textesUnifies.length} textes : ${bicameraux} bicam, ${anSeul} AN-seul, ${senSeul} Sénat-seul)`
	);

	// ── Stats finales ─────────────────────────────────────────────────────────
	const couvAN = ((anToSenat.size / textesAN.length) * 100).toFixed(1);
	const couvSen = ((senatToAn.size / textesSenat.length) * 100).toFixed(1);
	console.log(`\n✅ Cross-chambre construit. Couverture : AN ${couvAN}%, Sénat ${couvSen}%`);
}

/** Stream le dump dosleg pour construire l'index `slug → Set<loicod>`.
 *  Le slug est extrait depuis `texte.texurl` (qui contient des fichiers
 *  type `pjl24-035.html`). Le chaînage est :
 *   texte (lecassidt, texurl) → lecass (lecassidt → lecidt) → lecture (lecidt → loicod) */
async function buildSlugIndex(): Promise<Map<string, Set<string>>> {
	const lecass = new Map<string, string>(); // lecassidt → lecidt
	const lecture = new Map<string, string>(); // lecidt → loicod
	interface TexteRow {
		texurl: string;
		lecassidt: string;
	}
	const texteRows: TexteRow[] = [];

	await streamCopyBlocks(DOSLEG_SQL, new Set(['lecass', 'lecture', 'texte']), (table, cols, vals) => {
		const row = Object.fromEntries(cols.map((c, i) => [c, vals[i]] as const));
		if (table === 'lecass') {
			const k = row.lecassidt?.trim();
			const v = row.lecidt?.trim();
			if (k && v) lecass.set(k, v);
		} else if (table === 'lecture') {
			const k = row.lecidt?.trim();
			const v = row.loicod?.trim();
			if (k && v) lecture.set(k, v);
		} else if (table === 'texte') {
			const tex = row.texurl?.trim();
			const lec = row.lecassidt?.trim();
			if (tex && lec) texteRows.push({ texurl: tex, lecassidt: lec });
		}
	});

	const slugToLoicod = new Map<string, Set<string>>();
	for (const t of texteRows) {
		const lecidt = lecass.get(t.lecassidt);
		if (!lecidt) continue;
		const loi = lecture.get(lecidt);
		if (!loi) continue;
		// `texte.texurl` peut être un fichier `pjl24-035.html` ou une URL complète
		// `http://www.assemblee-nationale.fr/...` (textes transmis par l'AN). On ne
		// garde que le format fichier Sénat (sans `://`).
		if (/:\/\//.test(t.texurl)) continue;
		const m = t.texurl.match(/^([a-z]+\d+(?:-\d+)?)\.html?$/i);
		if (!m) continue;
		const slug = m[1].toLowerCase();
		let set = slugToLoicod.get(slug);
		if (!set) {
			set = new Set();
			slugToLoicod.set(slug, set);
		}
		set.add(loi);
	}
	return slugToLoicod;
}

main().catch((err) => {
	console.error('❌ build-cross-chambre crash:', err);
	process.exit(1);
});
