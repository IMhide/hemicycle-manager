<script lang="ts">
	import Hemicycle from '$lib/components/Hemicycle.svelte';
	import MemberRow from '$lib/components/MemberRow.svelte';
	import InfoTip from '$lib/components/InfoTip.svelte';
	import Rank from '$lib/components/Rank.svelte';
	import { POLITICAL_ORDER } from '$lib/political-order';

	const TOTAL_GROUPES = 12;

	let { data } = $props();

	type SortKey = 'nom' | 'loyaute' | 'presence' | 'frondes';
	let sortKey: SortKey = $state('nom');
	let search = $state('');

	const deputeStatsById = $derived.by(() => {
		const m = new Map<string, (typeof data.deputeStats)[number]>();
		for (const s of data.deputeStats) m.set(s.id, s);
		return m;
	});

	const president = $derived(
		data.groupe.presidentId
			? data.deputes.find((d) => d.id === data.groupe.presidentId) ?? null
			: null
	);

	const members = $derived(data.deputes.filter((d) => d.groupeId === data.groupe.id));

	const enrichedMembers = $derived(
		members.map((d) => ({ depute: d, stats: deputeStatsById.get(d.id)! }))
	);

	const filteredMembers = $derived.by(() => {
		const q = search.trim().toLowerCase();
		const filtered = q
			? enrichedMembers.filter((m) =>
					`${m.depute.prenom} ${m.depute.nom}`.toLowerCase().includes(q)
				)
			: enrichedMembers;

		const sorted = [...filtered];
		switch (sortKey) {
			case 'nom':
				sorted.sort((a, b) => a.depute.nom.localeCompare(b.depute.nom));
				break;
			case 'loyaute':
				sorted.sort((a, b) => (b.stats.tauxLoyaute ?? 0) - (a.stats.tauxLoyaute ?? 0));
				break;
			case 'presence':
				sorted.sort((a, b) => b.stats.tauxPresence - a.stats.tauxPresence);
				break;
			case 'frondes':
				sorted.sort((a, b) => b.stats.frondes - a.stats.frondes);
				break;
		}
		return sorted;
	});

	const topLoyalistes = $derived(
		data.stats.topLoyalistes
			.map((t) => ({
				depute: data.deputes.find((d) => d.id === t.id),
				stats: deputeStatsById.get(t.id)
			}))
			.filter((x) => x.depute && x.stats) as Array<{
			depute: (typeof data.deputes)[number];
			stats: (typeof data.deputeStats)[number];
		}>
	);

	const topFrondeurs = $derived(
		data.stats.topFrondeurs
			.map((t) => ({
				depute: data.deputes.find((d) => d.id === t.id),
				stats: deputeStatsById.get(t.id)
			}))
			.filter((x) => x.depute && x.stats) as Array<{
			depute: (typeof data.deputes)[number];
			stats: (typeof data.deputeStats)[number];
		}>
	);

	// Top présence: members of this group sorted by tauxPresence desc
	const topPresence = $derived(
		[...members]
			.map((d) => ({ depute: d, stats: deputeStatsById.get(d.id)! }))
			.filter((x) => x.stats)
			.sort((a, b) => b.stats.tauxPresence - a.stats.tauxPresence)
			.slice(0, 5)
	);

	const politicalRank = $derived(
		POLITICAL_ORDER[data.groupe.libelleAbrege] ?? null
	);

	function pct(n: number | null): string {
		if (n === null) return 'N/A';
		return `${(n * 100).toFixed(1)} %`;
	}
</script>

<svelte:head>
	<title>{data.groupe.libelle} — Hémicycle Manager</title>
</svelte:head>

<section class="max-w-7xl mx-auto px-6 py-8 space-y-6">
	<a
		href="/"
		class="text-sm text-assembly-muted hover:text-assembly-accent inline-flex items-center gap-1"
	>
		← Tous les groupes
	</a>

	<!-- Header -->
	<div
		class="card p-6 relative overflow-hidden"
		style="background: linear-gradient(120deg, {data.groupe
			.couleur}22 0%, transparent 60%), #1e293b;"
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
						{data.groupe.libelleAbrege} · {data.groupe.effectif} député{data.groupe.effectif > 1
							? 's'
							: ''}
						{#if politicalRank}
							· Position politique : rang {politicalRank.rank}/12
						{/if}
					</div>
				</div>
			</div>

			{#if president}
				<a
					href="/deputes/{president.id}/"
					class="card flex items-center gap-3 px-3 py-2 hover:border-assembly-accent/60"
				>
					<img
						src={president.photoUrl}
						alt=""
						class="w-10 h-10 rounded-full object-cover bg-assembly-border"
						loading="lazy"
						referrerpolicy="no-referrer"
					/>
					<div>
						<div class="text-[10px] uppercase tracking-widest text-assembly-muted">
							⭐ Président
						</div>
						<div class="text-sm font-semibold">
							{president.prenom} {president.nom}
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
	</div>

	<!-- Stats grid -->
	<div class="grid grid-cols-2 md:grid-cols-4 gap-3">
		<div class="card p-4">
			<div class="text-xs text-assembly-muted flex items-center gap-1">
				Cohésion
				<InfoTip title="Cohésion du groupe" size="xs">
					Part moyenne des membres alignés sur la <strong>position majoritaire du groupe</strong>,
					calculée scrutin par scrutin. Une cohésion de 100 % signifie que les membres votent
					toujours ensemble. C'est l'<strong>indice de Rice</strong>, utilisé en science politique.
				</InfoTip>
			</div>
			<div class="flex items-baseline gap-2 mt-1">
				<div class="title-display text-3xl" style="color: {data.groupe.couleur}">
					{data.stats.cohesion !== null ? pct(data.stats.cohesion) : 'N/A'}
				</div>
				<Rank rank={data.stats.rangs.cohesion} total={TOTAL_GROUPES} />
			</div>
		</div>
		<div class="card p-4">
			<div class="text-xs text-assembly-muted flex items-center gap-1">
				Présence moyenne
				<InfoTip title="Présence moyenne" size="xs">
					Moyenne des taux de présence individuels des membres du groupe sur les scrutins
					postérieurs à leur prise de fonction.
				</InfoTip>
			</div>
			<div class="flex items-baseline gap-2 mt-1">
				<div class="title-display text-3xl text-blue-400">
					{pct(data.stats.tauxPresenceMoyen)}
				</div>
				<Rank rank={data.stats.rangs.presence} total={TOTAL_GROUPES} />
			</div>
		</div>
		<div class="card p-4">
			<div class="text-xs text-assembly-muted flex items-center gap-1">
				Frondes totales
				<InfoTip title="Frondes" size="xs">
					Nombre total de votes <em>exprimés</em> opposés à la majorité du groupe, cumulés sur
					tous ses membres et tous les scrutins. Indicateur d'indiscipline globale.
				</InfoTip>
			</div>
			<div class="flex items-baseline gap-2 mt-1">
				<div class="title-display text-3xl text-rose-400">{data.stats.frondesTotales}</div>
				<Rank rank={data.stats.rangs.frondes} total={TOTAL_GROUPES} />
			</div>
		</div>
		<div class="card p-4">
			<div class="text-xs text-assembly-muted">Effectif</div>
			<div class="title-display text-3xl mt-1 text-assembly-accent">{data.groupe.effectif}</div>
		</div>
	</div>

	<!-- Mini hemicycle showing only this group's seats -->
	<div class="card p-4 sm:p-6">
		<h2 class="title-display text-xl mb-4">Sièges dans l'hémicycle</h2>
		<Hemicycle
			deputes={data.deputes}
			mode={{ kind: 'highlight-groupe', groupeId: data.groupe.id, groupes: data.groupes }}
		/>
	</div>

	<!-- Tops -->
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
		<div class="card p-4">
			<h3 class="title-display text-base mb-3 flex items-center gap-2">
				🎯 Top présence
				<InfoTip title="Top présence" size="xs">
					Membres physiquement présents au plus de scrutins (vote exprimé, abstention ou
					non-votant). Mesuré sur les scrutins postérieurs à leur prise de fonction.
				</InfoTip>
			</h3>
			{#if topPresence.length === 0}
				<div class="text-sm text-assembly-muted italic">Pas assez de données.</div>
			{:else}
				<div class="space-y-1.5">
					{#each topPresence as p (p.depute.id)}
						<MemberRow
							depute={p.depute}
							stats={p.stats}
							highlight="presence"
							isPresident={p.depute.id === data.groupe.presidentId}
						/>
					{/each}
				</div>
			{/if}
		</div>

		<div class="card p-4">
			<h3 class="title-display text-base mb-3 flex items-center gap-2">
				🤝 Top loyalistes
				<InfoTip title="Loyalistes" size="xs">
					Membres alignés le plus souvent avec la majorité du groupe. Mesuré sur tous les scrutins
					où le membre a exprimé un vote pour ou contre et où le groupe avait une majorité claire.
				</InfoTip>
			</h3>
			{#if topLoyalistes.length === 0}
				<div class="text-sm text-assembly-muted italic">Pas assez de données.</div>
			{:else}
				<div class="space-y-1.5">
					{#each topLoyalistes as l (l.depute.id)}
						<MemberRow
							depute={l.depute}
							stats={l.stats}
							highlight="loyaute"
							isPresident={l.depute.id === data.groupe.presidentId}
						/>
					{/each}
				</div>
			{/if}
		</div>

		<div class="card p-4">
			<h3 class="title-display text-base mb-3 flex items-center gap-2">
				🔥 Top frondeurs
				<InfoTip title="Frondeurs" size="xs">
					Membres ayant le plus voté <strong>contre la position majoritaire</strong> de leur
					groupe. Indicateur d'indépendance vis-à-vis de la ligne du parti.
				</InfoTip>
			</h3>
			{#if topFrondeurs.length === 0}
				<div class="text-sm text-assembly-muted italic">
					Aucun frondeur identifié dans ce groupe.
				</div>
			{:else}
				<div class="space-y-1.5">
					{#each topFrondeurs as f (f.depute.id)}
						<MemberRow
							depute={f.depute}
							stats={f.stats}
							highlight="frondes"
							isPresident={f.depute.id === data.groupe.presidentId}
						/>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<!-- All members -->
	<div class="card p-4">
		<div class="flex items-center justify-between gap-3 mb-4 flex-wrap">
			<h2 class="title-display text-xl">Tous les membres ({members.length})</h2>
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
				{#each filteredMembers as m (m.depute.id)}
					<MemberRow
						depute={m.depute}
						stats={m.stats}
						highlight={sortKey === 'nom' ? null : sortKey}
						isPresident={m.depute.id === data.groupe.presidentId}
					/>
				{/each}
			</div>
		{/if}
	</div>
</section>
