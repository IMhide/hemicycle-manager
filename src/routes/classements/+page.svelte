<script lang="ts">
	/**
	 * Classements stricts par législature (cf ADR 0017 : pas de cohorte cross-leg).
	 * On utilise les rangs pré-calculés dans `Mandat.rangs`.
	 */
	import InfoTip from '$lib/components/InfoTip.svelte';
	import GroupBadge from '$lib/components/GroupBadge.svelte';
	import type { Personne, Mandat, Groupe } from '$lib/types';

	let { data } = $props();

	type Metric = 'presence' | 'participation' | 'loyaute' | 'frondes';
	let metric: Metric = $state('presence');
	let view: 'global' | 'by-group' = $state('global');
	let topN = $state(20);

	const legSorted = $derived([...data.legislatures].sort((a, b) => b.num - a.num));
	let scopeLeg = $state(
		[...data.legislatures].sort((a, b) => b.num - a.num)[0]?.num ?? 17
	);

	const personneById = $derived.by(() => {
		const m = new Map<string, Personne>();
		for (const p of data.personnes) m.set(p.id, p);
		return m;
	});
	const groupeById = $derived.by(() => {
		const m = new Map<string, Groupe>();
		for (const g of data.groupes) m.set(g.id, g);
		return m;
	});

	const groupesScope = $derived(data.groupes.filter((g) => g.legislature === scopeLeg));

	const metricMeta = {
		presence: {
			label: 'Présence',
			emoji: '🎯',
			format: (m: Mandat) => `${(m.stats.presence.rate * 100).toFixed(1)} %`,
			value: (m: Mandat) => m.stats.presence.rate,
			rank: (m: Mandat) => m.rangs.presence.rank,
			info: 'Part des scrutins où le député était physiquement présent.',
			color: 'text-blue-400'
		},
		participation: {
			label: 'Participation',
			emoji: '✋',
			format: (m: Mandat) => `${(m.stats.participation.rate * 100).toFixed(1)} %`,
			value: (m: Mandat) => m.stats.participation.rate,
			rank: (m: Mandat) => m.rangs.participation.rank,
			info: 'Part des scrutins où le député a exprimé un vote pour, contre ou abstention.',
			color: 'text-purple-400'
		},
		loyaute: {
			label: 'Loyauté',
			emoji: '🤝',
			format: (m: Mandat) =>
				m.stats.loyaute.rate === null ? 'N/A' : `${(m.stats.loyaute.rate * 100).toFixed(1)} %`,
			value: (m: Mandat) => m.stats.loyaute.rate,
			rank: (m: Mandat) => m.rangs.loyaute.rank,
			info: 'Part des votes alignés avec la majorité du groupe au moment du vote (cf ADR 0016).',
			color: 'text-emerald-400'
		},
		frondes: {
			label: 'Frondes',
			emoji: '🔥',
			format: (m: Mandat) => `${m.stats.frondes.count}`,
			value: (m: Mandat) => m.stats.frondes.count,
			rank: (m: Mandat) => m.rangs.frondes.rank,
			info: 'Nombre de votes exprimés opposés à la majorité du groupe.',
			color: 'text-rose-400'
		}
	} as const;

	const currentMeta = $derived(metricMeta[metric]);

	/** Mandats de la législature scopée. */
	const mandats = $derived.by(() => {
		const list: Array<{ personne: Personne; mandat: Mandat }> = [];
		for (const p of data.personnes) {
			const m = p.mandats.find((md) => md.legislature === scopeLeg);
			if (m) list.push({ personne: p, mandat: m });
		}
		return list;
	});

	const sorted = $derived(
		[...mandats]
			.filter(({ mandat }) => currentMeta.value(mandat) !== null)
			.sort((a, b) => {
				const ra = currentMeta.rank(a.mandat);
				const rb = currentMeta.rank(b.mandat);
				if (ra === null && rb === null) return 0;
				if (ra === null) return 1;
				if (rb === null) return -1;
				return ra - rb;
			})
	);

	const topGlobal = $derived(sorted.slice(0, topN));

	/** Groupe principal d'une personne dans le mandat scopé (cf ADR 0016). */
	function groupePrincipal(m: Mandat): Groupe | null {
		for (let i = m.appartenancesGroupe.length - 1; i >= 0; i--) {
			const a = m.appartenancesGroupe[i];
			if (a.isTransitoireNI) continue;
			const g = groupeById.get(a.groupeId);
			if (g) return g;
		}
		return null;
	}

	const byGroup = $derived.by(() => {
		const grouped = new Map<string, Array<{ personne: Personne; mandat: Mandat }>>();
		for (const entry of sorted) {
			const g = groupePrincipal(entry.mandat);
			if (!g) continue;
			if (!grouped.has(g.id)) grouped.set(g.id, []);
			grouped.get(g.id)!.push(entry);
		}
		return groupesScope
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
	<title>Classements — PolitiDex</title>
</svelte:head>

<section class="max-w-7xl mx-auto px-6 py-8">
	<div class="flex items-baseline justify-between gap-4 flex-wrap mb-6">
		<div>
			<h1 class="title-display text-4xl">🏆 Classements</h1>
			<p class="text-assembly-muted text-sm mt-1">
				Classements de la {scopeLeg}<sup>e</sup> législature.
				<span class="italic">Pas de cohorte cross-législature (cf ADR 0017).</span>
			</p>
		</div>
		<div class="flex items-center gap-2">
			<div class="flex items-center gap-1 text-xs">
				{#each legSorted as l (l.num)}
					<button
						class="px-3 py-1 rounded {scopeLeg === l.num
							? 'bg-assembly-accent text-assembly-bg font-semibold'
							: 'border border-assembly-border text-assembly-muted hover:text-slate-200'}"
						onclick={() => (scopeLeg = l.num)}
					>
						{l.num}<sup>e</sup>
					</button>
				{/each}
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
	</div>

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
		<InfoTip title={currentMeta.label} size="xs">{currentMeta.info}</InfoTip>
	</div>

	{#if view === 'global'}
		<div class="space-y-1.5">
			{#each topGlobal as { personne, mandat }, i (personne.id)}
				{@const groupe = groupePrincipal(mandat)}
				{@const rank = currentMeta.rank(mandat)!}
				{@const tier = tierFor(rank, sorted.length)}
				<a
					href="/deputes/{personne.id}/?leg={scopeLeg}"
					class="card p-3 flex items-center gap-3 hover:border-assembly-accent/60 transition-colors {tier.cls}"
				>
					<div
						class="w-10 text-center title-display text-2xl tabular-nums flex-shrink-0 flex items-center justify-center"
					>
						{tier.medal || `#${rank}`}
					</div>
					<img
						src={personne.identite.photoUrl}
						alt=""
						class="w-10 h-10 rounded-full object-cover bg-assembly-border flex-shrink-0"
						loading="lazy"
						referrerpolicy="no-referrer"
					/>
					<div class="min-w-0 flex-1">
						<div class="font-semibold truncate">
							{personne.identite.prenom}
							{personne.identite.nom}
						</div>
						{#if groupe}
							<div class="mt-0.5">
								<GroupBadge {groupe} size="sm" linked={false} />
							</div>
						{/if}
					</div>
					<div class="title-display text-2xl tabular-nums flex-shrink-0 {currentMeta.color}">
						{currentMeta.format(mandat)}
					</div>
				</a>
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
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
			{#each byGroup as { groupe, top } (groupe.id)}
				<div class="card p-4" style="border-left: 4px solid {groupe.couleur}">
					<div class="flex items-center gap-2 mb-3">
						<GroupBadge {groupe} size="md" linked={true} />
						<span class="text-xs text-assembly-muted">— top {top.length}</span>
					</div>
					<div class="space-y-1.5">
						{#each top as { personne, mandat }, i (personne.id)}
							<a
								href="/deputes/{personne.id}/?leg={scopeLeg}"
								class="flex items-center gap-3 p-2 rounded hover:bg-assembly-border/30 transition-colors"
							>
								<div
									class="w-6 text-center title-display text-sm tabular-nums text-assembly-muted"
								>
									#{i + 1}
								</div>
								<img
									src={personne.identite.photoUrl}
									alt=""
									class="w-8 h-8 rounded-full object-cover bg-assembly-border flex-shrink-0"
									loading="lazy"
									referrerpolicy="no-referrer"
								/>
								<div class="min-w-0 flex-1">
									<div class="text-sm font-semibold truncate">
										{personne.identite.prenom}
										{personne.identite.nom}
									</div>
									<div class="text-[10px] text-assembly-muted">
										rang global #{currentMeta.rank(mandat)}
									</div>
								</div>
								<div class="title-display text-base tabular-nums {currentMeta.color}">
									{currentMeta.format(mandat)}
								</div>
							</a>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</section>
