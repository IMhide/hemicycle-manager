<script lang="ts">
	import Hemicycle from '$lib/components/Hemicycle.svelte';
	import VoteLegend from '$lib/components/VoteLegend.svelte';
	import GroupVoteBar from '$lib/components/GroupVoteBar.svelte';
	import FrondeurCard from '$lib/components/FrondeurCard.svelte';
	import InfoTip from '$lib/components/InfoTip.svelte';

	let { data } = $props();

	let hovered: string | null = $state(null);

	const deputeById = $derived.by(() => {
		const m = new Map<string, (typeof data.deputes)[number]>();
		for (const d of data.deputes) m.set(d.id, d);
		return m;
	});
	const groupeById = $derived.by(() => {
		const m = new Map<string, (typeof data.groupes)[number]>();
		for (const g of data.groupes) m.set(g.id, g);
		return m;
	});

	const detail = $derived(data.detail);

	// Sort group bars by political order (left to right) for readability.
	const sortedGroupes = $derived.by(() => {
		// We use the rank from political-order via Groupe.preseance is *not*
		// the same — instead we use the official preseance (Assembly's order).
		return [...detail.groupes]
			.map((g) => ({ ...g, groupe: groupeById.get(g.id) }))
			.filter((g) => g.groupe)
			.sort((a, b) => (a.groupe!.preseance ?? 99) - (b.groupe!.preseance ?? 99));
	});

	const frondeurs = $derived.by(() => {
		const list: Array<{
			depute: (typeof data.deputes)[number];
			groupe: (typeof data.groupes)[number] | null;
			position: 'pour' | 'contre';
			positionMajoritaireGroupe: string;
		}> = [];
		const groupeMajById = new Map<string, string>();
		for (const g of detail.groupes) groupeMajById.set(g.id, g.positionMajoritaire);
		for (const id of detail.frondeurs) {
			const depute = deputeById.get(id);
			if (!depute) continue;
			const groupe = depute.groupeId ? groupeById.get(depute.groupeId) ?? null : null;
			const position = detail.votes[id];
			if (position !== 'pour' && position !== 'contre') continue;
			const maj = depute.groupeId ? groupeMajById.get(depute.groupeId) ?? '' : '';
			list.push({ depute, groupe, position, positionMajoritaireGroupe: maj });
		}
		// Sort by group, then alphabetical
		return list.sort((a, b) => {
			const gA = a.groupe?.preseance ?? 99;
			const gB = b.groupe?.preseance ?? 99;
			if (gA !== gB) return gA - gB;
			return a.depute.nom.localeCompare(b.depute.nom);
		});
	});

	const hoveredDepute = $derived(hovered ? deputeById.get(hovered) : null);
	const hoveredGroupe = $derived(
		hoveredDepute?.groupeId ? groupeById.get(hoveredDepute.groupeId) : null
	);
	const hoveredVote = $derived(hovered ? detail.votes[hovered] ?? 'absent' : null);

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('fr-FR', {
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
	}

	// Find prev/next scrutin in chronological index for navigation
	const navigation = $derived.by(() => {
		const i = data.index.findIndex((s) => s.uid === detail.uid);
		return {
			prev: i > 0 ? data.index[i - 1] : null,        // index is most-recent first → prev = newer
			next: i < data.index.length - 1 ? data.index[i + 1] : null
		};
	});
</script>

<svelte:head>
	<title>Scrutin n°{detail.numero} — Hémicycle Manager</title>
</svelte:head>

<section class="max-w-7xl mx-auto px-6 py-8 space-y-6">
	<a href="/" class="text-sm text-assembly-muted hover:text-assembly-accent inline-flex items-center gap-1">
		← Tous les scrutins
	</a>

	<!-- Header card -->
	<div class="card p-6">
		<div class="flex items-start justify-between gap-4 mb-3">
			<div class="min-w-0 flex-1">
				<div class="text-xs uppercase tracking-widest text-assembly-muted mb-1">
					Scrutin n°{detail.numero} · {formatDate(detail.date)}
				</div>
				<h1 class="text-xl sm:text-2xl leading-snug font-semibold">{detail.titre}</h1>
				<div class="text-xs text-assembly-muted mt-2">
					{detail.typeVote}
				</div>
			</div>
			<div
				class="title-display text-2xl px-4 py-2 rounded-md whitespace-nowrap {detail.sort ===
				'adopté'
					? 'bg-vote-pour/20 text-vote-pour'
					: detail.sort === 'rejeté'
						? 'bg-vote-contre/20 text-vote-contre'
						: 'bg-assembly-border text-assembly-muted'}"
			>
				{detail.sort}
			</div>
		</div>
		{#if detail.demandeur}
			<div class="text-xs text-assembly-muted">Demandé par : {detail.demandeur}</div>
		{/if}
	</div>

	<!-- Hémicycle XL -->
	<div class="card p-4 sm:p-6">
		<Hemicycle
			deputes={data.deputes}
			mode={{ kind: 'vote', votes: detail.votes, groupes: data.groupes }}
			{hovered}
			onhover={(id) => (hovered = id)}
		/>
		<div class="mt-4">
			<VoteLegend pour={detail.pour} contre={detail.contre} abstention={detail.abstention} />
		</div>

		{#if hoveredDepute}
			<div class="absolute top-4 left-4 card px-4 py-3 pointer-events-none shadow-2xl text-sm hidden md:block">
				<div class="font-semibold">{hoveredDepute.prenom} {hoveredDepute.nom}</div>
				{#if hoveredGroupe}
					<div class="flex items-center gap-1.5 mt-0.5 text-xs">
						<span
							class="w-2 h-2 rounded-full"
							style="background-color: {hoveredGroupe.couleur}"
						></span>
						<span>{hoveredGroupe.libelleAbrege}</span>
					</div>
				{/if}
				{#if hoveredVote}
					<div class="mt-1 title-display text-sm">→ {hoveredVote}</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Ventilation par groupe -->
	<div class="card p-6">
		<h2 class="title-display text-xl mb-4 flex items-center gap-2">
			Ventilation par groupe
		</h2>
		<div class="space-y-2">
			{#each sortedGroupes as g (g.id)}
				{#if g.groupe}
					<GroupVoteBar
						groupe={g.groupe}
						decompte={g.decompte}
						positionMajoritaire={g.positionMajoritaire}
					/>
				{/if}
			{/each}
		</div>
	</div>

	<!-- Frondeurs -->
	<div class="card p-6">
		<div class="flex items-baseline gap-3 mb-4">
			<h2 class="title-display text-xl flex items-center gap-2">
				🔥 Frondeurs
				<InfoTip title="Frondeur">
					Un <strong>frondeur</strong> est un député qui a voté <strong>différemment</strong>
					de la position majoritaire de son groupe sur ce scrutin.
					<br /><br />
					On ne compte que les votes <em>exprimés</em> (pour ou contre) opposés à la majorité du groupe.
					Les abstentions individuelles ne sont pas considérées comme une fronde.
				</InfoTip>
			</h2>
			<span class="text-assembly-muted">
				{frondeurs.length} député{frondeurs.length > 1 ? 's' : ''} contre la ligne du groupe
			</span>
		</div>

		{#if frondeurs.length === 0}
			<div class="text-sm text-assembly-muted italic">
				Aucun frondeur sur ce scrutin — toutes les positions individuelles s'alignent sur les majorités de groupe.
			</div>
		{:else}
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
				{#each frondeurs as f (f.depute.id)}
					<FrondeurCard
						depute={f.depute}
						groupe={f.groupe}
						position={f.position}
						positionMajoritaireGroupe={f.positionMajoritaireGroupe}
					/>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Navigation -->
	<div class="flex justify-between gap-4 pt-2">
		{#if navigation.next}
			<a href="/scrutins/{navigation.next.uid}/" class="btn-ghost text-sm flex-1 max-w-xs">
				← Scrutin n°{navigation.next.numero}
				<div class="text-xs text-assembly-muted truncate">{navigation.next.titre}</div>
			</a>
		{:else}
			<div></div>
		{/if}
		{#if navigation.prev}
			<a
				href="/scrutins/{navigation.prev.uid}/"
				class="btn-ghost text-sm flex-1 max-w-xs text-right"
			>
				Scrutin n°{navigation.prev.numero} →
				<div class="text-xs text-assembly-muted truncate">{navigation.prev.titre}</div>
			</a>
		{/if}
	</div>
</section>
