<script lang="ts">
	/**
	 * Tabs sélecteur "Carrière" + un onglet par session parlementaire annuelle
	 * touchée par le sénateur (cf ADR 0023).
	 *
	 * Au Sénat, l'unité de cohorte est la session (sept→sept), pas la législature.
	 * État encodé en querystring `?session=AAAA`. Le parent gère le routing.
	 */
	import type { Senateur } from '$lib/types';

	interface Props {
		senateur: Senateur;
		/** null = vue carrière, sinon sesann (ex: 2024 = "2024-2025") */
		selected: number | null;
		onSelect: (sesann: number | null) => void;
	}

	let { senateur, selected, onSelect }: Props = $props();

	const ordered = $derived(
		[...senateur.carriere.sessions].sort((a, b) => a - b)
	);

	function libelle(sesann: number): string {
		return `${sesann}-${(sesann + 1).toString().slice(-2)}`;
	}
</script>

<div class="flex flex-wrap gap-1 border-b border-assembly-border/50">
	<button
		type="button"
		class="px-4 py-2 text-sm font-semibold transition-colors border-b-2 -mb-px {selected === null
			? 'border-assembly-accent text-assembly-accent'
			: 'border-transparent text-assembly-muted hover:text-slate-200'}"
		onclick={() => onSelect(null)}
	>
		Carrière
	</button>
	{#each ordered as sesann (sesann)}
		<button
			type="button"
			class="px-3 py-2 text-xs font-semibold transition-colors border-b-2 -mb-px {selected ===
			sesann
				? 'border-assembly-accent text-assembly-accent'
				: 'border-transparent text-assembly-muted hover:text-slate-200'}"
			onclick={() => onSelect(sesann)}
		>
			{libelle(sesann)}
		</button>
	{/each}
</div>
