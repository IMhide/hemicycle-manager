<script lang="ts">
	/**
	 * Tabs sélecteur "Carrière" + un onglet par mandat (cf ADR 0017).
	 * État encodé en querystring `?leg=N` (cf décision UI utilisateur).
	 *
	 * Émet la valeur sélectionnée via callback `onSelect`. Le parent gère le
	 * routing — ce composant ne pousse pas l'URL, il rend juste la barre.
	 */
	import type { Mandat } from '$lib/types';

	interface Props {
		mandats: Mandat[];
		/** null = vue carrière, sinon numéro de législature */
		selected: number | null;
		onSelect: (leg: number | null) => void;
	}

	let { mandats, selected, onSelect }: Props = $props();

	// Tri chronologique croissant (le plus ancien à gauche après "Carrière")
	const ordered = $derived([...mandats].sort((a, b) => a.legislature - b.legislature));

	function annees(m: Mandat): string {
		const debut = new Date(m.datePriseFonction).getFullYear();
		const fin = m.dateFinFonction ? new Date(m.dateFinFonction).getFullYear() : null;
		return fin ? `${debut}-${fin}` : `${debut}-`;
	}
</script>

<div class="flex flex-wrap gap-1 border-b border-border-soft/50">
	<button
		type="button"
		class="px-4 py-2 text-sm font-semibold transition-colors border-b-2 -mb-px {selected === null
			? 'border-accent text-link'
			: 'border-transparent text-fg-muted hover:text-fg'}"
		onclick={() => onSelect(null)}
	>
		Carrière
	</button>
	{#each ordered as m (m.legislature)}
		<button
			type="button"
			class="px-4 py-2 text-sm font-semibold transition-colors border-b-2 -mb-px {selected ===
			m.legislature
				? 'border-accent text-link'
				: 'border-transparent text-fg-muted hover:text-fg'}"
			onclick={() => onSelect(m.legislature)}
		>
			{m.legislature}<sup>e</sup>
			<span class="text-[10px] font-normal opacity-70">({annees(m)})</span>
		</button>
	{/each}
</div>
