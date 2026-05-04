<script lang="ts">
	import Hemicycle from '$lib/components/Hemicycle.svelte';
	import MiniDeputeCard from '$lib/components/MiniDeputeCard.svelte';
	import { POLITICAL_ORDER } from '$lib/political-order';
	import type { Depute, DeputeStats, Groupe } from '$lib/types';

	let { data } = $props();

	let hovered: string | null = $state(null);
	// Cursor position in viewport coords for tooltip placement
	let cursorX = $state(0);
	let cursorY = $state(0);

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
	const statsById = $derived.by(() => {
		const m = new Map<string, DeputeStats>();
		for (const s of data.stats) m.set(s.id, s);
		return m;
	});

	const hoveredDepute = $derived(hovered ? deputeById.get(hovered) ?? null : null);
	const hoveredGroupe = $derived(
		hoveredDepute?.groupeId ? groupeById.get(hoveredDepute.groupeId) ?? null : null
	);
	const hoveredStats = $derived(hovered ? statsById.get(hovered) ?? null : null);

	// 7-day rolling window of recent scrutins.
	const recentScrutins = $derived.by(() => {
		const now = new Date();
		const cutoff = new Date(now);
		cutoff.setDate(cutoff.getDate() - 7);
		const cutoffStr = cutoff.toISOString().slice(0, 10);
		return data.scrutins.filter((s) => s.date >= cutoffStr);
	});

	// Compact group cards, ordered politically (left → right).
	const sortedGroupes = $derived(
		[...data.groupes].sort(
			(a, b) =>
				(POLITICAL_ORDER[a.libelleAbrege]?.rank ?? 99) -
				(POLITICAL_ORDER[b.libelleAbrege]?.rank ?? 99)
		)
	);

	function trackCursor(e: MouseEvent) {
		cursorX = e.clientX;
		cursorY = e.clientY;
	}

	function selectDepute(id: string) {
		// Navigate to deputy page on click
		window.location.href = `/deputes/${id}/`;
	}

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('fr-FR', {
			day: 'numeric',
			month: 'short'
		});
	}

	function truncate(s: string, n: number): string {
		return s.length > n ? s.slice(0, n - 1) + '…' : s;
	}

	// Tooltip: keep it inside the viewport. Card is ~280×260 px.
	const tooltipPos = $derived.by(() => {
		const W = 290;
		const H = 280;
		const margin = 16;
		// Default: top-right of cursor
		let left = cursorX + 16;
		let top = cursorY + 16;
		if (typeof window !== 'undefined') {
			if (left + W + margin > window.innerWidth) {
				left = cursorX - W - 16;
			}
			if (top + H + margin > window.innerHeight) {
				top = cursorY - H - 16;
			}
			left = Math.max(margin, left);
			top = Math.max(margin, top);
		}
		return { left, top };
	});
</script>

<svelte:head>
	<title>Hémicycle Manager — Visualisez l'Assemblée nationale</title>
</svelte:head>

<svelte:window onmousemove={trackCursor} />

<section class="max-w-7xl mx-auto px-6 py-8">
	<div class="mb-6">
		<h1 class="title-display text-4xl sm:text-5xl tracking-wider">Hémicycle</h1>
		<p class="text-assembly-muted mt-1">
			Survolez un siège pour voir la fiche du député — cliquez pour ouvrir.
		</p>
	</div>

	<!-- The hemicycle itself -->
	<div class="card p-4 sm:p-6 mb-6">
		<Hemicycle
			deputes={data.deputes}
			mode={{ kind: 'groupe', groupes: data.groupes }}
			{hovered}
			onhover={(id) => (hovered = id)}
			onselect={(id) => selectDepute(id)}
		/>
	</div>

	<!-- Floating FIFA-style hover card -->
	{#if hoveredDepute && hoveredStats}
		<div
			class="fixed z-50 pointer-events-none transition-opacity duration-100"
			style="left: {tooltipPos.left}px; top: {tooltipPos.top}px; opacity: 0.98;"
		>
			<MiniDeputeCard depute={hoveredDepute} groupe={hoveredGroupe} stats={hoveredStats} />
		</div>
	{/if}

	<!-- Compact groups bar — clickable, ordered left→right politically -->
	<div class="mb-8">
		<div class="text-xs uppercase tracking-widest text-assembly-muted mb-2">Groupes politiques</div>
		<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
			{#each sortedGroupes as g (g.id)}
				<a
					href="/groupes/{g.id}/"
					class="card flex items-center gap-2 px-2.5 py-2 hover:border-assembly-accent/60 transition-colors min-w-0"
					style="border-left: 3px solid {g.couleur}"
				>
					<div class="min-w-0 flex-1">
						<div class="text-xs font-semibold truncate">{g.libelleAbrege}</div>
						<div class="text-[10px] text-assembly-muted truncate">{g.libelle}</div>
					</div>
					<div class="title-display text-base text-assembly-text tabular-nums flex-shrink-0">
						{g.effectif}
					</div>
				</a>
			{/each}
		</div>
	</div>

	<!-- Scrutins of the past 7 days -->
	<div>
		<div class="flex items-baseline justify-between gap-3 mb-3">
			<h2 class="title-display text-xl">Scrutins des 7 derniers jours</h2>
			<a href="/scrutins/" class="text-xs text-assembly-muted hover:text-assembly-accent">
				Voir tous les scrutins →
			</a>
		</div>
		{#if recentScrutins.length === 0}
			<div class="card p-6 text-sm text-assembly-muted text-center italic">
				Aucun scrutin sur les 7 derniers jours.
			</div>
		{:else}
			<div class="grid grid-cols-1 md:grid-cols-2 gap-2">
				{#each recentScrutins as s (s.uid)}
					<a
						href="/scrutins/{s.uid}/"
						class="card p-3 flex items-center gap-3 hover:border-assembly-accent/60 transition-colors"
					>
						<div class="text-center flex-shrink-0 w-12">
							<div class="text-[10px] text-assembly-muted leading-none">n°</div>
							<div class="title-display text-base tabular-nums">{s.numero}</div>
						</div>
						<div class="text-xs text-assembly-muted flex-shrink-0 w-14 text-right">
							{formatDate(s.date)}
						</div>
						<div class="min-w-0 flex-1">
							<div class="text-sm leading-snug line-clamp-2">{truncate(s.titre, 130)}</div>
							<div class="flex gap-2 mt-1 text-[10px] tabular-nums">
								<span class="text-vote-pour">{s.pour}</span>
								<span class="text-assembly-muted">·</span>
								<span class="text-vote-contre">{s.contre}</span>
								<span class="text-assembly-muted">·</span>
								<span class="text-vote-abstention">{s.abstention}</span>
							</div>
						</div>
						<div
							class="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded flex-shrink-0 {s.sort ===
							'adopté'
								? 'bg-vote-pour/20 text-vote-pour'
								: s.sort === 'rejeté'
									? 'bg-vote-contre/20 text-vote-contre'
									: 'bg-assembly-border text-assembly-muted'}"
						>
							{s.sort}
						</div>
					</a>
				{/each}
			</div>
		{/if}
	</div>
</section>
