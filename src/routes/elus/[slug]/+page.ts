import type { PageLoad, EntryGenerator } from './$types';
import {
	loadPersonne,
	loadGroupes,
	loadHistorique,
	loadLegislatures,
	loadSenateur,
	loadGroupesSenat,
	loadTriennats,
	loadHistoriqueSenat,
	loadTextes,
	loadTexteSlugResolver
} from '$lib/data';
import { loadElusManifest } from '$lib/elus';
import type { TriennatId } from '$lib/triennats';

// Prerender SSG (cf ADR 0041) : une page HTML statique par élu, énumérée depuis
// le manifest. L'historique de vote est lu depuis sa forme dénormalisée
// (meta 5e élément) et le vote final depuis textes.json précalculé — donc plus
// besoin de charger scrutins-index.json (6,1 Mo) dans chaque page.
export const prerender = true;
export const ssr = true;

// Énumère les slugs à prérendre. Tolère un manifest vide (placeholder CI →
// 0 page, build vert).
export const entries: EntryGenerator = async () => {
	try {
		const fs = await import('node:fs/promises');
		const raw = await fs.readFile('static/data/elus.json', 'utf-8');
		const { elus } = JSON.parse(raw) as { elus?: { slug: string }[] };
		return (elus ?? []).map((e) => ({ slug: e.slug }));
	} catch {
		return [];
	}
};

export const load: PageLoad = async ({ fetch, params }) => {
	const manifest = await loadElusManifest(fetch);
	const elu = manifest.elus.find((e) => e.slug === params.slug);
	if (!elu) throw new Error(`Élu ${params.slug} introuvable`);

	// Description SEO orientée intention (cf ADR 0043, H6) — émise par le +layout
	// via data.description. Nomme la personne, son rôle et son groupe pour ranker
	// sur « comment a voté {nom} » (cf plan SEO §0bis).
	const fem = elu.sexe === 'F';
	const aAN = elu.mandats.some((m) => m.chambre === 'AN');
	const aSenat = elu.mandats.some((m) => m.chambre === 'SENAT');
	const role =
		aAN && aSenat
			? fem
				? 'députée et sénatrice'
				: 'député et sénateur'
			: aSenat
				? fem
					? 'sénatrice'
					: 'sénateur'
				: fem
					? 'députée'
					: 'député';
	const groupeAbrege = elu.mandats.at(-1)?.groupeLibelleAbrege ?? null;
	const roleGroupe = groupeAbrege ? `${role} ${groupeAbrege}` : role;
	const metaTitle = `${elu.prenom} ${elu.nom}, ${roleGroupe} — votes & parcours · PolitiDex`;
	const description =
		`Comment a voté ${elu.prenom} ${elu.nom} (${roleGroupe}) : taux de présence, ` +
		`participation, loyauté et frondes, scrutin par scrutin. Parcours cross-chambre ` +
		`Assemblée nationale / Sénat sur PolitiDex.`;

	// Résumé NL visible (cf ADR 0043, PR C) : le <p> factuel sous le <h1>, qui
	// nomme la personne, son rôle et ses chiffres clés de carrière. Construit
	// depuis le manifest (carrière, toujours dispo au prerender) — le contenu
	// exact que Google met en avant et que les IA citent (cf plan SEO §0bis).
	const pct = (v: number) => `${Math.round(v * 100)} %`;
	const anneeDebut = elu.mandats
		.map((m) => m.debut)
		.filter(Boolean)
		.sort()[0]
		?.slice(0, 4);
	const nbMandats = elu.mandats.length;
	const pageSummary =
		`${elu.prenom} ${elu.nom} est ${roleGroupe}${anneeDebut ? ` depuis ${anneeDebut}` : ''}. ` +
		`Sur l'ensemble de sa carrière (${nbMandats} mandat${nbMandats > 1 ? 's' : ''}) : ` +
		`taux de présence ${pct(elu.radarCarriere.presence)}, ` +
		`participation ${pct(elu.radarCarriere.participation)}, ` +
		`loyauté ${pct(elu.radarCarriere.loyaute)}. ` +
		`Score Overall : ${elu.overallCarriere}/99.`;
	const pageTitle = `${elu.prenom} ${elu.nom}`;
	const pageSubtitle = roleGroupe.charAt(0).toUpperCase() + roleGroupe.slice(1);

	// Toujours charger les méta (légères) — utiles pour TriennatTabs et libellés.
	const [legislatures, triennats] = await Promise.all([
		loadLegislatures(fetch),
		loadTriennats(fetch)
	]);

	// Côté AN : Personne + groupes + historique (dénormalisé) + textes si mandat AN.
	let personne = null;
	let groupesAN: Awaited<ReturnType<typeof loadGroupes>> = [];
	let historiqueAN: Awaited<ReturnType<typeof loadHistorique>> = [];
	let textesAN: Awaited<ReturnType<typeof loadTextes>> = [];
	if (elu.paId) {
		personne = await loadPersonne(fetch, elu.paId);
		if (personne) {
			const groupesByLeg = await Promise.all(legislatures.map((l) => loadGroupes(fetch, l.num)));
			groupesAN = groupesByLeg.flat();
			[historiqueAN, textesAN] = await Promise.all([
				loadHistorique(fetch, elu.paId).catch(() => []),
				loadTextes(fetch).catch(() => [])
			]);
		}
	}

	// Côté Sénat : Senateur + groupes des triennats touchés + historique dénormalisé.
	let senateur = null;
	let groupesSenat: Awaited<ReturnType<typeof loadGroupesSenat>> = [];
	let historiqueSenat: Awaited<ReturnType<typeof loadHistoriqueSenat>> = [];
	if (elu.matricule) {
		senateur = await loadSenateur(fetch, elu.matricule);
		if (senateur) {
			const triennatsTouches: TriennatId[] = senateur.carriere.triennats as TriennatId[];
			const groupesByTriennat = await Promise.all(
				triennatsTouches.map((t) => loadGroupesSenat(fetch, t))
			);
			groupesSenat = groupesByTriennat.flat();
			historiqueSenat = await loadHistoriqueSenat(fetch, elu.matricule).catch(() => []);
		}
	}

	// Map texteId (AN) → slug de la fiche unifiée, pour les liens « Voir texte »
	// des groupes de vote (cf ADR 0042). Construit depuis les textes AN chargés.
	const resolveSlug = await loadTexteSlugResolver(fetch);
	const texteSlugById: Record<string, string> = {};
	for (const t of textesAN) {
		const slug = resolveSlug(t.id);
		if (slug) texteSlugById[t.id] = slug;
	}

	return {
		elu,
		metaTitle,
		description,
		pageTitle,
		pageSubtitle,
		pageSummary,
		legislatures,
		triennats,
		personne,
		groupesAN,
		historiqueAN,
		textesAN,
		senateur,
		groupesSenat,
		historiqueSenat,
		texteSlugById
	};
};
