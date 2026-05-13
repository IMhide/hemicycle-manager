<script lang="ts">
	import Hemicycle from '$lib/components/Hemicycle.svelte';
	import MiniDeputeCard from '$lib/components/MiniDeputeCard.svelte';
	import HemicycleColorToggle from '$lib/components/HemicycleColorToggle.svelte';
	import { POLITICAL_ORDER } from '$lib/political-order';
	import { colorMode } from '$lib/color-mode.svelte';
	import { goto } from '$app/navigation';
	import { lookupEluUrlForPaIdLeg } from '$lib/elus';
	import type { Personne, Groupe, Mandat } from '$lib/types';

	let { data } = $props();

	let hovered: string | null = $state(null);
	let cursorX = $state(0);
	let cursorY = $state(0);

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

	/** Filtre : seulement les personnes ayant un mandat dans la leg courante. */
	const personnesLeg = $derived(
		data.personnes.filter((p) => p.mandats.some((m) => m.legislature === data.legCourante))
	);

	function mandatLeg(p: Personne): Mandat | null {
		return p.mandats.find((m) => m.legislature === data.legCourante) ?? null;
	}

	const hoveredPersonne = $derived(hovered ? personneById.get(hovered) ?? null : null);
	const hoveredMandat = $derived(hoveredPersonne ? mandatLeg(hoveredPersonne) : null);
	const hoveredGroupe = $derived.by((): Groupe | null => {
		if (!hoveredMandat) return null;
		for (let i = hoveredMandat.appartenancesGroupe.length - 1; i >= 0; i--) {
			const a = hoveredMandat.appartenancesGroupe[i];
			if (a.isTransitoireNI) continue;
			const g = groupeById.get(a.groupeId);
			if (g) return g;
		}
		return null;
	});

	const recentScrutins = $derived.by(() => {
		const scrutinsLeg = data.scrutins.filter((s) => s.legislature === data.legCourante);
		const now = new Date();
		const cutoff = new Date(now);
		cutoff.setDate(cutoff.getDate() - 7);
		const cutoffStr = cutoff.toISOString().slice(0, 10);
		const recent = scrutinsLeg.filter((s) => s.date >= cutoffStr);
		// Si rien sur 7 jours, retomber sur les 8 plus récents (cas hors session)
		if (recent.length === 0) return scrutinsLeg.slice(0, 8);
		return recent;
	});

	// Cache les groupes éteints en cours de leg (effectifFin = 0).
	const sortedGroupes = $derived(
		[...data.groupes]
			.filter((g) => g.effectifFin > 0)
			.sort(
				(a, b) =>
					(POLITICAL_ORDER[a.libelleAbrege]?.rank ?? 99) -
					(POLITICAL_ORDER[b.libelleAbrege]?.rank ?? 99)
			)
	);

	const legSorted = $derived([...data.legislatures].sort((a, b) => b.num - a.num));

	function trackCursor(e: MouseEvent) {
		cursorX = e.clientX;
		cursorY = e.clientY;
	}

	function selectPersonne(id: string) {
		goto(lookupEluUrlForPaIdLeg(id, data.legCourante) ?? '/elus/');
	}

	function basculerLeg(num: number) {
		goto(`/assemblee/legislatures/${num}/`);
	}

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
	}

	function truncate(s: string, n: number): string {
		return s.length > n ? s.slice(0, n - 1) + '…' : s;
	}

	const tooltipPos = $derived.by(() => {
		const W = 290;
		const H = 280;
		const margin = 16;
		let left = cursorX + 16;
		let top = cursorY + 16;
		if (typeof window !== 'undefined') {
			if (left + W + margin > window.innerWidth) left = cursorX - W - 16;
			if (top + H + margin > window.innerHeight) top = cursorY - H - 16;
			left = Math.max(margin, left);
			top = Math.max(margin, top);
		}
		return { left, top };
	});
</script>

<svelte:head>
	<title>PolitiDex — Pokédex des élus français</title>
</svelte:head>

<svelte:window onmousemove={trackCursor} />

<section class="max-w-7xl mx-auto px-6 py-8">
	<div class="mb-6 flex flex-wrap items-end justify-between gap-3">
		<div>
			<h1 class="title-display text-4xl sm:text-5xl tracking-wider">Hémicycle</h1>
			<p class="text-assembly-muted mt-1">
				{data.legCourante}<sup>e</sup> législature · Survolez un siège pour voir la fiche, cliquez pour ouvrir.
			</p>
		</div>
		<div class="flex flex-col items-end gap-2 text-xs">
			<div class="flex items-center gap-1">
				<span class="text-assembly-muted">Législature :</span>
				{#each legSorted as l (l.num)}
					<button
						class="px-3 py-1 rounded {l.num === data.legCourante
							? 'bg-assembly-accent text-assembly-bg font-semibold'
							: 'border border-assembly-border text-assembly-muted hover:text-slate-200'}"
						onclick={() => basculerLeg(l.num)}
					>
						{l.num}<sup>e</sup>
					</button>
				{/each}
			</div>
			<HemicycleColorToggle />
		</div>
	</div>

	<div class="card p-4 sm:p-6 mb-6">
		<Hemicycle
			personnes={personnesLeg}
			legislature={data.legCourante}
			mode={{ kind: colorMode.current, groupes: data.groupes }}
			{hovered}
			onhover={(id) => (hovered = id)}
			onselect={(id) => selectPersonne(id)}
		/>
	</div>

	{#if hoveredPersonne}
		<div
			class="fixed z-50 pointer-events-none transition-opacity duration-100"
			style="left: {tooltipPos.left}px; top: {tooltipPos.top}px; opacity: 0.98;"
		>
			<MiniDeputeCard
				personne={hoveredPersonne}
				groupe={hoveredGroupe}
				mandat={hoveredMandat}
			/>
		</div>
	{/if}

	<div class="mb-8">
		<div class="text-xs uppercase tracking-widest text-assembly-muted mb-2">Groupes politiques</div>
		<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
			{#each sortedGroupes as g (g.id)}
				<a
					href="/assemblee/groupes/{g.legislature}/{g.id}/"
					class="card flex items-center gap-2 px-2.5 py-2 hover:border-assembly-accent/60 transition-colors min-w-0"
					style="border-left: 3px solid {g.couleur}"
				>
					<div class="min-w-0 flex-1">
						<div class="text-xs font-semibold truncate">{g.libelleAbrege}</div>
						<div class="text-[10px] text-assembly-muted truncate">{g.libelle}</div>
					</div>
					<div class="title-display text-base text-assembly-text tabular-nums flex-shrink-0">
						{g.effectifFin}
					</div>
				</a>
			{/each}
		</div>
	</div>

	<div>
		<div class="flex items-baseline justify-between gap-3 mb-3">
			<h2 class="title-display text-xl">Scrutins récents</h2>
			<div class="flex gap-3 text-xs text-assembly-muted">
				<a href="/textes/" class="hover:text-assembly-accent">
					Textes ({data.textes.length}) →
				</a>
				<a href="/assemblee/scrutins/" class="hover:text-assembly-accent">
					Voir tous les scrutins →
				</a>
			</div>
		</div>
		{#if recentScrutins.length === 0}
			<div class="card p-6 text-sm text-assembly-muted text-center italic">
				Aucun scrutin disponible.
			</div>
		{:else}
			<div class="grid grid-cols-1 md:grid-cols-2 gap-2">
				{#each recentScrutins as s (s.uid)}
					<a
						href="/assemblee/scrutins/{s.uid}/"
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
