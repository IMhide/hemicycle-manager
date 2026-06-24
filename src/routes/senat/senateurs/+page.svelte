<script lang="ts">
	import SenateurRow from '$lib/components/SenateurRow.svelte';
	import InfoTip from '$lib/components/InfoTip.svelte';
	import FiltresElus from '$lib/components/FiltresElus.svelte';
	import { POLITICAL_ORDER } from '$lib/political-order';
	import { type TriennatId } from '$lib/triennats';
	import type { Senateur, MandatSenat, GroupeSenat, TriennatStats } from '$lib/types';

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
	type EtatFilter = 'all' | 'ACTIF' | 'ANCIEN';

	const triennatsSorted = $derived(
		[...data.triennats].sort((a, b) => b.dateDebut.localeCompare(a.dateDebut))
	);

	function pickTriennatCourant(triennats: typeof data.triennats): TriennatId {
		return (triennats.find((t) => t.enCours)?.id ??
			[...triennats].sort((a, b) => b.dateDebut.localeCompare(a.dateDebut))[0]?.id ??
			'2023-2026') as TriennatId;
	}

	let search = $state('');
	let sortKey: SortKey = $state('nom');
	let groupFilter = $state<Set<string>>(new Set());
	let sexeFilter = $state<'tous' | 'M' | 'F'>('tous');
	let etatFilter: EtatFilter = $state('all');
	let famillesSelected = $state<string[]>([]);
	let badgesSelected = $state<string[]>([]);
	let visibleCount = $state(60);
	/** null = vue carrière (cross-triennat), sinon scope par triennat. Init = triennat
	 *  en cours. `untrack` : instantané unique de `data` (statique au prerender), pas
	 *  une dépendance réactive (sinon state_referenced_locally). */
	let scopeTriennat: TriennatId | null = $state(untrack(() => pickTriennatCourant(data.triennats)));

	const groupesByCode = $derived.by(() => {
		const m = new Map<string, GroupeSenat>();
		for (const g of data.groupes) m.set(`${g.triennat}-${g.code}`, g);
		return m;
	});

	const groupesScope = $derived.by(() => {
		if (scopeTriennat === null) {
			// dédupliquer par code (libellé du dernier groupe rencontré)
			const seen = new Map<string, GroupeSenat>();
			for (const g of data.groupes) seen.set(g.code, g);
			return [...seen.values()];
		}
		return data.groupes.filter((g) => g.triennat === scopeTriennat);
	});

	const groupesSorted = $derived(
		[...groupesScope].sort(
			(a, b) =>
				(POLITICAL_ORDER[a.libelleAbrege]?.rank ?? 99) -
				(POLITICAL_ORDER[b.libelleAbrege]?.rank ?? 99)
		)
	);

	const presidentMatricules = $derived(
		new Set(groupesScope.map((g) => g.presidentMatricule).filter((x): x is string => !!x))
	);

	function toggleGroup(code: string) {
		const next = new Set(groupFilter);
		if (next.has(code)) next.delete(code);
		else next.add(code);
		groupFilter = next;
		visibleCount = 60;
	}

	function clearFilters() {
		search = '';
		groupFilter = new Set();
		sexeFilter = 'tous';
		etatFilter = 'all';
		famillesSelected = [];
		badgesSelected = [];
		sortKey = 'nom';
		visibleCount = 60;
	}

	function mandatTriennat(s: Senateur): { mandat: MandatSenat; triennat: TriennatStats } | null {
		if (scopeTriennat === null) return null;
		for (const m of s.mandats) {
			const tri = m.triennats.find((t) => t.triennat === scopeTriennat);
			if (tri) return { mandat: m, triennat: tri };
		}
		return null;
	}

	function groupePrincipal(s: Senateur, m: MandatSenat | null): GroupeSenat | null {
		if (scopeTriennat === null) {
			// dernier groupe connu (dernier mandat, dernière appartenance)
			const lastM = s.mandats.at(-1);
			const lastApp = lastM?.appartenancesGroupe.at(-1);
			if (!lastApp) return null;
			// chercher le groupe pour le triennat le plus récent du dernier mandat
			for (let y = lastM!.triennats.length - 1; y >= 0; y--) {
				const triId = lastM!.triennats[y].triennat;
				const g = groupesByCode.get(`${triId}-${lastApp.groupeCode}`);
				if (g) return g;
			}
			return null;
		}
		const target = m ?? s.mandats.at(-1);
		const lastApp = target?.appartenancesGroupe.at(-1);
		if (!lastApp) return null;
		return groupesByCode.get(`${scopeTriennat}-${lastApp.groupeCode}`) ?? null;
	}

	const enriched = $derived.by(() => {
		return data.senateurs
			.map((s) => {
				const mt = mandatTriennat(s);
				if (scopeTriennat !== null && !mt) return null;
				return {
					senateur: s,
					mandat: mt?.mandat ?? null,
					triennat: mt?.triennat ?? null,
					groupe: groupePrincipal(s, mt?.mandat ?? null)
				};
			})
			.filter(
				(
					x
				): x is {
					senateur: Senateur;
					mandat: MandatSenat | null;
					triennat: TriennatStats | null;
					groupe: GroupeSenat | null;
				} => !!x
			);
	});

	const famByCode = $derived(
		(data.famillesByGroupeCodeSenat ?? {}) as Record<string, string>
	);

	function senateurFamilles(s: Senateur, m: MandatSenat | null): string[] {
		const mandats = m ? [m] : s.mandats;
		const set = new Set<string>();
		for (const md of mandats) {
			const stable = md.appartenancesGroupe.find(
				(a) => a.groupeCode !== 'NI' && a.groupeCode !== 'AUCUN'
			);
			if (stable?.groupeCode) {
				const fam = famByCode[stable.groupeCode] ?? stable.groupeCode;
				set.add(fam);
			}
		}
		return [...set];
	}

	function senateurBadgesForScope(s: Senateur, m: MandatSenat | null): string[] {
		if (scopeTriennat === null) return s.carriere.badgesCarriere ?? [];
		return m?.badgesMandat ?? [];
	}

	const filtered = $derived.by(() => {
		const q = search.trim().toLowerCase();
		return enriched.filter(({ senateur, mandat, groupe }) => {
			if (q) {
				const hay = `${senateur.identite.prenom} ${senateur.identite.nom}`.toLowerCase();
				if (!hay.includes(q)) return false;
			}
			if (sexeFilter !== 'tous' && senateur.identite.sexe !== sexeFilter) return false;
			if (etatFilter !== 'all' && senateur.identite.etat !== etatFilter) return false;
			if (famillesSelected.length > 0) {
				const fams = senateurFamilles(senateur, mandat);
				if (!fams.some((f) => famillesSelected.includes(f))) return false;
			}
			if (badgesSelected.length > 0) {
				const bs = senateurBadgesForScope(senateur, mandat);
				if (!badgesSelected.some((b) => bs.includes(b))) return false;
			}
			if (groupFilter.size > 0) {
				if (!groupe || !groupFilter.has(groupe.code)) return false;
			}
			return true;
		});
	});

	const sorted = $derived.by(() => {
		const arr = [...filtered];
		switch (sortKey) {
			case 'nom':
				arr.sort(
					(a, b) =>
						a.senateur.identite.nom.localeCompare(b.senateur.identite.nom) ||
						a.senateur.identite.prenom.localeCompare(b.senateur.identite.prenom)
				);
				break;
			case 'presence':
				arr.sort((a, b) => {
					const sa = a.triennat ? a.triennat.stats.presence.rate : a.senateur.carriere.presence.rate;
					const sb = b.triennat ? b.triennat.stats.presence.rate : b.senateur.carriere.presence.rate;
					return sb - sa;
				});
				break;
			case 'loyaute':
				arr.sort((a, b) => {
					const sa =
						(a.triennat ? a.triennat.stats.loyaute.rate : a.senateur.carriere.loyaute.rate) ?? 0;
					const sb =
						(b.triennat ? b.triennat.stats.loyaute.rate : b.senateur.carriere.loyaute.rate) ?? 0;
					return sb - sa;
				});
				break;
			case 'frondes':
				arr.sort((a, b) => {
					const sa = a.triennat
						? a.triennat.stats.frondes.count
						: a.senateur.carriere.frondes.count;
					const sb = b.triennat
						? b.triennat.stats.frondes.count
						: b.senateur.carriere.frondes.count;
					return sb - sa;
				});
				break;
			case 'participation':
				arr.sort((a, b) => {
					const sa = a.triennat
						? a.triennat.stats.participation.rate
						: a.senateur.carriere.participation.rate;
					const sb = b.triennat
						? b.triennat.stats.participation.rate
						: b.senateur.carriere.participation.rate;
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
		void etatFilter;
		void famillesSelected;
		void badgesSelected;
		void sortKey;
		void scopeTriennat;
		visibleCount = 60;
	});

	const highlight = $derived(
		sortKey === 'nom' || sortKey === 'participation'
			? null
			: (sortKey as 'presence' | 'loyaute' | 'frondes')
	);
</script>

<svelte:head>
	<title>Sénateurs — PolitiDex</title>
</svelte:head>

<section class="max-w-[1536px] mx-auto px-6 py-8">
	<div class="mb-6 flex flex-wrap items-end justify-between gap-3">
		<div>
			<h1 class="title-display text-4xl">Sénateurs</h1>
			<p class="text-fg-muted text-sm mt-1">
				{enriched.length} sénateur{enriched.length > 1 ? 's' : ''}
				{#if scopeTriennat !== null}
					ayant siégé sur le triennat {scopeTriennat}
				{:else}
					sur l'ensemble des triennats couverts
				{/if}
			</p>
		</div>
		<div class="flex items-center gap-1 text-xs flex-wrap justify-end">
			<span class="text-fg-muted">Vue :</span>
			<button
				class="px-3 py-1 rounded {scopeTriennat === null
					? 'bg-accent text-accent-fg font-semibold'
					: 'border border-border-soft text-fg-muted hover:text-fg'}"
				onclick={() => (scopeTriennat = null)}
			>
				Carrière
			</button>
			{#each triennatsSorted.slice(0, 4) as tri (tri.id)}
				<button
					class="px-2 py-1 rounded text-[11px] {scopeTriennat === tri.id
						? 'bg-accent text-accent-fg font-semibold'
						: 'border border-border-soft text-fg-muted hover:text-fg'}"
					onclick={() => (scopeTriennat = tri.id as TriennatId)}
				>
					{tri.id}
				</button>
			{/each}
		</div>
	</div>

	<div class="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 items-start">
		<aside class="card p-4 lg:sticky lg:top-20 space-y-4 text-sm">
			<div>
				<label
					class="text-xs uppercase tracking-widest text-fg-muted block mb-1.5"
					for="search-senateurs"
				>
					Recherche
				</label>
				<input
					id="search-senateurs"
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
				badges={scopeTriennat === null ? BADGES_CARRIERE : BADGES_MANDAT}
			/>

			<div>
				<div class="text-xs uppercase tracking-widest text-fg-muted mb-1.5">État</div>
				<div class="flex gap-1">
					{#each [['all', 'Tous'], ['ACTIF', 'En exercice'], ['ANCIEN', 'Anciens']] as [key, label] (key)}
						<button
							class="btn px-2 py-1 text-[11px] flex-1 {etatFilter === key
								? 'bg-accent text-accent-fg'
								: 'border border-border-soft text-fg-muted hover:text-fg'}"
							onclick={() => (etatFilter = key as EtatFilter)}
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
				<div class="space-y-1 max-h-72 overflow-y-auto pr-1">
					{#each groupesSorted as g (g.code + '-' + g.triennat)}
						{@const isActive = groupFilter.has(g.code)}
						<button
							class="w-full flex items-center justify-between gap-2 px-2 py-1 rounded text-left transition-colors {isActive
								? 'bg-border-soft/60'
								: 'hover:bg-border-soft/30'}"
							onclick={() => toggleGroup(g.code)}
						>
							<span class="flex items-center gap-2 min-w-0">
								<span
									class="w-2 h-2 rounded-full flex-shrink-0"
									style="background-color: {g.couleur}"
								></span>
								<span class="text-xs font-medium truncate">{g.libelleAbrege}</span>
							</span>
							{#if scopeTriennat !== null}
								<span class="text-[10px] text-fg-muted tabular-nums">{g.effectifFin}</span>
							{/if}
						</button>
					{/each}
				</div>
			</div>

			{#if search || groupFilter.size > 0 || sexeFilter !== 'tous' || etatFilter !== 'all' || famillesSelected.length > 0 || badgesSelected.length > 0 || sortKey !== 'nom'}
				<button class="btn-ghost w-full text-xs" onclick={clearFilters}>
					Réinitialiser tous les filtres
				</button>
			{/if}
		</aside>

		<div>
			<div class="flex items-center justify-between gap-3 mb-3 text-xs text-fg-muted">
				<div>
					<span class="title-display text-base text-fg">{filtered.length}</span>
					sénateur{filtered.length > 1 ? 's' : ''} trouvé{filtered.length > 1 ? 's' : ''}
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
					<div class="text-sm">Aucun sénateur ne correspond à ces critères.</div>
					<button class="btn-ghost mt-4 text-sm" onclick={clearFilters}>Réinitialiser</button>
				</div>
			{:else}
				<div class="grid grid-cols-1 xl:grid-cols-2 gap-2">
					{#each visible as { senateur, mandat, triennat, groupe } (senateur.id)}
						<SenateurRow
							{senateur}
							{mandat}
							{triennat}
							{groupe}
							{highlight}
							isPresident={presidentMatricules.has(senateur.id)}
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
