<script lang="ts">
	import MemberRow from '$lib/components/MemberRow.svelte';
	import InfoTip from '$lib/components/InfoTip.svelte';
	import FiltresElus from '$lib/components/FiltresElus.svelte';
	import { POLITICAL_ORDER } from '$lib/political-order';
	import type { Personne, Mandat, Groupe } from '$lib/types';

	import { untrack } from 'svelte';

	let { data } = $props();

	const BADGES_CARRIERE = [
		{ id: 'reelu', label: 'Réélu·e', emoji: '🔁' },
		{ id: 'veteran', label: 'Vétéran', emoji: '🎖️' },
		{ id: 'recomposition', label: 'Recomposition', emoji: '🔀' },
		{ id: 'transfuge', label: 'Transfuge', emoji: '🚪' }
	];
	const BADGES_MANDAT = [
		{ id: 'top-loyaliste', label: 'Top loyaliste', emoji: '🤝' },
		{ id: 'frondeur', label: 'Frondeur·euse', emoji: '🔥' },
		{ id: 'presence-or', label: 'Présence en or', emoji: '🎯' },
		{ id: 'absent-remarquable', label: 'Absent·e remarquable', emoji: '👻' }
	];

	type SortKey = 'nom' | 'presence' | 'loyaute' | 'frondes' | 'participation';

	const legislatureCourante = $derived(
		[...data.legislatures].sort((a, b) => b.num - a.num)[0]?.num ?? 17
	);

	let search = $state('');
	let sortKey: SortKey = $state('nom');
	let groupFilter = $state<Set<string>>(new Set());
	let sexeFilter = $state<'tous' | 'M' | 'F'>('tous');
	let famillesSelected = $state<string[]>([]);
	let badgesSelected = $state<string[]>([]);
	let visibleCount = $state(60);
	let onlyPresidents = $state(false);
	/** null = vue carrière (cross-leg), sinon scope par législature.
	 *  Valeur initiale = législature la plus récente. `untrack` car on veut
	 *  délibérément un instantané unique de `data` (statique au prerender), pas
	 *  une dépendance réactive — sinon Svelte émet `state_referenced_locally`. */
	let scopeLeg: number | null = $state(
		untrack(() => [...data.legislatures].sort((a, b) => b.num - a.num)[0]?.num ?? 17)
	);

	const groupesById = $derived.by(() => {
		const m = new Map<string, Groupe>();
		for (const g of data.groupes) m.set(g.id, g);
		return m;
	});

	const groupesScope = $derived.by(() => {
		if (scopeLeg === null) return data.groupes;
		return data.groupes.filter((g) => g.legislature === scopeLeg);
	});

	const groupesSorted = $derived(
		[...groupesScope].sort(
			(a, b) =>
				(POLITICAL_ORDER[a.libelleAbrege]?.rank ?? 99) -
				(POLITICAL_ORDER[b.libelleAbrege]?.rank ?? 99)
		)
	);

	const presidentIds = $derived(
		new Set(groupesScope.map((g) => g.presidentId).filter((x): x is string => !!x))
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
		sexeFilter = 'tous';
		famillesSelected = [];
		badgesSelected = [];
		onlyPresidents = false;
		sortKey = 'nom';
		visibleCount = 60;
	}

	/** Pour chaque personne, trouve son mandat dans le scope (ou null si carrière). */
	function mandatScope(p: Personne): Mandat | null {
		if (scopeLeg === null) return null;
		return p.mandats.find((m) => m.legislature === scopeLeg) ?? null;
	}

	/** Groupe "principal" pour une personne dans le scope courant. */
	function groupePrincipal(p: Personne, m: Mandat | null): Groupe | null {
		const mandats = m ? [m] : p.mandats;
		for (let i = mandats.length - 1; i >= 0; i--) {
			const md = mandats[i];
			for (let j = md.appartenancesGroupe.length - 1; j >= 0; j--) {
				const a = md.appartenancesGroupe[j];
				if (a.isTransitoireNI) continue;
				const g = groupesById.get(a.groupeId);
				if (g) return g;
			}
		}
		return null;
	}

	const enriched = $derived.by(() => {
		return data.personnes
			.map((p) => {
				const m = mandatScope(p);
				if (scopeLeg !== null && !m) return null;
				return { personne: p, mandat: m, groupe: groupePrincipal(p, m) };
			})
			.filter((x): x is { personne: Personne; mandat: Mandat | null; groupe: Groupe | null } => !!x);
	});

	const famByGroupe = $derived(
		(data.famillesByGroupeIdAN ?? {}) as Record<string, string>
	);

	function eluFamilles(p: Personne, m: Mandat | null): string[] {
		// Scope-aware : si on est sur une législature précise, on regarde la
		// famille du mandat scopé seulement. En vue Carrière, on prend l'union
		// des familles traversées par tous les mandats.
		const mandats = m ? [m] : p.mandats;
		const set = new Set<string>();
		for (const md of mandats) {
			const stable = md.appartenancesGroupe.find((a) => !a.isTransitoireNI);
			if (stable?.groupeId) {
				const fam = famByGroupe[stable.groupeId] ?? stable.groupeId;
				set.add(fam);
			}
		}
		return [...set];
	}

	function badgesForScope(p: Personne, m: Mandat | null): string[] {
		// Scope-aware : carrière → badges carrière, législature → badges du mandat.
		if (scopeLeg === null) return p.carriere.badgesCarriere ?? [];
		return m?.badgesMandat ?? [];
	}

	const filtered = $derived.by(() => {
		const q = search.trim().toLowerCase();
		return enriched.filter(({ personne, mandat, groupe }) => {
			if (q) {
				const hay = `${personne.identite.prenom} ${personne.identite.nom}`.toLowerCase();
				if (!hay.includes(q)) return false;
			}
			if (sexeFilter !== 'tous' && personne.identite.sexe !== sexeFilter) return false;
			if (famillesSelected.length > 0) {
				const fams = eluFamilles(personne, mandat);
				if (!fams.some((f) => famillesSelected.includes(f))) return false;
			}
			if (badgesSelected.length > 0) {
				const bs = badgesForScope(personne, mandat);
				if (!badgesSelected.some((b) => bs.includes(b))) return false;
			}
			if (groupFilter.size > 0) {
				if (!groupe || !groupFilter.has(groupe.id)) return false;
			}
			if (onlyPresidents && !presidentIds.has(personne.id)) return false;
			return true;
		});
	});

	const sorted = $derived.by(() => {
		const arr = [...filtered];
		switch (sortKey) {
			case 'nom':
				arr.sort(
					(a, b) =>
						a.personne.identite.nom.localeCompare(b.personne.identite.nom) ||
						a.personne.identite.prenom.localeCompare(b.personne.identite.prenom)
				);
				break;
			case 'presence':
				arr.sort((a, b) => {
					const sa = a.mandat ? a.mandat.stats.presence.rate : a.personne.carriere.presence.rate;
					const sb = b.mandat ? b.mandat.stats.presence.rate : b.personne.carriere.presence.rate;
					return sb - sa;
				});
				break;
			case 'loyaute':
				arr.sort((a, b) => {
					const sa = (a.mandat ? a.mandat.stats.loyaute.rate : a.personne.carriere.loyaute.rate) ?? 0;
					const sb = (b.mandat ? b.mandat.stats.loyaute.rate : b.personne.carriere.loyaute.rate) ?? 0;
					return sb - sa;
				});
				break;
			case 'frondes':
				arr.sort((a, b) => {
					const sa = a.mandat ? a.mandat.stats.frondes.count : a.personne.carriere.frondes.count;
					const sb = b.mandat ? b.mandat.stats.frondes.count : b.personne.carriere.frondes.count;
					return sb - sa;
				});
				break;
			case 'participation':
				arr.sort((a, b) => {
					const sa = a.mandat
						? a.mandat.stats.participation.rate
						: a.personne.carriere.participation.rate;
					const sb = b.mandat
						? b.mandat.stats.participation.rate
						: b.personne.carriere.participation.rate;
					return sb - sa;
				});
				break;
		}
		return arr;
	});

	const visible = $derived(sorted.slice(0, visibleCount));

	$effect(() => {
		void search;
		void groupFilter;
		void sexeFilter;
		void famillesSelected;
		void badgesSelected;
		void onlyPresidents;
		void sortKey;
		void scopeLeg;
		visibleCount = 60;
	});

	const highlight = $derived(
		sortKey === 'nom' || sortKey === 'participation'
			? null
			: (sortKey as 'presence' | 'loyaute' | 'frondes')
	);

	const legSorted = $derived([...data.legislatures].sort((a, b) => b.num - a.num));
</script>

<svelte:head>
	<title>Députés — PolitiDex</title>
</svelte:head>

<section class="max-w-[1536px] mx-auto px-6 py-8">
	<div class="mb-6 flex flex-wrap items-end justify-between gap-3">
		<div>
			<h1 class="title-display text-4xl">Députés</h1>
			<p class="text-fg-muted text-sm mt-1">
				{enriched.length} personne{enriched.length > 1 ? 's' : ''}
				{#if scopeLeg !== null}
					ayant siégé en {scopeLeg}<sup>e</sup> législature
				{:else}
					sur l'ensemble des législatures couvertes
				{/if}
			</p>
		</div>
		<div class="flex items-center gap-1 text-xs">
			<span class="text-fg-muted">Vue :</span>
			<button
				class="px-3 py-1 rounded {scopeLeg === null
					? 'bg-accent text-accent-fg font-semibold'
					: 'border border-border-soft text-fg-muted hover:text-fg'}"
				onclick={() => (scopeLeg = null)}
			>
				Carrière
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
					for="search-deputes"
				>
					Recherche
				</label>
				<input
					id="search-deputes"
					type="search"
					bind:value={search}
					placeholder="Nom ou prénom…"
					class="bg-bg border border-border-soft rounded-md px-3 py-1.5 w-full"
				/>
			</div>

			<div>
				<div class="text-xs uppercase tracking-widest text-fg-muted mb-1.5">Trier par</div>
				<select
					bind:value={sortKey}
					class="bg-bg border border-border-soft rounded-md px-2 py-1.5 w-full"
				>
					<option value="nom">Nom (A→Z)</option>
					<option value="presence">Présence ↓</option>
					<option value="participation">Participation ↓</option>
					<option value="loyaute">Loyauté ↓</option>
					<option value="frondes">Frondes ↓</option>
				</select>
			</div>

			<FiltresElus
				bind:sexe={sexeFilter}
				bind:famillesSelected
				bind:badgesSelected
				familles={data.familles}
				badges={scopeLeg === null ? BADGES_CARRIERE : BADGES_MANDAT}
			/>

			{#if scopeLeg !== null}
				<div>
					<label class="flex items-center gap-2 cursor-pointer">
						<input type="checkbox" bind:checked={onlyPresidents} class="accent-accent" />
						<span class="text-xs">Présidents de groupe seulement</span>
					</label>
				</div>

				<div>
					<div
						class="text-xs uppercase tracking-widest text-fg-muted mb-1.5 flex items-center gap-1"
					>
						Groupes
						{#if groupFilter.size > 0}
							<button
								class="ml-auto text-[10px] underline hover:text-link"
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
									? 'bg-border-soft/60'
									: 'hover:bg-border-soft/30'}"
								onclick={() => toggleGroup(g.id)}
							>
								<span class="flex items-center gap-2 min-w-0">
									<span
										class="w-2 h-2 rounded-full flex-shrink-0"
										style="background-color: {g.couleur}"
									></span>
									<span class="text-xs font-medium truncate">{g.libelleAbrege}</span>
								</span>
								<span class="text-[10px] text-fg-muted tabular-nums">{g.effectifFin}</span>
							</button>
						{/each}
					</div>
				</div>
			{/if}

			{#if search || groupFilter.size > 0 || sexeFilter !== 'tous' || famillesSelected.length > 0 || badgesSelected.length > 0 || onlyPresidents || sortKey !== 'nom'}
				<button class="btn-ghost w-full text-xs" onclick={clearFilters}>
					Réinitialiser tous les filtres
				</button>
			{/if}
		</aside>

		<div>
			<div class="flex items-center justify-between gap-3 mb-3 text-xs text-fg-muted">
				<div>
					<span class="title-display text-base text-fg">{filtered.length}</span>
					député{filtered.length > 1 ? 's' : ''} trouvé{filtered.length > 1 ? 's' : ''}
					{#if filtered.length !== enriched.length}
						<span class="text-fg-muted">/ {enriched.length}</span>
					{/if}
				</div>
				{#if highlight}
					<div class="flex items-center gap-1">
						Tri : <span class="text-fg font-semibold">{sortKey}</span>
						<InfoTip title="Tri" size="xs">
							Les valeurs sont mises en évidence dans la colonne {sortKey} pour faciliter la lecture.
						</InfoTip>
					</div>
				{/if}
			</div>

			{#if filtered.length === 0}
				<div class="card p-8 text-center text-fg-muted">
					<div class="title-display text-4xl mb-2 text-fg-muted">∅</div>
					<div class="text-sm">Aucun député ne correspond à ces critères.</div>
					<button class="btn-ghost mt-4 text-sm" onclick={clearFilters}> Réinitialiser </button>
				</div>
			{:else}
				<div class="grid grid-cols-1 xl:grid-cols-2 gap-2">
					{#each visible as { personne, mandat, groupe } (personne.id)}
						<MemberRow
							{personne}
							{mandat}
							{groupe}
							{highlight}
							isPresident={presidentIds.has(personne.id)}
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
