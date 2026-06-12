<script lang="ts">
	/**
	 * Index des groupes politiques du Sénat, scopé par triennat (cf ADR 0028).
	 * Pendant Sénat de /assemblee/groupes : sélecteur de triennat + grille de
	 * cartes, classées par préséance (ordre politique du groupe au Sénat).
	 */
	import { readableTextOn } from '$lib/contrast-text';
	import type { GroupeSenat } from '$lib/types';
	import { untrack } from 'svelte';

	let { data } = $props();

	const triennatsSorted = $derived(
		[...data.triennats].sort((a, b) => b.dateDebut.localeCompare(a.dateDebut))
	);

	// Init = triennat le plus récent. `untrack` : instantané unique de `data`
	// (statique au prerender), pas une dépendance réactive (state_referenced_locally).
	let scope = $state(
		untrack(
			() => [...data.triennats].sort((a, b) => b.dateDebut.localeCompare(a.dateDebut))[0]?.id ?? ''
		)
	);

	const groupesScope = $derived.by<GroupeSenat[]>(() => {
		const idx = data.triennats.findIndex((t) => t.id === scope);
		const list = idx >= 0 ? data.groupesByTriennat[idx] : [];
		return [...list].sort((a, b) => a.preseance - b.preseance);
	});
</script>

<svelte:head>
	<title>Groupes du Sénat — PolitiDex</title>
</svelte:head>

<section class="max-w-[1536px] mx-auto px-6 py-8">
	<div class="mb-6 flex flex-wrap items-end justify-between gap-3">
		<div>
			<h1 class="title-display text-4xl">Groupes du Sénat</h1>
			<p class="text-fg-muted text-sm mt-1">
				Les groupes politiques pour chaque triennat, classés par préséance.
			</p>
		</div>
		<div class="flex items-center gap-1 text-xs">
			<span class="text-fg-muted">Triennat :</span>
			{#each triennatsSorted as t (t.id)}
				<button
					class="px-3 py-1 {scope === t.id
						? 'bg-accent text-accent-fg font-semibold'
						: 'border border-border-soft text-fg-muted hover:text-fg'}"
					onclick={() => (scope = t.id)}
				>
					{t.libelle}
				</button>
			{/each}
		</div>
	</div>

	{#if groupesScope.length === 0}
		<div class="card p-8 text-center text-fg-muted">
			<div class="title-display text-4xl mb-2 text-fg-muted">∅</div>
			<div class="text-sm">Aucun groupe pour ce triennat.</div>
		</div>
	{:else}
		<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
			{#each groupesScope as groupe (groupe.code)}
				<a
					href="/senat/groupes/{groupe.triennat}/{groupe.code}/"
					class="card p-4 hover:border-accent/60 transition-colors flex items-start gap-4"
					style="border-left: 4px solid {groupe.couleur}"
				>
					<div
						class="w-12 h-12 flex-shrink-0 flex items-center justify-center title-display text-sm"
						style="background-color: {groupe.couleur}; color: {readableTextOn(
							groupe.couleur
						)}; border: 2px solid var(--border);"
					>
						{groupe.libelleAbrege.slice(0, 4)}
					</div>
					<div class="flex-1 min-w-0">
						<h2 class="font-semibold truncate">{groupe.libelle}</h2>
						<div class="text-xs text-fg-muted mt-0.5">
							{groupe.libelleAbrege} · {groupe.effectifFin} sénateur·rice·s · Overall moyen
							{groupe.overallMoyen}
						</div>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</section>
