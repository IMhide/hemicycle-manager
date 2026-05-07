<script lang="ts">
	import { goto } from '$app/navigation';
	import { ensureSearchIndex, searchAll, type SearchResults } from '$lib/search-index';
	import type { SearchIndex } from '$lib/search-index';
	import { lookupEluUrlCarriereForPaId, lookupEluUrlCarriereForMatricule } from '$lib/elus';

	let query = $state('');
	let isOpen = $state(false);
	let isLoading = $state(false);
	let index: SearchIndex | null = $state(null);
	let results: SearchResults = $state({
		personnes: [],
		groupes: [],
		scrutins: [],
		senateurs: [],
		groupesSenat: []
	});
	let activeIndex = $state(0);
	let inputEl: HTMLInputElement | null = $state(null);
	let containerEl: HTMLDivElement | null = $state(null);

	type Item =
		| { kind: 'personne'; href: string; data: SearchResults['personnes'][number] }
		| { kind: 'senateur'; href: string; data: SearchResults['senateurs'][number] }
		| { kind: 'groupe'; href: string; data: SearchResults['groupes'][number] }
		| { kind: 'groupeSenat'; href: string; data: SearchResults['groupesSenat'][number] }
		| { kind: 'scrutin'; href: string; data: SearchResults['scrutins'][number] };

	const flatResults = $derived.by(() => {
		const out: Item[] = [];
		for (const p of results.personnes)
			out.push({
				kind: 'personne',
				href: lookupEluUrlCarriereForPaId(p.id) ?? '/elus/',
				data: p
			});
		for (const s of results.senateurs)
			out.push({
				kind: 'senateur',
				href: lookupEluUrlCarriereForMatricule(s.id) ?? '/elus/',
				data: s
			});
		for (const g of results.groupes)
			out.push({ kind: 'groupe', href: `/assemblee/groupes/${g.legislature}/${g.id}/`, data: g });
		for (const g of results.groupesSenat)
			out.push({ kind: 'groupeSenat', href: `/senat/triennats/${g.triennat}/`, data: g });
		for (const s of results.scrutins)
			out.push({ kind: 'scrutin', href: `/assemblee/scrutins/${s.uid}/`, data: s });
		return out;
	});

	const totalCount = $derived(
		results.personnes.length +
			results.senateurs.length +
			results.groupes.length +
			results.groupesSenat.length +
			results.scrutins.length
	);

	async function ensureLoaded() {
		if (index) return index;
		isLoading = true;
		try {
			index = await ensureSearchIndex();
			return index;
		} finally {
			isLoading = false;
		}
	}

	async function handleFocus() {
		isOpen = true;
		await ensureLoaded();
		runSearch();
	}

	function handleBlur() {
		setTimeout(() => {
			if (containerEl && !containerEl.contains(document.activeElement)) {
				isOpen = false;
			}
		}, 120);
	}

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	function runSearch() {
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			if (!index) return;
			results = searchAll(index, query);
			activeIndex = 0;
		}, 80);
	}

	function handleInput() {
		runSearch();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!isOpen) return;
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			activeIndex = Math.min(activeIndex + 1, flatResults.length - 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			activeIndex = Math.max(activeIndex - 1, 0);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			const item = flatResults[activeIndex];
			if (item) {
				goto(item.href);
				close();
			}
		} else if (e.key === 'Escape') {
			e.preventDefault();
			close();
		}
	}

	function close() {
		isOpen = false;
		query = '';
		results = { personnes: [], groupes: [], scrutins: [], senateurs: [], groupesSenat: [] };
		inputEl?.blur();
	}

	function selectItem(item: Item) {
		goto(item.href);
		close();
	}

	function handleGlobalKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
			e.preventDefault();
			inputEl?.focus();
		}
	}

	$effect(() => {
		window.addEventListener('keydown', handleGlobalKeydown);
		return () => window.removeEventListener('keydown', handleGlobalKeydown);
	});

	function highlightMatch(text: string, q: string): string {
		if (!q) return text;
		const lower = text.toLowerCase();
		const lowerQ = q.toLowerCase();
		const idx = lower.indexOf(lowerQ);
		if (idx === -1) return text;
		return (
			text.slice(0, idx) +
			'<mark class="bg-assembly-accent/30 text-assembly-accent rounded px-0.5">' +
			text.slice(idx, idx + q.length) +
			'</mark>' +
			text.slice(idx + q.length)
		);
	}

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('fr-FR', {
			day: 'numeric',
			month: 'short',
			year: '2-digit'
		});
	}

	function truncate(s: string, n: number): string {
		return s.length > n ? s.slice(0, n - 1) + '…' : s;
	}
</script>

<div bind:this={containerEl} class="relative w-full max-w-md" onfocusout={handleBlur}>
	<div class="relative">
		<svg
			class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-assembly-muted pointer-events-none"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
		>
			<circle cx="11" cy="11" r="7" />
			<path d="m21 21-4.3-4.3" />
		</svg>
		<input
			bind:this={inputEl}
			bind:value={query}
			oninput={handleInput}
			onfocus={handleFocus}
			onkeydown={handleKeydown}
			type="search"
			placeholder="Rechercher un député, un groupe, une loi…"
			class="w-full bg-assembly-bg border border-assembly-border rounded-full pl-9 pr-12 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-assembly-accent/40 focus:border-assembly-accent/60 transition-all"
			aria-label="Recherche globale"
			aria-controls="global-search-results"
			autocomplete="off"
		/>
		<kbd
			class="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-assembly-muted bg-assembly-border/40 border border-assembly-border rounded px-1.5 py-0.5 font-mono pointer-events-none hidden sm:block"
		>
			⌘K
		</kbd>
	</div>

	{#if isOpen}
		<div
			id="global-search-results"
			class="absolute top-full left-0 right-0 mt-2 bg-assembly-surface border border-assembly-border rounded-xl shadow-2xl overflow-hidden z-50 max-h-[70vh] overflow-y-auto"
		>
			{#if isLoading && totalCount === 0}
				<div class="p-4 text-sm text-assembly-muted text-center">
					<div class="animate-pulse">Chargement de l'index…</div>
				</div>
			{:else if !query.trim()}
				<div class="p-4 text-xs text-assembly-muted">
					Tapez le nom d'un député, d'un groupe, ou un mot-clé d'une loi.
					<div class="mt-2 text-[10px]">
						Astuce : ⌘K (Ctrl+K) ouvre la recherche depuis n'importe où.
					</div>
				</div>
			{:else if totalCount === 0}
				<div class="p-4 text-sm text-assembly-muted text-center">
					Aucun résultat pour <span class="font-semibold text-assembly-text">{query}</span>.
				</div>
			{:else}
				{#if results.personnes.length > 0}
					<div
						class="px-3 py-2 text-[10px] uppercase tracking-widest text-assembly-muted bg-assembly-bg/50"
					>
						Personnes
					</div>
					{#each results.personnes as p, i (p.id)}
						{@const flatIdx = i}
						{@const circoLast = p.mandats.at(-1)?.circonscription ?? null}
						<button
							type="button"
							class="w-full px-3 py-2 flex items-center gap-3 text-left transition-colors {activeIndex ===
							flatIdx
								? 'bg-assembly-accent/10'
								: 'hover:bg-assembly-border/30'}"
							onmouseenter={() => (activeIndex = flatIdx)}
							onclick={() =>
								selectItem({
									kind: 'personne',
									href: lookupEluUrlCarriereForPaId(p.id) ?? '/elus/',
									data: p
								})}
						>
							<img
								src={p.identite.photoUrl}
								alt=""
								class="w-8 h-8 rounded-full object-cover bg-assembly-border flex-shrink-0"
								loading="lazy"
								referrerpolicy="no-referrer"
							/>
							<div class="min-w-0 flex-1">
								<div class="text-sm font-semibold truncate">
									{@html highlightMatch(`${p.identite.prenom} ${p.identite.nom}`, query)}
								</div>
								<div class="flex items-center gap-1.5 text-[10px] text-assembly-muted">
									{#if p.groupePrincipal}
										<span
											class="w-1.5 h-1.5 rounded-full"
											style="background-color: {p.groupePrincipal.couleur}"
										></span>
										<span>{p.groupePrincipal.libelleAbrege}</span>
									{/if}
									{#if circoLast}
										<span>· {circoLast.dep}</span>
									{/if}
									<span>· {p.carriere.legislatures.map((l) => `${l}ᵉ`).join('+')}</span>
								</div>
							</div>
						</button>
					{/each}
				{/if}

				{#if results.senateurs.length > 0}
					<div
						class="px-3 py-2 text-[10px] uppercase tracking-widest text-assembly-muted bg-assembly-bg/50"
					>
						Sénateurs
					</div>
					{#each results.senateurs as s, i (s.id)}
						{@const flatIdx = results.personnes.length + i}
						<button
							type="button"
							class="w-full px-3 py-2 flex items-center gap-3 text-left transition-colors {activeIndex ===
							flatIdx
								? 'bg-assembly-accent/10'
								: 'hover:bg-assembly-border/30'}"
							onmouseenter={() => (activeIndex = flatIdx)}
							onclick={() =>
								selectItem({
									kind: 'senateur',
									href: lookupEluUrlCarriereForMatricule(s.id) ?? '/elus/',
									data: s
								})}
						>
							<img
								src={s.identite.photoUrl}
								alt=""
								class="w-8 h-8 rounded-full object-cover bg-assembly-border flex-shrink-0"
								loading="lazy"
								referrerpolicy="no-referrer"
							/>
							<div class="min-w-0 flex-1">
								<div class="text-sm font-semibold truncate">
									{@html highlightMatch(`${s.identite.prenom} ${s.identite.nom}`, query)}
								</div>
								<div class="flex items-center gap-1.5 text-[10px] text-assembly-muted">
									{#if s.groupePrincipal}
										<span
											class="w-1.5 h-1.5 rounded-full"
											style="background-color: {s.groupePrincipal.couleur}"
										></span>
										<span>{s.groupePrincipal.libelleAbrege}</span>
									{/if}
									<span>· {s.identite.etat === 'ACTIF' ? 'En exercice' : 'Ancien'}</span>
									<span>· Sénat</span>
								</div>
							</div>
						</button>
					{/each}
				{/if}

				{#if results.groupes.length > 0}
					<div
						class="px-3 py-2 text-[10px] uppercase tracking-widest text-assembly-muted bg-assembly-bg/50"
					>
						Groupes (AN)
					</div>
					{#each results.groupes as g, i (g.legislature + ':' + g.id)}
						{@const flatIdx = results.personnes.length + results.senateurs.length + i}
						<button
							type="button"
							class="w-full px-3 py-2 flex items-center gap-3 text-left transition-colors {activeIndex ===
							flatIdx
								? 'bg-assembly-accent/10'
								: 'hover:bg-assembly-border/30'}"
							onmouseenter={() => (activeIndex = flatIdx)}
							onclick={() =>
								selectItem({
									kind: 'groupe',
									href: `/assemblee/groupes/${g.legislature}/${g.id}/`,
									data: g
								})}
						>
							<div
								class="w-8 h-8 rounded-md flex items-center justify-center title-display text-[10px] flex-shrink-0"
								style="background-color: {g.couleur}; color: white;"
							>
								{g.libelleAbrege.slice(0, 4)}
							</div>
							<div class="min-w-0 flex-1">
								<div class="text-sm font-semibold truncate">
									{@html highlightMatch(g.libelle, query)}
								</div>
								<div class="text-[10px] text-assembly-muted">
									{g.libelleAbrege} · {g.legislature}<sup>e</sup> lég. · {g.effectifFin} député{g.effectifFin >
									1
										? 's'
										: ''}
								</div>
							</div>
						</button>
					{/each}
				{/if}

				{#if results.groupesSenat.length > 0}
					<div
						class="px-3 py-2 text-[10px] uppercase tracking-widest text-assembly-muted bg-assembly-bg/50"
					>
						Groupes (Sénat)
					</div>
					{#each results.groupesSenat as g, i (g.code + ':' + g.triennat)}
						{@const flatIdx =
							results.personnes.length +
							results.senateurs.length +
							results.groupes.length +
							i}
						<button
							type="button"
							class="w-full px-3 py-2 flex items-center gap-3 text-left transition-colors {activeIndex ===
							flatIdx
								? 'bg-assembly-accent/10'
								: 'hover:bg-assembly-border/30'}"
							onmouseenter={() => (activeIndex = flatIdx)}
							onclick={() =>
								selectItem({
									kind: 'groupeSenat',
									href: `/senat/triennats/${g.triennat}/`,
									data: g
								})}
						>
							<div
								class="w-8 h-8 rounded-md flex items-center justify-center title-display text-[10px] flex-shrink-0"
								style="background-color: {g.couleur}; color: white;"
							>
								{g.libelleAbrege.slice(0, 4)}
							</div>
							<div class="min-w-0 flex-1">
								<div class="text-sm font-semibold truncate">
									{@html highlightMatch(g.libelle, query)}
								</div>
								<div class="text-[10px] text-assembly-muted">
									{g.libelleAbrege} · Sénat · triennat {g.triennat} · {g.effectifFin} sénateur{g.effectifFin >
									1
										? 's'
										: ''}
								</div>
							</div>
						</button>
					{/each}
				{/if}

				{#if results.scrutins.length > 0}
					<div
						class="px-3 py-2 text-[10px] uppercase tracking-widest text-assembly-muted bg-assembly-bg/50"
					>
						Scrutins (AN)
					</div>
					{#each results.scrutins as s, i (s.uid)}
						{@const flatIdx =
							results.personnes.length +
							results.senateurs.length +
							results.groupes.length +
							results.groupesSenat.length +
							i}
						<button
							type="button"
							class="w-full px-3 py-2 flex items-center gap-3 text-left transition-colors {activeIndex ===
							flatIdx
								? 'bg-assembly-accent/10'
								: 'hover:bg-assembly-border/30'}"
							onmouseenter={() => (activeIndex = flatIdx)}
							onclick={() =>
								selectItem({ kind: 'scrutin', href: `/assemblee/scrutins/${s.uid}/`, data: s })}
						>
							<div class="text-center flex-shrink-0 w-12">
								<div class="text-[9px] text-assembly-muted leading-none">n°</div>
								<div class="title-display text-sm tabular-nums">{s.numero}</div>
							</div>
							<div class="min-w-0 flex-1">
								<div class="text-xs leading-snug">
									{@html highlightMatch(truncate(s.titre, 100), query)}
								</div>
								<div class="text-[10px] text-assembly-muted mt-0.5">
									{formatDate(s.date)} · {s.legislature}<sup>e</sup> ·
									<span
										class={s.sort === 'adopté'
											? 'text-vote-pour'
											: s.sort === 'rejeté'
												? 'text-vote-contre'
												: ''}>{s.sort}</span
									>
								</div>
							</div>
						</button>
					{/each}
				{/if}

				<div
					class="px-3 py-2 border-t border-assembly-border/50 text-[10px] text-assembly-muted flex items-center gap-3"
				>
					<span><kbd class="bg-assembly-border/40 px-1 rounded">↑↓</kbd> naviguer</span>
					<span><kbd class="bg-assembly-border/40 px-1 rounded">↵</kbd> ouvrir</span>
					<span><kbd class="bg-assembly-border/40 px-1 rounded">Esc</kbd> fermer</span>
				</div>
			{/if}
		</div>
	{/if}
</div>
