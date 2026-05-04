<script lang="ts">
	import DeputeCard from '$lib/components/DeputeCard.svelte';
	import VoteHistoryItem from '$lib/components/VoteHistoryItem.svelte';
	import type { VotePosition } from '$lib/types';

	let { data } = $props();

	type Filter = 'tous' | 'pour' | 'contre' | 'abstention' | 'frondes';
	let filter: Filter = $state('tous');
	let visibleCount = $state(50);

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
			list.push({ scrutin, position, isFronde: isFronde === 1 });
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
</script>

<svelte:head>
	<title>{data.depute.prenom} {data.depute.nom} — Hémicycle Manager</title>
</svelte:head>

<section class="max-w-7xl mx-auto px-6 py-8">
	<a
		href="/"
		class="text-sm text-assembly-muted hover:text-assembly-accent inline-flex items-center gap-1 mb-4"
	>
		← Accueil
	</a>

	<div class="depute-layout">
		<!-- FIFA card (sticky on desktop) -->
		<div class="depute-card-col">
			<DeputeCard depute={data.depute} groupe={data.groupe} stats={data.stat} />
		</div>
		<!-- Vote history -->
		<div class="depute-history-col">
			<div class="card p-4 sm:p-6">
				<div class="flex items-center justify-between gap-3 mb-4">
					<h2 class="title-display text-xl">Historique de vote</h2>
					<div class="text-xs text-assembly-muted">
						{enrichedHistory.length} votes exprimés sur {data.stat.scrutinsEligibles} scrutins
					</div>
				</div>

				<!-- Filter tabs -->
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
							<VoteHistoryItem
								scrutin={h.scrutin}
								position={h.position}
								isFronde={h.isFronde}
							/>
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
