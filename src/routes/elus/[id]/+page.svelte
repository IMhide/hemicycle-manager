<script lang="ts">
	/**
	 * Fiche détail d'un Élu — seule fiche détail d'une personne (cf ADR 0030, 0031, 0032).
	 *
	 * Selon `?tab=...` :
	 *   - `carriere` (défaut) : EluCard cross-chambre + historique mergé chrono desc
	 *     + appartenances groupes mergées chrono asc
	 *   - `an-{leg}` : DeputeCard du mandat AN + historique scope leg + appartenances mandat
	 *   - `senat-{periode}` : SenateurCard du triennat + historique scope triennat
	 *
	 * Bouton « ← Retour » générique en haut (cf ADR 0030 §"Bouton retour générique").
	 *
	 * La logique des vues mandat AN / Sénat reproduit fonctionnellement les anciennes
	 * fiches `/assemblee/deputes/[id]` et `/senat/senateurs/[matricule]` (qui seront
	 * supprimées en PR #F).
	 */
	import type { Mandat, Groupe, GroupeSenat, MandatSenat, VotePosition } from '$lib/types';
	import type { TriennatId } from '$lib/triennats';
	import { isTriennatId } from '$lib/triennats';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	import EluCard from '$lib/components/EluCard.svelte';
	import DeputeCard from '$lib/components/DeputeCard.svelte';
	import SenateurCard from '$lib/components/SenateurCard.svelte';
	import MandatSelecteur from '$lib/components/MandatSelecteur.svelte';
	import type { SelectedTab } from '$lib/components/MandatSelecteur.svelte';
	import RetourButton from '$lib/components/RetourButton.svelte';
	import VoteHistoryItem from '$lib/components/VoteHistoryItem.svelte';
	import VoteHistoryItemSenat from '$lib/components/VoteHistoryItemSenat.svelte';

	let { data } = $props();

	const elu = $derived(data.elu);
	const personne = $derived(data.personne);
	const senateur = $derived(data.senateur);

	// ──────────────────────────────────────────────────────────────────
	// Tab actif (lu depuis ?tab=...)
	// ──────────────────────────────────────────────────────────────────

	function parseTab(s: string | null): SelectedTab {
		if (!s || s === 'carriere') return { kind: 'carriere' };
		if (s.startsWith('an-')) {
			const n = parseInt(s.slice(3), 10);
			if (Number.isFinite(n) && elu.mandats.some((m) => m.chambre === 'AN' && m.legislature === n)) {
				return { kind: 'an', legislature: n };
			}
		}
		if (s.startsWith('senat-')) {
			const t = s.slice(6);
			if (
				isTriennatId(t) &&
				elu.mandats.some((m) => m.chambre === 'SENAT' && m.triennat === t)
			) {
				return { kind: 'senat', triennat: t };
			}
		}
		return { kind: 'carriere' };
	}

	const selected = $derived<SelectedTab>(parseTab($page.url.searchParams.get('tab')));

	function selectTab(tab: SelectedTab) {
		const url = new URL($page.url);
		const v =
			tab.kind === 'carriere'
				? 'carriere'
				: tab.kind === 'an'
					? `an-${tab.legislature}`
					: `senat-${tab.triennat}`;
		url.searchParams.set('tab', v);
		goto(url.toString(), { replaceState: false, keepFocus: true, noScroll: true });
	}

	// ──────────────────────────────────────────────────────────────────
	// Données dérivées par vue
	// ──────────────────────────────────────────────────────────────────

	const groupesByIdAN = $derived.by(() => {
		const m = new Map<string, Groupe>();
		for (const g of data.groupesAN) m.set(g.id, g);
		return m;
	});

	const groupesByCodeSenat = $derived.by(() => {
		const m = new Map<string, GroupeSenat[]>();
		for (const g of data.groupesSenat) {
			const arr = m.get(g.code) ?? [];
			arr.push(g);
			m.set(g.code, arr);
		}
		return m;
	});

	const mandatActifAN = $derived.by((): Mandat | null => {
		if (selected.kind !== 'an' || !personne) return null;
		return personne.mandats.find((m) => m.legislature === selected.legislature) ?? null;
	});

	const mandatActifSenat = $derived.by((): MandatSenat | null => {
		if (selected.kind !== 'senat' || !senateur) return null;
		const t = selected.triennat;
		return senateur.mandats.find((m) => m.triennats.some((tr) => tr.triennat === t)) ?? null;
	});

	/** Groupe principal du mandat AN actif (cf ADR 0016 : plus récent non-NI). */
	const groupePrincipalAN = $derived.by((): Groupe | null => {
		if (!mandatActifAN) return null;
		for (let j = mandatActifAN.appartenancesGroupe.length - 1; j >= 0; j--) {
			const a = mandatActifAN.appartenancesGroupe[j];
			if (a.isTransitoireNI) continue;
			const g = groupesByIdAN.get(a.groupeId);
			if (g) return g;
		}
		return null;
	});

	/** Groupe principal du mandat Sénat actif. */
	const groupePrincipalSenat = $derived.by((): GroupeSenat | null => {
		if (!mandatActifSenat) return null;
		const lastApp = mandatActifSenat.appartenancesGroupe.at(-1);
		if (!lastApp) return null;
		const candidats = groupesByCodeSenat.get(lastApp.groupeCode);
		if (!candidats || candidats.length === 0) return null;
		const triennat =
			selected.kind === 'senat' ? selected.triennat : mandatActifSenat.triennats.at(-1)?.triennat;
		if (triennat) {
			const exact = candidats.find((g) => g.triennat === triennat);
			if (exact) return exact;
		}
		return candidats[0];
	});

	// ──────────────────────────────────────────────────────────────────
	// Historique de vote — vue Carrière (mergé chrono desc) ou scope mandat
	// ──────────────────────────────────────────────────────────────────

	type HistoryItem =
		| {
				chambre: 'AN';
				scrutin: NonNullable<typeof data.scrutinsIndexAN>[number];
				position: VotePosition;
				isFronde: boolean;
				date: string;
				legislature: number;
		  }
		| {
				chambre: 'SENAT';
				scrutin: NonNullable<typeof data.scrutinsIndexSenat>[number];
				position: VotePosition;
				isFronde: boolean;
				date: string;
				sesann: number;
		  };

	const scrutinByUidAN = $derived.by(() => {
		const m = new Map<string, (typeof data.scrutinsIndexAN)[number]>();
		for (const s of data.scrutinsIndexAN) m.set(s.uid, s);
		return m;
	});
	const scrutinByUidSenat = $derived.by(() => {
		const m = new Map<string, (typeof data.scrutinsIndexSenat)[number]>();
		for (const s of data.scrutinsIndexSenat) m.set(s.uid, s);
		return m;
	});

	const historyMerged = $derived.by((): HistoryItem[] => {
		const list: HistoryItem[] = [];
		for (const [uid, position, isFronde, legislature] of data.historiqueAN) {
			const sc = scrutinByUidAN.get(uid);
			if (!sc) continue;
			list.push({
				chambre: 'AN',
				scrutin: sc,
				position,
				isFronde: isFronde === 1,
				date: sc.date,
				legislature
			});
		}
		for (const [uid, position, isFronde, sesann] of data.historiqueSenat) {
			const sc = scrutinByUidSenat.get(uid);
			if (!sc) continue;
			list.push({
				chambre: 'SENAT',
				scrutin: sc,
				position,
				isFronde: isFronde === 1,
				date: sc.date,
				sesann
			});
		}
		list.sort((a, b) => b.date.localeCompare(a.date));
		return list;
	});

	const historyByLegAN = $derived.by(() => {
		const m = new Map<number, HistoryItem[]>();
		for (const h of historyMerged) {
			if (h.chambre !== 'AN') continue;
			const arr = m.get(h.legislature) ?? [];
			arr.push(h);
			m.set(h.legislature, arr);
		}
		return m;
	});

	// ──────────────────────────────────────────────────────────────────
	// Vue mandat — historique filtré
	// ──────────────────────────────────────────────────────────────────

	type Filter = 'tous' | 'pour' | 'contre' | 'abstention' | 'frondes';
	const PAGE_SIZE = 10;
	let filter = $state<Filter>('tous');
	let visibleCount = $state(PAGE_SIZE);
	let scrollEl = $state<HTMLDivElement | null>(null);

	const scopedHistory = $derived.by((): HistoryItem[] => {
		if (selected.kind === 'carriere') return historyMerged;
		if (selected.kind === 'an') {
			return (historyByLegAN.get(selected.legislature) ?? []).slice();
		}
		// senat-{triennat} : on filtre via triennatOfSesann à l'import-side.
		return historyMerged.filter(
			(h) => h.chambre === 'SENAT' && belongsToTriennat(h.sesann, selected.triennat)
		);
	});

	const filteredHistory = $derived.by(() => {
		if (filter === 'tous') return scopedHistory;
		if (filter === 'frondes') return scopedHistory.filter((h) => h.isFronde);
		return scopedHistory.filter((h) => h.position === filter);
	});

	const visibleHistory = $derived(filteredHistory.slice(0, visibleCount));

	const counts = $derived({
		tous: scopedHistory.length,
		pour: scopedHistory.filter((h) => h.position === 'pour').length,
		contre: scopedHistory.filter((h) => h.position === 'contre').length,
		abstention: scopedHistory.filter((h) => h.position === 'abstention').length,
		frondes: scopedHistory.filter((h) => h.isFronde).length
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
		// Reset au changement de tab
		void selected;
		filter = 'tous';
		visibleCount = PAGE_SIZE;
		scrollEl?.scrollTo({ top: 0 });
	});

	// Helper : la sesann appartient-elle au triennat ? (table figée des triennats)
	function belongsToTriennat(sesann: number, triennat: TriennatId): boolean {
		const map: Record<TriennatId, number[]> = {
			'2017-2020': [2017, 2018, 2019],
			'2020-2023': [2020, 2021, 2022],
			'2023-2026': [2023, 2024, 2025]
		};
		return map[triennat].includes(sesann);
	}

</script>

<svelte:head>
	<title>{elu.prenom} {elu.nom} — PolitiDex</title>
</svelte:head>

<section class="max-w-7xl mx-auto px-6 py-6">
	<div class="mb-4">
		<RetourButton />
	</div>

	<!-- Sélecteur de mandat unique : Carrière + AN-{leg}* + Sénat-{triennat}* -->
	<div class="mb-6">
		<MandatSelecteur mandats={elu.mandats} {selected} onSelect={selectTab} />
	</div>

	<div class="depute-layout">
		<div class="depute-card-col">
			{#if selected.kind === 'carriere'}
				<EluCard {elu} />
			{:else if selected.kind === 'an' && personne && mandatActifAN}
				<DeputeCard {personne} groupe={groupePrincipalAN} mandat={mandatActifAN} />
			{:else if selected.kind === 'senat' && senateur}
				<SenateurCard
					{senateur}
					groupe={groupePrincipalSenat}
					triennat={selected.triennat}
				/>
			{:else}
				<div class="card p-6 text-sm text-assembly-muted italic">
					Données indisponibles pour cette vue.
				</div>
			{/if}
		</div>

		<div class="depute-history-col">
			<div class="card p-4 sm:p-6">
				<div class="flex items-center justify-between gap-3 mb-4">
					<h2 class="title-display text-xl">
						Historique de vote
						{#if selected.kind === 'carriere'}
							<span class="text-sm text-assembly-muted">— toute la carrière (AN + Sénat)</span>
						{:else if selected.kind === 'an'}
							<span class="text-sm text-assembly-muted">— {selected.legislature}<sup>e</sup> AN</span>
						{:else}
							<span class="text-sm text-assembly-muted">— Sénat {selected.triennat}</span>
						{/if}
					</h2>
					<div class="text-xs text-assembly-muted">
						{scopedHistory.length} votes exprimés
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
							{#each visibleHistory as h (h.chambre + ':' + h.scrutin.uid)}
								{#if h.chambre === 'AN'}
									<VoteHistoryItem
										scrutin={h.scrutin}
										position={h.position}
										isFronde={h.isFronde}
									/>
								{:else}
									<VoteHistoryItemSenat
										scrutin={h.scrutin}
										position={h.position}
										isFronde={h.isFronde}
									/>
								{/if}
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

