import type { Depute, DeputeStats } from './types';

export interface Badge {
	id: string;
	label: string;
	emoji: string;
	description: string;
	tier: 'gold' | 'silver' | 'bronze' | 'special';
}

/**
 * Compute the badges a deputy qualifies for.
 *
 * Thresholds are chosen relative to what's realistic in this dataset:
 *  - average presence is ~30% (the cohort baseline), so >50% = remarkable.
 *  - average loyalty is ~93% (groups are disciplined in the 5e République),
 *    so >97% qualifies for the loyalist badge.
 */
export function computeBadges(d: Depute, s: DeputeStats): Badge[] {
	const badges: Badge[] = [];

	if (s.tauxPresence > 0.5) {
		badges.push({
			id: 'always-here',
			label: 'Toujours présent',
			emoji: '🎯',
			description: `Présent à plus de 50 % des scrutins (vous : ${Math.round(s.tauxPresence * 100)} %).`,
			tier: 'gold'
		});
	} else if (s.tauxPresence > 0.35) {
		badges.push({
			id: 'frequent',
			label: 'Assidu',
			emoji: '✋',
			description: `Présent à plus de 35 % des scrutins (vous : ${Math.round(s.tauxPresence * 100)} %).`,
			tier: 'silver'
		});
	}

	if (s.tauxLoyaute !== null && s.tauxLoyaute >= 0.99 && s.scrutinsEligibles > 100) {
		badges.push({
			id: 'pure-loyalist',
			label: 'Loyaliste pur',
			emoji: '🤝',
			description: `Aligné à 99 % ou plus avec sa majorité de groupe.`,
			tier: 'gold'
		});
	} else if (s.tauxLoyaute !== null && s.tauxLoyaute >= 0.97 && s.scrutinsEligibles > 100) {
		badges.push({
			id: 'loyalist',
			label: 'Loyaliste',
			emoji: '✅',
			description: `Aligné à 97 % ou plus avec sa majorité de groupe.`,
			tier: 'silver'
		});
	}

	if (s.frondes > 50) {
		badges.push({
			id: 'rebel',
			label: 'Franc-tireur',
			emoji: '🔥',
			description: `${s.frondes} votes contre la position majoritaire de son groupe.`,
			tier: 'special'
		});
	} else if (s.frondes > 15) {
		badges.push({
			id: 'occasional-rebel',
			label: 'Indépendant',
			emoji: '💥',
			description: `${s.frondes} votes contre la majorité de son groupe.`,
			tier: 'bronze'
		});
	}

	if (d.premiereElection) {
		badges.push({
			id: 'rookie',
			label: 'Premier mandat',
			emoji: '👶',
			description: 'Premier mandat de député à l\'Assemblée nationale.',
			tier: 'bronze'
		});
	}

	const expressed = s.pour + s.contre + s.abstention;
	if (expressed > 3000) {
		badges.push({
			id: 'voter',
			label: 'Hyperactif',
			emoji: '🦅',
			description: `Plus de 3000 votes exprimés.`,
			tier: 'gold'
		});
	}

	return badges;
}
