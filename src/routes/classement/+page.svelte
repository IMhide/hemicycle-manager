<script lang="ts">
	/**
	 * Classement global cross-chambre par `overallCarriere` (cf ADR 0030).
	 *
	 * Tri exclusif : `overallCarriere` desc. **Aucun filtre chambre** — c'est
	 * la valeur ajoutée vs `/assemblee/classements/` et `/senat/classements/`,
	 * qui assurent eux la rigueur scope-aware par chambre. Ici on assume
	 * la posture ludique cross-chambre, et toute restriction (AN/Sénat/Bicaméral)
	 * volerait l'intérêt de la page.
	 *
	 * Seule recherche par nom autorisée — utile pour retrouver une personne
	 * dans 1856 élus.
	 *
	 * Pastilles de podium or/argent/bronze sur Top 3. Pagination Top 50 + lazy load.
	 *
	 * Items linkent vers `/elus/[eluId]?tab=carriere` (vue cross-chambre).
	 */
	import { eluCategorie } from '$lib/elus';

	let { data } = $props();

	const PAGE_SIZE = 50;

	let q = $state('');
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
		if (qn === '') return sorted;
		return sorted.filter((e) => normalize(`${e.prenom} ${e.nom}`).includes(qn));
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

	/** Couleur de podium pour les 3 premiers (rang absolu), sinon null. */
	function podiumColor(rang: number): string | null {
		if (rang === 1) return '#FFC400'; // or
		if (rang === 2) return '#B8B8C0'; // argent
		if (rang === 3) return '#CD7F32'; // bronze
		return null;
	}

	/** Rang absolu (= position dans `sorted`, indépendant de la recherche). */
	const rangById = $derived.by(() => {
		const m = new Map<string, number>();
		for (let i = 0; i < sorted.length; i++) m.set(sorted[i].id, i + 1);
		return m;
	});

	$effect(() => {
		void q;
		visibleCount = PAGE_SIZE;
	});
</script>

<svelte:head>
	<title>Classement global — PolitiDex</title>
</svelte:head>

<section class="max-w-5xl mx-auto px-6 py-8">
	<header class="mb-6">
		<h1 class="title-display text-3xl">Classement global</h1>
		<p class="text-fg-muted text-sm mt-1">
			Tous les élus PolitiDex toutes chambres confondues, triés par <strong>Overall carrière</strong>
			(moyenne simple cross-chambre, cf
			<a class="underline hover:text-link" href="/faq#elu-carriere">ADR 0032</a>). Pour
			le détail scope-aware par chambre, voir
			<a class="underline hover:text-link" href="/assemblee/classements/">classement AN</a>
			et
			<a class="underline hover:text-link" href="/senat/classements/">classement Sénat</a
			>.
		</p>
	</header>

	<div class="mb-6">
		<input
			type="search"
			class="card px-3 py-2 text-sm w-full max-w-md"
			placeholder="Rechercher un nom ou prénom…"
			bind:value={q}
		/>
	</div>

	<div class="text-xs text-fg-muted mb-2 tabular-nums">
		{filtered.length} élu{filtered.length > 1 ? 's' : ''} ·
		Top {Math.min(visibleCount, filtered.length)} visibles
	</div>

	{#if visible.length === 0}
		<div class="card p-8 text-sm text-fg-muted italic text-center">
			Aucun élu ne correspond à cette recherche.
		</div>
	{:else}
		<div class="card divide-y divide-border-soft/40">
			{#each visible as e (e.id)}
				{@const cat = eluCategorie(e)}
				{@const rang = rangById.get(e.id) ?? 0}
				{@const pc = podiumColor(rang)}
				<a
					href="/elus/{e.id}?tab=carriere"
					class="flex items-center gap-3 px-3 py-2 hover:bg-surface-2 transition-colors"
				>
					<div class="w-9 flex-shrink-0 flex justify-center">
						{#if pc}
							<span
								class="inline-flex items-center justify-center w-8 h-8 title-display text-lg tabular-nums"
								style="background: {pc}; color: #0a0a0a; border: 2px solid var(--border);"
							>{rang}</span>
						{:else}
							<span class="text-xs text-fg-muted tabular-nums">#{rang}</span>
						{/if}
					</div>
					<img
						src={e.photoUrl}
						alt=""
						class="w-10 h-12 object-cover flex-shrink-0"
						style="border: 2px solid var(--border); background: var(--surface-2);"
						loading="lazy"
						referrerpolicy="no-referrer"
					/>
					<div class="min-w-0 flex-1">
						<div class="text-sm truncate">
							<span class="font-semibold">{e.prenom}</span> {e.nom}
						</div>
						<div class="text-[10px] text-fg-muted truncate">
							{e.mandats.length} mandat{e.mandats.length > 1 ? 's' : ''} · {categorieLabel(cat)}
							{#if e.badgesCarriere.includes('Bicameral')}
								· Bicaméral
							{/if}
						</div>
					</div>
					<div class="title-display text-2xl text-fg tabular-nums flex-shrink-0">
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

	<footer class="mt-8 text-xs text-fg-muted">
		<details class="card p-4">
			<summary class="cursor-pointer font-semibold text-fg">
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
					<a class="underline hover:text-link" href="/faq#overall">ADR 0022</a> :
					0,55 · Participation + 0,35 · Volume(centile-95 cohorte) + 0,10 · Présence × 99.
				</p>
				<p>
					Pour le classement scope-aware (par législature ou triennat), voir
					<a class="underline hover:text-link" href="/assemblee/classements/"
						>/assemblee/classements/</a
					>
					et
					<a class="underline hover:text-link" href="/senat/classements/"
						>/senat/classements/</a
					>.
				</p>
			</div>
		</details>
	</footer>
</section>
