<script lang="ts">
	/**
	 * Fiche d'un groupe politique Sénat scopé par triennat (cf ADR 0028, 0016 transposée).
	 *
	 * Reconstruit les membres côté front à partir des `Senateur[]` filtrés sur le
	 * mandat couvrant le triennat, avec dernière appartenance pointant vers ce groupe.
	 */
	import HemicycleSenat from '$lib/components/HemicycleSenat.svelte';
	import MiniSenateurCard from '$lib/components/MiniSenateurCard.svelte';
	import SenateurRow from '$lib/components/SenateurRow.svelte';
	import InfoTip from '$lib/components/InfoTip.svelte';
	import { goto } from '$app/navigation';
	import type { Senateur, MandatSenat, TriennatStats } from '$lib/types';

	let { data } = $props();

	type SortKey = 'nom' | 'loyaute' | 'presence' | 'frondes';
	let sortKey: SortKey = $state('nom');
	let search = $state('');
	let hovered: string | null = $state(null);
	let cursorX = $state(0);
	let cursorY = $state(0);

	function mandatPourTriennat(s: Senateur): MandatSenat | null {
		for (const m of s.mandats) {
			if (m.triennats.some((t) => t.triennat === data.triennat)) return m;
		}
		return null;
	}

	function triennatStats(s: Senateur): TriennatStats | null {
		const m = mandatPourTriennat(s);
		if (!m) return null;
		return m.triennats.find((t) => t.triennat === data.triennat) ?? null;
	}

	/** Membre du groupe pour ce triennat : dernière appartenance du mandat pointe ici. */
	function estMembre(s: Senateur): boolean {
		const m = mandatPourTriennat(s);
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
				mandat: mandatPourTriennat(s),
				triennat: triennatStats(s)
			}))
			.filter((x): x is { senateur: Senateur; mandat: MandatSenat; triennat: TriennatStats } =>
				!!x.mandat && !!x.triennat
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
				sorted.sort((a, b) => a.senateur.identite.nom.localeCompare(b.senateur.identite.nom));
				break;
			case 'loyaute':
				sorted.sort(
					(a, b) =>
						(b.triennat.stats.loyaute.rate ?? 0) - (a.triennat.stats.loyaute.rate ?? 0)
				);
				break;
			case 'presence':
				sorted.sort((a, b) => b.triennat.stats.presence.rate - a.triennat.stats.presence.rate);
				break;
			case 'frondes':
				sorted.sort((a, b) => b.triennat.stats.frondes.count - a.triennat.stats.frondes.count);
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
			s.mandats.some((m) => m.triennats.some((t) => t.triennat === data.triennat))
		)
	);

	const hoveredSenateur = $derived(hovered ? senateurById.get(hovered) ?? null : null);

	function trackCursor(e: MouseEvent) {
		cursorX = e.clientX;
		cursorY = e.clientY;
	}

	function selectSenateur(id: string) {
		goto(`/senat/senateurs/${id}/?triennat=${data.triennat}`);
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
		href="/senat/triennats/{data.triennat}/"
		class="text-sm text-assembly-muted hover:text-assembly-accent inline-flex items-center gap-1"
	>
		← Triennat {data.triennat}
	</a>

	<div class="card p-6" style="border-left: 4px solid {data.groupe.couleur}">
		<div class="flex items-start justify-between gap-4 mb-3">
			<div class="min-w-0 flex-1">
				<div class="text-xs uppercase tracking-widest text-assembly-muted mb-1">
					Triennat {data.triennat} · {data.groupe.libelleAbrege}
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
							href="/senat/senateurs/{president.id}/?triennat={data.triennat}"
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
						Moyenne des Overall individuels des membres du groupe pour ce triennat
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
			triennat={data.triennat}
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
			Les places non colorées sont celles des autres groupes pour ce triennat.
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
				triennat={data.triennat}
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
				{#each filteredMembers as { senateur, mandat, triennat } (senateur.id)}
					<SenateurRow
						{senateur}
						{mandat}
						{triennat}
						highlight={highlight()}
						isPresident={president?.id === senateur.id}
					/>
				{/each}
			</div>
		{/if}
	</div>
</section>
