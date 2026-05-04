/**
 * Political ordering of the 17e législature parliamentary groups.
 *
 * Source : Chapel Hill Expert Survey 2024 (CHES 2024) — academic dataset
 * scoring European parties on the left-right axis (lrgen, 0=far-left to
 * 10=far-right). https://www.chesdata.eu/2024-chapel-hill-expert-survey-ches
 *
 * For groups with no direct CHES entry (GDR, EcoS, DR), we use the proxy of
 * their dominant party. For groups too recent to be coded (UDR) or too
 * heterogeneous (LIOT, NI), we document the chosen rank explicitly.
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

/** Map: groupe abrégé → political rank metadata. */
export const POLITICAL_ORDER: Record<string, PoliticalRank> = {
	GDR: {
		rank: 1,
		chesScore: 1.73,
		confidence: 'proxy',
		rationale: 'PCF proxy (CHES 2024 party_id 601)',
		gradientColor: GRADIENT_BY_RANK[1]
	},
	'LFI-NFP': {
		rank: 2,
		chesScore: 0.82,
		confidence: 'direct',
		rationale: 'CHES 2024 party_id 627',
		gradientColor: GRADIENT_BY_RANK[2]
	},
	EcoS: {
		rank: 3,
		chesScore: 2.30,
		confidence: 'proxy',
		rationale: 'EELV proxy (CHES 2024 party_id 605)',
		gradientColor: GRADIENT_BY_RANK[3]
	},
	SOC: {
		rank: 4,
		chesScore: 3.45,
		confidence: 'direct',
		rationale: 'CHES 2024 party_id 602',
		gradientColor: GRADIENT_BY_RANK[4]
	},
	LIOT: {
		rank: 5,
		chesScore: null,
		confidence: 'estimated',
		rationale: 'Technical heterogeneous group; placed at centre by convention',
		gradientColor: GRADIENT_BY_RANK[5]
	},
	Dem: {
		rank: 6,
		chesScore: 5.36,
		confidence: 'direct',
		rationale: 'MoDem (CHES 2024 party_id 613)',
		gradientColor: GRADIENT_BY_RANK[6]
	},
	EPR: {
		rank: 7,
		chesScore: 6.27,
		confidence: 'direct',
		rationale: 'Renaissance (CHES 2024 party_id 626)',
		gradientColor: GRADIENT_BY_RANK[7]
	},
	HOR: {
		rank: 8,
		chesScore: 6.60,
		confidence: 'direct',
		rationale: 'Horizons (CHES 2024 party_id 631)',
		gradientColor: GRADIENT_BY_RANK[8]
	},
	DR: {
		rank: 9,
		chesScore: 7.73,
		confidence: 'proxy',
		rationale: 'LR proxy (CHES 2024 party_id 609); same group renamed',
		gradientColor: GRADIENT_BY_RANK[9]
	},
	UDR: {
		rank: 10,
		chesScore: 8.5,
		confidence: 'estimated',
		rationale: 'Too recent for CHES; Conseil d\'État classed UDR as far-right',
		gradientColor: GRADIENT_BY_RANK[10]
	},
	RN: {
		rank: 11,
		chesScore: 8.82,
		confidence: 'direct',
		rationale: 'CHES 2024 party_id 610',
		gradientColor: GRADIENT_BY_RANK[11]
	},
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
