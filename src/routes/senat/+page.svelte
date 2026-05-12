<script lang="ts">
	import HemicycleSenat from '$lib/components/HemicycleSenat.svelte';
	import MiniSenateurCard from '$lib/components/MiniSenateurCard.svelte';
	import { POLITICAL_ORDER } from '$lib/political-order';
	import { TRIENNATS, type TriennatId } from '$lib/triennats';
	import { goto } from '$app/navigation';
	import { lookupEluUrlForMatriculeTriennat } from '$lib/elus';
	import type { Senateur, GroupeSenat, MandatSenat } from '$lib/types';

	let { data } = $props();

	let hovered: string | null = $state(null);
	let cursorX = $state(0);
	let cursorY = $state(0);

	const senateurById = $derived.by(() => {
		const m = new Map<string, Senateur>();
		for (const s of data.senateurs) m.set(s.id, s);
		return m;
	});
	const groupeByCode = $derived.by(() => {
		const m = new Map<string, GroupeSenat>();
		for (const g of data.groupes) m.set(g.code, g);
		return m;
	});

	/** Sénateurs avec un mandat couvrant le triennat courant. */
	const senateursTriennat = $derived(
		data.senateurs.filter((s) =>
			s.mandats.some((m) => m.triennats.some((t) => t.triennat === data.triennatCourant))
		)
	);

	function mandatPourTriennat(s: Senateur): MandatSenat | null {
		for (const m of s.mandats) {
			if (m.triennats.some((t) => t.triennat === data.triennatCourant)) return m;
		}
		return null;
	}

	const hoveredSenateur = $derived(hovered ? senateurById.get(hovered) ?? null : null);
	const hoveredMandat = $derived(hoveredSenateur ? mandatPourTriennat(hoveredSenateur) : null);
	const hoveredGroupe = $derived.by((): GroupeSenat | null => {
		if (!hoveredMandat) return null;
		const lastApp = hoveredMandat.appartenancesGroupe.at(-1);
		return lastApp ? groupeByCode.get(lastApp.groupeCode) ?? null : null;
	});

	const triennatMeta = $derived(TRIENNATS.find((t) => t.id === data.triennatCourant));

	const recentScrutins = $derived.by(() => {
		if (!triennatMeta) return [];
		const inTriennat = data.scrutins.filter(
			(s) => s.date >= triennatMeta.dateDebut && s.date < triennatMeta.dateFin
		);
		const sorted = [...inTriennat].sort((a, b) => b.date.localeCompare(a.date));
		return sorted.slice(0, 8);
	});

	// Trier les groupes par axe gauche-droite (PolitiDex)
	const sortedGroupes = $derived(
		[...data.groupes]
			.filter((g) => g.effectifFin > 0)
			.sort(
				(a, b) =>
					(POLITICAL_ORDER[a.libelleAbrege]?.rank ?? 99) -
					(POLITICAL_ORDER[b.libelleAbrege]?.rank ?? 99)
			)
	);

	const triennatsSorted = $derived(
		[...data.triennats]
			.filter((t) => t.nbScrutins > 0)
			.sort((a, b) => b.dateDebut.localeCompare(a.dateDebut))
	);

	function trackCursor(e: MouseEvent) {
		cursorX = e.clientX;
		cursorY = e.clientY;
	}

	function selectSenateur(id: string) {
		goto(lookupEluUrlForMatriculeTriennat(id, data.triennatCourant) ?? '/elus/');
	}

	function basculerTriennat(periode: TriennatId) {
		goto(`/senat/triennats/${periode}/`);
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
	<title>Sénat — PolitiDex</title>
</svelte:head>

<svelte:window onmousemove={trackCursor} />

<section class="max-w-7xl mx-auto px-6 py-8">
	<div class="mb-6 flex flex-wrap items-end justify-between gap-3">
		<div>
			<h1 class="title-display text-4xl sm:text-5xl tracking-wider">Hémicycle Sénat</h1>
			<p class="text-assembly-muted mt-1">
				Triennat {data.triennatCourant} · 348 sièges · Survolez un siège pour voir la fiche,
				cliquez pour ouvrir.
			</p>
		</div>
		<div class="flex items-center gap-1 flex-wrap justify-end max-w-md text-xs">
			<span class="text-assembly-muted">Triennat :</span>
			{#each triennatsSorted as tri (tri.id)}
				<button
					class="px-2 py-1 rounded text-[11px] {tri.id === data.triennatCourant
						? 'bg-assembly-accent text-assembly-bg font-semibold'
						: 'border border-assembly-border text-assembly-muted hover:text-slate-200'}"
					onclick={() => basculerTriennat(tri.id as TriennatId)}
				>
					{tri.id}
				</button>
			{/each}
		</div>
	</div>

	<div class="card p-4 sm:p-6 mb-6">
		<HemicycleSenat
			senateurs={senateursTriennat}
			triennat={data.triennatCourant}
			mode={{ kind: 'gradient', groupes: data.groupes }}
			{hovered}
			onhover={(id) => (hovered = id)}
			onselect={(id) => selectSenateur(id)}
		/>
	</div>

	{#if hoveredSenateur}
		<div
			class="fixed z-50 pointer-events-none transition-opacity duration-100"
			style="left: {tooltipPos.left}px; top: {tooltipPos.top}px; opacity: 0.98;"
		>
			<MiniSenateurCard
				senateur={hoveredSenateur}
				groupe={hoveredGroupe}
				triennat={data.triennatCourant}
			/>
		</div>
	{/if}

	<div class="mb-8">
		<div class="text-xs uppercase tracking-widest text-assembly-muted mb-2">Groupes politiques</div>
		<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
			{#each sortedGroupes as g (g.code)}
				<div
					class="card flex items-center gap-2 px-2.5 py-2 min-w-0"
					style="border-left: 3px solid {g.couleur}"
				>
					<div class="min-w-0 flex-1">
						<div class="text-xs font-semibold truncate">{g.libelleAbrege}</div>
						<div class="text-[10px] text-assembly-muted truncate">{g.libelle}</div>
					</div>
					<div class="title-display text-base text-assembly-text tabular-nums flex-shrink-0">
						{g.effectifFin}
					</div>
				</div>
			{/each}
		</div>
	</div>

	<div>
		<div class="flex items-baseline justify-between gap-3 mb-3">
			<h2 class="title-display text-xl">Scrutins récents</h2>
			<div class="flex gap-3 text-xs text-assembly-muted">
				<a href="/senat/textes/" class="hover:text-assembly-accent">
					Textes →
				</a>
				<a href="/senat/scrutins/" class="hover:text-assembly-accent">
					Voir tous les scrutins →
				</a>
			</div>
		</div>
		{#if recentScrutins.length === 0}
			<div class="card p-6 text-sm text-assembly-muted text-center italic">
				Aucun scrutin disponible pour ce triennat.
			</div>
		{:else}
			<div class="grid grid-cols-1 md:grid-cols-2 gap-2">
				{#each recentScrutins as s (s.uid)}
					<a
						href="/senat/scrutins/{s.uid}/"
						class="card p-3 flex items-center gap-3 hover:border-assembly-accent/60 transition-colors"
					>
						<div class="text-center flex-shrink-0 w-12">
							<div class="text-[10px] text-assembly-muted leading-none">n°</div>
							<div class="title-display text-base tabular-nums">{s.scrnum}</div>
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
							class="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded flex-shrink-0 {s.sort?.toLowerCase().includes('adopt')
								? 'bg-vote-pour/20 text-vote-pour'
								: s.sort?.toLowerCase().includes('rejet')
									? 'bg-vote-contre/20 text-vote-contre'
									: 'bg-assembly-border text-assembly-muted'}"
						>
							{s.sort || 'n/a'}
						</div>
					</a>
				{/each}
			</div>
		{/if}
	</div>
</section>
