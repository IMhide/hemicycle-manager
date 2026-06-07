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
	/** Identifiant du texte législatif auquel ce scrutin se rattache (cf type `Texte`).
	 *  null pour les motions de censure, suspensions de séance, déclarations
	 *  gouvernementales — légitimement hors champ "texte législatif". */
	texteId: string | null;
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

/** Métadonnées du scrutin dénormalisées DANS l'historique (cf ADR 0041).
 *  Permet à la fiche élu d'afficher l'historique SANS charger
 *  `scrutins-index.json` (6,1 Mo). Projetées au pipeline depuis ScrutinIndex. */
export interface VoteHistoryScrutinMeta {
	titre: string;
	date: string;
	sort: string;
	texteId: string | null;
	pour: number;
	contre: number;
	abstention: number;
}

/** Compact: [scrutinUid, position, isFronde 0|1, legislature, meta?]
 *  - legislature : ajoutée Phase 1 pour filtrer sans cross-ref index.
 *  - meta : 5e élément dénormalisé (ADR 0041) — présent dans les fichiers
 *    `historique/{paId}.json` générés, pour éviter de charger l'index global.
 *    Optionnel dans le type pour rétro-compat (ancien format à 4 éléments). */
export type VoteHistoryItem =
	| [string, VotePosition, 0 | 1, number]
	| [string, VotePosition, 0 | 1, number, VoteHistoryScrutinMeta];

// ────────────────────────────────────────────────────────────────────────────
// Textes législatifs (cf ADR à venir)
// ────────────────────────────────────────────────────────────────────────────

/** Type éditorial du texte, dérivé soit du parser titre, soit du dump dossiers
 *  Etalab. Le parser titre est la source d'autorité quand les deux divergent. */
export type TexteType =
	| 'projet-loi'
	| 'projet-loi-finances'
	| 'projet-loi-finances-rectificative'
	| 'projet-loi-financement-ss'
	| 'projet-loi-organique'
	| 'projet-loi-constitutionnelle'
	| 'proposition-loi'
	| 'proposition-loi-organique'
	| 'proposition-loi-constitutionnelle'
	| 'proposition-resolution'
	| 'proposition-resolution-europeenne'
	| 'autre';

/** Un "texte" agrège tous les scrutins relatifs à un même dossier législatif :
 *  amendements, sous-amendements, articles, votes solennels (1ʳᵉ lecture,
 *  navette, lecture définitive, CMP).
 *
 *  L'identifiant `id` est :
 *   - le `dossierRef` officiel Etalab (`DLR…`) quand connu (~11% des scrutins) ;
 *   - sinon une signature synthétique stable dérivée du titre normalisé
 *     (préfixe `sig-`), garantie cohérente entre runs grâce à la normalisation
 *     du parser de titres (cf `scripts/lib/texte-parser.ts`).
 *
 *  Les motions de censure, suspensions de séance et déclarations gouvernementales
 *  ne sont PAS représentées comme des textes (le scrutin a `texteId: null`). */
export interface Texte {
	id: string;
	legislature: number;
	titre: string;
	type: TexteType;
	/** Code procédure Etalab quand connu via le dump dossiers (libellé brut). */
	procedureLibelle: string | null;
	/** PA-ids des députés à l'origine du dépôt (vide pour projets gouvernementaux). */
	initiateurs: string[];
	/** Liste des uids de scrutins, ordre chronologique (plus ancien → plus récent). */
	scrutins: string[];
	dateDebut: string; // date du 1er scrutin lié
	dateFin: string; // date du dernier scrutin lié
	/** Date de promulgation au JO si connue (extraite du dump dossiers). */
	datePromulgation: string | null;
	/** Sort final = celui du dernier scrutin (vote solennel ou ultime). */
	sortFinal: string;
	nbScrutins: number;
	/** Nombre de scrutins dont le typeVote est "scrutin public solennel"
	 *  (votes finaux par lecture, plus signifiants pour la position globale). */
	nbVotesSolennels: number;
	/** Indique si le texte est enrichi par le dump dossiers (titre officiel,
	 *  procédure, initiateurs, timeline). false = identifiant fallback signature. */
	enrichiDossiersAN: boolean;
	/** URL du dossier équivalent sur le site du Sénat quand connu (extrait
	 *  de `titreDossier.senatChemin` du dump dossiers AN). Premier jalon
	 *  navette cross-chambre, cf handoff N3.a. ~32% des dossiers AN 17ᵉ. */
	senatUrl: string | null;
	/** Référence vers la version Sénat du même texte (N3.c navette).
	 *  null = pas de version Sénat trouvée dans le dataset (texte non transmis
	 *  ou Sénat n'a pas eu de scrutin nominal sur ce texte). Quand non-null,
	 *  contient l'id du TexteSenat correspondant — utile pour le matching
	 *  cross-chambre et l'affichage des deux colonnes sur `/textes/[id]`. */
	versionAutreChambre: { texteSenatId: string; matchedVia: 'slug' | 'titre' } | null;
	/** Timeline navette : suite ordonnée des actes "remarquables" extraite
	 *  de l'arbre `actesLegislatifs` du dump dossiers AN (cf ADR 0037).
	 *  Vide pour les textes signature (non enrichis). */
	timelineNavette: TimelineActe[];
}

/** Phase navette retenue pour l'UI, dérivée du `codeActe` Etalab. */
export type TimelinePhase =
	| 'depot'
	| 'premiere-lecture'
	| 'deuxieme-lecture'
	| 'nouvelle-lecture'
	| 'lecture-definitive'
	| 'lecture-unique'
	| 'cmp'
	| 'conseil-constitutionnel'
	| 'promulgation'
	| 'engagement-responsabilite' // 49.3
	| 'motion-censure'
	| 'retrait'
	| 'autre';

/** Chambre/instance responsable d'un acte. */
export type TimelineChambre = 'AN' | 'SEN' | 'CMP' | 'CC' | 'GVT' | 'JO';

/** Un événement chronologique du parcours navette d'un texte (cf ADR 0037).
 *  Cf `scripts/lib/timeline-navette.ts` pour la construction. */
export interface TimelineActe {
	date: string; // YYYY-MM-DD
	code: string; // Code brut Etalab (ex. "AN1-DEBATS-DEC", "CMP-DEC")
	chambre: TimelineChambre;
	phase: TimelinePhase;
	/** Libellé court lisible pour l'UI (ex. "Vote en séance Sénat"). */
	label: string;
	/** Si l'acte correspond à un scrutin nominal connu côté AN ou Sénat,
	 *  uid du scrutin permettant un lien direct. null = vote à main levée
	 *  ou pas de scrutin nominal détecté à cette date. */
	scrutinUid: string | null;
	/** Chambre où le scrutin nominal a été identifié (utile pour construire
	 *  l'URL `/assemblee/scrutins/...` vs `/senat/scrutins/...`). */
	scrutinChambre: 'AN' | 'SEN' | null;
}

/** Entrée minimale pour afficher le nom d'un acteur Etalab. Utilisé pour
 *  les initiateurs de textes législatifs qui peuvent être des ministres
 *  (non-députés, absents de personnes.json). Cf ADR 0035. */
export interface ActeurNom {
	id: string; // PA-id Etalab
	civ: string; // "M.", "Mme", "" si non renseigné
	prenom: string;
	nom: string;
}

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
		textes: number;
		/** Nombre d'acteurs Etalab (députés + ministres + sénateurs + anciens) dans
		 *  `acteurs-noms.json`, utilisé pour afficher les initiateurs de textes
		 *  non-députés (cf ADR 0035). */
		acteurs: number;
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
	sessions: SessionStats[]; // brique data : toutes les sessions chevauchant le mandat (cf ADR 0028)
	triennats: TriennatStats[]; // unité de regroupement exposée UI (cf ADR 0028)
	cumul: MandatStats; // cumul pondéré des sessions du mandat
	badgesMandat: BadgeMandat[]; // réutilisé tel quel (presence-or, frondeur, …)
}

/** Stats d'un mandat pour une session particulière. Brique data sous-jacente,
 *  plus exposée en UI v1 (cf ADR 0028). Conservée pour souplesse future. */
export interface SessionStats {
	sesann: number; // ex. 2024 (= "2024-2025")
	scrutinsEligibles: number;
	stats: MandatStats; // réutilisé du bloc AN
	rangs: MandatRangs; // réutilisé du bloc AN
}

/** Stats d'un mandat pour un triennat (cohorte par triennat, cf ADR 0028).
 *  Unité de regroupement principale Sénat — analogue de la législature côté AN. */
export interface TriennatStats {
	triennat: string; // TriennatId, ex. "2023-2026"
	scrutinsEligibles: number;
	stats: MandatStats;
	rangs: MandatRangs;
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
	sessions: number[]; // brique data : toutes les sessions touchées (asc)
	triennats: string[]; // TriennatId[] — triennats touchés (asc), exposé UI (cf ADR 0028)
	badgesCarriere: BadgeCarriere[]; // réutilisé (recomposition / transfuge / veteran / reelu)
	overall: number;
	volume: number;
}

/** Groupe politique au Sénat, scopé par triennat (analogue à Groupe AN par leg, cf ADR 0028). */
export interface GroupeSenat {
	code: string; // grppolcod (clé)
	triennat: string; // TriennatId, ex. "2023-2026"
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

/** Métadonnées d'une session parlementaire annuelle (sept→sept).
 *  Brique data sous-jacente, plus exposée en UI v1 (cf ADR 0028). */
export interface SessionMeta {
	sesann: number;
	libelle: string; // ex. "2024-2025"
	dateDebut: string; // 1er octobre N (heuristique)
	dateFin: string; // 30 septembre N+1
	nbSenateursActifs: number;
	nbScrutins: number;
}

/** Métadonnées d'un triennat (cf ADR 0028 + 0029) — unité de regroupement principale Sénat. */
export interface TriennatMeta {
	id: string; // TriennatId, ex. "2023-2026"
	libelle: string; // ex. "2023-2026"
	dateDebut: string; // ISO, début du triennat
	dateFin: string; // ISO, fin du triennat
	enCours: boolean;
	sessions: number[]; // sesann couvertes par le triennat
	nbSenateursActifs: number; // nombre distinct de sénateurs ayant siégé sur le triennat
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
	/** Id du TexteSenat auquel ce scrutin appartient, ou `null` (motion, scrutin
	 *  de procédure sans dossier identifiable). Cf textes-senat.ts. N3.b navette. */
	texteId: string | null;
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
	sessions: number[]; // sesann couvertes (brique data)
	triennats: string[]; // TriennatId[] — triennats couverts (cf ADR 0028)
	counts: {
		senateurs: number;
		mandats: number;
		groupesUniques: number;
		sessions: number;
		triennats: number;
		scrutins: number;
		votesNominatifs: number;
	};
	sources: Record<string, string>;
}

// ────────────────────────────────────────────────────────────────────────────
// Textes législatifs Sénat (N3.b navette, symétrique de Texte côté AN)
// ────────────────────────────────────────────────────────────────────────────

/** Type de texte législatif Sénat. Reprend la nomenclature `typloi.typloicod`
 *  du dump dosleg pour rester proche de la source. */
export type TexteSenatType =
	| 'pjl' // projet de loi (ordinaire)
	| 'pjlo' // projet de loi organique
	| 'pjlc' // projet de loi constitutionnelle
	| 'pjlf' // projet de loi de finances
	| 'pjlr' // projet de loi de finances rectificative
	| 'pjlg' // projet de loi de règlement
	| 'pjfs' // projet de loi de financement sécurité sociale
	| 'pfsr' // projet de loi de financement sécurité sociale rectificative
	| 'prog' // projet de loi de programmation
	| 'ppl' // proposition de loi
	| 'pplo' // proposition de loi organique
	| 'pplc' // proposition de loi constitutionnelle
	| 'ppro' // proposition de loi de programmation
	| 'refe' // proposition de loi en application de l'art 11
	| 'pac' // résolution européenne (proposition d'acte communautaire)
	| 'ppre' // modification du règlement Sénat
	| 'ppra' // proposition de résolution autre
	| 'pprp' // résolution art 34-1
	| 'enq' // commission d'enquête
	| 'cvn' // convention
	| 'mref' // motion référendaire
	| 'dape' // déclaration politique générale (rare)
	| 'autre';

/** État final d'un dossier législatif Sénat (étalonné via `etaloi`). */
export type TexteSenatEtat =
	| 'en-cours'
	| 'promulgue'
	| 'rejete'
	| 'retire'
	| 'caduc'
	| 'fusionne'
	| 'inconnu';

/** Agrégation d'un ensemble de scrutins Sénat portant sur le même texte
 *  législatif, symétrique du type `Texte` côté AN (ADR 0035).
 *
 *  Stratégie de groupement (cf scripts/lib/textes-senat.ts) :
 *   - Niveau 1 : matching par signature titre (`scr.scrint` ↔ `loi.loitit`)
 *     contre les dossiers `loi` du dump dosleg → id = `loicod` (12 chars trimmés)
 *   - Niveau 2 : fallback signature (`sig-…`) pour les scrutins sans dossier
 *
 *  Aucune FK structurée n'existe entre `scr` et `loi` dans dosleg.sql, c'est
 *  la principale différence avec le pipeline AN. */
export interface TexteSenat {
	/** Soit un `loicod` brut (ex. `74884`) trimmé, soit `sig-<sesann>|<type>|<nom>`. */
	id: string;
	/** Triennat de rattachement (cf ADR 0028 + 0029). Le triennat est celui du
	 *  premier scrutin du texte. */
	triennat: string;
	titre: string;
	/** Type Sénat brut (`typloicod` du dump quand connu, sinon classé via parser titre). */
	type: TexteSenatType;
	/** Libellé long du type ("Projet de loi de finances", etc.). */
	typeLibelle: string;
	/** État final du dossier (cf `etaloi`). */
	etat: TexteSenatEtat;
	/** Numéro officiel de loi promulguée (ex. `2024-201`), null si non promulgué. */
	numeroLoi: string | null;
	/** Liste des `uid` de scrutins Sénat, ordre chronologique. */
	scrutins: string[];
	dateDebut: string; // date du 1er scrutin lié
	dateFin: string; // date du dernier scrutin lié
	/** Date de promulgation au JO si connue (`loi.loidatjo`). */
	datePromulgation: string | null;
	/** URL de publication au JO si connue (`loi.url_jo`). */
	urlJO: string | null;
	/** Sort final = sort du dernier scrutin (ou état du dossier si promulgué). */
	sortFinal: string;
	nbScrutins: number;
	/** Indique si le texte est enrichi par le dump dosleg (id = `loicod`).
	 *  false = identifiant fallback signature. */
	enrichiDosleg: boolean;
	/** Référence vers la version AN du même texte (N3.c navette).
	 *  null = pas de version AN trouvée. Quand non-null, contient l'id du
	 *  Texte AN correspondant — utile pour le matching cross-chambre. */
	versionAutreChambre: { texteAnId: string; matchedVia: 'slug' | 'titre' } | null;
}

// ────────────────────────────────────────────────────────────────────────────
// Texte unifié cross-chambre (N3.d, cf ADR 0036)
// ────────────────────────────────────────────────────────────────────────────

/** État global d'un texte unifié, cascade ADR 0036 :
 *  promulgue > rejete > retire/caduc > en-cours. */
export type TexteUnifieEtat =
	| 'promulgue'
	| 'rejete'
	| 'retire'
	| 'caduc'
	| 'fusionne'
	| 'en-cours'
	| 'inconnu';

/** Référence légère vers un texte spécifique d'une chambre (sous-objet
 *  de `TexteUnifie`). Conserve l'id natif côté chambre et les compteurs
 *  utilisés par les colonnes de la fiche unifiée `/textes/[id]`. */
export interface TexteUnifieChambreRef {
	/** id natif côté chambre (DLR…/sig-… côté AN, loicod côté Sénat). */
	texteId: string;
	titre: string;
	dateDebut: string;
	dateFin: string;
	nbScrutins: number;
	sortFinal: string;
}

/** Objet `TexteUnifie` — un texte législatif vu cross-chambre.
 *  Cf ADR 0036 pour la résolution des sources d'autorité.
 *
 *  Le `TexteUnifie` est l'entité canonique côté UI : une seule URL
 *  `/textes/[id]` par texte, peu importe combien de chambres l'ont examiné.
 *  Les routes chambre /assemblee/textes et /senat/textes ont été supprimées
 *  (cf commit suppression routes chambre).
 *
 *  Pour ~70-80% des textes, un seul des deux côtés `an`/`senat` est non-null
 *  (textes mono-chambre). Les ~20-30% bicaméraux ont les deux côtés et la
 *  fiche affiche les deux colonnes côte à côte. */
export interface TexteUnifie {
	/** Id canonique stable : id AN si présent, sinon id Sénat. Cf ADR 0036. */
	id: string;
	/** URL lisible : préfixe titre + suffixe d'id (haché si signature). ADR 0042. */
	slug: string;
	/** Titre canonique court (AN prioritaire, fallback titre Sénat nettoyé). */
	titre: string;
	/** Type éditorial (AN prioritaire, sinon projection Sénat). */
	type: TexteType;
	/** Libellé long du type. */
	typeLibelle: string;
	/** État global après cascade. */
	etat: TexteUnifieEtat;
	/** N° de loi promulguée si applicable (`loi.loinumjo` Sénat). */
	numeroLoi: string | null;
	/** Date de promulgation au JO si applicable. */
	datePromulgation: string | null;
	/** URL Légifrance du texte au JO si applicable. */
	urlJO: string | null;
	/** URL du dossier officiel sur senat.fr (extrait dump AN, N3.a). */
	senatUrl: string | null;
	/** PA-ids des initiateurs (AN expose, Sénat n'expose pas). */
	initiateurs: string[];
	/** Libellé de la procédure (AN expose, Sénat n'expose pas directement). */
	procedureLibelle: string | null;
	/** Période globale : min(débuts) → max(fins). */
	dateDebut: string;
	dateFin: string;
	/** Total scrutins toutes chambres confondues. */
	nbScrutins: number;
	/** Indique si bicaméral. Critère (ADR 0037) : la timelineNavette contient
	 *  au moins un acte de chambre `SEN` (preuve de passage Sénat même sans
	 *  scrutin nominal côté pipeline Sénat). Plus large que l'ancien critère
	 *  basé uniquement sur la présence de scrutins nominaux des deux côtés. */
	bicameral: boolean;
	/** Côté AN si présent. */
	an: TexteUnifieChambreRef | null;
	/** Côté Sénat si présent. */
	senat: TexteUnifieChambreRef | null;
	/** Timeline navette propagée depuis le Texte AN sous-jacent (cf ADR 0037).
	 *  Vide pour les textes Sénat-seul ou non enrichis. */
	timelineNavette: TimelineActe[];
}
