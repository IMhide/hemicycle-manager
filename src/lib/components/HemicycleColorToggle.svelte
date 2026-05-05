<script lang="ts">
	/**
	 * Toggle de mode de coloration de l'hémicycle :
	 * - GCHES : gradient politique CHES gauche → droite (sourcé, cohérent cross-leg)
	 * - OFFI  : couleurs officielles des groupes (Etalab)
	 */
	import { colorMode, type ColorMode } from '$lib/color-mode.svelte';
	import InfoTip from './InfoTip.svelte';

	function set(m: ColorMode) {
		colorMode.set(m);
	}
</script>

<div class="flex items-center gap-1">
	<span class="text-assembly-muted inline-flex items-center gap-1">
		Couleur
		<InfoTip title="Mode de coloration de l'hémicycle" size="xs" placement="bottom">
			<strong>GCHES</strong> — gradient politique gauche → droite basé sur les scores
			<a
				href="https://www.chesdata.eu/2024-chapel-hill-expert-survey-ches"
				target="_blank"
				rel="noopener"
				class="underline">CHES 2024</a
			>. Cohérent entre législatures.
			<br /><br />
			<strong>OFFI</strong> — couleurs officielles publiées par chaque groupe (Open Data Etalab).
			Plus identitaire mais moins cohérent (ex: LaREM en violet en 15ᵉ).
		</InfoTip>
		<span>:</span>
	</span>
	<button
		class="px-3 py-1 rounded font-semibold {colorMode.current === 'gradient'
			? 'bg-assembly-accent text-assembly-bg'
			: 'border border-assembly-border text-assembly-muted hover:text-slate-200'}"
		onclick={() => set('gradient')}
		aria-pressed={colorMode.current === 'gradient'}
	>
		GCHES
	</button>
	<button
		class="px-3 py-1 rounded font-semibold {colorMode.current === 'groupe'
			? 'bg-assembly-accent text-assembly-bg'
			: 'border border-assembly-border text-assembly-muted hover:text-slate-200'}"
		onclick={() => set('groupe')}
		aria-pressed={colorMode.current === 'groupe'}
	>
		OFFI
	</button>
</div>
