<script lang="ts">
	/**
	 * Badge avec InfoTip systématique (cf ADR 0016).
	 * Reçoit un id de badge (mandat ou carrière), résolu via le module badges.ts.
	 */
	import type { BadgeMandat, BadgeCarriere } from '$lib/types';
	import type { BadgeCarriereCross } from '$lib/elus';
	import {
		badgeMandatDisplay,
		badgeCarriereDisplay,
		badgeCarriereCrossDisplay,
		badgeDisplayUnknown
	} from '$lib/badges';
	import InfoTip from './InfoTip.svelte';

	interface Props {
		id: BadgeMandat | BadgeCarriere | BadgeCarriereCross | string;
		kind?: 'mandat' | 'carriere' | 'elu-carriere';
	}

	let { id, kind }: Props = $props();

	const MANDAT_IDS = new Set<string>(['top-loyaliste', 'frondeur', 'presence-or', 'absent-remarquable']);
	const CARRIERE_IDS = new Set<string>(['recomposition', 'transfuge', 'veteran', 'reelu']);
	const CARRIERE_CROSS_IDS = new Set<string>([
		'Recomposition',
		'Transfuge',
		'Veteran',
		'Reelu',
		'Bicameral'
	]);

	const display = $derived.by(() => {
		if (kind === 'mandat') return badgeMandatDisplay(id as BadgeMandat);
		if (kind === 'carriere') return badgeCarriereDisplay(id as BadgeCarriere);
		if (kind === 'elu-carriere')
			return badgeCarriereCrossDisplay(id as BadgeCarriereCross);
		if (MANDAT_IDS.has(id)) return badgeMandatDisplay(id as BadgeMandat);
		if (CARRIERE_IDS.has(id)) return badgeCarriereDisplay(id as BadgeCarriere);
		if (CARRIERE_CROSS_IDS.has(id))
			return badgeCarriereCrossDisplay(id as BadgeCarriereCross);
		return badgeDisplayUnknown(id);
	});

	const tierStyle = $derived(
		{
			gold: 'border-amber-400/60 bg-amber-400/10 text-amber-200',
			silver: 'border-border-soft bg-surface-2 text-fg',
			bronze: 'border-orange-700/60 bg-orange-700/15 text-orange-300',
			special: 'border-rose-400/60 bg-rose-400/10 text-rose-200',
			legend:
				'border-fuchsia-400/70 bg-gradient-to-r from-fuchsia-400/15 to-amber-400/15 text-fuchsia-200'
		}[display.tier]
	);
</script>

<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs {tierStyle}">
	<span aria-hidden="true">{display.emoji}</span>
	<span class="font-semibold whitespace-nowrap">{display.label}</span>
	<InfoTip title={display.label} size="xs">
		{display.description}
	</InfoTip>
</span>
