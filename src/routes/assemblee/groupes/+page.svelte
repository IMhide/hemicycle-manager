<script lang="ts">
	import { POLITICAL_ORDER } from '$lib/political-order';
	import type { Groupe } from '$lib/types';

	let { data } = $props();

	const legSorted = $derived([...data.legislatures].sort((a, b) => b.num - a.num));

	let scope = $state([...data.legislatures].sort((a, b) => b.num - a.num)[0]?.num ?? 17);

	const groupesScope = $derived.by(() => {
		const idx = data.legislatures.findIndex((l) => l.num === scope);
		const list = idx >= 0 ? data.groupesByLeg[idx] : [];
		return [...list].sort(
			(a, b) =>
				(POLITICAL_ORDER[a.libelleAbrege]?.rank ?? 99) -
				(POLITICAL_ORDER[b.libelleAbrege]?.rank ?? 99)
		);
	});
</script>

<svelte:head>
	<title>Groupes politiques — PolitiDex</title>
</svelte:head>

<section class="max-w-7xl mx-auto px-6 py-8">
	<div class="mb-6 flex flex-wrap items-end justify-between gap-3">
		<div>
			<h1 class="title-display text-4xl">Groupes politiques</h1>
			<p class="text-assembly-muted text-sm mt-1">
				Classés de gauche à droite (selon les scores
				<a
					class="underline hover:text-assembly-accent"
					href="https://www.chesdata.eu/2024-chapel-hill-expert-survey-ches"
					target="_blank"
					rel="noopener">CHES 2024</a
				>).
			</p>
		</div>
		<div class="flex items-center gap-1 text-xs">
			<span class="text-assembly-muted">Législature :</span>
			{#each legSorted as l (l.num)}
				<button
					class="px-3 py-1 rounded {scope === l.num
						? 'bg-assembly-accent text-assembly-bg font-semibold'
						: 'border border-assembly-border text-assembly-muted hover:text-slate-200'}"
					onclick={() => (scope = l.num)}
				>
					{l.num}<sup>e</sup>
				</button>
			{/each}
		</div>
	</div>

	<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
		{#each groupesScope as groupe (groupe.id)}
			{@const rank = POLITICAL_ORDER[groupe.libelleAbrege]?.rank ?? 99}
			<a
				href="/assemblee/groupes/{groupe.legislature}/{groupe.id}/"
				class="card p-4 hover:border-assembly-accent/60 transition-colors flex items-start gap-4"
				style="border-left: 4px solid {groupe.couleur}"
			>
				<div
					class="w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center title-display text-sm"
					style="background-color: {groupe.couleur}; color: white;"
				>
					{groupe.libelleAbrege.slice(0, 4)}
				</div>
				<div class="flex-1 min-w-0">
					<div class="flex items-center gap-2 flex-wrap">
						<h2 class="font-semibold truncate">{groupe.libelle}</h2>
						{#if rank < 99}
							<span class="text-[10px] text-assembly-muted">rang {rank}/12</span>
						{/if}
					</div>
					<div class="text-xs text-assembly-muted mt-0.5">
						{groupe.libelleAbrege} · {groupe.effectifFin} député{groupe.effectifFin > 1 ? 's' : ''}
					</div>
				</div>
			</a>
		{/each}
	</div>
</section>
