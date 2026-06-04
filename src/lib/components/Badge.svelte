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

	// Aplats francs (DS §2/§4) : bordure brutaliste --border + fond plein coloré
	// par tier + texte sombre. Contraste AA garanti en Light comme en Dark
	// (texte noir sur aplats vifs). `legend` = jaune acide (la rareté max).
	const tierStyle = $derived(
		{
			gold: 'bg-amber-400 text-[#0a0a0a]',
			silver: 'bg-surface-2 text-fg',
			bronze: 'bg-orange-400 text-[#0a0a0a]',
			special: 'bg-rose-400 text-[#0a0a0a]',
			legend: 'bg-accent text-accent-fg'
		}[display.tier]
	);
</script>

<span
	class="inline-flex items-center gap-1.5 px-2.5 py-1 border-2 border-border text-xs {tierStyle}"
>
	<span aria-hidden="true">{display.emoji}</span>
	<span class="font-semibold whitespace-nowrap">{display.label}</span>
	<InfoTip title={display.label} size="xs">
		{display.description}
	</InfoTip>
</span>
