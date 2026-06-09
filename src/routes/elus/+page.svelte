<script lang="ts">
	/**
	 * Liste cross-chambre dédupliquée des élus PolitiDex (cf ADR 0030, 0031).
	 *
	 * Filtres : recherche libre, chambre (AN seul / Sénat seul / Bicaméral),
	 * sexe, familles politiques (multi-OR, cf ADR 0034), badges carrière (multi-OR).
	 *
	 * Pagination : Top 50 visibles + lazy load (cf PR #7 vote-scroll pattern).
	 *
	 * Items linkent vers `/elus/[eluId]?tab=carriere` (vue cross-chambre).
	 */
	import type { Elu } from '$lib/elus';
	import { eluCategorie } from '$lib/elus';
	import FiltresElus from '$lib/components/FiltresElus.svelte';

	let { data } = $props();

	type Chambre = 'tous' | 'an' | 'senat' | 'bicameral';
	const PAGE_SIZE = 50;

	const BADGES_OPTIONS = [
		{ id: 'Reelu', label: 'Réélu·e', emoji: '🔁' },
		{ id: 'Veteran', label: 'Vétéran', emoji: '🎖️' },
		{ id: 'Recomposition', label: 'Recomposition', emoji: '🔀' },
		{ id: 'Transfuge', label: 'Transfuge', emoji: '🚪' },
		{ id: 'Bicameral', label: 'Bicaméral·e', emoji: '🏛️' }
	];

	let q = $state('');
	let chambre = $state<Chambre>('tous');
	let sexe = $state<'tous' | 'M' | 'F'>('tous');
	let famillesSelected = $state<string[]>([]);
	let badgesSelected = $state<string[]>([]);
	let visibleCount = $state(PAGE_SIZE);

	const elus = $derived(data.manifest.elus);

	function normalize(s: string): string {
		return s
			.normalize('NFD')
			.replace(/[̀-ͯ]/g, '')
			.toLowerCase();
	}

	function eluFamilles(e: Elu): string[] {
		const set = new Set<string>();
		for (const m of e.mandats) {
			if (m.famille) set.add(m.famille);
		}
		return [...set];
	}

	function dernierGroupe(e: Elu): { libelle: string; couleur: string } | null {
		// Mandats sont triés par debut ASC (cf builder). On prend le dernier
		// mandat qui a une appartenance non-NI (groupeLibelleAbrege non null).
		for (let i = e.mandats.length - 1; i >= 0; i--) {
			const m = e.mandats[i];
			if (m.groupeLibelleAbrege) {
				return {
					libelle: m.groupeLibelleAbrege,
					couleur: m.groupeCouleur ?? '#9ca3af'
				};
			}
		}
		return null;
	}

	const filtered = $derived.by(() => {
		const qn = normalize(q.trim());
		const list = elus.filter((e) => {
			if (chambre !== 'tous' && eluCategorie(e) !== chambre) return false;
			if (sexe !== 'tous' && e.sexe !== sexe) return false;
			if (famillesSelected.length > 0) {
				const fams = eluFamilles(e);
				if (!fams.some((f) => famillesSelected.includes(f))) return false;
			}
			if (badgesSelected.length > 0) {
				if (!badgesSelected.some((b) => e.badgesCarriere.includes(b as never))) return false;
			}
			if (qn === '') return true;
			const name = normalize(`${e.prenom} ${e.nom}`);
			return name.includes(qn);
		});
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
		void sexe;
		void famillesSelected;
		void badgesSelected;
		visibleCount = PAGE_SIZE;
	});
</script>

<svelte:head>
	<title>Tous les élus — députés et sénateurs français · PolitiDex</title>
</svelte:head>

<section class="max-w-[1536px] mx-auto px-6 py-8">
	<header class="mb-6">
		<h1 class="title-display text-3xl">Tous les élus</h1>
		<p class="text-fg-muted text-sm mt-1">
			{data.manifest.count} élus dédupliqués cross-chambre · {data.manifest.countBicameral}
			bicaméraux. Une fiche par personne, qu'elle soit députée, sénatrice ou les deux.
		</p>
	</header>

	<div class="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 items-start">
		<aside class="card p-4 lg:sticky lg:top-20 space-y-4 text-sm">
			<input
				type="search"
				class="bg-bg border border-border-soft rounded-md px-3 py-1.5 w-full text-sm"
				placeholder="Rechercher un nom…"
				bind:value={q}
			/>

			<div>
				<div class="text-xs uppercase tracking-widest text-fg-muted mb-1.5">Chambre</div>
				<div class="grid grid-cols-2 gap-1">
					{#each [['tous', 'Tous'], ['an', 'AN'], ['senat', 'Sénat'], ['bicameral', 'Bicam.']] as [val, label] (val)}
						<button
							class="btn px-2 py-1 text-xs {chambre === val
								? 'bg-accent text-accent-fg'
								: 'border border-border-soft text-fg-muted hover:text-fg'}"
							onclick={() => (chambre = val as Chambre)}
						>
							{label}
						</button>
					{/each}
				</div>
			</div>

			<FiltresElus
				bind:sexe
				bind:famillesSelected
				bind:badgesSelected
				familles={data.familles}
				badges={BADGES_OPTIONS}
			/>
		</aside>

		<div>
			<div class="text-xs text-fg-muted mb-2 tabular-nums">
				{filtered.length} élu{filtered.length > 1 ? 's' : ''} · {Math.min(visibleCount, filtered.length)}
				affichés
			</div>

			{#if visible.length === 0}
				<div class="card p-8 text-sm text-fg-muted italic text-center">
					Aucun élu ne correspond à ces critères.
				</div>
			{:else}
				<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
					{#each visible as e (e.id)}
						{@const cat = eluCategorie(e)}
						{@const grp = dernierGroupe(e)}
						<a href="/elus/{e.slug}?tab=carriere" class="vignette">
							<!-- Liseré famille politique (signal CHES) -->
							<span class="vignette-bande" style="background: {grp?.couleur ?? 'var(--border-soft)'};" aria-hidden="true"></span>
							<img
								src={e.photoUrl}
								alt=""
								class="w-12 h-14 object-cover flex-shrink-0"
								style="border: 2px solid var(--border); background: var(--surface-2);"
								loading="lazy"
								referrerpolicy="no-referrer"
							/>
							<div class="min-w-0 flex-1">
								<div class="text-sm truncate">
									<span class="font-semibold">{e.prenom}</span> {e.nom}
								</div>
								<div class="flex items-center gap-1.5 mt-0.5 flex-wrap text-[10px] text-fg-muted">
									{#if grp}
										<span
											class="inline-flex items-center gap-1 px-1.5 py-0.5"
											style="border: 1px solid var(--border-soft);"
											title={grp.libelle}
										>
											<span
												class="w-1.5 h-1.5 rounded-full flex-shrink-0"
												style="background-color: {grp.couleur}"
											></span>
											<span class="truncate max-w-[8rem]">{grp.libelle}</span>
										</span>
									{/if}
									<span class="truncate">
										{e.mandats.length} mandat{e.mandats.length > 1 ? 's' : ''} · {categorieLabel(cat)}
										{#if e.badgesCarriere.includes('Bicameral')}
											· Bicam.
										{/if}
									</span>
								</div>
							</div>
							<div class="title-display text-xl text-fg tabular-nums flex-shrink-0">
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
		</div>
	</div>
</section>

<style>
	/* Vignette élu (liste) — bloc brutaliste avec liseré famille politique. */
	.vignette {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 0.75rem 0.75rem 1rem;
		background: var(--surface);
		border: 3px solid var(--border);
		box-shadow: 4px 4px 0 0 var(--shadow-color);
		transition:
			transform 120ms ease-out,
			box-shadow 120ms ease-out;
	}
	.vignette-bande {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 6px;
	}
	@media (hover: hover) {
		.vignette:hover {
			transform: translate(-2px, -2px);
			box-shadow: 6px 6px 0 0 var(--shadow-color);
		}
	}
	.vignette:active {
		transform: translate(2px, 2px);
		box-shadow: none;
	}
	@media (prefers-reduced-motion: reduce) {
		.vignette,
		.vignette:hover {
			transform: none;
			transition: none;
		}
	}
</style>
