/**
 * Badges — labels et descriptions pour rendu UI.
 *
 * Le calcul des badges est entièrement délégué au pipeline `scripts/fetch-data.ts`
 * (cf ADR 0017 : top/bottom 10% par cohorte législature pour les badges mandat ;
 * critères carrière pour Recomposition, Transfuge, Vétéran, Réélu·e).
 *
 * Ce module ne fait que mapper un identifiant de badge en métadonnées
 * d'affichage : libellé, emoji, tier, description (servant aussi de texte
 * d'InfoTip cf ADR 0016).
 */

import type { BadgeMandat, BadgeCarriere } from './types';

export type BadgeTier = 'gold' | 'silver' | 'bronze' | 'special' | 'legend';

export interface BadgeDisplay {
	id: BadgeMandat | BadgeCarriere;
	label: string;
	emoji: string;
	tier: BadgeTier;
	description: string;
}

const MANDAT: Record<BadgeMandat, Omit<BadgeDisplay, 'id'>> = {
	'top-loyaliste': {
		label: 'Top loyaliste',
		emoji: '🤝',
		tier: 'gold',
		description:
			'Top 10 % de la législature pour le taux de loyauté (alignement avec la majorité du groupe au moment du vote).'
	},
	frondeur: {
		label: 'Frondeur·euse',
		emoji: '🔥',
		tier: 'special',
		description:
			'Top 10 % de la législature en nombre absolu de votes opposés à la majorité du groupe d’appartenance au moment du vote.'
	},
	'presence-or': {
		label: 'Présence en or',
		emoji: '🎯',
		tier: 'gold',
		description: 'Top 10 % de la législature pour le taux de présence aux scrutins éligibles.'
	},
	'absent-remarquable': {
		label: 'Absent·e remarquable',
		emoji: '👻',
		tier: 'special',
		description: 'Bottom 10 % de la législature pour le taux de présence aux scrutins éligibles.'
	}
};

const CARRIERE: Record<BadgeCarriere, Omit<BadgeDisplay, 'id'>> = {
	recomposition: {
		label: 'Recomposition',
		emoji: '🔀',
		tier: 'silver',
		description:
			'A changé de groupe entre deux législatures. Indique une trajectoire évolutive (réélection sous une autre étiquette, recomposition partisane).'
	},
	transfuge: {
		label: 'Transfuge',
		emoji: '🚪',
		tier: 'special',
		description:
			'A changé de groupe pendant le même mandat. Souvent suite à une démission ou une exclusion. Plus marquant qu’une simple recomposition.'
	},
	veteran: {
		label: 'Vétéran',
		emoji: '🎖️',
		tier: 'gold',
		description: 'A siégé dans au moins 3 législatures couvertes par PolitiDex.'
	},
	reelu: {
		label: 'Réélu·e',
		emoji: '🔁',
		tier: 'bronze',
		description: 'A obtenu au moins 2 mandats consécutifs.'
	}
};

export function badgeMandatDisplay(b: BadgeMandat): BadgeDisplay {
	return { id: b, ...MANDAT[b] };
}

export function badgeCarriereDisplay(b: BadgeCarriere): BadgeDisplay {
	return { id: b, ...CARRIERE[b] };
}

export function badgeDisplayUnknown(b: string): BadgeDisplay {
	return {
		id: b as BadgeMandat,
		label: b,
		emoji: '⚪',
		tier: 'bronze',
		description: 'Badge non documenté.'
	};
}

// ────────────────────────────────────────────────────────────────────────────
// Badges carrière cross-chambre (cf ADR 0032)
// ────────────────────────────────────────────────────────────────────────────

import type { BadgeCarriereCross } from './elus';

const CARRIERE_CROSS: Record<BadgeCarriereCross, Omit<BadgeDisplay, 'id'>> = {
	Recomposition: { ...CARRIERE.recomposition },
	Transfuge: { ...CARRIERE.transfuge },
	Veteran: {
		...CARRIERE.veteran,
		description: 'A siégé dans au moins 3 mandats au total (toutes chambres confondues).'
	},
	Reelu: {
		...CARRIERE.reelu,
		description: 'A obtenu au moins 2 mandats consécutifs dans la même chambre.'
	},
	Bicameral: {
		label: 'Bicaméral·e',
		emoji: '🏛️',
		tier: 'legend',
		description:
			'A siégé dans les deux chambres du Parlement français — Assemblée nationale ET Sénat. Statut rare, ~50 cas attendus dans PolitiDex.'
	}
};

export function badgeCarriereCrossDisplay(b: BadgeCarriereCross): BadgeDisplay {
	return { id: b as unknown as BadgeMandat, ...CARRIERE_CROSS[b] };
}
