<script lang="ts">
	/**
	 * Fiche scrutin. Affiche pour chaque frondeur son groupe **au moment du vote**
	 * (cf ADR 0016). Le groupe est résolu via l'appartenance qui couvre la date du scrutin.
	 */
	import Hemicycle from '$lib/components/Hemicycle.svelte';
	import VoteLegend from '$lib/components/VoteLegend.svelte';
	import GroupVoteBar from '$lib/components/GroupVoteBar.svelte';
	import FrondeurCard from '$lib/components/FrondeurCard.svelte';
	import InfoTip from '$lib/components/InfoTip.svelte';
	import VoteSearchBox from '$lib/components/VoteSearchBox.svelte';
	import type { VoteEntry } from '$lib/components/VoteSearchBox.types';
	import { lookupEluUrlForPaIdLeg } from '$lib/elus';
	import type { Personne, Groupe, AppartenanceGroupe } from '$lib/types';

	let { data } = $props();

	let hovered: string | null = $state(null);

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

	const detail = $derived(data.detail);

	/** Appartenance d'une personne à la date du scrutin (cf ADR 0016). */
	function appartenanceAuVote(p: Personne): AppartenanceGroupe | null {
		const m = p.mandats.find((md) => md.legislature === detail.legislature);
		if (!m) return null;
		for (const a of m.appartenancesGroupe) {
			if (a.dateDebut <= detail.date && (a.dateFin === null || a.dateFin >= detail.date)) {
				return a;
			}
		}
		return m.appartenancesGroupe.at(-1) ?? null;
	}

	function groupeAuVote(p: Personne): Groupe | null {
		const a = appartenanceAuVote(p);
		return a ? groupeById.get(a.groupeId) ?? null : null;
	}

	const sortedGroupes = $derived.by(() => {
		return [...detail.groupes]
			.map((g) => ({ ...g, groupe: groupeById.get(g.id) }))
			.filter((g) => g.groupe)
			.sort((a, b) => (a.groupe!.preseance ?? 99) - (b.groupe!.preseance ?? 99));
	});

	const frondeurs = $derived.by(() => {
		const list: Array<{
			personne: Personne;
			groupe: Groupe | null;
			position: 'pour' | 'contre';
			positionMajoritaireGroupe: string;
		}> = [];
		const groupeMajById = new Map<string, string>();
		for (const g of detail.groupes) groupeMajById.set(g.id, g.positionMajoritaire);
		for (const id of detail.frondeurs) {
			const personne = personneById.get(id);
			if (!personne) continue;
			const app = appartenanceAuVote(personne);
			const groupe = app ? groupeById.get(app.groupeId) ?? null : null;
			const position = detail.votes[id];
			if (position !== 'pour' && position !== 'contre') continue;
			const maj = app ? groupeMajById.get(app.groupeId) ?? '' : '';
			list.push({ personne, groupe, position, positionMajoritaireGroupe: maj });
		}
		return list.sort((a, b) => {
			const gA = a.groupe?.preseance ?? 99;
			const gB = b.groupe?.preseance ?? 99;
			if (gA !== gB) return gA - gB;
			return a.personne.identite.nom.localeCompare(b.personne.identite.nom);
		});
	});

	const personnesPourHemicycle = $derived(
		data.personnes.filter((p) => p.mandats.some((m) => m.legislature === detail.legislature))
	);

	const voteEntries = $derived.by(() => {
		const out: VoteEntry[] = [];
		for (const p of personnesPourHemicycle) {
			const position = detail.votes[p.id] ?? 'absent';
			const groupe = groupeAuVote(p);
			out.push({
				id: p.id,
				prenom: p.identite.prenom,
				nom: p.identite.nom,
				groupeLibelle: groupe?.libelleAbrege ?? '',
				groupeCouleur: groupe?.couleur ?? null,
				position,
				href: lookupEluUrlForPaIdLeg(p.id, detail.legislature)
			});
		}
		return out;
	});

	const hoveredPersonne = $derived(hovered ? personneById.get(hovered) ?? null : null);
	const hoveredGroupe = $derived(hoveredPersonne ? groupeAuVote(hoveredPersonne) : null);
	const hoveredVote = $derived(hovered ? detail.votes[hovered] ?? 'absent' : null);

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('fr-FR', {
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
	}

	const navigation = $derived.by(() => {
		const i = data.index.findIndex((s) => s.uid === detail.uid);
		return {
			prev: i > 0 ? data.index[i - 1] : null,
			next: i < data.index.length - 1 ? data.index[i + 1] : null
		};
	});

	const totalEffectif = $derived.by(() => {
		const legGroupes = data.groupes.filter((g) => g.legislature === detail.legislature);
		return legGroupes.reduce((acc, g) => acc + g.effectifFin, 0);
	});
</script>

<svelte:head>
	<title>Scrutin n°{detail.numero} — PolitiDex</title>
</svelte:head>

<section class="max-w-7xl mx-auto px-6 py-8 space-y-6">
	<a
		href="/assemblee/scrutins/"
		class="text-sm text-assembly-muted hover:text-assembly-accent inline-flex items-center gap-1"
	>
		← Tous les scrutins
	</a>

	<div class="card p-6">
		<div class="flex items-start justify-between gap-4 mb-3">
			<div class="min-w-0 flex-1">
				<div class="text-xs uppercase tracking-widest text-assembly-muted mb-1">
					Scrutin n°{detail.numero} · {detail.legislature}<sup>e</sup> législature · {formatDate(
						detail.date
					)}
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
		{#if data.texte}
			<a
				href="/assemblee/textes/{encodeURIComponent(data.texte.id)}"
				class="mt-3 inline-flex items-center gap-2 text-xs text-assembly-muted hover:text-assembly-accent group"
				title="Voir tous les scrutins de ce texte"
			>
				<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
					><path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 6h16M4 12h16M4 18h7"
					></path></svg
				>
				<span class="uppercase tracking-wider">Texte&nbsp;:</span>
				<span class="text-assembly-fg group-hover:text-assembly-accent">
					{data.texte.titre}
				</span>
				<span class="text-assembly-muted">·</span>
				<span>{data.texte.nbScrutins} scrutin{data.texte.nbScrutins > 1 ? 's' : ''}</span>
			</a>
		{/if}
	</div>

	<VoteSearchBox entries={voteEntries} label="député" />

	<div class="card p-4 sm:p-6">
		<Hemicycle
			personnes={personnesPourHemicycle}
			legislature={detail.legislature}
			mode={{
				kind: 'vote',
				votes: detail.votes,
				groupes: data.groupes,
				dateScrutin: detail.date
			}}
			{hovered}
			onhover={(id) => (hovered = id)}
		/>
		<div class="mt-4">
			<VoteLegend
				pour={detail.pour}
				contre={detail.contre}
				abstention={detail.abstention}
				total={totalEffectif}
			/>
		</div>

		{#if hoveredPersonne}
			<div
				class="absolute top-4 left-4 card px-4 py-3 pointer-events-none shadow-2xl text-sm hidden md:block"
			>
				<div class="font-semibold">
					{hoveredPersonne.identite.prenom}
					{hoveredPersonne.identite.nom}
				</div>
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

	<div class="card p-6">
		<h2 class="title-display text-xl mb-4">Ventilation par groupe</h2>
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
					<br /><br />
					Le groupe affiché est celui d'appartenance <strong>au moment du vote</strong> (cf ADR 0016).
				</InfoTip>
			</h2>
			<span class="text-assembly-muted">
				{frondeurs.length} député{frondeurs.length > 1 ? 's' : ''} contre la ligne du groupe
			</span>
		</div>

		{#if frondeurs.length === 0}
			<div class="text-sm text-assembly-muted italic">
				Aucun frondeur sur ce scrutin — toutes les positions individuelles s'alignent sur les
				majorités de groupe.
			</div>
		{:else}
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
				{#each frondeurs as f (f.personne.id)}
					<FrondeurCard
						personne={f.personne}
						groupe={f.groupe}
						position={f.position}
						positionMajoritaireGroupe={f.positionMajoritaireGroupe}
						legislature={data.detail.legislature}
					/>
				{/each}
			</div>
		{/if}
	</div>

	<div class="flex justify-between gap-4 pt-2">
		{#if navigation.next}
			<a href="/assemblee/scrutins/{navigation.next.uid}/" class="btn-ghost text-sm flex-1 max-w-xs">
				← Scrutin n°{navigation.next.numero}
				<div class="text-xs text-assembly-muted truncate">{navigation.next.titre}</div>
			</a>
		{:else}
			<div></div>
		{/if}
		{#if navigation.prev}
			<a
				href="/assemblee/scrutins/{navigation.prev.uid}/"
				class="btn-ghost text-sm flex-1 max-w-xs text-right"
			>
				Scrutin n°{navigation.prev.numero} →
				<div class="text-xs text-assembly-muted truncate">{navigation.prev.titre}</div>
			</a>
		{/if}
	</div>
</section>
