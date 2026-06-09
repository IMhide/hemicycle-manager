import type { PageLoad, EntryGenerator } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { browser } from '$app/environment';
import { loadTexteUnifieBySlug, loadTextesUnifies, loadActeursNoms } from '$lib/data';

// Prerender SSG (cf ADR 0041) : une page HTML statique par texte unifié, énumérée
// depuis le manifest. Les scrutins de chaque texte sont inlinés dans le
// TexteUnifie au pipeline (cf ADR 0041) — donc plus besoin de charger
// scrutins-index.json (6,6 Mo) + senat/scrutins-index.json (~1 Mo) + personnes.json
// (2,7 Mo) ici. Seul acteurs-noms.json (léger) sert à nommer les initiateurs.
export const prerender = true;
export const ssr = true;

// Énumère les slugs à prérendre. Tolère un manifest vide (placeholder CI →
// 0 page, build vert).
export const entries: EntryGenerator = async () => {
	try {
		const fs = await import('node:fs/promises');
		const raw = await fs.readFile('static/data/textes-unifies.json', 'utf-8');
		const arr = JSON.parse(raw) as { slug: string }[];
		return (arr ?? []).map((t) => ({ slug: t.slug }));
	} catch {
		return [];
	}
};

export const load: PageLoad = async ({ fetch, params }) => {
	const slug = decodeURIComponent(params.slug);
	const texte = await loadTexteUnifieBySlug(fetch, slug);

	if (!texte) {
		// Lien entrant par id brut (canonique, AN ou Sénat) : on résout l'unifié et
		// on redirige vers son slug canonique (cf ADR 0042). Filet de sécurité
		// purement client-side — le prerender n'énumère que des slugs valides, donc
		// ce chemin n'est jamais emprunté au build (gardé par `browser`).
		if (browser) {
			const all = await loadTextesUnifies(fetch);
			const byId = all.find(
				(t) => t.id === slug || t.an?.texteId === slug || t.senat?.texteId === slug
			);
			if (byId) {
				throw redirect(307, `/textes/${byId.slug}`);
			}
		}
		throw error(404, `Texte ${slug} introuvable`);
	}

	// Noms des initiateurs (députés + sénateurs + ministres) — manifest léger.
	const acteursNoms = await loadActeursNoms(fetch).catch(() => []);

	// Méta SEO orientée intention (cf ADR 0043, H6) — émises par le +layout via
	// data.metaTitle / data.description.
	const etatLabel =
		texte.etat === 'promulgue'
			? 'promulguée'
			: texte.etat === 'rejete'
				? 'rejeté'
				: texte.etat === 'caduc'
					? 'caduc'
					: texte.etat === 'retire'
						? 'retiré'
						: texte.etat === 'fusionne'
							? 'fusionné'
							: 'en cours de navette';
	const titreCourt =
		texte.titre.length > 70 ? texte.titre.slice(0, 67).trim() + '…' : texte.titre;
	const metaTitle = `${titreCourt} — ${etatLabel} · PolitiDex`;
	const description =
		`${texte.titre} : résultat des votes, scrutins AN${texte.senat ? ' et Sénat' : ''} et navette ` +
		`parlementaire. ${
			texte.etat === 'promulgue'
				? `Loi ${texte.numeroLoi ? `n° ${texte.numeroLoi} ` : ''}promulguée.`
				: `Texte ${etatLabel}.`
		} Qui a voté quoi sur PolitiDex.`;

	return {
		texte,
		acteursNoms,
		metaTitle,
		description
	};
};
