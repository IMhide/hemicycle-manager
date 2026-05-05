<script lang="ts">
	import DeputeCard from '$lib/components/DeputeCard.svelte';
	import MandatTabs from '$lib/components/MandatTabs.svelte';
	import VoteHistoryItem from '$lib/components/VoteHistoryItem.svelte';
	import type { VotePosition, Mandat, Groupe, AppartenanceGroupe } from '$lib/types';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	let { data } = $props();

	type Filter = 'tous' | 'pour' | 'contre' | 'abstention' | 'frondes';
	let filter: Filter = $state('tous');
	let visibleCount = $state(50);

	/** Tab actif : null = carrière, sinon numéro de législature */
	const selectedLeg = $derived.by(() => {
		const q = $page.url.searchParams.get('leg');
		if (!q) return null;
		const n = parseInt(q, 10);
		return Number.isFinite(n) && data.personne.mandats.some((m) => m.legislature === n) ? n : null;
	});

	function selectTab(leg: number | null) {
		const url = new URL($page.url);
		if (leg === null) url.searchParams.delete('leg');
		else url.searchParams.set('leg', String(leg));
		goto(url.toString(), { replaceState: false, keepFocus: true, noScroll: true });
	}

	const mandatActif = $derived(
		selectedLeg !== null
			? data.personne.mandats.find((m) => m.legislature === selectedLeg) ?? null
			: null
	);

	const groupesById = $derived.by(() => {
		const m = new Map<string, Groupe>();
		for (const g of data.groupes) m.set(g.id, g);
		return m;
	});

	/** Groupe principal selon la vue (cf ADR 0016 : plus récent non-NI). */
	const groupePrincipal = $derived.by((): Groupe | null => {
		const mandats = mandatActif ? [mandatActif] : data.personne.mandats;
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
			legislature: number;
		}> = [];
		for (const [uid, position, isFronde, legislature] of data.historique) {
			if (selectedLeg !== null && legislature !== selectedLeg) continue;
			const scrutin = scrutinByUid.get(uid);
			if (!scrutin) continue;
			list.push({ scrutin, position, isFronde: isFronde === 1, legislature });
		}
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
		visibleCount = 50;
	}

	function showMore() {
		visibleCount += 100;
	}

	$effect(() => {
		void selectedLeg;
		visibleCount = 50;
	});

	/** Timeline des appartenances de groupe pour le mandat actif (cf ADR 0016). */
	const appartenancesTimeline = $derived.by(() => {
		if (!mandatActif) return [];
		return mandatActif.appartenancesGroupe.map((a) => ({
			...a,
			groupe: groupesById.get(a.groupeId) ?? null
		}));
	});

	const scrutinsEligibles = $derived(
		mandatActif ? mandatActif.stats.presence.denominator : data.personne.carriere.presence.denominator
	);

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
	}
</script>

<svelte:head>
	<title>{data.personne.identite.prenom} {data.personne.identite.nom} — PolitiDex</title>
</svelte:head>

<section class="max-w-7xl mx-auto px-6 py-8">
	<a
		href="/"
		class="text-sm text-assembly-muted hover:text-assembly-accent inline-flex items-center gap-1 mb-4"
	>
		← Accueil
	</a>

	<!-- Sélecteur de législature en haut de la fiche (cf décision UI utilisateur) -->
	<div class="mb-6">
		<MandatTabs mandats={data.personne.mandats} selected={selectedLeg} onSelect={selectTab} />
	</div>

	<div class="depute-layout">
		<div class="depute-card-col">
			<DeputeCard personne={data.personne} groupe={groupePrincipal} mandat={mandatActif} />

			{#if appartenancesTimeline.length > 1}
				<div class="card p-4 mt-3 text-xs">
					<div class="text-[10px] uppercase tracking-widest text-assembly-muted mb-2">
						Appartenances de groupe — {mandatActif?.legislature}<sup>e</sup>
					</div>
					<div class="space-y-1.5">
						{#each appartenancesTimeline as a (a.groupeId + a.dateDebut)}
							<div class="flex items-center justify-between gap-2">
								<div class="flex items-center gap-1.5 min-w-0">
									{#if a.groupe}
										<span
											class="w-2 h-2 rounded-full flex-shrink-0"
											style="background-color: {a.groupe.couleur}"
										></span>
										<span class="font-medium truncate">{a.groupe.libelleAbrege}</span>
									{:else}
										<span class="text-assembly-muted italic">Groupe inconnu</span>
									{/if}
									<span class="text-[10px] text-assembly-muted">· {a.qualite}</span>
								</div>
								<span class="text-[10px] text-assembly-muted whitespace-nowrap">
									{formatDate(a.dateDebut)} → {a.dateFin ? formatDate(a.dateFin) : 'en cours'}
								</span>
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
						{#if mandatActif}
							<span class="text-sm text-assembly-muted">— {mandatActif.legislature}<sup>e</sup> législature</span>
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
					<div class="space-y-1.5">
						{#each visibleHistory as h (h.scrutin.uid)}
							<VoteHistoryItem scrutin={h.scrutin} position={h.position} isFronde={h.isFronde} />
						{/each}
					</div>

					{#if visibleCount < filteredHistory.length}
						<div class="mt-4 text-center">
							<button class="btn-ghost text-sm" onclick={showMore}>
								Charger 100 de plus ({filteredHistory.length - visibleCount} restants)
							</button>
						</div>
					{/if}
				{/if}
			</div>
		</div>
	</div>
</section>
