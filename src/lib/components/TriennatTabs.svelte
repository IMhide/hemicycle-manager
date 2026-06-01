<script lang="ts">
	/**
	 * Tabs sélecteur "Carrière" + un onglet par triennat couvert par le sénateur
	 * (cf ADR 0028). Le triennat est l'analogue de la législature côté AN.
	 *
	 * Ordre antichronologique : `[Carrière] [2023-2026] [2020-2023] [2017-2020]`.
	 *
	 * Émet la valeur sélectionnée via callback `onSelect`. Le parent gère le
	 * routing — ce composant ne pousse pas l'URL, il rend juste la barre.
	 */
	import type { Senateur } from '$lib/types';
	import { TRIENNATS, type TriennatId } from '$lib/triennats';
	import InfoTip from './InfoTip.svelte';

	interface Props {
		senateur: Senateur;
		/** null = vue carrière, sinon TriennatId (ex. "2023-2026") */
		selected: TriennatId | null;
		onSelect: (triennat: TriennatId | null) => void;
	}

	let { senateur, selected, onSelect }: Props = $props();

	// Tri antichronologique sur la table figée (le plus récent en premier)
	const ordered = $derived(
		TRIENNATS.filter((t) => senateur.carriere.triennats.includes(t.id))
			.slice()
			.reverse()
	);
</script>

<div class="flex flex-wrap items-center gap-1 border-b border-border-soft/50">
	<button
		type="button"
		class="px-4 py-2 text-sm font-semibold transition-colors border-b-2 -mb-px {selected === null
			? 'border-accent text-link'
			: 'border-transparent text-fg-muted hover:text-fg'}"
		onclick={() => onSelect(null)}
	>
		Carrière
	</button>
	{#each ordered as t (t.id)}
		<button
			type="button"
			class="px-3 py-2 text-xs font-semibold transition-colors border-b-2 -mb-px {selected ===
			t.id
				? 'border-accent text-link'
				: 'border-transparent text-fg-muted hover:text-fg'}"
			onclick={() => onSelect(t.id)}
			title={`Triennat ${t.id}`}
		>
			{t.id}
		</button>
	{/each}
	<div class="ml-auto pr-1">
		<InfoTip title="Triennat sénatorial" placement="bottom">
			Au Sénat, le <b>triennat</b> (3 ans entre 2 renouvellements de la moitié des
			sièges) joue le rôle de la législature côté AN.
			<a href="/faq#senat-triennat" class="text-link hover:underline">
				Voir la FAQ
			</a>
			pour le détail.
		</InfoTip>
	</div>
</div>
