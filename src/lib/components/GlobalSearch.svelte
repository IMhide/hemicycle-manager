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
		senateurs: [],
		groupesSenat: [],
		textes: []
	});
	let activeIndex = $state(0);
	let inputEl: HTMLInputElement | null = $state(null);
	let containerEl: HTMLDivElement | null = $state(null);

	type Item =
		| { kind: 'personne'; href: string; data: SearchResults['personnes'][number] }
		| { kind: 'senateur'; href: string; data: SearchResults['senateurs'][number] }
		| { kind: 'groupe'; href: string; data: SearchResults['groupes'][number] }
		| { kind: 'groupeSenat'; href: string; data: SearchResults['groupesSenat'][number] }
		| { kind: 'texte'; href: string; data: SearchResults['textes'][number] };

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
		for (const t of results.textes)
			out.push({ kind: 'texte', href: `/textes/${encodeURIComponent(t.id)}`, data: t });
		return out;
	});

	const totalCount = $derived(
		results.personnes.length +
			results.senateurs.length +
			results.groupes.length +
			results.groupesSenat.length +
			results.textes.length
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
		results = { personnes: [], groupes: [], senateurs: [], groupesSenat: [], textes: [] };
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
			'<mark class="bg-accent/30 text-link rounded px-0.5">' +
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

	/** Libellé court compact pour les chips, basé sur `TexteType`
	 *  (aligné sur la liste `/textes/`). */
	function typeBadge(t: string): string {
		if (t === 'projet-loi-finances') return 'PLF';
		if (t === 'projet-loi-finances-rectificative') return 'PLFR';
		if (t === 'projet-loi-financement-ss') return 'PLFSS';
		if (t === 'projet-loi-organique') return 'PJL-O';
		if (t === 'projet-loi-constitutionnelle') return 'PJL-C';
		if (t === 'projet-loi') return 'PJL';
		if (t === 'proposition-loi-organique') return 'PPL-O';
		if (t === 'proposition-loi-constitutionnelle') return 'PPL-C';
		if (t === 'proposition-loi') return 'PPL';
		if (t === 'proposition-resolution-europeenne') return 'PPR-EU';
		if (t === 'proposition-resolution') return 'PPR';
		return 'AUTRE';
	}

	function etatLibelle(e: string): string {
		if (e === 'promulgue') return 'Promulguée';
		if (e === 'rejete') return 'Rejeté';
		if (e === 'retire') return 'Retiré';
		if (e === 'caduc') return 'Caduc';
		if (e === 'fusionne') return 'Fusionné';
		if (e === 'en-cours') return 'En cours';
		return 'Inconnu';
	}
</script>

<div bind:this={containerEl} class="relative w-full max-w-md" onfocusout={handleBlur}>
	<div class="relative">
		<svg
			class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted pointer-events-none"
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
			placeholder="Rechercher un élu, un groupe, un texte de loi…"
			class="w-full bg-bg border border-border-soft rounded-full pl-9 pr-12 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/60 transition-all"
			aria-label="Recherche globale"
			aria-controls="global-search-results"
			autocomplete="off"
		/>
		<kbd
			class="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-fg-muted bg-border-soft/40 border border-border-soft rounded px-1.5 py-0.5 font-mono pointer-events-none hidden sm:block"
		>
			⌘K
		</kbd>
	</div>

	{#if isOpen}
		<div
			id="global-search-results"
			class="absolute top-full left-0 right-0 mt-2 bg-surface border border-border-soft rounded-xl shadow-2xl overflow-hidden z-50 max-h-[70vh] overflow-y-auto"
		>
			{#if isLoading && totalCount === 0}
				<div class="p-4 text-sm text-fg-muted text-center">
					<div class="animate-pulse">Chargement de l'index…</div>
				</div>
			{:else if !query.trim()}
				<div class="p-4 text-xs text-fg-muted">
					Tapez le nom d'un élu, d'un groupe, ou un mot-clé d'un texte de loi.
					<div class="mt-2 text-[10px]">
						Astuce : ⌘K (Ctrl+K) ouvre la recherche depuis n'importe où.
					</div>
				</div>
			{:else if totalCount === 0}
				<div class="p-4 text-sm text-fg-muted text-center">
					Aucun résultat pour <span class="font-semibold text-fg">{query}</span>.
				</div>
			{:else}
				{#if results.personnes.length > 0}
					<div
						class="px-3 py-2 text-[10px] uppercase tracking-widest text-fg-muted bg-bg/50"
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
								? 'bg-accent/10'
								: 'hover:bg-border-soft/30'}"
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
								class="w-8 h-8 rounded-full object-cover bg-border-soft flex-shrink-0"
								loading="lazy"
								referrerpolicy="no-referrer"
							/>
							<div class="min-w-0 flex-1">
								<div class="text-sm font-semibold truncate">
									{@html highlightMatch(`${p.identite.prenom} ${p.identite.nom}`, query)}
								</div>
								<div class="flex items-center gap-1.5 text-[10px] text-fg-muted">
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
						class="px-3 py-2 text-[10px] uppercase tracking-widest text-fg-muted bg-bg/50"
					>
						Sénateurs
					</div>
					{#each results.senateurs as s, i (s.id)}
						{@const flatIdx = results.personnes.length + i}
						<button
							type="button"
							class="w-full px-3 py-2 flex items-center gap-3 text-left transition-colors {activeIndex ===
							flatIdx
								? 'bg-accent/10'
								: 'hover:bg-border-soft/30'}"
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
								class="w-8 h-8 rounded-full object-cover bg-border-soft flex-shrink-0"
								loading="lazy"
								referrerpolicy="no-referrer"
							/>
							<div class="min-w-0 flex-1">
								<div class="text-sm font-semibold truncate">
									{@html highlightMatch(`${s.identite.prenom} ${s.identite.nom}`, query)}
								</div>
								<div class="flex items-center gap-1.5 text-[10px] text-fg-muted">
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
						class="px-3 py-2 text-[10px] uppercase tracking-widest text-fg-muted bg-bg/50"
					>
						Groupes (AN)
					</div>
					{#each results.groupes as g, i (g.legislature + ':' + g.id)}
						{@const flatIdx = results.personnes.length + results.senateurs.length + i}
						<button
							type="button"
							class="w-full px-3 py-2 flex items-center gap-3 text-left transition-colors {activeIndex ===
							flatIdx
								? 'bg-accent/10'
								: 'hover:bg-border-soft/30'}"
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
								<div class="text-[10px] text-fg-muted">
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
						class="px-3 py-2 text-[10px] uppercase tracking-widest text-fg-muted bg-bg/50"
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
								? 'bg-accent/10'
								: 'hover:bg-border-soft/30'}"
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
								<div class="text-[10px] text-fg-muted">
									{g.libelleAbrege} · Sénat · triennat {g.triennat} · {g.effectifFin} sénateur{g.effectifFin >
									1
										? 's'
										: ''}
								</div>
							</div>
						</button>
					{/each}
				{/if}

				{#if results.textes.length > 0}
					<div
						class="px-3 py-2 text-[10px] uppercase tracking-widest text-fg-muted bg-bg/50"
					>
						Textes législatifs
					</div>
					{#each results.textes as t, i (t.id)}
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
								? 'bg-accent/10'
								: 'hover:bg-border-soft/30'}"
							onmouseenter={() => (activeIndex = flatIdx)}
							onclick={() =>
								selectItem({
									kind: 'texte',
									href: `/textes/${encodeURIComponent(t.id)}`,
									data: t
								})}
						>
							<div class="flex-shrink-0">
								<span
									class="inline-block text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-border-soft/50 text-fg-muted"
									title={t.typeLibelle}
								>
									{typeBadge(t.type)}
								</span>
							</div>
							<div class="min-w-0 flex-1">
								<div class="text-xs leading-snug">
									{@html highlightMatch(truncate(t.titre, 100), query)}
								</div>
								<div class="text-[10px] text-fg-muted mt-0.5">
									{formatDate(t.dateFin)} ·
									<span
										class={t.etat === 'promulgue'
											? 'text-vote-pour'
											: t.etat === 'rejete'
												? 'text-vote-contre'
												: ''}>{etatLibelle(t.etat)}</span
									>
									{#if t.an && t.senat}
										· AN + Sénat
									{:else if t.an}
										· AN
									{:else if t.senat}
										· Sénat
									{/if}
								</div>
							</div>
						</button>
					{/each}
				{/if}

				<div
					class="px-3 py-2 border-t border-border-soft/50 text-[10px] text-fg-muted flex items-center gap-3"
				>
					<span><kbd class="bg-border-soft/40 px-1 rounded">↑↓</kbd> naviguer</span>
					<span><kbd class="bg-border-soft/40 px-1 rounded">↵</kbd> ouvrir</span>
					<span><kbd class="bg-border-soft/40 px-1 rounded">Esc</kbd> fermer</span>
				</div>
			{/if}
		</div>
	{/if}
</div>
