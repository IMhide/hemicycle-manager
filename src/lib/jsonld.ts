/**
 * Génération de données structurées JSON-LD (cf ADR 0045, PR E).
 *
 * Schémas émis :
 *  - WebSite + Organization + Dataset (home)
 *  - Person + `sameAs` officiel AN/Sénat (fiche élu) — clé pour relier la fiche
 *    à l'entité que Google reconnaît déjà et ranker sur le nom (cf plan SEO §0bis)
 *  - Legislation + `sameAs` Légifrance/Sénat (fiche texte)
 *
 * Injection via un <script type="application/ld+json"> dans <svelte:head>
 * (composant JsonLd). On échappe `</script>` pour ne pas casser le parsing HTML.
 */

import type { Elu } from './elus.ts';
import type { TexteUnifie } from './types.ts';
import { SITE_URL } from './sitemap.ts';

/** Échappe une chaîne JSON-LD pour insertion sûre dans <script> (cf ADR 0045).
 *  Seul `</script` (et `<!--`) peut casser le parsing → on neutralise `<`. */
export function serializeJsonLd(obj: unknown): string {
	return JSON.stringify(obj).replace(/</g, '\\u003c');
}

// ────────────────────────────────────────────────────────────────────────────
// URLs officielles (sameAs)
// ────────────────────────────────────────────────────────────────────────────

/** Fiche officielle AN d'un député à partir du PA-id.
 *  Format vérifié : https://www.assemblee-nationale.fr/dyn/deputes/PA1592 */
export function officialAnUrl(paId: string): string {
	return `https://www.assemblee-nationale.fr/dyn/deputes/${paId}`;
}

/** Slug d'URL officielle Sénat : `{nom prenom}` translittéré (minuscules, sans
 *  accents, non-[a-z]→`_`, underscores collapsés) suivi DIRECTEMENT du matricule
 *  en minuscules. Ex. ("Rossignol","Laurence","11045K") → "rossignol_laurence11045k".
 *  Format vérifié : https://www.senat.fr/senateur/rossignol_laurence11045k.html */
export function senatSlug(nom: string, prenom: string, matricule: string): string {
	const base = `${nom} ${prenom}`
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/æ/gi, 'ae')
		.replace(/œ/gi, 'oe')
		.toLowerCase()
		.replace(/[^a-z]+/g, '_')
		.replace(/^_+|_+$/g, '');
	return `${base}${matricule.toLowerCase()}`;
}

/** Fiche officielle Sénat d'un sénateur à partir de nom/prénom/matricule. */
export function officialSenatUrl(nom: string, prenom: string, matricule: string): string {
	return `https://www.senat.fr/senateur/${senatSlug(nom, prenom, matricule)}.html`;
}

// ────────────────────────────────────────────────────────────────────────────
// Person (fiche élu)
// ────────────────────────────────────────────────────────────────────────────

/** Construit le JSON-LD `Person` d'un élu, avec `sameAs` vers ses fiches
 *  officielles AN et/ou Sénat (cf ADR 0045). `jobTitle` reflète le(s) rôle(s). */
export function buildPersonLd(elu: Elu): Record<string, unknown> {
	const aAN = elu.mandats.some((m) => m.chambre === 'AN');
	const aSenat = elu.mandats.some((m) => m.chambre === 'SENAT');
	const jobTitle = [aAN ? 'Député' : null, aSenat ? 'Sénateur' : null].filter(Boolean).join(' / ');

	const sameAs: string[] = [];
	if (elu.paId) sameAs.push(officialAnUrl(elu.paId));
	if (elu.matricule) sameAs.push(officialSenatUrl(elu.nom, elu.prenom, elu.matricule));

	const worksFor = [
		aAN ? { '@type': 'GovernmentOrganization', name: 'Assemblée nationale' } : null,
		aSenat ? { '@type': 'GovernmentOrganization', name: 'Sénat' } : null
	].filter(Boolean);

	const person: Record<string, unknown> = {
		'@context': 'https://schema.org',
		'@type': 'Person',
		name: `${elu.prenom} ${elu.nom}`,
		givenName: elu.prenom,
		familyName: elu.nom,
		gender: elu.sexe === 'F' ? 'Female' : 'Male',
		jobTitle,
		url: `${SITE_URL}/elus/${elu.slug}/`
	};
	if (elu.dateNaissance) person.birthDate = elu.dateNaissance;
	if (elu.photoUrl) person.image = elu.photoUrl;
	if (worksFor.length) person.worksFor = worksFor.length === 1 ? worksFor[0] : worksFor;
	if (sameAs.length) person.sameAs = sameAs;
	return person;
}

// ────────────────────────────────────────────────────────────────────────────
// Legislation (fiche texte)
// ────────────────────────────────────────────────────────────────────────────

/** Construit le JSON-LD `Legislation` d'un texte, avec `sameAs` Légifrance (JO)
 *  et/ou dossier Sénat (cf ADR 0045). */
export function buildLegislationLd(texte: TexteUnifie): Record<string, unknown> {
	const sameAs = [texte.urlJO, texte.senatUrl].filter((u): u is string => !!u);
	const ld: Record<string, unknown> = {
		'@context': 'https://schema.org',
		'@type': 'Legislation',
		name: texte.titre,
		legislationType: texte.typeLibelle,
		url: `${SITE_URL}/textes/${texte.slug}/`,
		legislationJurisdiction: 'France'
	};
	if (texte.datePromulgation) ld.legislationDate = texte.datePromulgation;
	if (texte.numeroLoi) ld.legislationIdentifier = texte.numeroLoi;
	if (texte.etat === 'promulgue') ld.legislationLegalForce = 'InForce';
	if (sameAs.length) ld.sameAs = sameAs;
	return ld;
}

// ────────────────────────────────────────────────────────────────────────────
// Home : WebSite + Organization + Dataset
// ────────────────────────────────────────────────────────────────────────────

export function buildWebsiteLd(): Record<string, unknown> {
	return {
		'@context': 'https://schema.org',
		'@type': 'WebSite',
		name: 'PolitiDex',
		url: `${SITE_URL}/`,
		inLanguage: 'fr-FR',
		description:
			'Le Pokédex des élus nationaux français : votes, présence, loyauté et parcours des députés et sénateurs, à partir de l’open data Etalab.'
	};
}

export function buildOrganizationLd(): Record<string, unknown> {
	return {
		'@context': 'https://schema.org',
		'@type': 'Organization',
		name: 'PolitiDex',
		url: `${SITE_URL}/`,
		logo: `${SITE_URL}/favicon.svg`
	};
}

/** Dataset (licence Etalab, couverture 2017-2026) — peut gagner Google Dataset
 *  Search, niche peu concurrencée (cf ADR 0045). */
export function buildDatasetLd(): Record<string, unknown> {
	return {
		'@context': 'https://schema.org',
		'@type': 'Dataset',
		name: 'PolitiDex — votes et parcours des élus nationaux français',
		description:
			'Jeu de données dérivé de l’open data Etalab (Assemblée nationale, Sénat) : députés, sénateurs, scrutins nominaux, textes législatifs et navette parlementaire, ère Macron.',
		url: `${SITE_URL}/`,
		inLanguage: 'fr-FR',
		temporalCoverage: '2017-09-24/..',
		license: 'https://www.etalab.gouv.fr/licence-ouverte-open-licence',
		creator: { '@type': 'Organization', name: 'PolitiDex' },
		distribution: [
			{
				'@type': 'DataDownload',
				encodingFormat: 'application/json',
				contentUrl: `${SITE_URL}/data/elus.json`
			},
			{
				'@type': 'DataDownload',
				encodingFormat: 'application/json',
				contentUrl: `${SITE_URL}/data/textes-unifies.json`
			}
		]
	};
}
