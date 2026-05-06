<script lang="ts">
	/**
	 * Home par session Sénat. Même UI que `/senat`, mais paramétrée sur
	 * params.sesann. La home racine `/senat` fixe la session = la plus récente.
	 */
	import HemicycleSenat from '$lib/components/HemicycleSenat.svelte';
	import MiniSenateurCard from '$lib/components/MiniSenateurCard.svelte';
	import HemicycleColorToggle from '$lib/components/HemicycleColorToggle.svelte';
	import { POLITICAL_ORDER } from '$lib/political-order';
	import { colorMode } from '$lib/color-mode.svelte';
	import { goto } from '$app/navigation';
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

	const senateursSession = $derived(
		data.senateurs.filter((s) =>
			s.mandats.some((m) => m.sessions.some((sess) => sess.sesann === data.sessionCourante))
		)
	);

	function mandatPourSession(s: Senateur): MandatSenat | null {
		for (const m of s.mandats) {
			if (m.sessions.some((sess) => sess.sesann === data.sessionCourante)) return m;
		}
		return null;
	}

	const hoveredSenateur = $derived(hovered ? senateurById.get(hovered) ?? null : null);
	const hoveredMandat = $derived(hoveredSenateur ? mandatPourSession(hoveredSenateur) : null);
	const hoveredGroupe = $derived.by((): GroupeSenat | null => {
		if (!hoveredMandat) return null;
		const lastApp = hoveredMandat.appartenancesGroupe.at(-1);
		return lastApp ? groupeByCode.get(lastApp.groupeCode) ?? null : null;
	});

	const recentScrutins = $derived.by(() => {
		const scrutinsSession = data.scrutins.filter((s) => s.sesann === data.sessionCourante);
		const sorted = [...scrutinsSession].sort((a, b) => b.date.localeCompare(a.date));
		return sorted.slice(0, 8);
	});

	const sortedGroupes = $derived(
		[...data.groupes]
			.filter((g) => g.effectifFin > 0)
			.sort(
				(a, b) =>
					(POLITICAL_ORDER[a.libelleAbrege]?.rank ?? 99) -
					(POLITICAL_ORDER[b.libelleAbrege]?.rank ?? 99)
			)
	);

	const sessionsSorted = $derived([...data.sessions].sort((a, b) => b.sesann - a.sesann));

	function trackCursor(e: MouseEvent) {
		cursorX = e.clientX;
		cursorY = e.clientY;
	}

	function selectSenateur(id: string) {
		goto(`/senat/senateurs/${id}/?session=${data.sessionCourante}`);
	}

	function basculerSession(sesann: number) {
		goto(`/senat/sessions/${sesann}/`);
	}

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
	}

	function truncate(s: string, n: number): string {
		return s.length > n ? s.slice(0, n - 1) + '…' : s;
	}

	function libelleSession(sesann: number): string {
		return `${sesann}-${(sesann + 1).toString().slice(-2)}`;
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
	<title>Session {libelleSession(data.sessionCourante)} — Sénat — PolitiDex</title>
</svelte:head>

<svelte:window onmousemove={trackCursor} />

<section class="max-w-7xl mx-auto px-6 py-8">
	<div class="mb-6 flex flex-wrap items-end justify-between gap-3">
		<div>
			<h1 class="title-display text-4xl sm:text-5xl tracking-wider">
				Sénat · {libelleSession(data.sessionCourante)}
			</h1>
			<p class="text-assembly-muted mt-1">
				{senateursSession.length} sénateurs ayant siégé cette session.
			</p>
		</div>
		<div class="flex flex-col items-end gap-2 text-xs">
			<div class="flex items-center gap-1 flex-wrap justify-end max-w-md">
				<span class="text-assembly-muted">Session :</span>
				{#each sessionsSorted.slice(0, 8) as sess (sess.sesann)}
					<button
						class="px-2 py-1 rounded text-[11px] {sess.sesann === data.sessionCourante
							? 'bg-assembly-accent text-assembly-bg font-semibold'
							: 'border border-assembly-border text-assembly-muted hover:text-slate-200'}"
						onclick={() => basculerSession(sess.sesann)}
					>
						{libelleSession(sess.sesann)}
					</button>
				{/each}
			</div>
			<HemicycleColorToggle />
		</div>
	</div>

	<div class="card p-4 sm:p-6 mb-6">
		<HemicycleSenat
			senateurs={senateursSession}
			sesann={data.sessionCourante}
			mode={{ kind: colorMode.current, groupes: data.groupes }}
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
				sesann={data.sessionCourante}
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
			<a href="/senat/scrutins/" class="text-xs text-assembly-muted hover:text-assembly-accent">
				Voir tous les scrutins →
			</a>
		</div>
		{#if recentScrutins.length === 0}
			<div class="card p-6 text-sm text-assembly-muted text-center italic">
				Aucun scrutin disponible pour cette session.
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
