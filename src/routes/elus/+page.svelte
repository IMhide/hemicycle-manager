<script lang="ts">
	/**
	 * Liste cross-chambre dédupliquée des élus PolitiDex (cf ADR 0030, 0031).
	 *
	 * Filtres : recherche libre, chambre (AN seul / Sénat seul / Bicaméral),
	 * groupe principal du dernier mandat (mêmes codes que /assemblee/deputes/
	 * + Sénat).
	 *
	 * Pagination : Top 50 visibles + lazy load (cf PR #7 vote-scroll pattern).
	 *
	 * Items linkent vers `/elus/[eluId]?tab=carriere` (vue cross-chambre).
	 */
	import type { Elu } from '$lib/elus';
	import { eluCategorie } from '$lib/elus';

	let { data } = $props();

	type Chambre = 'tous' | 'an' | 'senat' | 'bicameral';
	const PAGE_SIZE = 50;

	let q = $state('');
	let chambre = $state<Chambre>('tous');
	let visibleCount = $state(PAGE_SIZE);

	const elus = $derived(data.manifest.elus);

	function normalize(s: string): string {
		return s
			.normalize('NFD')
			.replace(/[̀-ͯ]/g, '')
			.toLowerCase();
	}

	const filtered = $derived.by(() => {
		const qn = normalize(q.trim());
		const list = elus.filter((e) => {
			if (chambre !== 'tous' && eluCategorie(e) !== chambre) return false;
			if (qn === '') return true;
			const name = normalize(`${e.prenom} ${e.nom}`);
			return name.includes(qn);
		});
		// Tri par nom puis prénom (déjà fait par le pipeline mais on le refait
		// après filtrage pour rester explicite).
		return list;
	});

	const visible = $derived(filtered.slice(0, visibleCount));

	function showMore() {
		visibleCount = Math.min(visibleCount + PAGE_SIZE, filtered.length);
	}

	function categorieLabel(c: 'an' | 'senat' | 'bicameral'): string {
		if (c === 'an') return 'AN';
		if (c === 'senat') return 'Sénat';
		return 'Bicaméral';
	}

	$effect(() => {
		void q;
		void chambre;
		visibleCount = PAGE_SIZE;
	});
</script>

<svelte:head>
	<title>Tous les élus — PolitiDex</title>
</svelte:head>

<section class="max-w-6xl mx-auto px-6 py-8">
	<header class="mb-6">
		<h1 class="title-display text-3xl">Tous les élus</h1>
		<p class="text-assembly-muted text-sm mt-1">
			{data.manifest.count} élus dédupliqués cross-chambre · {data.manifest.countBicameral}
			bicaméraux. Une fiche par personne, qu'elle soit députée, sénatrice ou les deux.
		</p>
	</header>

	<div class="flex flex-wrap gap-3 mb-6">
		<input
			type="search"
			class="card px-3 py-2 text-sm flex-1 min-w-[240px]"
			placeholder="Rechercher un nom ou prénom…"
			bind:value={q}
		/>
		<div class="flex flex-wrap gap-1">
			{#each [['tous', 'Tous'], ['an', '🏛️ AN'], ['senat', '🏛️ Sénat'], ['bicameral', '🏛️🏛️ Bicaméral']] as [val, label] (val)}
				<button
					class="btn px-3 py-1 text-xs {chambre === val
						? 'bg-assembly-accent text-assembly-bg'
						: 'border border-assembly-border text-assembly-muted hover:text-assembly-text'}"
					onclick={() => (chambre = val as Chambre)}
				>
					{label}
				</button>
			{/each}
		</div>
	</div>

	<div class="text-xs text-assembly-muted mb-2 tabular-nums">
		{filtered.length} élu{filtered.length > 1 ? 's' : ''} · {Math.min(visibleCount, filtered.length)}
		affichés
	</div>

	{#if visible.length === 0}
		<div class="card p-8 text-sm text-assembly-muted italic text-center">
			Aucun élu ne correspond à ces critères.
		</div>
	{:else}
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
			{#each visible as e (e.id)}
				{@const cat = eluCategorie(e)}
				<a
					href="/elus/{e.id}?tab=carriere"
					class="card p-3 flex items-center gap-3 hover:border-assembly-accent/60 transition-colors"
				>
					<img
						src={e.photoUrl}
						alt=""
						class="w-12 h-14 object-cover rounded-md border border-assembly-border bg-assembly-border flex-shrink-0"
						loading="lazy"
						referrerpolicy="no-referrer"
					/>
					<div class="min-w-0 flex-1">
						<div class="text-sm truncate">
							<span class="font-semibold">{e.prenom}</span> {e.nom}
						</div>
						<div class="text-[10px] text-assembly-muted truncate">
							{e.mandats.length} mandat{e.mandats.length > 1 ? 's' : ''} · {categorieLabel(cat)}
							{#if e.badgesCarriere.includes('Bicameral')}
								· 🏛️ Bicaméral
							{/if}
						</div>
					</div>
					<div class="title-display text-xl text-amber-300 tabular-nums flex-shrink-0">
						{e.overallCarriere}
					</div>
				</a>
			{/each}
		</div>

		{#if visibleCount < filtered.length}
			<div class="mt-6 text-center">
				<button class="btn-ghost text-sm" onclick={showMore}>
					Charger {Math.min(PAGE_SIZE, filtered.length - visibleCount)} de plus
					({filtered.length - visibleCount} restants)
				</button>
			</div>
		{/if}
	{/if}
</section>
