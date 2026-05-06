<script lang="ts">
	import SenateurRow from '$lib/components/SenateurRow.svelte';
	import InfoTip from '$lib/components/InfoTip.svelte';
	import { POLITICAL_ORDER } from '$lib/political-order';
	import type { Senateur, MandatSenat, GroupeSenat, SessionStats } from '$lib/types';

	let { data } = $props();

	type SortKey = 'nom' | 'presence' | 'loyaute' | 'frondes' | 'participation';
	type EtatFilter = 'all' | 'ACTIF' | 'ANCIEN';

	const sessionsSorted = $derived([...data.sessions].sort((a, b) => b.sesann - a.sesann));
	const sessionCourante = $derived(sessionsSorted[0]?.sesann ?? new Date().getFullYear());

	let search = $state('');
	let sortKey: SortKey = $state('nom');
	let groupFilter = $state<Set<string>>(new Set());
	let civFilter = $state<'all' | 'M.' | 'Mme'>('all');
	let etatFilter: EtatFilter = $state('all');
	let visibleCount = $state(60);
	/** null = vue carrière (cross-session), sinon scope par session */
	let scopeSession: number | null = $state(sessionCourante);

	const groupesByCode = $derived.by(() => {
		const m = new Map<string, GroupeSenat>();
		for (const g of data.groupes) m.set(`${g.sesann}-${g.code}`, g);
		return m;
	});

	const groupesScope = $derived.by(() => {
		if (scopeSession === null) {
			// dédupliquer par code (libellé du dernier groupe rencontré)
			const seen = new Map<string, GroupeSenat>();
			for (const g of data.groupes) seen.set(g.code, g);
			return [...seen.values()];
		}
		return data.groupes.filter((g) => g.sesann === scopeSession);
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
		civFilter = 'all';
		etatFilter = 'all';
		sortKey = 'nom';
		visibleCount = 60;
	}

	function mandatSession(s: Senateur): { mandat: MandatSenat; session: SessionStats } | null {
		if (scopeSession === null) return null;
		for (const m of s.mandats) {
			const sess = m.sessions.find((sess) => sess.sesann === scopeSession);
			if (sess) return { mandat: m, session: sess };
		}
		return null;
	}

	function groupePrincipal(s: Senateur, m: MandatSenat | null): GroupeSenat | null {
		if (scopeSession === null) {
			// dernier groupe connu (dernier mandat, dernière appartenance)
			const lastM = s.mandats.at(-1);
			const lastApp = lastM?.appartenancesGroupe.at(-1);
			if (!lastApp) return null;
			// chercher le groupe pour la session du dernier mandat
			for (let y = lastM!.sessions.length - 1; y >= 0; y--) {
				const sesann = lastM!.sessions[y].sesann;
				const g = groupesByCode.get(`${sesann}-${lastApp.groupeCode}`);
				if (g) return g;
			}
			return null;
		}
		const target = m ?? s.mandats.at(-1);
		const lastApp = target?.appartenancesGroupe.at(-1);
		if (!lastApp) return null;
		return groupesByCode.get(`${scopeSession}-${lastApp.groupeCode}`) ?? null;
	}

	const enriched = $derived.by(() => {
		return data.senateurs
			.map((s) => {
				const ms = mandatSession(s);
				if (scopeSession !== null && !ms) return null;
				return {
					senateur: s,
					mandat: ms?.mandat ?? null,
					session: ms?.session ?? null,
					groupe: groupePrincipal(s, ms?.mandat ?? null)
				};
			})
			.filter(
				(
					x
				): x is {
					senateur: Senateur;
					mandat: MandatSenat | null;
					session: SessionStats | null;
					groupe: GroupeSenat | null;
				} => !!x
			);
	});

	const filtered = $derived.by(() => {
		const q = search.trim().toLowerCase();
		return enriched.filter(({ senateur, groupe }) => {
			if (q) {
				const hay = `${senateur.identite.prenom} ${senateur.identite.nom}`.toLowerCase();
				if (!hay.includes(q)) return false;
			}
			if (civFilter !== 'all' && senateur.identite.civ !== civFilter) return false;
			if (etatFilter !== 'all' && senateur.identite.etat !== etatFilter) return false;
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
					const sa = a.session ? a.session.stats.presence.rate : a.senateur.carriere.presence.rate;
					const sb = b.session ? b.session.stats.presence.rate : b.senateur.carriere.presence.rate;
					return sb - sa;
				});
				break;
			case 'loyaute':
				arr.sort((a, b) => {
					const sa =
						(a.session ? a.session.stats.loyaute.rate : a.senateur.carriere.loyaute.rate) ?? 0;
					const sb =
						(b.session ? b.session.stats.loyaute.rate : b.senateur.carriere.loyaute.rate) ?? 0;
					return sb - sa;
				});
				break;
			case 'frondes':
				arr.sort((a, b) => {
					const sa = a.session
						? a.session.stats.frondes.count
						: a.senateur.carriere.frondes.count;
					const sb = b.session
						? b.session.stats.frondes.count
						: b.senateur.carriere.frondes.count;
					return sb - sa;
				});
				break;
			case 'participation':
				arr.sort((a, b) => {
					const sa = a.session
						? a.session.stats.participation.rate
						: a.senateur.carriere.participation.rate;
					const sb = b.session
						? b.session.stats.participation.rate
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
		void civFilter;
		void etatFilter;
		void sortKey;
		void scopeSession;
		visibleCount = 60;
	});

	const highlight = $derived(
		sortKey === 'nom' || sortKey === 'participation'
			? null
			: (sortKey as 'presence' | 'loyaute' | 'frondes')
	);

	function libelleSession(sesann: number): string {
		return `${sesann}-${(sesann + 1).toString().slice(-2)}`;
	}
</script>

<svelte:head>
	<title>Sénateurs — PolitiDex</title>
</svelte:head>

<section class="max-w-7xl mx-auto px-6 py-8">
	<div class="mb-6 flex flex-wrap items-end justify-between gap-3">
		<div>
			<h1 class="title-display text-4xl">Sénateurs</h1>
			<p class="text-assembly-muted text-sm mt-1">
				{enriched.length} sénateur{enriched.length > 1 ? 's' : ''}
				{#if scopeSession !== null}
					ayant siégé en {libelleSession(scopeSession)}
				{:else}
					sur l'ensemble des sessions couvertes
				{/if}
			</p>
		</div>
		<div class="flex items-center gap-1 text-xs flex-wrap justify-end">
			<span class="text-assembly-muted">Vue :</span>
			<button
				class="px-3 py-1 rounded {scopeSession === null
					? 'bg-assembly-accent text-assembly-bg font-semibold'
					: 'border border-assembly-border text-assembly-muted hover:text-slate-200'}"
				onclick={() => (scopeSession = null)}
			>
				Carrière
			</button>
			{#each sessionsSorted.slice(0, 4) as sess (sess.sesann)}
				<button
					class="px-2 py-1 rounded text-[11px] {scopeSession === sess.sesann
						? 'bg-assembly-accent text-assembly-bg font-semibold'
						: 'border border-assembly-border text-assembly-muted hover:text-slate-200'}"
					onclick={() => (scopeSession = sess.sesann)}
				>
					{libelleSession(sess.sesann)}
				</button>
			{/each}
		</div>
	</div>

	<div class="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 items-start">
		<aside class="card p-4 lg:sticky lg:top-20 space-y-4 text-sm">
			<div>
				<label
					class="text-xs uppercase tracking-widest text-assembly-muted block mb-1.5"
					for="search-senateurs"
				>
					Recherche
				</label>
				<input
					id="search-senateurs"
					type="search"
					bind:value={search}
					placeholder="Nom ou prénom…"
					class="bg-assembly-bg border border-assembly-border rounded-md px-3 py-1.5 w-full"
				/>
			</div>

			<div>
				<div class="text-xs uppercase tracking-widest text-assembly-muted mb-1.5">Trier par</div>
				<select
					bind:value={sortKey}
					class="bg-assembly-bg border border-assembly-border rounded-md px-2 py-1.5 w-full"
				>
					<option value="nom">Nom (A→Z)</option>
					<option value="presence">Présence ↓</option>
					<option value="participation">Participation ↓</option>
					<option value="loyaute">Loyauté ↓</option>
					<option value="frondes">Frondes ↓</option>
				</select>
			</div>

			<div>
				<div class="text-xs uppercase tracking-widest text-assembly-muted mb-1.5">Civilité</div>
				<div class="flex gap-1">
					{#each [['all', 'Tous'], ['M.', 'M.'], ['Mme', 'Mme']] as [key, label] (key)}
						<button
							class="btn px-3 py-1 text-xs flex-1 {civFilter === key
								? 'bg-assembly-accent text-assembly-bg'
								: 'border border-assembly-border text-assembly-muted hover:text-assembly-text'}"
							onclick={() => (civFilter = key as 'all' | 'M.' | 'Mme')}
						>
							{label}
						</button>
					{/each}
				</div>
			</div>

			<div>
				<div class="text-xs uppercase tracking-widest text-assembly-muted mb-1.5">État</div>
				<div class="flex gap-1">
					{#each [['all', 'Tous'], ['ACTIF', 'En exercice'], ['ANCIEN', 'Anciens']] as [key, label] (key)}
						<button
							class="btn px-2 py-1 text-[11px] flex-1 {etatFilter === key
								? 'bg-assembly-accent text-assembly-bg'
								: 'border border-assembly-border text-assembly-muted hover:text-assembly-text'}"
							onclick={() => (etatFilter = key as EtatFilter)}
						>
							{label}
						</button>
					{/each}
				</div>
			</div>

			<div>
				<div
					class="text-xs uppercase tracking-widest text-assembly-muted mb-1.5 flex items-center gap-1"
				>
					Groupes
					{#if groupFilter.size > 0}
						<button
							class="ml-auto text-[10px] underline hover:text-assembly-accent"
							onclick={() => {
								groupFilter = new Set();
							}}
						>
							effacer
						</button>
					{/if}
				</div>
				<div class="space-y-1 max-h-72 overflow-y-auto pr-1">
					{#each groupesSorted as g (g.code + '-' + g.sesann)}
						{@const isActive = groupFilter.has(g.code)}
						<button
							class="w-full flex items-center justify-between gap-2 px-2 py-1 rounded text-left transition-colors {isActive
								? 'bg-assembly-border/60'
								: 'hover:bg-assembly-border/30'}"
							onclick={() => toggleGroup(g.code)}
						>
							<span class="flex items-center gap-2 min-w-0">
								<span
									class="w-2 h-2 rounded-full flex-shrink-0"
									style="background-color: {g.couleur}"
								></span>
								<span class="text-xs font-medium truncate">{g.libelleAbrege}</span>
							</span>
							{#if scopeSession !== null}
								<span class="text-[10px] text-assembly-muted tabular-nums">{g.effectifFin}</span>
							{/if}
						</button>
					{/each}
				</div>
			</div>

			{#if search || groupFilter.size > 0 || civFilter !== 'all' || etatFilter !== 'all' || sortKey !== 'nom'}
				<button class="btn-ghost w-full text-xs" onclick={clearFilters}>
					Réinitialiser les filtres
				</button>
			{/if}
		</aside>

		<div>
			<div class="flex items-center justify-between gap-3 mb-3 text-xs text-assembly-muted">
				<div>
					<span class="title-display text-base text-assembly-text">{filtered.length}</span>
					sénateur{filtered.length > 1 ? 's' : ''} trouvé{filtered.length > 1 ? 's' : ''}
					{#if filtered.length !== enriched.length}
						<span class="text-assembly-muted">/ {enriched.length}</span>
					{/if}
				</div>
				{#if highlight}
					<div class="flex items-center gap-1">
						Tri : <span class="text-assembly-text font-semibold">{sortKey}</span>
						<InfoTip title="Tri" size="xs">
							Les valeurs sont mises en évidence dans la colonne {sortKey} pour faciliter la lecture.
						</InfoTip>
					</div>
				{/if}
			</div>

			{#if filtered.length === 0}
				<div class="card p-8 text-center text-assembly-muted">
					<div class="title-display text-2xl mb-1">😶</div>
					<div class="text-sm">Aucun sénateur ne correspond à ces critères.</div>
					<button class="btn-ghost mt-4 text-sm" onclick={clearFilters}>Réinitialiser</button>
				</div>
			{:else}
				<div class="grid grid-cols-1 xl:grid-cols-2 gap-2">
					{#each visible as { senateur, mandat, session } (senateur.id)}
						<SenateurRow
							{senateur}
							{mandat}
							{session}
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
