<script lang="ts">
	/**
	 * Fiche scrutin Sénat. Affiche pour chaque frondeur son groupe **au moment du vote**
	 * (cf ADR 0016 transposée). L'appartenance qui couvre la date du scrutin est
	 * sélectionnée. Délégations de vote ignorées en v1 (cf ADR 0027).
	 */
	import HemicycleSenat from '$lib/components/HemicycleSenat.svelte';
	import VoteLegend from '$lib/components/VoteLegend.svelte';
	import GroupVoteBarSenat from '$lib/components/GroupVoteBarSenat.svelte';
	import FrondeurSenatCard from '$lib/components/FrondeurSenatCard.svelte';
	import InfoTip from '$lib/components/InfoTip.svelte';
	import VoteSearchBox from '$lib/components/VoteSearchBox.svelte';
	import type { VoteEntry } from '$lib/components/VoteSearchBox.types';
	import { lookupEluUrlForMatriculeTriennat } from '$lib/elus';
	import { triennatOfDate } from '$lib/triennats';
	import type {
		Senateur,
		GroupeSenat,
		AppartenanceGroupeSenat,
		MandatSenat
	} from '$lib/types';

	let { data } = $props();

	let hovered: string | null = $state(null);

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

	const detail = $derived(data.detail);
	const triennatId = $derived(triennatOfDate(detail.date)?.id ?? null);

	/** Mandat couvrant la date du scrutin (cf ADR 0028 transposée). */
	function mandatPourScrutin(s: Senateur): MandatSenat | null {
		for (const m of s.mandats) {
			if (m.datePriseFonction <= detail.date && (m.dateFinFonction ?? '9999-12-31') >= detail.date) {
				return m;
			}
		}
		return null;
	}

	function appartenanceAuVote(s: Senateur): AppartenanceGroupeSenat | null {
		const m = mandatPourScrutin(s);
		if (!m) return null;
		for (const a of m.appartenancesGroupe) {
			if (a.dateDebut <= detail.date && (a.dateFin === null || a.dateFin >= detail.date)) {
				return a;
			}
		}
		return m.appartenancesGroupe.at(-1) ?? null;
	}

	function groupeAuVote(s: Senateur): GroupeSenat | null {
		const a = appartenanceAuVote(s);
		return a ? groupeByCode.get(a.groupeCode) ?? null : null;
	}

	const sortedGroupes = $derived.by(() => {
		return [...detail.groupes]
			.map((g) => ({ ...g, groupe: groupeByCode.get(g.code) }))
			.filter((g) => g.groupe)
			.sort((a, b) => (a.groupe!.preseance ?? 99) - (b.groupe!.preseance ?? 99));
	});

	const frondeurs = $derived.by(() => {
		const list: Array<{
			senateur: Senateur;
			groupe: GroupeSenat | null;
			position: 'pour' | 'contre';
			positionMajoritaireGroupe: string;
		}> = [];
		const groupeMajByCode = new Map<string, string>();
		for (const g of detail.groupes) groupeMajByCode.set(g.code, g.positionMajoritaire);
		for (const id of detail.frondeurs) {
			const senateur = senateurById.get(id);
			if (!senateur) continue;
			const app = appartenanceAuVote(senateur);
			const groupe = app ? groupeByCode.get(app.groupeCode) ?? null : null;
			const position = detail.votes[id];
			if (position !== 'pour' && position !== 'contre') continue;
			const maj = app ? groupeMajByCode.get(app.groupeCode) ?? '' : '';
			list.push({ senateur, groupe, position, positionMajoritaireGroupe: maj });
		}
		return list.sort((a, b) => {
			const gA = a.groupe?.preseance ?? 99;
			const gB = b.groupe?.preseance ?? 99;
			if (gA !== gB) return gA - gB;
			return a.senateur.identite.nom.localeCompare(b.senateur.identite.nom);
		});
	});

	const senateursPourHemicycle = $derived(
		data.senateurs.filter((s) =>
			s.mandats.some(
				(m) =>
					m.datePriseFonction <= detail.date && (m.dateFinFonction ?? '9999-12-31') >= detail.date
			)
		)
	);

	const voteEntries = $derived.by(() => {
		const out: VoteEntry[] = [];
		for (const s of senateursPourHemicycle) {
			const position = detail.votes[s.id] ?? 'absent';
			const groupe = groupeAuVote(s);
			out.push({
				id: s.id,
				prenom: s.identite.prenom,
				nom: s.identite.nom,
				groupeLibelle: groupe?.libelleAbrege ?? '',
				groupeCouleur: groupe?.couleur ?? null,
				position,
				href: triennatId ? lookupEluUrlForMatriculeTriennat(s.id, triennatId) : null
			});
		}
		return out;
	});

	const hoveredSenateur = $derived(hovered ? senateurById.get(hovered) ?? null : null);
	const hoveredGroupe = $derived(hoveredSenateur ? groupeAuVote(hoveredSenateur) : null);
	const hoveredVote = $derived(hovered ? detail.votes[hovered] ?? 'absent' : null);

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('fr-FR', {
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
	}

	const navigation = $derived.by(() => {
		const sortedIndex = [...data.index].sort((a, b) => b.date.localeCompare(a.date));
		const i = sortedIndex.findIndex((s) => s.uid === detail.uid);
		return {
			next: i > 0 ? sortedIndex[i - 1] : null,
			prev: i >= 0 && i < sortedIndex.length - 1 ? sortedIndex[i + 1] : null
		};
	});

	const totalEffectif = $derived.by(() => {
		return data.groupes.reduce((acc, g) => acc + g.effectifFin, 0);
	});

	function sortClass(s: string | null | undefined): string {
		const t = (s ?? '').toLowerCase();
		if (t.includes('adopt')) return 'bg-vote-pour/20 text-vote-pour';
		if (t.includes('rejet') || t.includes('refus')) return 'bg-vote-contre/20 text-vote-contre';
		return 'bg-assembly-border text-assembly-muted';
	}
</script>

<svelte:head>
	<title>Scrutin n°{detail.scrnum} — Sénat — PolitiDex</title>
</svelte:head>

<section class="max-w-7xl mx-auto px-6 py-8 space-y-6">
	<a
		href="/senat/scrutins/"
		class="text-sm text-assembly-muted hover:text-assembly-accent inline-flex items-center gap-1"
	>
		← Tous les scrutins Sénat
	</a>

	<div class="card p-6">
		<div class="flex items-start justify-between gap-4 mb-3">
			<div class="min-w-0 flex-1">
				<div class="text-xs uppercase tracking-widest text-assembly-muted mb-1">
					Scrutin n°{detail.scrnum}{#if triennatId} · Triennat {triennatId}{/if} ·
					{formatDate(detail.date)}
				</div>
				<h1 class="text-xl sm:text-2xl leading-snug font-semibold">{detail.titre}</h1>
				{#if data.texte}
					<a
						href="/textes/{encodeURIComponent(data.texte.versionAutreChambre?.texteAnId ?? data.texte.id)}"
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
			<div
				class="title-display text-2xl px-4 py-2 rounded-md whitespace-nowrap {sortClass(
					detail.sort
				)}"
			>
				{detail.sort || 'n/a'}
			</div>
		</div>
	</div>

	<VoteSearchBox entries={voteEntries} label="sénateur" />

	<div class="card p-4 sm:p-6 relative">
		<HemicycleSenat
			senateurs={senateursPourHemicycle}
			triennat={triennatId ?? '2023-2026'}
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

		{#if hoveredSenateur}
			<div
				class="absolute top-4 left-4 card px-4 py-3 pointer-events-none shadow-2xl text-sm hidden md:block"
			>
				<div class="font-semibold">
					{hoveredSenateur.identite.prenom}
					{hoveredSenateur.identite.nom}
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
			{#each sortedGroupes as g (g.code)}
				{#if g.groupe}
					<GroupVoteBarSenat
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
					Un <strong>frondeur</strong> est un sénateur qui a voté
					<strong>différemment</strong> de la position majoritaire de son groupe sur ce
					scrutin.
					<br /><br />
					On ne compte que les votes <em>exprimés</em> (pour ou contre) opposés à la majorité du
					groupe. Les abstentions individuelles ne sont pas considérées comme une fronde.
					<br /><br />
					Le groupe affiché est celui d'appartenance <strong>au moment du vote</strong> (cf
					ADR 0016 transposée).
					<br /><br />
					Les délégations de vote ne sont pas prises en compte en v1 (cf
					<a
						href="https://github.com/IMhide/hemicycle-manager/blob/main/decisions/0027-delegations-vote-senat-v1.md"
						class="underline">ADR 0027</a
					>).
				</InfoTip>
			</h2>
			<span class="text-assembly-muted">
				{frondeurs.length} sénateur{frondeurs.length > 1 ? 's' : ''} contre la ligne du groupe
			</span>
		</div>

		{#if frondeurs.length === 0}
			<div class="text-sm text-assembly-muted italic">
				Aucun frondeur sur ce scrutin — toutes les positions individuelles s'alignent sur les
				majorités de groupe.
			</div>
		{:else}
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
				{#each frondeurs as f (f.senateur.id)}
					<FrondeurSenatCard
						senateur={f.senateur}
						groupe={f.groupe}
						position={f.position}
						positionMajoritaireGroupe={f.positionMajoritaireGroupe}
						triennat={triennatId ?? undefined}
					/>
				{/each}
			</div>
		{/if}
	</div>

	<div class="flex justify-between gap-4 pt-2">
		{#if navigation.prev}
			<a
				href="/senat/scrutins/{navigation.prev.uid}/"
				class="btn-ghost text-sm flex-1 max-w-xs"
			>
				← Scrutin n°{navigation.prev.scrnum}
				<div class="text-xs text-assembly-muted truncate">{navigation.prev.titre}</div>
			</a>
		{:else}
			<div></div>
		{/if}
		{#if navigation.next}
			<a
				href="/senat/scrutins/{navigation.next.uid}/"
				class="btn-ghost text-sm flex-1 max-w-xs text-right"
			>
				Scrutin n°{navigation.next.scrnum} →
				<div class="text-xs text-assembly-muted truncate">{navigation.next.titre}</div>
			</a>
		{/if}
	</div>
</section>
