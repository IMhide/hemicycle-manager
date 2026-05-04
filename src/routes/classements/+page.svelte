<script lang="ts">
	import InfoTip from '$lib/components/InfoTip.svelte';
	import GroupBadge from '$lib/components/GroupBadge.svelte';
	import type { Depute, DeputeStats, Groupe } from '$lib/types';

	let { data } = $props();

	type Metric = 'presence' | 'participation' | 'loyaute' | 'frondes' | 'activite';
	let metric: Metric = $state('presence');
	let view: 'global' | 'by-group' = $state('global');
	let topN = $state(20);

	const deputeById = $derived.by(() => {
		const m = new Map<string, Depute>();
		for (const d of data.deputes) m.set(d.id, d);
		return m;
	});
	const groupeById = $derived.by(() => {
		const m = new Map<string, Groupe>();
		for (const g of data.groupes) m.set(g.id, g);
		return m;
	});

	const metricMeta = {
		presence: {
			label: 'Présence',
			emoji: '🎯',
			format: (s: DeputeStats) => `${(s.tauxPresence * 100).toFixed(1)} %`,
			value: (s: DeputeStats) => s.tauxPresence,
			rank: (s: DeputeStats) => s.rangs.presence,
			info: 'Part des scrutins où le député était physiquement présent.',
			color: 'text-blue-400'
		},
		participation: {
			label: 'Participation',
			emoji: '✋',
			format: (s: DeputeStats) => `${(s.tauxParticipation * 100).toFixed(1)} %`,
			value: (s: DeputeStats) => s.tauxParticipation,
			rank: (s: DeputeStats) => s.rangs.participation,
			info: 'Part des scrutins où le député a exprimé un vote pour, contre ou abstention.',
			color: 'text-purple-400'
		},
		loyaute: {
			label: 'Loyauté',
			emoji: '🤝',
			format: (s: DeputeStats) =>
				s.tauxLoyaute === null ? 'N/A' : `${(s.tauxLoyaute * 100).toFixed(1)} %`,
			value: (s: DeputeStats) => s.tauxLoyaute,
			rank: (s: DeputeStats) => s.rangs.loyaute,
			info: 'Part des votes alignés avec la majorité du groupe.',
			color: 'text-emerald-400'
		},
		frondes: {
			label: 'Frondes',
			emoji: '🔥',
			format: (s: DeputeStats) => `${s.frondes}`,
			value: (s: DeputeStats) => s.frondes,
			rank: (s: DeputeStats) => s.rangs.frondes,
			info: 'Nombre de votes exprimés opposés à la majorité du groupe.',
			color: 'text-rose-400'
		},
		activite: {
			label: 'Activité',
			emoji: '🦅',
			format: (s: DeputeStats) => `${s.activite}`,
			value: (s: DeputeStats) => s.activite,
			rank: (s: DeputeStats) => s.rangs.activite,
			info: 'Nombre total de votes exprimés (pour + contre + abstention).',
			color: 'text-amber-400'
		}
	} as const;

	const currentMeta = $derived(metricMeta[metric]);

	const sorted = $derived(
		[...data.stats]
			.filter((s) => currentMeta.value(s) !== null)
			.sort((a, b) => currentMeta.rank(a)! - currentMeta.rank(b)!)
	);

	const topGlobal = $derived(sorted.slice(0, topN));

	// "Par groupe": top 1 of each group on the current metric.
	const byGroup = $derived.by(() => {
		const grouped = new Map<string, DeputeStats[]>();
		for (const s of sorted) {
			const dep = deputeById.get(s.id);
			if (!dep?.groupeId) continue;
			if (!grouped.has(dep.groupeId)) grouped.set(dep.groupeId, []);
			grouped.get(dep.groupeId)!.push(s);
		}
		return data.groupes
			.map((g) => {
				const list = grouped.get(g.id) ?? [];
				return { groupe: g, top: list.slice(0, 5) };
			})
			.filter((entry) => entry.top.length > 0);
	});

	function tierFor(rank: number, total: number): { medal: string; cls: string } {
		const ratio = rank / total;
		if (ratio <= 0.1) return { medal: '🥇', cls: 'border-amber-400/40 bg-amber-400/5' };
		if (ratio <= 0.25) return { medal: '🥈', cls: 'border-slate-400/40 bg-slate-400/5' };
		if (ratio <= 0.5) return { medal: '🥉', cls: 'border-orange-700/40 bg-orange-700/5' };
		return { medal: '', cls: '' };
	}
</script>

<svelte:head>
	<title>Classements — Hémicycle Manager</title>
</svelte:head>

<section class="max-w-7xl mx-auto px-6 py-8">
	<div class="flex items-baseline justify-between gap-4 flex-wrap mb-6">
		<div>
			<h1 class="title-display text-4xl">🏆 Classements</h1>
			<p class="text-assembly-muted text-sm mt-1">
				Les 577 députés classés sur les indicateurs clés de la 17ᵉ législature.
			</p>
		</div>
		<div class="flex gap-1 bg-assembly-surface border border-assembly-border rounded-lg p-1">
			<button
				class="btn px-3 py-1 text-xs {view === 'global'
					? 'bg-assembly-accent text-assembly-bg'
					: 'text-assembly-muted'}"
				onclick={() => (view = 'global')}
			>
				Global
			</button>
			<button
				class="btn px-3 py-1 text-xs {view === 'by-group'
					? 'bg-assembly-accent text-assembly-bg'
					: 'text-assembly-muted'}"
				onclick={() => (view = 'by-group')}
			>
				Par groupe
			</button>
		</div>
	</div>

	<!-- Metric selector tabs -->
	<div class="flex flex-wrap gap-2 mb-6">
		{#each Object.entries(metricMeta) as [key, meta] (key)}
			<button
				class="card px-4 py-2 flex items-center gap-2 transition-colors {metric === key
					? 'border-assembly-accent ring-1 ring-assembly-accent/40'
					: 'hover:border-assembly-accent/60'}"
				onclick={() => (metric = key as Metric)}
			>
				<span aria-hidden="true">{meta.emoji}</span>
				<span class="font-semibold">{meta.label}</span>
			</button>
		{/each}
	</div>

	<div class="text-sm text-assembly-muted flex items-center gap-1 mb-4">
		{currentMeta.info}
		<InfoTip title="{currentMeta.label}" size="xs">{currentMeta.info}</InfoTip>
	</div>

	{#if view === 'global'}
		<!-- Top N global -->
		<div class="space-y-1.5">
			{#each topGlobal as s, i (s.id)}
				{@const dep = deputeById.get(s.id)}
				{@const groupe = dep?.groupeId ? groupeById.get(dep.groupeId) : null}
				{@const rank = currentMeta.rank(s)!}
				{@const tier = tierFor(rank, data.stats.length)}
				{#if dep}
					<a
						href="/deputes/{dep.id}/"
						class="card p-3 flex items-center gap-3 hover:border-assembly-accent/60 transition-colors {tier.cls}"
					>
						<div
							class="w-10 text-center title-display text-2xl tabular-nums flex-shrink-0 flex items-center justify-center"
						>
							{tier.medal || `#${rank}`}
						</div>
						<img
							src={dep.photoUrl}
							alt=""
							class="w-10 h-10 rounded-full object-cover bg-assembly-border flex-shrink-0"
							loading="lazy"
							referrerpolicy="no-referrer"
						/>
						<div class="min-w-0 flex-1">
							<div class="font-semibold truncate">{dep.prenom} {dep.nom}</div>
							{#if groupe}
								<div class="mt-0.5">
									<GroupBadge {groupe} size="sm" linked={false} />
								</div>
							{/if}
						</div>
						<div class="title-display text-2xl tabular-nums flex-shrink-0 {currentMeta.color}">
							{currentMeta.format(s)}
						</div>
					</a>
				{/if}
			{/each}
		</div>

		{#if topN < sorted.length}
			<div class="mt-4 text-center">
				<button class="btn-ghost text-sm" onclick={() => (topN += 20)}>
					Charger 20 de plus ({sorted.length - topN} restants)
				</button>
			</div>
		{/if}
	{:else}
		<!-- Par groupe -->
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
			{#each byGroup as { groupe, top } (groupe.id)}
				<div class="card p-4" style="border-left: 4px solid {groupe.couleur}">
					<div class="flex items-center gap-2 mb-3">
						<GroupBadge {groupe} size="md" linked={true} />
						<span class="text-xs text-assembly-muted">— top {top.length}</span>
					</div>
					<div class="space-y-1.5">
						{#each top as s, i (s.id)}
							{@const dep = deputeById.get(s.id)}
							{#if dep}
								<a
									href="/deputes/{dep.id}/"
									class="flex items-center gap-3 p-2 rounded hover:bg-assembly-border/30 transition-colors"
								>
									<div class="w-6 text-center title-display text-sm tabular-nums text-assembly-muted">
										#{i + 1}
									</div>
									<img
										src={dep.photoUrl}
										alt=""
										class="w-8 h-8 rounded-full object-cover bg-assembly-border flex-shrink-0"
										loading="lazy"
										referrerpolicy="no-referrer"
									/>
									<div class="min-w-0 flex-1">
										<div class="text-sm font-semibold truncate">
											{dep.prenom} {dep.nom}
										</div>
										<div class="text-[10px] text-assembly-muted">
											rang global #{currentMeta.rank(s)}
										</div>
									</div>
									<div class="title-display text-base tabular-nums {currentMeta.color}">
										{currentMeta.format(s)}
									</div>
								</a>
							{/if}
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</section>
