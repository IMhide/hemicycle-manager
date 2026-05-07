<script lang="ts">
	/**
	 * Classement global cross-chambre par `overallCarriere` (cf ADR 0030).
	 *
	 * Tri exclusif : `overallCarriere` desc. Pas de scope période, pas de
	 * filtre score — c'est le classement *global* qui assume la posture
	 * ludique cross-chambre (la rigueur scope-aware reste dans
	 * /assemblee/classements/ et /senat/classements/).
	 *
	 * Filtres UI : recherche par nom, chambre (AN seul / Sénat seul /
	 * Bicaméral). Le score reste `overallCarriere` peu importe le filtre.
	 *
	 * Médailles 🥇 🥈 🥉 sur Top 3. Pagination Top 50 + lazy load.
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

	function normalize(s: string): string {
		return s
			.normalize('NFD')
			.replace(/[̀-ͯ]/g, '')
			.toLowerCase();
	}

	const sorted = $derived.by(() => {
		// Copie + tri par overallCarriere desc, tie-break par nom pour stabilité.
		const arr = [...data.manifest.elus];
		arr.sort((a, b) => {
			if (b.overallCarriere !== a.overallCarriere) return b.overallCarriere - a.overallCarriere;
			return a.nom.localeCompare(b.nom, 'fr');
		});
		return arr;
	});

	const filtered = $derived.by(() => {
		const qn = normalize(q.trim());
		return sorted.filter((e) => {
			if (chambre !== 'tous' && eluCategorie(e) !== chambre) return false;
			if (qn === '') return true;
			return normalize(`${e.prenom} ${e.nom}`).includes(qn);
		});
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

	/** Médaille pour les 3 premiers (rang absolu, sans dépendre des filtres). */
	function medal(rang: number): string | null {
		if (rang === 1) return '🥇';
		if (rang === 2) return '🥈';
		if (rang === 3) return '🥉';
		return null;
	}

	/** Rang absolu (= position dans `sorted`, indépendant des filtres). */
	const rangById = $derived.by(() => {
		const m = new Map<string, number>();
		for (let i = 0; i < sorted.length; i++) m.set(sorted[i].id, i + 1);
		return m;
	});

	$effect(() => {
		void q;
		void chambre;
		visibleCount = PAGE_SIZE;
	});
</script>

<svelte:head>
	<title>Classement global — PolitiDex</title>
</svelte:head>

<section class="max-w-5xl mx-auto px-6 py-8">
	<header class="mb-6">
		<h1 class="title-display text-3xl">🏆 Classement global</h1>
		<p class="text-assembly-muted text-sm mt-1">
			Tous les élus PolitiDex triés par <strong>Overall carrière</strong> (moyenne simple
			cross-chambre, cf <a class="underline hover:text-assembly-accent" href="/faq#elu-carriere"
				>ADR 0032</a
			>). Le score reste le même peu importe le filtre — c'est le classement <em>global</em>, qui assume la
			posture ludique.
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
		{filtered.length} élu{filtered.length > 1 ? 's' : ''} affiché{filtered.length > 1 ? 's' : ''} ·
		Top {Math.min(visibleCount, filtered.length)} visibles
	</div>

	{#if visible.length === 0}
		<div class="card p-8 text-sm text-assembly-muted italic text-center">
			Aucun élu ne correspond à ces critères.
		</div>
	{:else}
		<div class="card divide-y divide-assembly-border/40">
			{#each visible as e (e.id)}
				{@const cat = eluCategorie(e)}
				{@const rang = rangById.get(e.id) ?? 0}
				{@const m = medal(rang)}
				<a
					href="/elus/{e.id}?tab=carriere"
					class="flex items-center gap-3 px-3 py-2 hover:bg-assembly-border/20 transition-colors"
				>
					<div class="w-10 text-center flex-shrink-0">
						{#if m}
							<span class="text-2xl">{m}</span>
						{:else}
							<span class="text-xs text-assembly-muted tabular-nums">#{rang}</span>
						{/if}
					</div>
					<img
						src={e.photoUrl}
						alt=""
						class="w-10 h-12 object-cover rounded-md border border-assembly-border bg-assembly-border flex-shrink-0"
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
					<div class="title-display text-2xl text-amber-300 tabular-nums flex-shrink-0">
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

	<footer class="mt-8 text-xs text-assembly-muted">
		<details class="card p-4">
			<summary class="cursor-pointer font-semibold text-assembly-text">
				Comment se calcule ce classement ?
			</summary>
			<div class="mt-3 space-y-2">
				<p>
					L'<strong>Overall carrière</strong> est la moyenne arithmétique simple des Overall de
					chaque mandat de l'élu (un par législature AN, un par triennat Sénat). Posture
					éditoriale assumée : <em>chaque mandat compte pareil</em>.
				</p>
				<p>
					La formule de chaque Overall mandat reste celle figée par
					<a class="underline hover:text-assembly-accent" href="/faq#overall">ADR 0022</a> :
					0,55 · Participation + 0,35 · Volume(centile-95 cohorte) + 0,10 · Présence × 99.
				</p>
				<p>
					Pour le classement scope-aware (par législature ou triennat), voir
					<a class="underline hover:text-assembly-accent" href="/assemblee/classements/"
						>/assemblee/classements/</a
					>
					et
					<a class="underline hover:text-assembly-accent" href="/senat/classements/"
						>/senat/classements/</a
					>.
				</p>
			</div>
		</details>
	</footer>
</section>
