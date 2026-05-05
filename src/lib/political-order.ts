/**
 * Political ordering of parliamentary groups for the 15ᵉ, 16ᵉ and 17ᵉ
 * législatures (ère Macron complète).
 *
 * Source : Chapel Hill Expert Survey 2024 (CHES 2024) — academic dataset
 * scoring European parties on the left-right axis (lrgen, 0=far-left to
 * 10=far-right). https://www.chesdata.eu/2024-chapel-hill-expert-survey-ches
 *
 * For groups with no direct CHES entry (GDR, EcoS, DR), we use the proxy of
 * their dominant party. For groups too recent to be coded (UDR) or too
 * heterogeneous (LIOT, LT, NI), we document the chosen rank explicitly.
 *
 * Groupes spécifiques à la 15ᵉ : LREM/REM (Renaissance proxy), NG/SOC (PS),
 * FI/LFI (LFI), UDI-AGIR/UAI/UDI_I (LR proxy), LT (centre hétérogène),
 * EDS (EELV proxy, éphémère 2020), AE (Horizons proxy), LC (LR proxy, éphémère).
 *
 * The ranks below match the seating order from left (physical) to right when
 * looking at the chamber from the perchoir: GDR is rank 1 (far left), RN is
 * rank 11 (far right). NI (non inscrits, rank 12) sit on a separate "bench"
 * outside the political ordering — they are not placed on the gradient.
 */

export interface PoliticalRank {
	rank: number;          // 1..12; 12 = NI (off-gradient)
	chesScore: number | null;
	confidence: 'direct' | 'proxy' | 'estimated' | 'na';
	rationale: string;
	gradientColor: string; // 12-step palette: dark red → pink → yellow → light blue → dark blue → grey
}

/** Ordered palette: rank 1 (far left) → rank 12 (NI). */
export const GRADIENT_BY_RANK: Record<number, string> = {
	1: '#7f1d1d',  // dark red — GDR
	2: '#b91c1c',  // red — LFI-NFP
	3: '#dc2626',  // bright red — EcoS
	4: '#f472b6',  // pink — SOC
	5: '#facc15',  // yellow — LIOT (centre, technical group)
	6: '#bae6fd',  // light blue — Dem
	7: '#7dd3fc',  // sky blue — EPR
	8: '#38bdf8',  // mid blue — HOR
	9: '#0ea5e9',  // blue — DR
	10: '#1d4ed8', // strong blue — UDR
	11: '#1e3a8a', // dark blue — RN
	12: '#9ca3af'  // grey — NI (bench)
};

// Couleurs métier (réutilisables entre legs sur les groupes équivalents).
const COLOR_GDR = GRADIENT_BY_RANK[1];
const COLOR_LFI = GRADIENT_BY_RANK[2];
const COLOR_ECO = GRADIENT_BY_RANK[3];
const COLOR_SOC = GRADIENT_BY_RANK[4];
const COLOR_TECH = GRADIENT_BY_RANK[5];
const COLOR_DEM = GRADIENT_BY_RANK[6];
const COLOR_LREM = GRADIENT_BY_RANK[7];
const COLOR_HOR = GRADIENT_BY_RANK[8];
const COLOR_LR = GRADIENT_BY_RANK[9];
const COLOR_UDR = GRADIENT_BY_RANK[10];
const COLOR_RN = GRADIENT_BY_RANK[11];

/** Map: groupe abrégé → political rank metadata.
 *  Couvre les législatures 15ᵉ, 16ᵉ, 17ᵉ — les abrégés peuvent varier d'une
 *  leg à l'autre (ex: LREM en 15ᵉ devient RE en 16ᵉ puis EPR en 17ᵉ). */
export const POLITICAL_ORDER: Record<string, PoliticalRank> = {
	// ── Extrême gauche / gauche radicale ─────────────────────────────────
	GDR: {
		rank: 1,
		chesScore: 1.73,
		confidence: 'proxy',
		rationale: 'PCF proxy (CHES 2024 party_id 601)',
		gradientColor: COLOR_GDR
	},
	'GDR - NUPES': {
		rank: 1,
		chesScore: 1.73,
		confidence: 'proxy',
		rationale: 'GDR sous bannière NUPES en 16ᵉ — PCF proxy',
		gradientColor: COLOR_GDR
	},
	FI: {
		rank: 2,
		chesScore: 0.82,
		confidence: 'direct',
		rationale: 'LFI 15ᵉ (CHES 2024 party_id 627)',
		gradientColor: COLOR_LFI
	},
	LFI: {
		rank: 2,
		chesScore: 0.82,
		confidence: 'direct',
		rationale: 'LFI (CHES 2024 party_id 627)',
		gradientColor: COLOR_LFI
	},
	'LFI - NUPES': {
		rank: 2,
		chesScore: 0.82,
		confidence: 'direct',
		rationale: 'LFI sous bannière NUPES en 16ᵉ',
		gradientColor: COLOR_LFI
	},
	'LFI-NFP': {
		rank: 2,
		chesScore: 0.82,
		confidence: 'direct',
		rationale: 'LFI sous bannière NFP en 17ᵉ',
		gradientColor: COLOR_LFI
	},

	// ── Écologistes ──────────────────────────────────────────────────────
	EcoS: {
		rank: 3,
		chesScore: 2.3,
		confidence: 'proxy',
		rationale: 'EELV proxy (CHES 2024 party_id 605)',
		gradientColor: COLOR_ECO
	},
	'Ecolo - NUPES': {
		rank: 3,
		chesScore: 2.3,
		confidence: 'proxy',
		rationale: 'Écologistes sous bannière NUPES en 16ᵉ — EELV proxy',
		gradientColor: COLOR_ECO
	},
	EDS: {
		rank: 3,
		chesScore: 2.3,
		confidence: 'estimated',
		rationale:
			'Écologie Démocratie Solidarité (15ᵉ, mai-oct 2020) — scission gauche-écolo de LREM, EELV proxy',
		gradientColor: COLOR_ECO
	},

	// ── Socialistes / sociaux-démocrates ────────────────────────────────
	SOC: {
		rank: 4,
		chesScore: 3.45,
		confidence: 'direct',
		rationale: 'PS (CHES 2024 party_id 602)',
		gradientColor: COLOR_SOC
	},
	NG: {
		rank: 4,
		chesScore: 3.45,
		confidence: 'direct',
		rationale: 'Nouvelle Gauche (15ᵉ, 2017-2018) — préfiguration de SOC, même groupe renommé',
		gradientColor: COLOR_SOC
	},

	// ── Centre / technique hétérogène ────────────────────────────────────
	LIOT: {
		rank: 5,
		chesScore: null,
		confidence: 'estimated',
		rationale: 'Technical heterogeneous group; placed at centre by convention',
		gradientColor: COLOR_TECH
	},
	LT: {
		rank: 5,
		chesScore: null,
		confidence: 'estimated',
		rationale:
			'Libertés et Territoires (15ᵉ, 2018-2022) — hétérogène centre/régionaliste, ancêtre de LIOT',
		gradientColor: COLOR_TECH
	},

	// ── MoDem ────────────────────────────────────────────────────────────
	Dem: {
		rank: 6,
		chesScore: 5.36,
		confidence: 'direct',
		rationale: 'MoDem (CHES 2024 party_id 613)',
		gradientColor: COLOR_DEM
	},
	MODEM: {
		rank: 6,
		chesScore: 5.36,
		confidence: 'direct',
		rationale: 'MoDem 15ᵉ (CHES 2024 party_id 613)',
		gradientColor: COLOR_DEM
	},

	// ── Macroniste central (LaREM → RE → EPR) ────────────────────────────
	LaREM: {
		rank: 7,
		chesScore: 6.27,
		confidence: 'direct',
		rationale: 'La République En Marche (15ᵉ) — Renaissance proxy (CHES 2024 party_id 626)',
		gradientColor: COLOR_LREM
	},
	LREM: {
		rank: 7,
		chesScore: 6.27,
		confidence: 'direct',
		rationale: 'LREM alias (15ᵉ) — Renaissance proxy',
		gradientColor: COLOR_LREM
	},
	REM: {
		rank: 7,
		chesScore: 6.27,
		confidence: 'direct',
		rationale: 'REM (15ᵉ early naming) — Renaissance proxy',
		gradientColor: COLOR_LREM
	},
	RE: {
		rank: 7,
		chesScore: 6.27,
		confidence: 'direct',
		rationale: 'Renaissance 16ᵉ (CHES 2024 party_id 626)',
		gradientColor: COLOR_LREM
	},
	EPR: {
		rank: 7,
		chesScore: 6.27,
		confidence: 'direct',
		rationale: 'Ensemble pour la République 17ᵉ — Renaissance proxy',
		gradientColor: COLOR_LREM
	},

	// ── Centre-droit / Horizons ──────────────────────────────────────────
	HOR: {
		rank: 8,
		chesScore: 6.6,
		confidence: 'direct',
		rationale: 'Horizons (CHES 2024 party_id 631)',
		gradientColor: COLOR_HOR
	},
	'Agir ens': {
		rank: 8,
		chesScore: 6.6,
		confidence: 'proxy',
		rationale:
			'Agir Ensemble (15ᵉ, 2020-2022) — courant centre-droit macroniste, Horizons proxy',
		gradientColor: COLOR_HOR
	},
	AE: {
		rank: 8,
		chesScore: 6.6,
		confidence: 'proxy',
		rationale: 'Agir Ensemble alias (15ᵉ) — Horizons proxy',
		gradientColor: COLOR_HOR
	},

	// ── Droite / LR ──────────────────────────────────────────────────────
	LR: {
		rank: 9,
		chesScore: 7.73,
		confidence: 'direct',
		rationale: 'LR (CHES 2024 party_id 609)',
		gradientColor: COLOR_LR
	},
	DR: {
		rank: 9,
		chesScore: 7.73,
		confidence: 'proxy',
		rationale: 'Droite Républicaine 17ᵉ — LR proxy (même groupe renommé)',
		gradientColor: COLOR_LR
	},
	'UDI-AGIR': {
		rank: 9,
		chesScore: 7.73,
		confidence: 'proxy',
		rationale: 'UDI, Agir et Indépendants 15ᵉ — LR proxy',
		gradientColor: COLOR_LR
	},
	'UDI-I': {
		rank: 9,
		chesScore: 7.73,
		confidence: 'proxy',
		rationale: 'UDI et Indépendants 15ᵉ — LR proxy',
		gradientColor: COLOR_LR
	},
	UDI_I: {
		rank: 9,
		chesScore: 7.73,
		confidence: 'proxy',
		rationale: 'UDI et Indépendants 15ᵉ alias — LR proxy',
		gradientColor: COLOR_LR
	},
	LC: {
		rank: 9,
		chesScore: 7.73,
		confidence: 'proxy',
		rationale: 'Les Constructifs (15ᵉ, 2017-2018) — dissidence LR/UDI pro-Macron, LR proxy',
		gradientColor: COLOR_LR
	},

	// ── Extrême droite ───────────────────────────────────────────────────
	UDR: {
		rank: 10,
		chesScore: 8.5,
		confidence: 'estimated',
		rationale: "Too recent for CHES; Conseil d'État classed UDR as far-right",
		gradientColor: COLOR_UDR
	},
	AD: {
		rank: 10,
		chesScore: 8.5,
		confidence: 'estimated',
		rationale: 'À Droite 17ᵉ — éphémère, classement extrême-droite estimé',
		gradientColor: COLOR_UDR
	},
	RN: {
		rank: 11,
		chesScore: 8.82,
		confidence: 'direct',
		rationale: 'CHES 2024 party_id 610',
		gradientColor: COLOR_RN
	},

	// ── Non-inscrits ─────────────────────────────────────────────────────
	NI: {
		rank: 12,
		chesScore: null,
		confidence: 'na',
		rationale: 'Non-inscrits — heterogeneous, displayed on a separate bench',
		gradientColor: GRADIENT_BY_RANK[12]
	}
};

export function rankOf(groupeAbrege: string | null): number {
	if (!groupeAbrege) return 12;
	return POLITICAL_ORDER[groupeAbrege]?.rank ?? 12;
}

export function gradientColorFor(groupeAbrege: string | null): string {
	if (!groupeAbrege) return GRADIENT_BY_RANK[12];
	return POLITICAL_ORDER[groupeAbrege]?.gradientColor ?? GRADIENT_BY_RANK[12];
}
