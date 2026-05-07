<script lang="ts">
	/**
	 * Fiche d'un groupe politique scopé par législature (cf ADR 0015, 0016).
	 * On reconstruit les top membres côté front à partir des `Personne[]` filtrées
	 * sur le mandat de la législature courante. Pas de stats agrégées de groupe
	 * (cohésion, etc.) en Phase 1 — à ajouter au pipeline si besoin.
	 */
	import Hemicycle from '$lib/components/Hemicycle.svelte';
	import MemberRow from '$lib/components/MemberRow.svelte';
	import InfoTip from '$lib/components/InfoTip.svelte';
	import { POLITICAL_ORDER } from '$lib/political-order';
	import type { Personne, Mandat } from '$lib/types';

	let { data } = $props();

	type SortKey = 'nom' | 'loyaute' | 'presence' | 'frondes';
	let sortKey: SortKey = $state('nom');
	let search = $state('');

	function mandatLeg(p: Personne): Mandat | null {
		return p.mandats.find((m) => m.legislature === data.legislature) ?? null;
	}

	/** Une personne est membre du groupe si une de ses appartenances dans le
	 *  mandat de la législature pointe vers ce groupe (peut être passée). */
	function aAppartenuAuGroupe(p: Personne): boolean {
		const m = mandatLeg(p);
		if (!m) return false;
		return m.appartenancesGroupe.some((a) => a.groupeId === data.groupe.id);
	}

	/** Membre actuel = appartenance la plus récente non-NI-transitoire pointe vers ce groupe. */
	function estMembreActuel(p: Personne): boolean {
		const m = mandatLeg(p);
		if (!m) return false;
		for (let i = m.appartenancesGroupe.length - 1; i >= 0; i--) {
			const a = m.appartenancesGroupe[i];
			if (a.isTransitoireNI) continue;
			return a.groupeId === data.groupe.id;
		}
		return false;
	}

	const president = $derived(
		data.groupe.presidentId
			? data.personnes.find((p) => p.id === data.groupe.presidentId) ?? null
			: null
	);

	const personnesAyantAppartenu = $derived(data.personnes.filter(aAppartenuAuGroupe));
	const membresActuels = $derived(data.personnes.filter(estMembreActuel));

	const enrichedMembers = $derived.by(() =>
		personnesAyantAppartenu.map((p) => ({
			personne: p,
			mandat: mandatLeg(p)!
		}))
	);

	const filteredMembers = $derived.by(() => {
		const q = search.trim().toLowerCase();
		const filtered = q
			? enrichedMembers.filter((m) =>
					`${m.personne.identite.prenom} ${m.personne.identite.nom}`.toLowerCase().includes(q)
				)
			: enrichedMembers;

		const sorted = [...filtered];
		switch (sortKey) {
			case 'nom':
				sorted.sort((a, b) => a.personne.identite.nom.localeCompare(b.personne.identite.nom));
				break;
			case 'loyaute':
				sorted.sort(
					(a, b) => (b.mandat.stats.loyaute.rate ?? 0) - (a.mandat.stats.loyaute.rate ?? 0)
				);
				break;
			case 'presence':
				sorted.sort((a, b) => b.mandat.stats.presence.rate - a.mandat.stats.presence.rate);
				break;
			case 'frondes':
				sorted.sort((a, b) => b.mandat.stats.frondes.count - a.mandat.stats.frondes.count);
				break;
		}
		return sorted;
	});

	const topLoyalistes = $derived(
		[...enrichedMembers]
			.filter((m) => m.mandat.stats.loyaute.rate !== null)
			.sort((a, b) => (b.mandat.stats.loyaute.rate ?? 0) - (a.mandat.stats.loyaute.rate ?? 0))
			.slice(0, 5)
	);

	const topFrondeurs = $derived(
		[...enrichedMembers]
			.filter((m) => m.mandat.stats.frondes.count > 0)
			.sort((a, b) => b.mandat.stats.frondes.count - a.mandat.stats.frondes.count)
			.slice(0, 5)
	);

	const topPresence = $derived(
		[...enrichedMembers]
			.sort((a, b) => b.mandat.stats.presence.rate - a.mandat.stats.presence.rate)
			.slice(0, 5)
	);

	const politicalRank = $derived(POLITICAL_ORDER[data.groupe.libelleAbrege] ?? null);

	const personnesPourHemicycle = $derived(
		data.personnes.filter((p) => p.mandats.some((m) => m.legislature === data.legislature))
	);
</script>

<svelte:head>
	<title>{data.groupe.libelle} ({data.legislature}ᵉ) — PolitiDex</title>
</svelte:head>

<section class="max-w-7xl mx-auto px-6 py-8 space-y-6">
	<a
		href="/assemblee/groupes/"
		class="text-sm text-assembly-muted hover:text-assembly-accent inline-flex items-center gap-1"
	>
		← Tous les groupes
	</a>

	<div
		class="card p-6 relative overflow-hidden"
		style="background: linear-gradient(120deg, {data.groupe.couleur}22 0%, transparent 60%), #1e293b;"
	>
		<div class="flex items-start justify-between gap-6 flex-wrap">
			<div class="flex items-center gap-4 min-w-0">
				<div
					class="w-14 h-14 rounded-xl flex-shrink-0 flex items-center justify-center title-display text-xl"
					style="background-color: {data.groupe.couleur}; color: white;"
				>
					{data.groupe.libelleAbrege.slice(0, 4)}
				</div>
				<div class="min-w-0">
					<h1 class="title-display text-3xl sm:text-4xl leading-tight">{data.groupe.libelle}</h1>
					<div class="text-sm text-assembly-muted mt-1">
						{data.groupe.libelleAbrege} · {data.legislature}<sup>e</sup> législature ·
						{data.groupe.effectifFin} député{data.groupe.effectifFin > 1 ? 's' : ''}
						{#if politicalRank}
							· Position politique : rang {politicalRank.rank}/12
						{/if}
					</div>
				</div>
			</div>

			{#if president}
				<a
					href="/assemblee/deputes/{president.id}/?leg={data.legislature}"
					class="card flex items-center gap-3 px-3 py-2 hover:border-assembly-accent/60"
				>
					<img
						src={president.identite.photoUrl}
						alt=""
						class="w-10 h-10 rounded-full object-cover bg-assembly-border"
						loading="lazy"
						referrerpolicy="no-referrer"
					/>
					<div>
						<div class="text-[10px] uppercase tracking-widest text-assembly-muted">⭐ Président</div>
						<div class="text-sm font-semibold">
							{president.identite.prenom}
							{president.identite.nom}
						</div>
					</div>
				</a>
			{/if}
		</div>

		{#if politicalRank}
			<div class="mt-4 text-xs text-assembly-muted">
				{#if politicalRank.chesScore !== null}
					Score CHES 2024 : <span class="text-assembly-text font-semibold">
						{politicalRank.chesScore.toFixed(2)}/10
					</span>
					·
				{/if}
				<span class="italic">{politicalRank.rationale}</span>
			</div>
		{/if}

		<div class="mt-3 text-xs text-assembly-muted">
			<strong>{membresActuels.length}</strong> membre{membresActuels.length > 1 ? 's' : ''} actuel{membresActuels.length >
			1
				? 's'
				: ''} · <strong>{personnesAyantAppartenu.length}</strong> personne{personnesAyantAppartenu.length >
			1
				? 's'
				: ''} y a appartenu sur cette législature
		</div>
	</div>

	<div class="card p-4 sm:p-6">
		<h2 class="title-display text-xl mb-4">Sièges dans l'hémicycle</h2>
		<Hemicycle
			personnes={personnesPourHemicycle}
			legislature={data.legislature}
			mode={{ kind: 'highlight-groupe', groupeId: data.groupe.id, groupes: data.groupes }}
		/>
	</div>

	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
		<div class="card p-4">
			<h3 class="title-display text-base mb-3 flex items-center gap-2">
				🎯 Top présence
				<InfoTip title="Top présence" size="xs">
					Membres physiquement présents au plus de scrutins (vote exprimé, abstention ou non-votant).
				</InfoTip>
			</h3>
			{#if topPresence.length === 0}
				<div class="text-sm text-assembly-muted italic">Pas assez de données.</div>
			{:else}
				<div class="space-y-1.5">
					{#each topPresence as p (p.personne.id)}
						<MemberRow
							personne={p.personne}
							mandat={p.mandat}
							highlight="presence"
							isPresident={p.personne.id === data.groupe.presidentId}
						/>
					{/each}
				</div>
			{/if}
		</div>

		<div class="card p-4">
			<h3 class="title-display text-base mb-3 flex items-center gap-2">
				🤝 Top loyalistes
				<InfoTip title="Loyalistes" size="xs">
					Membres alignés le plus souvent avec la majorité du groupe.
				</InfoTip>
			</h3>
			{#if topLoyalistes.length === 0}
				<div class="text-sm text-assembly-muted italic">Pas assez de données.</div>
			{:else}
				<div class="space-y-1.5">
					{#each topLoyalistes as l (l.personne.id)}
						<MemberRow
							personne={l.personne}
							mandat={l.mandat}
							highlight="loyaute"
							isPresident={l.personne.id === data.groupe.presidentId}
						/>
					{/each}
				</div>
			{/if}
		</div>

		<div class="card p-4">
			<h3 class="title-display text-base mb-3 flex items-center gap-2">
				🔥 Top frondeurs
				<InfoTip title="Frondeurs" size="xs">
					Membres ayant le plus voté <strong>contre la position majoritaire</strong> du groupe au moment du vote (cf ADR 0016).
				</InfoTip>
			</h3>
			{#if topFrondeurs.length === 0}
				<div class="text-sm text-assembly-muted italic">Aucun frondeur identifié.</div>
			{:else}
				<div class="space-y-1.5">
					{#each topFrondeurs as f (f.personne.id)}
						<MemberRow
							personne={f.personne}
							mandat={f.mandat}
							highlight="frondes"
							isPresident={f.personne.id === data.groupe.presidentId}
						/>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<div class="card p-4">
		<div class="flex items-center justify-between gap-3 mb-4 flex-wrap">
			<h2 class="title-display text-xl">Tous les membres ({enrichedMembers.length})</h2>
			<div class="flex items-center gap-2">
				<input
					type="search"
					bind:value={search}
					placeholder="Rechercher…"
					class="bg-assembly-bg border border-assembly-border rounded-md px-3 py-1 text-sm w-48"
				/>
				<select
					bind:value={sortKey}
					class="bg-assembly-bg border border-assembly-border rounded-md px-2 py-1 text-sm"
				>
					<option value="nom">Trier : nom</option>
					<option value="loyaute">Trier : loyauté</option>
					<option value="presence">Trier : présence</option>
					<option value="frondes">Trier : frondes</option>
				</select>
			</div>
		</div>

		{#if filteredMembers.length === 0}
			<div class="text-sm text-assembly-muted italic py-6 text-center">
				Aucun député ne correspond.
			</div>
		{:else}
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-2">
				{#each filteredMembers as m (m.personne.id)}
					<MemberRow
						personne={m.personne}
						mandat={m.mandat}
						highlight={sortKey === 'nom' ? null : sortKey}
						isPresident={m.personne.id === data.groupe.presidentId}
					/>
				{/each}
			</div>
		{/if}
	</div>
</section>
