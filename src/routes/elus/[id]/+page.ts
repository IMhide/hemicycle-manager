import type { PageLoad } from './$types';
import {
	loadPersonne,
	loadGroupes,
	loadHistorique,
	loadScrutinsIndex,
	loadLegislatures,
	loadSenateur,
	loadGroupesSenat,
	loadTriennats,
	loadHistoriqueSenat,
	loadScrutinsSenatIndex
} from '$lib/data';
import { loadElusManifest } from '$lib/elus';
import type { TriennatId } from '$lib/triennats';

// SPA mode : la fiche Élu charge le manifest + les données AN et/ou Sénat
// nécessaires côté client. Trop volumineux pour prerender chaque eluId.
export const prerender = false;
export const ssr = false;

export const load: PageLoad = async ({ fetch, params }) => {
	const manifest = await loadElusManifest(fetch);
	const elu = manifest.elus.find((e) => e.id === params.id);
	if (!elu) throw new Error(`Élu ${params.id} introuvable`);

	// Toujours charger les méta (légères) — utiles pour TriennatTabs et libellés.
	const [legislatures, triennats] = await Promise.all([
		loadLegislatures(fetch),
		loadTriennats(fetch)
	]);

	// Côté AN : Personne + groupes + historique + scrutins-index si l'élu y a un mandat.
	let personne = null;
	let groupesAN: Awaited<ReturnType<typeof loadGroupes>> = [];
	let historiqueAN: Awaited<ReturnType<typeof loadHistorique>> = [];
	let scrutinsIndexAN: Awaited<ReturnType<typeof loadScrutinsIndex>> = [];
	if (elu.paId) {
		personne = await loadPersonne(fetch, elu.paId);
		if (personne) {
			const groupesByLeg = await Promise.all(legislatures.map((l) => loadGroupes(fetch, l.num)));
			groupesAN = groupesByLeg.flat();
			[historiqueAN, scrutinsIndexAN] = await Promise.all([
				loadHistorique(fetch, elu.paId).catch(() => []),
				loadScrutinsIndex(fetch)
			]);
		}
	}

	// Côté Sénat : Senateur + groupes des triennats touchés + historique + scrutins-index.
	let senateur = null;
	let groupesSenat: Awaited<ReturnType<typeof loadGroupesSenat>> = [];
	let historiqueSenat: Awaited<ReturnType<typeof loadHistoriqueSenat>> = [];
	let scrutinsIndexSenat: Awaited<ReturnType<typeof loadScrutinsSenatIndex>> = [];
	if (elu.matricule) {
		senateur = await loadSenateur(fetch, elu.matricule);
		if (senateur) {
			const triennatsTouches: TriennatId[] = senateur.carriere.triennats as TriennatId[];
			const groupesByTriennat = await Promise.all(
				triennatsTouches.map((t) => loadGroupesSenat(fetch, t))
			);
			groupesSenat = groupesByTriennat.flat();
			[historiqueSenat, scrutinsIndexSenat] = await Promise.all([
				loadHistoriqueSenat(fetch, elu.matricule).catch(() => []),
				loadScrutinsSenatIndex(fetch)
			]);
		}
	}

	return {
		elu,
		legislatures,
		triennats,
		personne,
		groupesAN,
		historiqueAN,
		scrutinsIndexAN,
		senateur,
		groupesSenat,
		historiqueSenat,
		scrutinsIndexSenat
	};
};
