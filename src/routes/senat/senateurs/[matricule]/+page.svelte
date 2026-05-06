<script lang="ts">
	/**
	 * Fiche détail d'un sénateur (cf ADR 0023..0028).
	 *
	 * Tabs : [Carrière] [2023-2026] [2020-2023] [2017-2020] via `TriennatTabs`.
	 * Default tab : Carrière si pas de mandat sur triennat en cours, sinon triennat en cours.
	 * Le filtre fronde/position et la pagination sont alignés sur la fiche AN
	 * pour cohérence UX (cf /deputes/[id]/).
	 */
	import SenateurCard from '$lib/components/SenateurCard.svelte';
	import TriennatTabs from '$lib/components/TriennatTabs.svelte';
	import VoteHistoryItemSenat from '$lib/components/VoteHistoryItemSenat.svelte';
	import { TRIENNATS, isTriennatId, triennatOfDate, type TriennatId } from '$lib/triennats';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import type { GroupeSenat, VotePosition, MandatSenat } from '$lib/types';

	let { data } = $props();

	type Filter = 'tous' | 'pour' | 'contre' | 'abstention' | 'frondes';
	const PAGE_SIZE = 10;
	let filter: Filter = $state('tous');
	let visibleCount = $state(PAGE_SIZE);
	let scrollEl = $state<HTMLDivElement | null>(null);

	/** Default tab : Carrière si pas de mandat sur triennat en cours, sinon triennat en cours. */
	const defaultTriennat = $derived.by((): TriennatId | null => {
		const enCours = TRIENNATS.find((t) => t.enCours)?.id;
		if (enCours && data.senateur.carriere.triennats.includes(enCours)) {
			return enCours as TriennatId;
		}
		return null; // Carrière
	});

	/** Tab actif : null = carrière, sinon TriennatId.
	 *  URL `?triennat=carriere` = vue Carrière explicite (clic utilisateur).
	 *  URL sans param = default (triennat en cours si le sénateur y siège, sinon Carrière). */
	const selectedTriennat = $derived.by((): TriennatId | null => {
		const q = $page.url.searchParams.get('triennat');
		if (q === 'carriere') return null;
		if (!q) return defaultTriennat;
		if (isTriennatId(q) && data.senateur.carriere.triennats.includes(q)) return q;
		return defaultTriennat;
	});

	function selectTab(triennat: TriennatId | null) {
		const url = new URL($page.url);
		if (triennat === null) url.searchParams.set('triennat', 'carriere');
		else url.searchParams.set('triennat', triennat);
		goto(url.toString(), { replaceState: false, keepFocus: true, noScroll: true });
	}

	const groupesByCode = $derived.by(() => {
		const m = new Map<string, GroupeSenat[]>();
		for (const g of data.groupes) {
			const arr = m.get(g.code) ?? [];
			arr.push(g);
			m.set(g.code, arr);
		}
		return m;
	});

	/** Mandat couvrant le triennat sélectionné (sinon : dernier mandat). */
	const mandatActif = $derived.by((): MandatSenat | null => {
		if (selectedTriennat === null) return null;
		for (const m of data.senateur.mandats) {
			if (m.triennats.some((t) => t.triennat === selectedTriennat)) return m;
		}
		return null;
	});

	/** Groupe principal selon la vue (cf ADR 0016 transposée + ADR 0028). */
	const groupePrincipal = $derived.by((): GroupeSenat | null => {
		const target = mandatActif ?? data.senateur.mandats.at(-1);
		const lastApp = target?.appartenancesGroupe.at(-1);
		if (!lastApp) return null;
		const candidats = groupesByCode.get(lastApp.groupeCode);
		if (!candidats || candidats.length === 0) return null;
		if (selectedTriennat !== null) {
			const exact = candidats.find((g) => g.triennat === selectedTriennat);
			if (exact) return exact;
		}
		return [...candidats].sort((a, b) => b.triennat.localeCompare(a.triennat))[0];
	});

	const scrutinByUid = $derived.by(() => {
		const m = new Map<string, (typeof data.scrutinsIndex)[number]>();
		for (const s of data.scrutinsIndex) m.set(s.uid, s);
		return m;
	});

	const enrichedHistory = $derived.by(() => {
		const list: Array<{
			scrutin: (typeof data.scrutinsIndex)[number];
			position: VotePosition;
			isFronde: boolean;
		}> = [];
		for (const [uid, position, isFronde] of data.historique) {
			const scrutin = scrutinByUid.get(uid);
			if (!scrutin) continue;
			if (selectedTriennat !== null) {
				const tri = triennatOfDate(scrutin.date);
				if (tri?.id !== selectedTriennat) continue;
			}
			list.push({ scrutin, position, isFronde: isFronde === 1 });
		}
		list.sort((a, b) => b.scrutin.date.localeCompare(a.scrutin.date));
		return list;
	});

	const filteredHistory = $derived.by(() => {
		if (filter === 'tous') return enrichedHistory;
		if (filter === 'frondes') return enrichedHistory.filter((h) => h.isFronde);
		return enrichedHistory.filter((h) => h.position === filter);
	});

	const visibleHistory = $derived(filteredHistory.slice(0, visibleCount));

	const counts = $derived({
		tous: enrichedHistory.length,
		pour: enrichedHistory.filter((h) => h.position === 'pour').length,
		contre: enrichedHistory.filter((h) => h.position === 'contre').length,
		abstention: enrichedHistory.filter((h) => h.position === 'abstention').length,
		frondes: enrichedHistory.filter((h) => h.isFronde).length
	});

	function setFilter(f: Filter) {
		filter = f;
		visibleCount = PAGE_SIZE;
		scrollEl?.scrollTo({ top: 0 });
	}

	function showMore() {
		visibleCount += PAGE_SIZE;
	}

	$effect(() => {
		void selectedTriennat;
		visibleCount = PAGE_SIZE;
		scrollEl?.scrollTo({ top: 0 });
	});

	const scrutinsEligibles = $derived.by(() => {
		if (selectedTriennat !== null && mandatActif) {
			const tri = mandatActif.triennats.find((t) => t.triennat === selectedTriennat);
			return tri?.scrutinsEligibles ?? 0;
		}
		return data.senateur.carriere.presence.denominator;
	});

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('fr-FR', {
			day: '2-digit',
			month: 'short',
			year: 'numeric'
		});
	}

	/** Timeline des appartenances de groupe par mandat. */
	const appartenancesTimeline = $derived.by(() => {
		const mandats = mandatActif ? [mandatActif] : data.senateur.mandats;
		return mandats.map((m) => ({
			eluId: m.eluId,
			datePriseFonction: m.datePriseFonction,
			dateFinFonction: m.dateFinFonction,
			circonscription: m.circonscription,
			motifDebut: m.motifDebut,
			motifFin: m.motifFin,
			appartenances: m.appartenancesGroupe.map((a) => {
				const candidats = groupesByCode.get(a.groupeCode);
				const grp = candidats
					? [...candidats].sort((x, y) => y.triennat.localeCompare(x.triennat))[0]
					: null;
				return { ...a, groupe: grp };
			})
		}));
	});

	const showTimeline = $derived(
		mandatActif ? mandatActif.appartenancesGroupe.length > 1 : data.senateur.mandats.length >= 1
	);
</script>

<svelte:head>
	<title>{data.senateur.identite.prenom} {data.senateur.identite.nom} — Sénat — PolitiDex</title>
</svelte:head>

<section class="max-w-7xl mx-auto px-6 py-8">
	<a
		href="/senat/senateurs/"
		class="text-sm text-assembly-muted hover:text-assembly-accent inline-flex items-center gap-1 mb-4"
	>
		← Tous les sénateurs
	</a>

	<div class="mb-6">
		<TriennatTabs senateur={data.senateur} selected={selectedTriennat} onSelect={selectTab} />
	</div>

	<div class="depute-layout">
		<div class="depute-card-col">
			<SenateurCard
				senateur={data.senateur}
				groupe={groupePrincipal}
				triennat={selectedTriennat}
			/>

			{#if showTimeline}
				<div class="card p-4 mt-3 text-xs">
					<div class="text-[10px] uppercase tracking-widest text-assembly-muted mb-3">
						{#if mandatActif}
							Appartenances de groupe — Triennat {selectedTriennat}
						{:else}
							Carrière sénatoriale
						{/if}
					</div>
					<div class="space-y-3">
						{#each appartenancesTimeline as m (m.eluId)}
							<div>
								{#if !mandatActif}
									<div
										class="flex items-baseline justify-between gap-2 mb-1.5 pb-1 border-b border-assembly-border/40"
									>
										<div class="font-semibold">
											Mandat
											{#if m.motifDebut}
												<span class="text-[10px] text-assembly-muted font-normal">
													· {m.motifDebut}
												</span>
											{/if}
										</div>
										<span class="text-[10px] text-assembly-muted whitespace-nowrap">
											{formatDate(m.datePriseFonction)} →
											{m.dateFinFonction ? formatDate(m.dateFinFonction) : 'en cours'}
										</span>
									</div>
									{#if m.circonscription}
										<div class="text-[10px] text-assembly-muted mb-1">{m.circonscription}</div>
									{/if}
								{/if}
								<div class="space-y-1.5">
									{#each m.appartenances as a (a.groupeCode + a.dateDebut)}
										<div class="flex items-center justify-between gap-2">
											<div class="flex items-center gap-1.5 min-w-0">
												{#if a.groupe}
													<span
														class="w-2 h-2 rounded-full flex-shrink-0"
														style="background-color: {a.groupe.couleur}"
													></span>
													<span class="font-medium truncate">{a.groupe.libelleAbrege}</span>
												{:else}
													<span class="text-assembly-muted italic">{a.groupeCode}</span>
												{/if}
												{#if a.fonction && a.fonction !== 'Membre'}
													<span class="text-[10px] text-assembly-muted">· {a.fonction}</span>
												{/if}
											</div>
											<span class="text-[10px] text-assembly-muted whitespace-nowrap">
												{a.dateDebut ? formatDate(a.dateDebut) : '?'} →
												{a.dateFin ? formatDate(a.dateFin) : 'en cours'}
											</span>
										</div>
									{/each}
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>

		<div class="depute-history-col">
			<div class="card p-4 sm:p-6">
				<div class="flex items-center justify-between gap-3 mb-4">
					<h2 class="title-display text-xl">
						Historique de vote
						{#if selectedTriennat !== null}
							<span class="text-sm text-assembly-muted">
								— triennat {selectedTriennat}
							</span>
						{:else}
							<span class="text-sm text-assembly-muted">— toute la carrière</span>
						{/if}
					</h2>
					<div class="text-xs text-assembly-muted">
						{enrichedHistory.length} votes exprimés sur {scrutinsEligibles} scrutins
					</div>
				</div>

				<div class="flex flex-wrap gap-1 mb-4">
					{#each [['tous', 'Tous'], ['pour', 'Pour'], ['contre', 'Contre'], ['abstention', 'Abst.'], ['frondes', '🔥 Frondes']] as [key, label] (key)}
						<button
							class="btn px-3 py-1 text-xs {filter === key
								? 'bg-assembly-accent text-assembly-bg'
								: 'border border-assembly-border text-assembly-muted hover:text-assembly-text'}"
							onclick={() => setFilter(key as Filter)}
						>
							{label}
							<span class="opacity-60 ml-1">({counts[key as Filter]})</span>
						</button>
					{/each}
				</div>

				{#if visibleHistory.length === 0}
					<div class="text-sm text-assembly-muted italic py-8 text-center">
						Aucun vote dans cette catégorie.
					</div>
				{:else}
					<div
						bind:this={scrollEl}
						class="vote-scroll overflow-y-auto pr-1 -mr-1 border-y border-assembly-border/40"
					>
						<div class="space-y-1.5 py-1.5">
							{#each visibleHistory as h (h.scrutin.uid)}
								<VoteHistoryItemSenat
									scrutin={h.scrutin}
									position={h.position}
									isFronde={h.isFronde}
								/>
							{/each}
						</div>

						{#if visibleCount < filteredHistory.length}
							<div class="py-3 text-center">
								<button class="btn-ghost text-sm" onclick={showMore}>
									Charger {Math.min(PAGE_SIZE, filteredHistory.length - visibleCount)} de plus
									({filteredHistory.length - visibleCount} restants)
								</button>
							</div>
						{/if}
					</div>

					<div class="mt-2 text-[10px] text-assembly-muted text-right tabular-nums">
						{Math.min(visibleCount, filteredHistory.length)} / {filteredHistory.length} affichés
					</div>
				{/if}
			</div>
		</div>
	</div>
</section>
