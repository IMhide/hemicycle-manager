<script lang="ts">
	/**
	 * Fiche d'un groupe politique Sénat scopé par session (cf ADR 0023, 0016 transposée).
	 *
	 * Reconstruit les membres côté front à partir des `Senateur[]` filtrés sur le
	 * mandat couvrant la session, avec dernière appartenance pointant vers ce groupe.
	 */
	import HemicycleSenat from '$lib/components/HemicycleSenat.svelte';
	import MiniSenateurCard from '$lib/components/MiniSenateurCard.svelte';
	import SenateurRow from '$lib/components/SenateurRow.svelte';
	import InfoTip from '$lib/components/InfoTip.svelte';
	import { goto } from '$app/navigation';
	import type { Senateur, MandatSenat, GroupeSenat, SessionStats } from '$lib/types';

	let { data } = $props();

	type SortKey = 'nom' | 'loyaute' | 'presence' | 'frondes';
	let sortKey: SortKey = $state('nom');
	let search = $state('');
	let hovered: string | null = $state(null);
	let cursorX = $state(0);
	let cursorY = $state(0);

	function mandatPourSession(s: Senateur): MandatSenat | null {
		for (const m of s.mandats) {
			if (m.sessions.some((sess) => sess.sesann === data.sesann)) return m;
		}
		return null;
	}

	function sessionStats(s: Senateur): SessionStats | null {
		const m = mandatPourSession(s);
		if (!m) return null;
		return m.sessions.find((sess) => sess.sesann === data.sesann) ?? null;
	}

	/** Membre du groupe pour cette session : dernière appartenance du mandat pointe ici. */
	function estMembre(s: Senateur): boolean {
		const m = mandatPourSession(s);
		if (!m) return false;
		const lastApp = m.appartenancesGroupe.at(-1);
		return lastApp?.groupeCode === data.groupe.code;
	}

	const president = $derived(
		data.groupe.presidentMatricule
			? data.senateurs.find((s) => s.id === data.groupe.presidentMatricule) ?? null
			: null
	);

	const membres = $derived(data.senateurs.filter(estMembre));

	const enrichedMembers = $derived.by(() =>
		membres
			.map((s) => ({
				senateur: s,
				mandat: mandatPourSession(s),
				session: sessionStats(s)
			}))
			.filter((x): x is { senateur: Senateur; mandat: MandatSenat; session: SessionStats } =>
				!!x.mandat && !!x.session
			)
	);

	const filteredMembers = $derived.by(() => {
		const q = search.trim().toLowerCase();
		const filtered = q
			? enrichedMembers.filter((m) =>
					`${m.senateur.identite.prenom} ${m.senateur.identite.nom}`.toLowerCase().includes(q)
				)
			: enrichedMembers;

		const sorted = [...filtered];
		switch (sortKey) {
			case 'nom':
				sorted.sort((a, b) =>
					a.senateur.identite.nom.localeCompare(b.senateur.identite.nom)
				);
				break;
			case 'loyaute':
				sorted.sort(
					(a, b) => (b.session.stats.loyaute.rate ?? 0) - (a.session.stats.loyaute.rate ?? 0)
				);
				break;
			case 'presence':
				sorted.sort((a, b) => b.session.stats.presence.rate - a.session.stats.presence.rate);
				break;
			case 'frondes':
				sorted.sort((a, b) => b.session.stats.frondes.count - a.session.stats.frondes.count);
				break;
		}
		return sorted;
	});

	const senateurById = $derived.by(() => {
		const m = new Map<string, Senateur>();
		for (const s of data.senateurs) m.set(s.id, s);
		return m;
	});

	const senateursPourHemicycle = $derived(
		data.senateurs.filter((s) =>
			s.mandats.some((m) => m.sessions.some((sess) => sess.sesann === data.sesann))
		)
	);

	const hoveredSenateur = $derived(hovered ? senateurById.get(hovered) ?? null : null);

	function trackCursor(e: MouseEvent) {
		cursorX = e.clientX;
		cursorY = e.clientY;
	}

	function selectSenateur(id: string) {
		goto(`/senat/senateurs/${id}/?session=${data.sesann}`);
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

	const groupesAllSenat = $derived([data.groupe]);

	function highlight(): 'loyaute' | 'frondes' | 'presence' | null {
		if (sortKey === 'loyaute') return 'loyaute';
		if (sortKey === 'frondes') return 'frondes';
		if (sortKey === 'presence') return 'presence';
		return null;
	}
</script>

<svelte:head>
	<title>{data.groupe.libelleAbrege} — Sénat — PolitiDex</title>
</svelte:head>

<svelte:window onmousemove={trackCursor} />

<section class="max-w-7xl mx-auto px-6 py-8 space-y-6">
	<a
		href="/senat/sessions/{data.sesann}/"
		class="text-sm text-assembly-muted hover:text-assembly-accent inline-flex items-center gap-1"
	>
		← Session {libelleSession(data.sesann)}
	</a>

	<div class="card p-6" style="border-left: 4px solid {data.groupe.couleur}">
		<div class="flex items-start justify-between gap-4 mb-3">
			<div class="min-w-0 flex-1">
				<div class="text-xs uppercase tracking-widest text-assembly-muted mb-1">
					Session {libelleSession(data.sesann)} · {data.groupe.libelleAbrege}
				</div>
				<h1
					class="text-xl sm:text-2xl leading-snug font-semibold"
					style="color: {data.groupe.couleur}"
				>
					{data.groupe.libelle}
				</h1>
				{#if president}
					<div class="text-xs text-assembly-muted mt-2">
						Président·e :
						<a
							href="/senat/senateurs/{president.id}/?session={data.sesann}"
							class="hover:text-assembly-accent"
						>
							{president.identite.prenom}
							{president.identite.nom}
						</a>
					</div>
				{/if}
			</div>
		</div>
		<div class="grid grid-cols-3 gap-4 text-sm mt-4 pt-3 border-t border-assembly-border/40">
			<div>
				<div class="title-display text-2xl">{data.groupe.effectifFin}</div>
				<div class="text-xs text-assembly-muted">Sénateur·rice·s</div>
			</div>
			<div>
				<div class="title-display text-2xl">{data.groupe.overallMoyen}</div>
				<div class="text-xs text-assembly-muted flex items-center gap-1">
					Overall moyen
					<InfoTip title="Overall moyen du groupe" size="xs">
						Moyenne des Overall individuels des membres du groupe pour cette session
						(cf <a
							href="https://github.com/IMhide/hemicycle-manager/blob/main/decisions/0022-score-overall.md"
							class="underline">ADR 0022</a
						>).
					</InfoTip>
				</div>
			</div>
			<div>
				<div class="title-display text-2xl">{data.groupe.preseance}</div>
				<div class="text-xs text-assembly-muted">Préséance gauche-droite</div>
			</div>
		</div>
	</div>

	<div class="card p-4 sm:p-6">
		<HemicycleSenat
			senateurs={senateursPourHemicycle}
			sesann={data.sesann}
			mode={{
				kind: 'highlight-groupe',
				groupeCode: data.groupe.code,
				groupes: groupesAllSenat
			}}
			{hovered}
			onhover={(id) => (hovered = id)}
			onselect={(id) => selectSenateur(id)}
		/>
		<div class="text-[10px] text-assembly-muted text-center mt-2 italic">
			Les places non colorées sont celles des autres groupes pour cette session.
		</div>
	</div>

	{#if hoveredSenateur}
		<div
			class="fixed z-50 pointer-events-none transition-opacity duration-100"
			style="left: {tooltipPos.left}px; top: {tooltipPos.top}px; opacity: 0.98;"
		>
			<MiniSenateurCard
				senateur={hoveredSenateur}
				groupe={data.groupe}
				sesann={data.sesann}
			/>
		</div>
	{/if}

	<div class="card p-4 sm:p-6">
		<div class="flex items-center justify-between gap-3 mb-4 flex-wrap">
			<h2 class="title-display text-xl">
				Membres
				<span class="text-sm text-assembly-muted">— {filteredMembers.length}</span>
			</h2>
			<div class="flex items-center gap-2 text-xs">
				<input
					type="search"
					bind:value={search}
					placeholder="Rechercher un nom…"
					class="bg-assembly-bg border border-assembly-border rounded-md px-3 py-1.5"
				/>
				<select
					bind:value={sortKey}
					class="bg-assembly-bg border border-assembly-border rounded-md px-2 py-1.5"
				>
					<option value="nom">Nom (A→Z)</option>
					<option value="presence">Présence ↓</option>
					<option value="loyaute">Loyauté ↓</option>
					<option value="frondes">Frondes ↓</option>
				</select>
			</div>
		</div>

		{#if filteredMembers.length === 0}
			<div class="text-sm text-assembly-muted italic py-8 text-center">
				Aucun membre ne correspond.
			</div>
		{:else}
			<div class="grid grid-cols-1 xl:grid-cols-2 gap-2">
				{#each filteredMembers as { senateur, mandat, session } (senateur.id)}
					<SenateurRow
						{senateur}
						{mandat}
						{session}
						highlight={highlight()}
						isPresident={president?.id === senateur.id}
					/>
				{/each}
			</div>
		{/if}
	</div>
</section>
