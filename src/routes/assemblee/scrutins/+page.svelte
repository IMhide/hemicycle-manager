<script lang="ts">
	import type { Groupe } from '$lib/types';

	let { data } = $props();

	type SortKey = 'date-desc' | 'date-asc' | 'numero-desc' | 'numero-asc';
	type SortFilter = 'all' | 'adopté' | 'rejeté';
	type Period = 'all' | '30j' | '6m' | '1an';

	const legSorted = $derived([...data.legislatures].sort((a, b) => b.num - a.num));

	let search = $state('');
	let sortFilter: SortFilter = $state('all');
	let demandeurFilter = $state<Set<string>>(new Set());
	let period: Period = $state('all');
	let sortKey: SortKey = $state('date-desc');
	let visibleCount = $state(50);
	/** null = toutes législatures */
	let scopeLeg: number | null = $state(null);

	function clearFilters() {
		search = '';
		sortFilter = 'all';
		demandeurFilter = new Set();
		period = 'all';
		sortKey = 'date-desc';
		scopeLeg = null;
		visibleCount = 50;
	}

	function toggleDemandeur(id: string) {
		const next = new Set(demandeurFilter);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		demandeurFilter = next;
	}

	const groupesScope = $derived.by(() =>
		scopeLeg === null ? data.groupes : data.groupes.filter((g) => g.legislature === scopeLeg)
	);

	const demandeurOptions = $derived.by(() => {
		const opts: Array<{ groupe: Groupe; count: number }> = [];
		const counts = new Map<string, number>();
		for (const s of data.scrutins) {
			if (!s.demandeur) continue;
			if (scopeLeg !== null && s.legislature !== scopeLeg) continue;
			for (const g of groupesScope) {
				if (s.demandeur.includes(g.libelle)) {
					counts.set(g.id, (counts.get(g.id) ?? 0) + 1);
				}
			}
		}
		for (const g of groupesScope) {
			const c = counts.get(g.id) ?? 0;
			if (c > 0) opts.push({ groupe: g, count: c });
		}
		return opts.sort((a, b) => b.count - a.count);
	});

	const periodCutoff = $derived.by(() => {
		if (period === 'all') return null;
		const now = new Date();
		const d = new Date(now);
		if (period === '30j') d.setDate(d.getDate() - 30);
		if (period === '6m') d.setMonth(d.getMonth() - 6);
		if (period === '1an') d.setFullYear(d.getFullYear() - 1);
		return d.toISOString().slice(0, 10);
	});

	const filtered = $derived.by(() => {
		const q = search.trim().toLowerCase();
		return data.scrutins.filter((s) => {
			if (scopeLeg !== null && s.legislature !== scopeLeg) return false;
			if (q && !s.titre.toLowerCase().includes(q)) return false;
			if (sortFilter !== 'all' && s.sort !== sortFilter) return false;
			if (periodCutoff && s.date < periodCutoff) return false;
			if (demandeurFilter.size > 0) {
				if (!s.demandeur) return false;
				const matches = [...demandeurFilter].some((groupeId) => {
					const g = data.groupes.find((x) => x.id === groupeId);
					if (!g) return false;
					return s.demandeur!.includes(g.libelle);
				});
				if (!matches) return false;
			}
			return true;
		});
	});

	const sorted = $derived.by(() => {
		const arr = [...filtered];
		switch (sortKey) {
			case 'date-desc':
				arr.sort(
					(a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0) || b.numero - a.numero
				);
				break;
			case 'date-asc':
				arr.sort(
					(a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) || a.numero - b.numero
				);
				break;
			case 'numero-desc':
				arr.sort((a, b) => b.numero - a.numero);
				break;
			case 'numero-asc':
				arr.sort((a, b) => a.numero - b.numero);
				break;
		}
		return arr;
	});

	const visible = $derived(sorted.slice(0, visibleCount));

	$effect(() => {
		void search;
		void sortFilter;
		void demandeurFilter;
		void period;
		void sortKey;
		void scopeLeg;
		visibleCount = 50;
	});

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('fr-FR', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}

	function truncate(s: string, n: number): string {
		return s.length > n ? s.slice(0, n - 1) + '…' : s;
	}

	const hasFilters = $derived(
		search !== '' ||
			sortFilter !== 'all' ||
			demandeurFilter.size > 0 ||
			period !== 'all' ||
			sortKey !== 'date-desc' ||
			scopeLeg !== null
	);

	const counts = $derived.by(() => {
		const c = { all: 0, adopté: 0, rejeté: 0 };
		for (const s of data.scrutins) {
			if (scopeLeg !== null && s.legislature !== scopeLeg) continue;
			c.all += 1;
			if (s.sort === 'adopté') c.adopté += 1;
			else if (s.sort === 'rejeté') c.rejeté += 1;
		}
		return c;
	});
</script>

<svelte:head>
	<title>Scrutins — PolitiDex</title>
</svelte:head>

<section class="max-w-[1536px] mx-auto px-6 py-8">
	<div class="mb-6 flex flex-wrap items-end justify-between gap-3">
		<div>
			<h1 class="title-display text-4xl">Scrutins</h1>
			<p class="text-fg-muted text-sm mt-1">
				{counts.all} scrutin{counts.all > 1 ? 's' : ''} public{counts.all > 1 ? 's' : ''}
				{#if scopeLeg !== null}
					· {scopeLeg}<sup>e</sup> législature
				{/if}
			</p>
		</div>
		<div class="flex items-center gap-1 text-xs">
			<span class="text-fg-muted">Législature :</span>
			<button
				class="px-3 py-1 rounded {scopeLeg === null
					? 'bg-accent text-accent-fg font-semibold'
					: 'border border-border-soft text-fg-muted hover:text-fg'}"
				onclick={() => (scopeLeg = null)}
			>
				Toutes
			</button>
			{#each legSorted as l (l.num)}
				<button
					class="px-3 py-1 rounded {scopeLeg === l.num
						? 'bg-accent text-accent-fg font-semibold'
						: 'border border-border-soft text-fg-muted hover:text-fg'}"
					onclick={() => (scopeLeg = l.num)}
				>
					{l.num}<sup>e</sup>
				</button>
			{/each}
		</div>
	</div>

	<div class="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 items-start">
		<aside class="card p-4 lg:sticky lg:top-20 space-y-4 text-sm">
			<div>
				<label
					class="text-xs uppercase tracking-widest text-fg-muted block mb-1.5"
					for="search-scrutins"
				>
					Recherche
				</label>
				<input
					id="search-scrutins"
					type="search"
					bind:value={search}
					placeholder="Mot-clé dans le titre…"
					class="bg-bg border border-border-soft rounded-md px-3 py-1.5 w-full"
				/>
			</div>

			<div>
				<div class="text-xs uppercase tracking-widest text-fg-muted mb-1.5">Tri</div>
				<select
					bind:value={sortKey}
					class="bg-bg border border-border-soft rounded-md px-2 py-1.5 w-full"
				>
					<option value="date-desc">Date ↓ (récent)</option>
					<option value="date-asc">Date ↑ (ancien)</option>
					<option value="numero-desc">N° ↓ (récent)</option>
					<option value="numero-asc">N° ↑ (ancien)</option>
				</select>
			</div>

			<div>
				<div class="text-xs uppercase tracking-widest text-fg-muted mb-1.5">Résultat</div>
				<div class="flex flex-col gap-1">
					{#each [['all', `Tous (${counts.all})`], ['adopté', `Adopté (${counts.adopté})`], ['rejeté', `Rejeté (${counts.rejeté})`]] as [key, label] (key)}
						<button
							class="btn px-3 py-1 text-xs text-left {sortFilter === key
								? 'bg-accent text-accent-fg'
								: 'border border-border-soft text-fg-muted hover:text-fg'}"
							onclick={() => (sortFilter = key as SortFilter)}
						>
							{label}
						</button>
					{/each}
				</div>
			</div>

			<div>
				<div class="text-xs uppercase tracking-widest text-fg-muted mb-1.5">Période</div>
				<div class="grid grid-cols-2 gap-1">
					{#each [['all', 'Tout'], ['30j', '30 j'], ['6m', '6 mois'], ['1an', '1 an']] as [key, label] (key)}
						<button
							class="btn px-2 py-1 text-xs {period === key
								? 'bg-accent text-accent-fg'
								: 'border border-border-soft text-fg-muted hover:text-fg'}"
							onclick={() => (period = key as Period)}
						>
							{label}
						</button>
					{/each}
				</div>
			</div>

			<div>
				<div
					class="text-xs uppercase tracking-widest text-fg-muted mb-1.5 flex items-center gap-1"
				>
					Demandeur
					{#if demandeurFilter.size > 0}
						<button
							class="ml-auto text-[10px] underline hover:text-link"
							onclick={() => {
								demandeurFilter = new Set();
							}}
						>
							effacer
						</button>
					{/if}
				</div>
				{#if demandeurOptions.length === 0}
					<div class="text-xs text-fg-muted italic">Aucun demandeur identifié.</div>
				{:else}
					<div class="space-y-1 max-h-60 overflow-y-auto pr-1">
						{#each demandeurOptions as { groupe, count } (groupe.id)}
							{@const isActive = demandeurFilter.has(groupe.id)}
							<button
								class="w-full flex items-center justify-between gap-2 px-2 py-1 rounded text-left transition-colors {isActive
									? 'bg-border-soft/60'
									: 'hover:bg-border-soft/30'}"
								onclick={() => toggleDemandeur(groupe.id)}
							>
								<span class="flex items-center gap-2 min-w-0">
									<span
										class="w-2 h-2 rounded-full flex-shrink-0"
										style="background-color: {groupe.couleur}"
									></span>
									<span class="text-xs font-medium truncate">{groupe.libelleAbrege}</span>
								</span>
								<span class="text-[10px] text-fg-muted tabular-nums">{count}</span>
							</button>
						{/each}
					</div>
				{/if}
			</div>

			{#if hasFilters}
				<button class="btn-ghost w-full text-xs" onclick={clearFilters}>
					Réinitialiser les filtres
				</button>
			{/if}
		</aside>

		<div>
			<div class="flex items-center justify-between gap-3 mb-3 text-xs text-fg-muted">
				<div>
					<span class="title-display text-base text-fg">{filtered.length}</span>
					scrutin{filtered.length > 1 ? 's' : ''} trouvé{filtered.length > 1 ? 's' : ''}
					{#if filtered.length !== counts.all}
						<span class="text-fg-muted">/ {counts.all}</span>
					{/if}
				</div>
			</div>

			{#if filtered.length === 0}
				<div class="card p-8 text-center text-fg-muted">
					<div class="title-display text-2xl mb-1">😶</div>
					<div class="text-sm">Aucun scrutin ne correspond à ces critères.</div>
					<button class="btn-ghost mt-4 text-sm" onclick={clearFilters}>Réinitialiser</button>
				</div>
			{:else}
				<div class="space-y-1.5">
					{#each visible as s (s.uid)}
						<a
							href="/assemblee/scrutins/{s.uid}/"
							class="card p-3 flex items-center gap-3 hover:border-accent/60 transition-colors"
						>
							<div class="text-center flex-shrink-0 w-16">
								<div class="text-xs text-fg-muted">n°</div>
								<div class="title-display text-base tabular-nums">{s.numero}</div>
							</div>

							<div class="text-xs text-fg-muted flex-shrink-0 w-20 text-right">
								{formatDate(s.date)}
							</div>

							<div class="min-w-0 flex-1">
								<div class="text-sm leading-snug">{truncate(s.titre, 140)}</div>
								<div class="text-[10px] text-fg-muted mt-0.5 flex items-center gap-2">
									<span>{s.legislature}<sup>e</sup> lég.</span>
									{#if s.demandeur}
										<span class="truncate">· Demandé par : {s.demandeur}</span>
									{/if}
								</div>
							</div>

							<div
								class="hidden sm:flex gap-2 text-[10px] flex-shrink-0 items-center tabular-nums"
							>
								<span class="text-vote-pour">{s.pour}</span>
								<span class="text-fg-muted">·</span>
								<span class="text-vote-contre">{s.contre}</span>
								<span class="text-fg-muted">·</span>
								<span class="text-vote-abstention">{s.abstention}</span>
							</div>

							<div
								class="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded flex-shrink-0 {s.sort ===
								'adopté'
									? 'bg-vote-pour/20 text-vote-pour'
									: s.sort === 'rejeté'
										? 'bg-vote-contre/20 text-vote-contre'
										: 'bg-border-soft text-fg-muted'}"
							>
								{s.sort}
							</div>
						</a>
					{/each}
				</div>

				{#if visibleCount < sorted.length}
					<div class="mt-4 text-center">
						<button class="btn-ghost text-sm" onclick={() => (visibleCount += 50)}>
							Charger 50 de plus ({sorted.length - visibleCount} restants)
						</button>
					</div>
				{/if}
			{/if}
		</div>
	</div>
</section>
