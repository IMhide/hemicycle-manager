<script lang="ts">
	import { goto } from '$app/navigation';
	import { ensureSearchIndex, searchAll, type SearchResults } from '$lib/search-index';
	import type { SearchIndex } from '$lib/search-index';

	/**
	 * `size` :
	 *  - `topbar` (défaut) — widget compact du header, inchangé.
	 *  - `hero` — grande barre brutaliste de la home (bordure 3px, ombre dure,
	 *    input plus haut, rangées de résultats plus grandes).
	 * `query` est `$bindable` pour que la home puisse la remplir depuis une
	 *  puce de suggestion (« Retailleau », « PLF 2025 »…).
	 */
	let { size = 'topbar', query = $bindable('') }: { size?: 'topbar' | 'hero'; query?: string } =
		$props();

	const isHero = $derived(size === 'hero');
	let isOpen = $state(false);
	let isLoading = $state(false);
	let index: SearchIndex | null = $state(null);
	let results: SearchResults = $state({
		elus: [],
		groupes: [],
		textes: []
	});
	let activeIndex = $state(0);
	let inputEl: HTMLInputElement | null = $state(null);
	let containerEl: HTMLDivElement | null = $state(null);
	let resultsEl: HTMLDivElement | null = $state(null);

	/** Garde la ligne active (flèches ↑↓) visible dans le dropdown scrollable. */
	$effect(() => {
		// Dépend de activeIndex : se redéclenche à chaque déplacement clavier.
		const idx = activeIndex;
		if (!isOpen || !resultsEl) return;
		const rows = resultsEl.querySelectorAll<HTMLElement>('.search-row');
		rows[idx]?.scrollIntoView({ block: 'nearest' });
	});

	type Item =
		| { kind: 'elu'; href: string; data: SearchResults['elus'][number] }
		| { kind: 'groupe'; href: string; data: SearchResults['groupes'][number] }
		| { kind: 'texte'; href: string; data: SearchResults['textes'][number] };

	// L'href est désormais calculé en amont (search-index) et porté par chaque
	// résultat — flatResults se contente d'aplatir dans l'ordre d'affichage.
	const flatResults = $derived.by(() => {
		const out: Item[] = [];
		for (const e of results.elus) out.push({ kind: 'elu', href: e.href, data: e });
		for (const g of results.groupes) out.push({ kind: 'groupe', href: g.href, data: g });
		for (const t of results.textes)
			out.push({ kind: 'texte', href: `/textes/${encodeURIComponent(t.id)}`, data: t });
		return out;
	});

	const totalCount = $derived(
		results.elus.length + results.groupes.length + results.textes.length
	);

	/** Libellé de chambre d'un élu pour la ligne de résultat. */
	function chambreLabelElu(cat: 'an' | 'senat' | 'bicameral'): string {
		if (cat === 'bicameral') return 'Député·e + Sénateur·rice';
		if (cat === 'an') return 'Assemblée nationale';
		return 'Sénat';
	}

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
		results = { elus: [], groupes: [], textes: [] };
		inputEl?.blur();
	}

	function selectItem(item: Item) {
		goto(item.href);
		close();
	}

	/** Appelé par la home (puces de suggestion) : remplit, focus, recherche. */
	export async function searchFor(term: string) {
		query = term;
		isOpen = true;
		inputEl?.focus();
		await ensureLoaded();
		runSearch();
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
			'<mark class="search-hl">' +
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

<div
	bind:this={containerEl}
	class="relative w-full {isHero ? '' : 'max-w-md'}"
	onfocusout={handleBlur}
>
	<div class="relative">
		<svg
			class="absolute top-1/2 -translate-y-1/2 text-fg-muted pointer-events-none {isHero
				? 'left-4 w-6 h-6'
				: 'left-3 w-4 h-4'}"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
		>
			<circle cx="11" cy="11" r="7" />
			<path d="m21 21-4.3-4.3" />
		</svg>
		{#if isHero}
			<input
				bind:this={inputEl}
				bind:value={query}
				oninput={handleInput}
				onfocus={handleFocus}
				onkeydown={handleKeydown}
				type="search"
				placeholder="Mélenchon, Le Pen, loi immigration…"
				class="search-hero w-full pl-14 pr-16 py-4 text-lg sm:text-xl"
				aria-label="Recherche globale"
				aria-controls="global-search-results"
				autocomplete="off"
			/>
			<kbd
				class="search-hero-kbd absolute right-4 top-1/2 hidden -translate-y-1/2 px-2 py-1 text-xs sm:block"
			>
				⌘K
			</kbd>
		{:else}
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
		{/if}
	</div>

	{#if isOpen}
		<div
			bind:this={resultsEl}
			id="global-search-results"
			role="listbox"
			aria-label="Résultats de recherche"
			class="absolute top-full left-0 right-0 z-50 max-h-[70vh] overflow-y-auto overflow-hidden bg-surface {isHero
				? 'search-hero-panel mt-3'
				: 'mt-2 rounded-xl border border-border-soft shadow-2xl'}"
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
				{#if results.elus.length > 0}
					<div
						class="px-3 py-2 text-[10px] uppercase tracking-widest text-fg-muted bg-bg/50"
					>
						Élus
					</div>
					{#each results.elus as e, i (e.eluId)}
						{@const flatIdx = i}
						<button
							type="button"
							role="option"
							aria-selected={activeIndex === flatIdx}
							class="search-row"
							class:search-row-active={activeIndex === flatIdx}
							onmouseenter={() => (activeIndex = flatIdx)}
							onclick={() => selectItem({ kind: 'elu', href: e.href, data: e })}
						>
							<img
								src={e.photoUrl}
								alt=""
								class="w-8 h-8 rounded-full object-cover bg-border-soft flex-shrink-0"
								loading="lazy"
								referrerpolicy="no-referrer"
							/>
							<div class="min-w-0 flex-1">
								<div class="text-sm font-semibold truncate">
									{@html highlightMatch(`${e.prenom} ${e.nom}`, query)}
								</div>
								<div class="flex items-center gap-1.5 text-[10px] text-fg-muted">
									{#if e.groupeLibelleAbrege}
										<span
											class="w-1.5 h-1.5 rounded-full flex-shrink-0"
											style="background-color: {e.groupeCouleur ?? 'var(--fg-muted)'}"
										></span>
										<span>{e.groupeLibelleAbrege}</span>
										<span>·</span>
									{/if}
									<span>{chambreLabelElu(e.categorie)}</span>
									{#if e.categorie !== 'bicameral'}
										<span>· {e.enExercice ? 'En exercice' : 'Ancien·ne'}</span>
									{/if}
								</div>
							</div>
						</button>
					{/each}
				{/if}

				{#if results.groupes.length > 0}
					<div
						class="px-3 py-2 text-[10px] uppercase tracking-widest text-fg-muted bg-bg/50"
					>
						Groupes
					</div>
					{#each results.groupes as g, i (g.key)}
						{@const flatIdx = results.elus.length + i}
						<button
							type="button"
							role="option"
							aria-selected={activeIndex === flatIdx}
							class="search-row"
							class:search-row-active={activeIndex === flatIdx}
							onmouseenter={() => (activeIndex = flatIdx)}
							onclick={() => selectItem({ kind: 'groupe', href: g.href, data: g })}
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
									{g.libelleAbrege} · {g.chambre === 'AN' ? 'AN' : 'Sénat'} · {g.contexte} · {g.effectif}
									{g.chambre === 'AN' ? 'député·e' : 'sénateur·rice'}{g.effectif > 1 ? 's' : ''}
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
						{@const flatIdx = results.elus.length + results.groupes.length + i}
						<button
							type="button"
							role="option"
							aria-selected={activeIndex === flatIdx}
							class="search-row"
							class:search-row-active={activeIndex === flatIdx}
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

<style>
	/* ── Rangée de résultat : curseur clavier/souris franc ──────────────── */
	.search-row {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 0.75rem;
		text-align: left;
		border-left: 3px solid transparent;
		transition:
			background-color 100ms ease-out,
			border-color 100ms ease-out;
	}
	/* La ligne « active » (flèches ↑↓ OU survol souris) : aplat jaune franc
	   + barre gauche. Le fond `--accent` est le MÊME jaune en Light et Dark,
	   donc le texte doit TOUJOURS être `--accent-fg` (noir) — sinon le nom
	   principal hérite de `--fg` (blanc en dark) = illisible sur jaune. */
	.search-row-active {
		background: var(--accent);
		border-left-color: var(--border);
		color: var(--accent-fg);
	}
	.search-row-active :global(.text-fg-muted),
	.search-row-active :global(.text-link),
	.search-row-active :global(.text-vote-pour),
	.search-row-active :global(.text-vote-contre) {
		color: var(--accent-fg);
	}
	/* Terme recherché surligné : pas de bloc plein (illisible en dark),
	   juste gras + souligné en couleur d'accent du texte. */
	:global(.search-hl) {
		background: transparent;
		color: var(--link);
		font-weight: 700;
		text-decoration: underline;
		text-decoration-thickness: 2px;
		text-underline-offset: 2px;
	}
	/* Sur la ligne active (aplat jaune), le terme reste lisible en noir. */
	.search-row-active :global(.search-hl) {
		color: var(--accent-fg);
	}
	@media (prefers-reduced-motion: reduce) {
		.search-row {
			transition: none;
		}
	}

	/* ── Variante `hero` (home) : grande barre brutaliste ───────────────── */
	.search-hero {
		background: var(--surface);
		border: 3px solid var(--border);
		box-shadow: 4px 4px 0 0 var(--shadow-color);
		border-radius: 0;
		font-weight: 500;
		color: var(--fg);
		transition:
			box-shadow 120ms ease-out,
			transform 120ms ease-out;
	}
	.search-hero::placeholder {
		color: var(--fg-muted);
	}
	.search-hero:focus {
		outline: none;
		box-shadow: 6px 6px 0 0 var(--accent);
	}
	.search-hero-kbd {
		font-family: monospace;
		color: var(--fg-muted);
		background: var(--surface-2);
		border: 2px solid var(--border);
		border-radius: 0;
		pointer-events: none;
	}
	.search-hero-panel {
		border: 3px solid var(--border);
		border-radius: 0;
		box-shadow: 6px 6px 0 0 var(--shadow-color);
	}
	@media (prefers-reduced-motion: reduce) {
		.search-hero {
			transition: none;
		}
	}
</style>
