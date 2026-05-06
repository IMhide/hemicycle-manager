// Types partagés entre le pipeline data et le front-end.
// Doivent rester en phase avec scripts/fetch-data.ts.
//
// Modèle Phase 1 : Personne unique cross-législature avec mandats[] (cf ADR 0015).
// Une personne politique = une fiche, indépendamment du nombre de législatures.

// ────────────────────────────────────────────────────────────────────────────
// Identité
// ────────────────────────────────────────────────────────────────────────────

/** Une personne politique, identifiée par son PA-id stable cross-législature (cf ADR 0018). */
export interface Personne {
	id: string; // PA-id (ex: "PA1592")
	identite: PersonneIdentite;
	mandats: Mandat[]; // chronologique croissant, ≥ 1
	carriere: CarriereAggregee;
}

export interface PersonneIdentite {
	civ: string; // "M.", "Mme"
	prenom: string;
	nom: string;
	sexe: 'F' | 'M';
	dateNaissance: string | null; // ISO 8601
	villeNaissance: string | null;
	photoUrl: string;
	professionDeclaree: string | null;
}

// ────────────────────────────────────────────────────────────────────────────
// Mandat parlementaire (1 par législature où la personne a siégé)
// ────────────────────────────────────────────────────────────────────────────

export interface Mandat {
	legislature: number; // ex: 16, 17
	datePriseFonction: string; // ISO
	dateFinFonction: string | null; // null = mandat en cours
	premiereElection: boolean;
	circonscription: Circonscription | null;
	place: number | null; // numéro de siège dans l'hémicycle (placeHemicycle officielle)
	appartenancesGroupe: AppartenanceGroupe[]; // chronologique, ≥ 1, cf ADR 0016
	scrutinsEligibles: number;
	stats: MandatStats;
	rangs: MandatRangs;
	badgesMandat: BadgeMandat[];
}

export interface Circonscription {
	dep: string;
	depNum: string;
	num: string;
	region: string;
}

/** Une appartenance datée à un groupe politique au sein d'un mandat (cf ADR 0016). */
export interface AppartenanceGroupe {
	groupeId: string; // PO-id du groupe
	dateDebut: string; // ISO
	dateFin: string | null; // null = en cours
	qualite: string; // "Membre", "Président", "Vice-Président", "Député non-inscrit"…
	/** True pour les appartenances NI transitoires (≤ 7 jours en début de législature
	 *  avant inscription au groupe officiel). À ignorer pour les badges Transfuge. */
	isTransitoireNI: boolean;
}

// ────────────────────────────────────────────────────────────────────────────
// Stats par mandat (cf ADR 0017)
// ────────────────────────────────────────────────────────────────────────────

/** Une métrique brute exposant numerator + denominator + rate.
 *  Permet le cumul carrière en moyenne pondérée (cf ADR 0017). */
export interface RatioStat {
	numerator: number;
	denominator: number;
	rate: number; // entre 0 et 1
}

/** Variant de RatioStat où le rate peut être null (groupes sans majorité claire). */
export interface NullableRatioStat {
	numerator: number;
	denominator: number;
	rate: number | null;
}

export interface MandatStats {
	presence: RatioStat;
	participation: RatioStat;
	loyaute: NullableRatioStat;
	frondes: { count: number; rate: number };
	/** Score Overall 0-99 du mandat. Formule cf ADR 0022 :
	 *  round((0.55 * participation + 0.35 * volume + 0.10 * presence) * 99)
	 *  avec volume = min(1, participation.numerator / volumeRef) et volumeRef = centile 95 cohorte législature. */
	overall: number;
	/** Volume normalisé 0-1 (= min(1, participation.numerator / volumeRef)).
	 *  Exposé pour permettre l'affichage radar sans recalcul (cf ADR 0022). */
	volume: number;
}

export interface MandatRangs {
	presence: { rank: number; total: number };
	participation: { rank: number; total: number };
	loyaute: { rank: number | null; total: number };
	frondes: { rank: number; total: number };
}

// ────────────────────────────────────────────────────────────────────────────
// Carrière agrégée (cumul tous mandats, sans rang — cf ADR 0017)
// ────────────────────────────────────────────────────────────────────────────

export interface CarriereAggregee {
	presence: RatioStat;
	participation: RatioStat;
	loyaute: NullableRatioStat;
	frondes: { count: number; rate: number };
	nbMandats: number;
	legislatures: number[]; // ex: [16, 17]
	badgesCarriere: BadgeCarriere[];
	/** Score Overall 0-99 sur la carrière entière. Formule cf ADR 0022.
	 *  volume normalisé sur centile 95 de la cohorte tous-mandats-cumulés (toutes légis confondues). */
	overall: number;
	/** Volume normalisé 0-1 sur la carrière (cf ADR 0022). */
	volume: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Badges (cf ADR 0017)
// ────────────────────────────────────────────────────────────────────────────

/** Badges calculés sur un mandat (visibles uniquement dans la tab du mandat). */
export type BadgeMandat =
	| 'top-loyaliste'
	| 'frondeur'
	| 'presence-or'
	| 'absent-remarquable';

/** Badges calculés sur la carrière entière (visibles dans toutes les vues). */
export type BadgeCarriere =
	| 'recomposition' // ≥ 2 mandats avec groupes différents (cf ADR 0016)
	| 'transfuge' // ≥ 1 mandat avec ≥ 2 appartenances groupe (hors NI-bridge)
	| 'veteran' // ≥ 3 législatures (pertinent à partir de Phase 2)
	| 'reelu'; // ≥ 2 mandats consécutifs

// ────────────────────────────────────────────────────────────────────────────
// Groupes politiques (scopés par législature, cf ADR 0015 + ADR 0016)
// ────────────────────────────────────────────────────────────────────────────

export interface Groupe {
	id: string; // PO-id
	legislature: number;
	libelle: string;
	libelleAbrege: string;
	couleur: string;
	preseance: number;
	presidentId: string | null; // PA-id du président de groupe
	dateDebut: string;
	dateFin: string | null; // null = encore actif (groupes 17e en cours)
	/** Effectif final du groupe (à la fin de la législature, ou à ce jour si en cours). */
	effectifFin: number;
	/** Moyenne d'overall des membres rattachés à ce groupe comme groupe principal
	 *  (cf ADR 0022 + ADR 0016). Calculé pipeline. 0 si aucun membre. */
	overallMoyen: number;
	/** Nb de personnes prises en compte dans `overallMoyen` (= membres ayant un mandat
	 *  dans cette législature et pour qui ce groupe est le principal). */
	overallEffectif: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Législatures (méta)
// ────────────────────────────────────────────────────────────────────────────

export interface LegislatureMeta {
	num: number;
	dateDebut: string;
	dateFin: string | null; // null = en cours
	nbPersonnes: number; // nb de personnes ayant siégé dans cette législature
	nbScrutins: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Scrutins (uids déjà uniques cross-législature, cf ADR 0015)
// ────────────────────────────────────────────────────────────────────────────

export type VotePosition = 'pour' | 'contre' | 'abstention' | 'nonVotant' | 'absent';

export interface ScrutinIndex {
	uid: string;
	legislature: number;
	numero: number;
	date: string;
	titre: string;
	sort: string;
	pour: number;
	contre: number;
	abstention: number;
	demandeur: string | null;
}

export interface ScrutinDetail extends ScrutinIndex {
	objet: string;
	typeVote: string;
	/** Vote par personne (PA-id → position). */
	votes: Record<string, VotePosition>;
	groupes: Array<{
		id: string;
		effectif: number;
		positionMajoritaire: string;
		decompte: { pour: number; contre: number; abstention: number; nonVotant: number };
	}>;
	/** PA-ids des frondeurs (vote opposé à la majoritaire de leur groupe au moment du vote). */
	frondeurs: string[];
}

// ────────────────────────────────────────────────────────────────────────────
// Historiques compacts (cf ADR 0012)
// ────────────────────────────────────────────────────────────────────────────

/** Compact: [scrutinUid, position, isFronde 0|1, legislature]
 *  legislature ajoutée Phase 1 pour permettre le filtrage sans cross-ref index. */
export type VoteHistoryItem = [string, VotePosition, 0 | 1, number];

// ────────────────────────────────────────────────────────────────────────────
// Build metadata
// ────────────────────────────────────────────────────────────────────────────

export interface BuildMeta {
	generatedAt: string;
	legislatures: number[]; // ex: [16, 17]
	counts: {
		personnes: number;
		mandats: number;
		groupes: number;
		scrutins: number;
	};
	sources: Record<string, string>;
}

// ════════════════════════════════════════════════════════════════════════════
// SÉNAT (Phase 3, cf ADR 0023..0027) — types parallèles aux types AN ci-dessus.
// L'agrégation cross-chambre AN/Sénat sera traitée en Phase 3c.
// Réutilisent : RatioStat, NullableRatioStat, MandatStats, MandatRangs,
// BadgeMandat, BadgeCarriere, VotePosition (définis plus haut côté AN).
// ════════════════════════════════════════════════════════════════════════════

/** Un sénateur, identifié par son matricule (cf ADR 0024). */
export interface Senateur {
	id: string; // matricule (ex. "08061X")
	identite: SenateurIdentite;
	mandats: MandatSenat[]; // chronologique croissant, ≥ 1
	carriere: CarriereSenatAggregee;
}

export interface SenateurIdentite {
	civ: string; // "M.", "Mme"
	prenom: string;
	nom: string;
	sexe: 'F' | 'M';
	dateNaissance: string | null; // ISO 8601, null pour très anciens
	dateDeces: string | null; // ISO 8601, spécifique Sénat (état ANCIEN)
	villeNaissance: string | null;
	photoUrl: string;
	professionDeclaree: string | null;
	categorieProfessionnelle: string | null; // champ Sénat distinct (PCS_INSEE-derived)
	etat: 'ACTIF' | 'ANCIEN';
}

/** Mandat sénatorial (1 par période d'éligibilité). Couvre plusieurs sessions. */
export interface MandatSenat {
	eluId: string; // ELUSEN.Identifiant_mandat (clé interne)
	datePriseFonction: string; // ISO
	dateFinFonction: string | null;
	motifDebut: string | null; // ELUSEN.Motif_debut (Election, Remplacement, …)
	motifFin: string | null; // ELUSEN.Motif_fin (Fin de mandat, Démission, Décès, …)
	circonscription: string | null; // ODSEN.Circonscription (libellé seul, le Sénat n'a pas de num circo)
	/** Place hémicycle 1..348. Non-null uniquement pour le mandat actif d'un sénateur en exercice. */
	place: number | null;
	/** Série 1 ou 2 (renouvellement par moitié). Non-null pour les actifs. */
	serie: 1 | 2 | null;
	appartenancesGroupe: AppartenanceGroupeSenat[]; // chronologique
	sessions: SessionStats[]; // toutes les sessions chevauchant le mandat
	cumul: MandatStats; // cumul pondéré des sessions du mandat
	badgesMandat: BadgeMandat[]; // réutilisé tel quel (presence-or, frondeur, …)
}

/** Stats d'un mandat pour une session particulière (cohorte par session, cf ADR 0023). */
export interface SessionStats {
	sesann: number; // ex. 2024 (= "2024-2025")
	scrutinsEligibles: number;
	stats: MandatStats; // réutilisé du bloc AN
	rangs: MandatRangs; // réutilisé du bloc AN
}

/** Une appartenance datée à un groupe politique au sein d'un mandat sénatorial.
 *  Symétrique à AppartenanceGroupe AN (ADR 0016) mais avec champs Sénat-spécifiques
 *  (fonction temporelle distincte de l'appartenance). */
export interface AppartenanceGroupeSenat {
	groupeCode: string; // grppolcod (ex. "SOC", "UMP", "LREM")
	groupeNomCourt: string; // grppollibcou ("Groupe Socialiste, Écologiste et Républicain", …)
	dateDebut: string; // ISO ou "" si non renseigné côté source
	dateFin: string | null;
	fonction: string; // "Membre", "Président", "Délégué", "Vice-Président", "Secrétaire"
	fonctionDateDebut: string | null;
	fonctionDateFin: string | null;
}

export interface CarriereSenatAggregee {
	presence: RatioStat;
	participation: RatioStat;
	loyaute: NullableRatioStat;
	frondes: { count: number; rate: number };
	nbMandats: number;
	sessions: number[]; // toutes les sessions touchées (asc)
	badgesCarriere: BadgeCarriere[]; // réutilisé (recomposition / transfuge / veteran / reelu)
	overall: number;
	volume: number;
}

/** Groupe politique au Sénat, scopé par session (analogue à Groupe AN par leg). */
export interface GroupeSenat {
	code: string; // grppolcod (clé)
	sesann: number;
	libelle: string; // grppollib (long)
	libelleAbrege: string; // grppollibcou (court, ex. "SOC", "UMP")
	couleur: string; // mappée via political-order si présent, sinon gris
	preseance: number; // groupe.ordre api-senat si dispo, sinon CHES rank
	presidentMatricule: string | null;
	dateDebut: string;
	dateFin: string | null;
	effectifFin: number;
	overallMoyen: number;
	overallEffectif: number;
}

/** Métadonnées d'une session parlementaire annuelle (sept→sept). */
export interface SessionMeta {
	sesann: number;
	libelle: string; // ex. "2024-2025"
	dateDebut: string; // 1er octobre N (heuristique)
	dateFin: string; // 30 septembre N+1
	nbSenateursActifs: number;
	nbScrutins: number;
}

export interface ScrutinSenatIndex {
	/** uid composé pour route URL : `${sesann}-${scrnum}` (ex. "2024-58"). */
	uid: string;
	sesann: number;
	scrnum: number;
	date: string; // scrdat ISO
	titre: string; // scrint
	sort: string; // soslib (peut être null source → "non précisé")
	pour: number;
	contre: number;
	abstention: number;
	nonVotant: number;
}

export interface ScrutinSenatDetail extends ScrutinSenatIndex {
	/** Vote par sénateur : matricule → position. Délégations ignorées en v1 (cf ADR 0027). */
	votes: Record<string, VotePosition>;
	groupes: Array<{
		code: string;
		effectif: number;
		positionMajoritaire: VotePosition | 'aucune';
		decompte: { pour: number; contre: number; abstention: number; nonVotant: number };
	}>;
	/** Matricules des frondeurs (vote opposé à la maj du groupe au moment du vote). */
	frondeurs: string[];
}

/** Compact: [scrutinUid, position, isFronde 0|1, sesann]
 *  Symétrique au tuple AN (cf ADR 0012). */
export type VoteHistoryItemSenat = [string, VotePosition, 0 | 1, number];

export interface BuildMetaSenat {
	generatedAt: string;
	sessions: number[];
	counts: {
		senateurs: number;
		mandats: number;
		groupesUniques: number;
		sessions: number;
		scrutins: number;
		votesNominatifs: number;
	};
	sources: Record<string, string>;
}
