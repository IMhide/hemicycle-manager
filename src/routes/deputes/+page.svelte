<script lang="ts">
	import MemberRow from '$lib/components/MemberRow.svelte';
	import GroupBadge from '$lib/components/GroupBadge.svelte';
	import InfoTip from '$lib/components/InfoTip.svelte';
	import { POLITICAL_ORDER } from '$lib/political-order';
	import type { Depute, DeputeStats, Groupe } from '$lib/types';

	let { data } = $props();

	type SortKey = 'nom' | 'presence' | 'loyaute' | 'frondes' | 'activite';
	let search = $state('');
	let sortKey: SortKey = $state('nom');
	// Empty Set = no filter (show everyone). Otherwise: show only deputies in
	// these groups.
	let groupFilter = $state<Set<string>>(new Set());
	let civFilter = $state<'all' | 'M.' | 'Mme'>('all');
	let visibleCount = $state(60);
	let onlyPresidents = $state(false);

	const statsById = $derived.by(() => {
		const m = new Map<string, DeputeStats>();
		for (const s of data.stats) m.set(s.id, s);
		return m;
	});

	const groupesSorted = $derived(
		[...data.groupes].sort(
			(a, b) =>
				(POLITICAL_ORDER[a.libelleAbrege]?.rank ?? 99) -
				(POLITICAL_ORDER[b.libelleAbrege]?.rank ?? 99)
		)
	);

	const presidentIds = $derived(
		new Set(data.groupes.map((g) => g.presidentId).filter((x): x is string => !!x))
	);

	function toggleGroup(id: string) {
		const next = new Set(groupFilter);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		groupFilter = next;
		visibleCount = 60;
	}

	function clearFilters() {
		search = '';
		groupFilter = new Set();
		civFilter = 'all';
		onlyPresidents = false;
		sortKey = 'nom';
		visibleCount = 60;
	}

	const filtered = $derived.by(() => {
		const q = search.trim().toLowerCase();
		return data.deputes
			.map((d) => ({ depute: d, stats: statsById.get(d.id)! }))
			.filter(({ depute }) => {
				if (q) {
					const hay = `${depute.prenom} ${depute.nom}`.toLowerCase();
					if (!hay.includes(q)) return false;
				}
				if (civFilter !== 'all' && depute.civ !== civFilter) return false;
				if (groupFilter.size > 0) {
					if (!depute.groupeId || !groupFilter.has(depute.groupeId)) return false;
				}
				if (onlyPresidents && !presidentIds.has(depute.id)) return false;
				return true;
			});
	});

	const sorted = $derived.by(() => {
		const arr = [...filtered];
		switch (sortKey) {
			case 'nom':
				arr.sort((a, b) =>
					a.depute.nom.localeCompare(b.depute.nom) ||
					a.depute.prenom.localeCompare(b.depute.prenom)
				);
				break;
			case 'presence':
				arr.sort((a, b) => b.stats.tauxPresence - a.stats.tauxPresence);
				break;
			case 'loyaute':
				arr.sort((a, b) => (b.stats.tauxLoyaute ?? 0) - (a.stats.tauxLoyaute ?? 0));
				break;
			case 'frondes':
				arr.sort((a, b) => b.stats.frondes - a.stats.frondes);
				break;
			case 'activite':
				arr.sort((a, b) => b.stats.activite - a.stats.activite);
				break;
		}
		return arr;
	});

	const visible = $derived(sorted.slice(0, visibleCount));

	// Reset visible count when filters change
	$effect(() => {
		// Touch the dependencies so the effect tracks them
		void search;
		void groupFilter;
		void civFilter;
		void onlyPresidents;
		void sortKey;
		visibleCount = 60;
	});

	const highlight = $derived(
		sortKey === 'nom' ? null : (sortKey as 'presence' | 'loyaute' | 'frondes')
	);
</script>

<svelte:head>
	<title>Députés — Hémicycle Manager</title>
</svelte:head>

<section class="max-w-7xl mx-auto px-6 py-8">
	<div class="mb-6">
		<h1 class="title-display text-4xl">Députés</h1>
		<p class="text-assembly-muted text-sm mt-1">
			{data.deputes.length} députés de la 17ᵉ législature.
		</p>
	</div>

	<div class="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 items-start">
		<!-- Filter sidebar -->
		<aside class="card p-4 lg:sticky lg:top-20 space-y-4 text-sm">
			<div>
				<label class="text-xs uppercase tracking-widest text-assembly-muted block mb-1.5" for="search-deputes">
					Recherche
				</label>
				<input
					id="search-deputes"
					type="search"
					bind:value={search}
					placeholder="Nom ou prénom…"
					class="bg-assembly-bg border border-assembly-border rounded-md px-3 py-1.5 w-full"
				/>
			</div>

			<div>
				<div class="text-xs uppercase tracking-widest text-assembly-muted mb-1.5">Trier par</div>
				<select
					bind:value={sortKey}
					class="bg-assembly-bg border border-assembly-border rounded-md px-2 py-1.5 w-full"
				>
					<option value="nom">Nom (A→Z)</option>
					<option value="presence">Présence ↓</option>
					<option value="loyaute">Loyauté ↓</option>
					<option value="frondes">Frondes ↓</option>
					<option value="activite">Activité ↓</option>
				</select>
			</div>

			<div>
				<div class="text-xs uppercase tracking-widest text-assembly-muted mb-1.5">Civilité</div>
				<div class="flex gap-1">
					{#each [['all', 'Tous'], ['M.', 'M.'], ['Mme', 'Mme']] as [key, label] (key)}
						<button
							class="btn px-3 py-1 text-xs flex-1 {civFilter === key
								? 'bg-assembly-accent text-assembly-bg'
								: 'border border-assembly-border text-assembly-muted hover:text-assembly-text'}"
							onclick={() => (civFilter = key as 'all' | 'M.' | 'Mme')}
						>
							{label}
						</button>
					{/each}
				</div>
			</div>

			<div>
				<label class="flex items-center gap-2 cursor-pointer">
					<input type="checkbox" bind:checked={onlyPresidents} class="accent-assembly-accent" />
					<span class="text-xs">⭐ Présidents de groupe seulement</span>
				</label>
			</div>

			<div>
				<div class="text-xs uppercase tracking-widest text-assembly-muted mb-1.5 flex items-center gap-1">
					Groupes
					{#if groupFilter.size > 0}
						<button
							class="ml-auto text-[10px] underline hover:text-assembly-accent"
							onclick={() => {
								groupFilter = new Set();
							}}
						>
							effacer
						</button>
					{/if}
				</div>
				<div class="space-y-1">
					{#each groupesSorted as g (g.id)}
						{@const isActive = groupFilter.has(g.id)}
						<button
							class="w-full flex items-center justify-between gap-2 px-2 py-1 rounded text-left transition-colors {isActive
								? 'bg-assembly-border/60'
								: 'hover:bg-assembly-border/30'}"
							onclick={() => toggleGroup(g.id)}
						>
							<span class="flex items-center gap-2 min-w-0">
								<span
									class="w-2 h-2 rounded-full flex-shrink-0"
									style="background-color: {g.couleur}"
								></span>
								<span class="text-xs font-medium truncate">{g.libelleAbrege}</span>
							</span>
							<span class="text-[10px] text-assembly-muted tabular-nums">{g.effectif}</span>
						</button>
					{/each}
				</div>
			</div>

			{#if search || groupFilter.size > 0 || civFilter !== 'all' || onlyPresidents || sortKey !== 'nom'}
				<button class="btn-ghost w-full text-xs" onclick={clearFilters}>
					Réinitialiser les filtres
				</button>
			{/if}
		</aside>

		<!-- Results -->
		<div>
			<div class="flex items-center justify-between gap-3 mb-3 text-xs text-assembly-muted">
				<div>
					<span class="title-display text-base text-assembly-text">{filtered.length}</span>
					député{filtered.length > 1 ? 's' : ''} trouvé{filtered.length > 1 ? 's' : ''}
					{#if filtered.length !== data.deputes.length}
						<span class="text-assembly-muted">/ {data.deputes.length}</span>
					{/if}
				</div>
				{#if highlight}
					<div class="flex items-center gap-1">
						Tri : <span class="text-assembly-text font-semibold">{sortKey}</span>
						<InfoTip title="Tri" size="xs">
							Les valeurs sont mises en évidence dans la colonne {sortKey} pour faciliter la lecture.
						</InfoTip>
					</div>
				{/if}
			</div>

			{#if filtered.length === 0}
				<div class="card p-8 text-center text-assembly-muted">
					<div class="title-display text-2xl mb-1">😶</div>
					<div class="text-sm">Aucun député ne correspond à ces critères.</div>
					<button class="btn-ghost mt-4 text-sm" onclick={clearFilters}>
						Réinitialiser
					</button>
				</div>
			{:else}
				<div class="grid grid-cols-1 xl:grid-cols-2 gap-2">
					{#each visible as { depute, stats } (depute.id)}
						<MemberRow
							{depute}
							{stats}
							{highlight}
							isPresident={presidentIds.has(depute.id)}
						/>
					{/each}
				</div>

				{#if visibleCount < sorted.length}
					<div class="mt-4 text-center">
						<button class="btn-ghost text-sm" onclick={() => (visibleCount += 60)}>
							Charger 60 de plus ({sorted.length - visibleCount} restants)
						</button>
					</div>
				{/if}
			{/if}
		</div>
	</div>
</section>
