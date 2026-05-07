<script lang="ts">
	import { TRIENNATS, type TriennatId, triennatOfDate } from '$lib/triennats';

	let { data } = $props();

	type SortKey = 'date-desc' | 'date-asc' | 'numero-desc' | 'numero-asc';
	type Period = 'all' | '30j' | '6m' | '1an';

	const triennatsSorted = $derived(
		[...data.triennats].sort((a, b) => b.dateDebut.localeCompare(a.dateDebut))
	);

	let search = $state('');
	let resultFilter = $state('all'); // libre car libellés sort hétérogènes côté Sénat
	let period: Period = $state('all');
	let sortKey: SortKey = $state('date-desc');
	let visibleCount = $state(50);
	/** null = tous triennats */
	let scopeTriennat: TriennatId | null = $state(null);

	function clearFilters() {
		search = '';
		resultFilter = 'all';
		period = 'all';
		sortKey = 'date-desc';
		scopeTriennat = null;
		visibleCount = 50;
	}

	const periodCutoff = $derived.by(() => {
		if (period === 'all') return null;
		const now = new Date();
		const d = new Date(now);
		if (period === '30j') d.setDate(d.getDate() - 30);
		if (period === '6m') d.setMonth(d.getMonth() - 6);
		if (period === '1an') d.setFullYear(d.getFullYear() - 1);
		return d.toISOString().slice(0, 10);
	});

	/** Catégorise un libellé `sort` Sénat (très varié : "Adopté", "Rejeté", "Adoption", …). */
	function sortCategory(s: string | null | undefined): 'adopte' | 'rejete' | 'autre' {
		if (!s) return 'autre';
		const t = s.toLowerCase();
		if (t.includes('adopt')) return 'adopte';
		if (t.includes('rejet') || t.includes('refus')) return 'rejete';
		return 'autre';
	}

	function triennatOfScrutin(date: string): TriennatId | null {
		return (triennatOfDate(date)?.id as TriennatId) ?? null;
	}

	const filtered = $derived.by(() => {
		const q = search.trim().toLowerCase();
		return data.scrutins.filter((s) => {
			if (scopeTriennat !== null && triennatOfScrutin(s.date) !== scopeTriennat) return false;
			if (q && !s.titre.toLowerCase().includes(q)) return false;
			if (resultFilter !== 'all') {
				if (sortCategory(s.sort) !== resultFilter) return false;
			}
			if (periodCutoff && s.date < periodCutoff) return false;
			return true;
		});
	});

	const sorted = $derived.by(() => {
		const arr = [...filtered];
		switch (sortKey) {
			case 'date-desc':
				arr.sort(
					(a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0) || b.scrnum - a.scrnum
				);
				break;
			case 'date-asc':
				arr.sort(
					(a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) || a.scrnum - b.scrnum
				);
				break;
			case 'numero-desc':
				arr.sort((a, b) => b.scrnum - a.scrnum);
				break;
			case 'numero-asc':
				arr.sort((a, b) => a.scrnum - b.scrnum);
				break;
		}
		return arr;
	});

	const visible = $derived(sorted.slice(0, visibleCount));

	$effect(() => {
		void search;
		void resultFilter;
		void period;
		void sortKey;
		void scopeTriennat;
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

	const counts = $derived.by(() => {
		const c = { all: 0, adopte: 0, rejete: 0 };
		for (const s of data.scrutins) {
			if (scopeTriennat !== null && triennatOfScrutin(s.date) !== scopeTriennat) continue;
			c.all += 1;
			const cat = sortCategory(s.sort);
			if (cat === 'adopte') c.adopte += 1;
			else if (cat === 'rejete') c.rejete += 1;
		}
		return c;
	});

	const hasFilters = $derived(
		search !== '' ||
			resultFilter !== 'all' ||
			period !== 'all' ||
			sortKey !== 'date-desc' ||
			scopeTriennat !== null
	);
</script>

<svelte:head>
	<title>Scrutins Sénat — PolitiDex</title>
</svelte:head>

<section class="max-w-7xl mx-auto px-6 py-8">
	<div class="mb-6 flex flex-wrap items-end justify-between gap-3">
		<div>
			<h1 class="title-display text-4xl">Scrutins Sénat</h1>
			<p class="text-assembly-muted text-sm mt-1">
				{counts.all} scrutin{counts.all > 1 ? 's' : ''} public{counts.all > 1 ? 's' : ''}
				{#if scopeTriennat !== null}
					· triennat {scopeTriennat}
				{/if}
			</p>
		</div>
		<div class="flex items-center gap-1 text-xs flex-wrap justify-end max-w-md">
			<span class="text-assembly-muted">Triennat :</span>
			<button
				class="px-2 py-1 rounded text-[11px] {scopeTriennat === null
					? 'bg-assembly-accent text-assembly-bg font-semibold'
					: 'border border-assembly-border text-assembly-muted hover:text-slate-200'}"
				onclick={() => (scopeTriennat = null)}
			>
				Tous
			</button>
			{#each triennatsSorted.slice(0, 6) as tri (tri.id)}
				<button
					class="px-2 py-1 rounded text-[11px] {scopeTriennat === tri.id
						? 'bg-assembly-accent text-assembly-bg font-semibold'
						: 'border border-assembly-border text-assembly-muted hover:text-slate-200'}"
					onclick={() => (scopeTriennat = tri.id as TriennatId)}
				>
					{tri.id}{#if tri.enCours} ⚡{/if}
				</button>
			{/each}
		</div>
	</div>

	<div class="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 items-start">
		<aside class="card p-4 lg:sticky lg:top-20 space-y-4 text-sm">
			<div>
				<label
					class="text-xs uppercase tracking-widest text-assembly-muted block mb-1.5"
					for="search-scrutins-senat"
				>
					Recherche
				</label>
				<input
					id="search-scrutins-senat"
					type="search"
					bind:value={search}
					placeholder="Mot-clé dans le titre…"
					class="bg-assembly-bg border border-assembly-border rounded-md px-3 py-1.5 w-full"
				/>
			</div>

			<div>
				<div class="text-xs uppercase tracking-widest text-assembly-muted mb-1.5">Tri</div>
				<select
					bind:value={sortKey}
					class="bg-assembly-bg border border-assembly-border rounded-md px-2 py-1.5 w-full"
				>
					<option value="date-desc">Date ↓ (récent)</option>
					<option value="date-asc">Date ↑ (ancien)</option>
					<option value="numero-desc">N° ↓ (récent)</option>
					<option value="numero-asc">N° ↑ (ancien)</option>
				</select>
			</div>

			<div>
				<div class="text-xs uppercase tracking-widest text-assembly-muted mb-1.5">Résultat</div>
				<div class="flex flex-col gap-1">
					{#each [['all', `Tous (${counts.all})`], ['adopte', `Adopté (${counts.adopte})`], ['rejete', `Rejeté (${counts.rejete})`]] as [key, label] (key)}
						<button
							class="btn px-3 py-1 text-xs text-left {resultFilter === key
								? 'bg-assembly-accent text-assembly-bg'
								: 'border border-assembly-border text-assembly-muted hover:text-assembly-text'}"
							onclick={() => (resultFilter = key)}
						>
							{label}
						</button>
					{/each}
				</div>
			</div>

			<div>
				<div class="text-xs uppercase tracking-widest text-assembly-muted mb-1.5">Période</div>
				<div class="grid grid-cols-2 gap-1">
					{#each [['all', 'Tout'], ['30j', '30 j'], ['6m', '6 mois'], ['1an', '1 an']] as [key, label] (key)}
						<button
							class="btn px-2 py-1 text-xs {period === key
								? 'bg-assembly-accent text-assembly-bg'
								: 'border border-assembly-border text-assembly-muted hover:text-assembly-text'}"
							onclick={() => (period = key as Period)}
						>
							{label}
						</button>
					{/each}
				</div>
			</div>

			{#if hasFilters}
				<button class="btn-ghost w-full text-xs" onclick={clearFilters}>
					Réinitialiser les filtres
				</button>
			{/if}
		</aside>

		<div>
			<div class="flex items-center justify-between gap-3 mb-3 text-xs text-assembly-muted">
				<div>
					<span class="title-display text-base text-assembly-text">{filtered.length}</span>
					scrutin{filtered.length > 1 ? 's' : ''} trouvé{filtered.length > 1 ? 's' : ''}
					{#if filtered.length !== counts.all}
						<span class="text-assembly-muted">/ {counts.all}</span>
					{/if}
				</div>
			</div>

			{#if filtered.length === 0}
				<div class="card p-8 text-center text-assembly-muted">
					<div class="title-display text-2xl mb-1">😶</div>
					<div class="text-sm">Aucun scrutin ne correspond à ces critères.</div>
					<button class="btn-ghost mt-4 text-sm" onclick={clearFilters}>Réinitialiser</button>
				</div>
			{:else}
				<div class="space-y-1.5">
					{#each visible as s (s.uid)}
						{@const cat = sortCategory(s.sort)}
						{@const triId = triennatOfScrutin(s.date)}
						<a
							href="/senat/scrutins/{s.uid}/"
							class="card p-3 flex items-center gap-3 hover:border-assembly-accent/60 transition-colors"
						>
							<div class="text-center flex-shrink-0 w-16">
								<div class="text-xs text-assembly-muted">n°</div>
								<div class="title-display text-base tabular-nums">{s.scrnum}</div>
							</div>

							<div class="text-xs text-assembly-muted flex-shrink-0 w-20 text-right">
								{formatDate(s.date)}
							</div>

							<div class="min-w-0 flex-1">
								<div class="text-sm leading-snug">{truncate(s.titre, 140)}</div>
								{#if triId}
									<div class="text-[10px] text-assembly-muted mt-0.5">
										Triennat {triId}
									</div>
								{/if}
							</div>

							<div
								class="hidden sm:flex gap-2 text-[10px] flex-shrink-0 items-center tabular-nums"
							>
								<span class="text-vote-pour">{s.pour}</span>
								<span class="text-assembly-muted">·</span>
								<span class="text-vote-contre">{s.contre}</span>
								<span class="text-assembly-muted">·</span>
								<span class="text-vote-abstention">{s.abstention}</span>
							</div>

							<div
								class="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded flex-shrink-0 {cat ===
								'adopte'
									? 'bg-vote-pour/20 text-vote-pour'
									: cat === 'rejete'
										? 'bg-vote-contre/20 text-vote-contre'
										: 'bg-assembly-border text-assembly-muted'}"
							>
								{s.sort || 'n/a'}
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
