<script lang="ts">
	import InfoTip from '$lib/components/InfoTip.svelte';
	import { POLITICAL_ORDER } from '$lib/political-order';

	let { data } = $props();

	const statsById = $derived.by(() => {
		const m = new Map<string, (typeof data.stats)[number]>();
		for (const s of data.stats) m.set(s.id, s);
		return m;
	});

	const enriched = $derived(
		data.groupes
			.map((g) => ({
				groupe: g,
				stats: statsById.get(g.id),
				rank: POLITICAL_ORDER[g.libelleAbrege]?.rank ?? 99
			}))
			.sort((a, b) => a.rank - b.rank)
	);

	function pct(n: number | null | undefined): string {
		if (n === null || n === undefined) return 'N/A';
		return `${Math.round(n * 100)} %`;
	}
</script>

<svelte:head>
	<title>Groupes politiques — Hémicycle Manager</title>
</svelte:head>

<section class="max-w-7xl mx-auto px-6 py-8">
	<h1 class="title-display text-4xl mb-2">Groupes politiques</h1>
	<p class="text-assembly-muted text-sm mb-6">
		Les 12 groupes de la 17ᵉ législature, classés de gauche à droite (selon les scores
		<a class="underline hover:text-assembly-accent" href="https://www.chesdata.eu/2024-chapel-hill-expert-survey-ches" target="_blank" rel="noopener">CHES 2024</a>).
	</p>

	<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
		{#each enriched as { groupe, stats, rank } (groupe.id)}
			<a
				href="/groupes/{groupe.id}/"
				class="card p-4 hover:border-assembly-accent/60 transition-colors flex items-start gap-4"
				style="border-left: 4px solid {groupe.couleur}"
			>
				<div
					class="w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center title-display text-sm"
					style="background-color: {groupe.couleur}; color: white;"
				>
					{groupe.libelleAbrege.slice(0, 4)}
				</div>
				<div class="flex-1 min-w-0">
					<div class="flex items-center gap-2 flex-wrap">
						<h2 class="font-semibold truncate">{groupe.libelle}</h2>
						{#if rank < 99}
							<span class="text-[10px] text-assembly-muted">rang {rank}/12</span>
						{/if}
					</div>
					<div class="text-xs text-assembly-muted mt-0.5">
						{groupe.libelleAbrege} · {groupe.effectif} député{groupe.effectif > 1 ? 's' : ''}
					</div>
					<div class="grid grid-cols-3 gap-3 mt-3 text-xs">
						<div>
							<div class="text-assembly-muted flex items-center gap-1">
								Cohésion
								<InfoTip title="Cohésion" size="xs">
									Part moyenne des membres alignés sur la majorité du groupe.
								</InfoTip>
							</div>
							<div class="title-display text-base" style="color: {groupe.couleur}">
								{stats ? pct(stats.cohesion) : 'N/A'}
							</div>
						</div>
						<div>
							<div class="text-assembly-muted">Présence</div>
							<div class="title-display text-base text-blue-400">
								{stats ? pct(stats.tauxPresenceMoyen) : 'N/A'}
							</div>
						</div>
						<div>
							<div class="text-assembly-muted">Frondes</div>
							<div class="title-display text-base text-rose-400">
								{stats?.frondesTotales ?? 'N/A'}
							</div>
						</div>
					</div>
				</div>
			</a>
		{/each}
	</div>
</section>
