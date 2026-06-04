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
	import TimelineCarriere from '$lib/components/TimelineCarriere.svelte';
	import { findScrutinFinalUidForTexte } from '$lib/vote-final';

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
	/** Mode d'affichage de l'historique AN : liste plate (chronologique) ou
	 *  groupé par texte législatif (cf ADR 0035). Le Sénat reste en liste plate
	 *  car l'agrégation par texte n'est pas implémentée côté Sénat.
	 *  Défaut "Par texte" : la posture éditoriale privilégie les textes
	 *  législatifs (lois) plutôt que la mécanique des scrutins. */
	let groupByTexte = $state(true);
	let expandedTexte = $state<string | null>(null);

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

	// ──────────────────────────────────────────────────────────────────
	// Vue "Par texte" (AN uniquement, cf ADR 0035)
	// ──────────────────────────────────────────────────────────────────

	const texteById = $derived.by(() => {
		const m = new Map<string, (typeof data.textesAN)[number]>();
		for (const t of data.textesAN) m.set(t.id, t);
		return m;
	});

	/** Index des HistoryItem AN par scrutin uid, calculé sur la portée complète
	 *  (scopedHistory, pas filteredHistory) pour que le vote final reste affichable
	 *  même quand le filtre exclut sa position (ex: filtre "frondes" et vote final
	 *  conforme à la majorité). */
	const anHistoryByUid = $derived.by(() => {
		const m = new Map<string, HistoryItem>();
		for (const h of scopedHistory) {
			if (h.chambre === 'AN') m.set(h.scrutin.uid, h);
		}
		return m;
	});

	/** Groupe les items AN de filteredHistory par texteId.
	 *  Le Sénat (pas de texte) et les scrutins AN sans texteId sont placés
	 *  dans un bucket spécial "_sans_texte".
	 *  Pour chaque texte enrichi, on identifie le "vote final" — celui qui
	 *  scelle l'adoption ou le rejet du texte (cf $lib/vote-final.ts). */
	const groupedByTexte = $derived.by(() => {
		interface GroupeTexte {
			texteId: string | null;
			titre: string;
			legislature: number;
			items: HistoryItem[];
			pour: number;
			contre: number;
			abstention: number;
			frondes: number;
			dateMin: string;
			dateMax: string;
			/** Vote AN qui acte le sort du texte (lecture définitive, CMP, etc.).
			 *  null = pas de timeline navette OU élu n'a pas voté ce scrutin
			 *  (absent, ou vote à main levée). */
			voteFinal: HistoryItem | null;
			/** Sort officiel du texte (adopté / rejeté / etc.) si connu via le
			 *  scrutin final, sinon null. */
			sortFinal: string | null;
			/** ScrutinIndex du vote final (existe même quand l'élu n'a pas voté). */
			scrutinFinal: (typeof data.scrutinsIndexAN)[number] | null;
		}
		const map = new Map<string, GroupeTexte>();
		for (const h of filteredHistory) {
			const texteId = h.chambre === 'AN' ? h.scrutin.texteId ?? null : null;
			const key = texteId ?? `_sans_${h.chambre}`;
			let g = map.get(key);
			if (!g) {
				const texte = texteId ? texteById.get(texteId) : null;
				const titre = texte
					? texte.titre
					: h.chambre === 'SENAT'
						? 'Scrutins Sénat'
						: 'Hors texte législatif (motions, procédure…)';
				let voteFinal: HistoryItem | null = null;
				let sortFinal: string | null = null;
				let scrutinFinal: (typeof data.scrutinsIndexAN)[number] | null = null;
				if (texte) {
					// Résout les ScrutinIndex du texte pour le fallback titre-based
					const scrutinsDuTexte = texte.scrutins
						.map((uid) => scrutinByUidAN.get(uid))
						.filter((s): s is (typeof data.scrutinsIndexAN)[number] => !!s);
					const finalUid = findScrutinFinalUidForTexte(texte.timelineNavette, scrutinsDuTexte);
					if (finalUid) {
						voteFinal = anHistoryByUid.get(finalUid) ?? null;
						scrutinFinal = scrutinByUidAN.get(finalUid) ?? null;
						sortFinal = scrutinFinal?.sort ?? null;
					}
				}
				g = {
					texteId,
					titre,
					legislature: h.chambre === 'AN' ? h.legislature : 0,
					items: [],
					pour: 0,
					contre: 0,
					abstention: 0,
					frondes: 0,
					dateMin: h.date,
					dateMax: h.date,
					voteFinal,
					sortFinal,
					scrutinFinal
				};
				map.set(key, g);
			}
			g.items.push(h);
			if (h.position === 'pour') g.pour++;
			else if (h.position === 'contre') g.contre++;
			else if (h.position === 'abstention') g.abstention++;
			if (h.isFronde) g.frondes++;
			if (h.date < g.dateMin) g.dateMin = h.date;
			if (h.date > g.dateMax) g.dateMax = h.date;
		}
		// Tri : par date de fin descendante (textes les plus récents en haut)
		return [...map.values()].sort((a, b) => b.dateMax.localeCompare(a.dateMax));
	});

	function toggleExpandedTexte(key: string) {
		expandedTexte = expandedTexte === key ? null : key;
	}

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
		groupByTexte = true;
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
				<TimelineCarriere
					mode={{ kind: 'carriere' }}
					{personne}
					{senateur}
					{groupesByIdAN}
					{groupesByCodeSenat}
				/>
			{:else if selected.kind === 'an' && personne && mandatActifAN}
				<DeputeCard {personne} groupe={groupePrincipalAN} mandat={mandatActifAN} />
				{#if mandatActifAN.appartenancesGroupe.length > 1}
					<TimelineCarriere
						mode={{ kind: 'an-mandat', mandat: mandatActifAN }}
						{personne}
						senateur={null}
						{groupesByIdAN}
						{groupesByCodeSenat}
					/>
				{/if}
			{:else if selected.kind === 'senat' && senateur}
				<SenateurCard
					{senateur}
					groupe={groupePrincipalSenat}
					triennat={selected.triennat}
				/>
				{#if mandatActifSenat && mandatActifSenat.appartenancesGroupe.length > 1}
					<TimelineCarriere
						mode={{ kind: 'senat-mandat', mandat: mandatActifSenat, triennat: selected.triennat }}
						personne={null}
						{senateur}
						{groupesByIdAN}
						{groupesByCodeSenat}
					/>
				{/if}
			{:else}
				<div class="card p-6 text-sm text-fg-muted italic">
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
							<span class="text-sm text-fg-muted">— toute la carrière (AN + Sénat)</span>
						{:else if selected.kind === 'an'}
							<span class="text-sm text-fg-muted">— {selected.legislature}<sup>e</sup> AN</span>
						{:else}
							<span class="text-sm text-fg-muted">— Sénat {selected.triennat}</span>
						{/if}
					</h2>
					<div class="text-xs text-fg-muted">
						{scopedHistory.length} votes exprimés
					</div>
				</div>

				<div class="flex flex-wrap gap-1 mb-3">
					{#each [['tous', 'Tous'], ['pour', 'Pour'], ['contre', 'Contre'], ['abstention', 'Abst.'], ['frondes', '🔥 Frondes']] as [key, label] (key)}
						<button
							class="btn px-3 py-1 text-xs {filter === key
								? 'bg-accent text-accent-fg'
								: 'border border-border-soft text-fg-muted hover:text-fg'}"
							onclick={() => setFilter(key as Filter)}
						>
							{label}
							<span class="opacity-60 ml-1">({counts[key as Filter]})</span>
						</button>
					{/each}
				</div>

				<div class="flex items-center gap-2 mb-4 text-xs">
					<span class="text-fg-muted">Affichage :</span>
					<button
						class="px-2 py-0.5 rounded {groupByTexte
							? 'bg-accent text-accent-fg'
							: 'text-fg-muted hover:text-fg'}"
						onclick={() => (groupByTexte = true)}
						title="Regroupe les scrutins par texte législatif (cf ADR 0035)"
					>
						Par texte
					</button>
					<button
						class="px-2 py-0.5 rounded {!groupByTexte
							? 'bg-accent text-accent-fg'
							: 'text-fg-muted hover:text-fg'}"
						onclick={() => (groupByTexte = false)}
					>
						Par scrutin
					</button>
				</div>

				{#if filteredHistory.length === 0}
					<div class="text-sm text-fg-muted italic py-8 text-center">
						Aucun vote dans cette catégorie.
					</div>
				{:else if groupByTexte}
					<div
						bind:this={scrollEl}
						class="vote-scroll overflow-y-auto pr-1 -mr-1 border-y border-border-soft/40"
					>
						<div class="space-y-2 py-1.5">
							{#each groupedByTexte as g (g.texteId ?? g.titre)}
								{@const expandKey = g.texteId ?? `_${g.titre}`}
								{@const isExpanded = expandedTexte === expandKey}
								{@const hasTextePage = g.texteId !== null}
								<div class="border border-border-soft/60 rounded-md overflow-hidden relative">
									<button
										class="w-full px-3 py-2 text-left hover:bg-border-soft/20 flex items-center gap-3 text-sm {hasTextePage
											? 'pr-24'
											: ''}"
										onclick={() => toggleExpandedTexte(expandKey)}
									>
										<span class="text-fg-muted text-xs w-4 text-center">
											{isExpanded ? '▼' : '▶'}
										</span>
										<div class="min-w-0 flex-1">
											<div class="font-medium leading-snug">{g.titre}</div>
											<div class="text-[11px] text-fg-muted mt-0.5">
												{g.items.length} vote{g.items.length > 1 ? 's' : ''} ·
												<span class="text-vote-pour">{g.pour} pour</span> ·
												<span class="text-vote-contre">{g.contre} contre</span>
												{#if g.abstention > 0}
													· <span>{g.abstention} abst.</span>
												{/if}
												{#if g.frondes > 0}
													· <span class="text-amber-400"
														>🔥 {g.frondes} fronde{g.frondes > 1 ? 's' : ''}</span
													>
												{/if}
											</div>
										</div>
									</button>
									{#if hasTextePage}
										<a
											href="/textes/{encodeURIComponent(g.texteId!)}"
											class="absolute top-2 right-3 text-[10px] uppercase tracking-wider text-fg-muted hover:text-link"
										>
											Voir texte →
										</a>
									{/if}
									{#if g.scrutinFinal}
										{@const vf = g.voteFinal && g.voteFinal.chambre === 'AN' ? g.voteFinal : null}
										{@const vfPosition = vf ? vf.position : 'absent'}
										{@const vfIsFronde = vf?.isFronde ?? false}
										{@const vfStyle = vfPosition === 'pour'
											? 'bg-vote-pour/15 text-vote-pour border-vote-pour/40'
											: vfPosition === 'contre'
												? 'bg-vote-contre/15 text-vote-contre border-vote-contre/40'
												: vfPosition === 'abstention'
													? 'bg-vote-abstention/15 text-vote-abstention border-vote-abstention/40'
													: 'bg-surface-2 text-fg border-border-soft'}
										{@const vfLabel = vfPosition === 'pour'
											? 'POUR'
											: vfPosition === 'contre'
												? 'CONTRE'
												: vfPosition === 'abstention'
													? 'ABST.'
													: vfPosition === 'nonVotant'
														? 'N.V.'
														: 'ABSENT'}
										<a
											href="/assemblee/scrutins/{g.scrutinFinal.uid}/"
											class="block px-3 py-2 border-t border-border-soft/40 bg-border-soft/10 hover:bg-border-soft/20 transition-colors"
											title="Le scrutin qui scelle le sort du texte (lecture définitive, CMP, ou vote sur l'ensemble)"
										>
											<div class="flex items-center gap-2 text-[11px]">
												<span class="uppercase tracking-wider text-fg-muted font-semibold flex-shrink-0">
													Vote final
												</span>
												{#if g.sortFinal}
													<span
														class="text-[10px] uppercase {g.sortFinal === 'adopté'
															? 'text-vote-pour'
															: g.sortFinal === 'rejeté'
																? 'text-vote-contre'
																: 'text-fg-muted'}"
													>
														· {g.sortFinal}
													</span>
												{/if}
												<span class="flex-1 min-w-0 truncate text-fg-muted">
													n°{g.scrutinFinal.numero}
												</span>
												{#if vfIsFronde}
													<span
														class="text-[10px] uppercase font-bold px-1.5 py-0.5 bg-rose-400 text-[#0a0a0a] border-2 border-border"
													>
														🔥 FRONDE
													</span>
												{/if}
												<span
													class="text-[10px] font-bold px-2 py-0.5 rounded border {vfStyle} tabular-nums"
												>
													{vfLabel}
												</span>
											</div>
										</a>
									{/if}
									{#if isExpanded}
										<div class="px-3 pb-2 space-y-1.5 border-t border-border-soft/40 bg-border-soft/5">
											{#each g.items as h (h.chambre + ':' + h.scrutin.uid)}
												<div class="pt-1.5">
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
												</div>
											{/each}
										</div>
									{/if}
								</div>
							{/each}
						</div>
					</div>

					<div class="mt-2 text-[10px] text-fg-muted text-right tabular-nums">
						{groupedByTexte.length} texte{groupedByTexte.length > 1 ? 's' : ''} · {filteredHistory.length}
						vote{filteredHistory.length > 1 ? 's' : ''}
					</div>
				{:else}
					<div
						bind:this={scrollEl}
						class="vote-scroll overflow-y-auto pr-1 -mr-1 border-y border-border-soft/40"
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

					<div class="mt-2 text-[10px] text-fg-muted text-right tabular-nums">
						{Math.min(visibleCount, filteredHistory.length)} / {filteredHistory.length} affichés
					</div>
				{/if}
			</div>
		</div>
	</div>
</section>

