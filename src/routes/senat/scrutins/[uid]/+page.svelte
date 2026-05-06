<script lang="ts">
	/**
	 * Fiche détail d'un scrutin Sénat (stub PR B — version complète en PR C).
	 */
	let { data } = $props();

	const groupesByCode = $derived.by(() => {
		const m = new Map<string, (typeof data.groupes)[number]>();
		for (const g of data.groupes) m.set(g.code, g);
		return m;
	});

	function libelleSession(sesann: number): string {
		return `${sesann}-${(sesann + 1).toString().slice(-2)}`;
	}
</script>

<svelte:head>
	<title>Scrutin {data.detail.uid} — Sénat — PolitiDex</title>
</svelte:head>

<section class="max-w-5xl mx-auto px-6 py-8">
	<div class="mb-4">
		<a href="/senat/scrutins/" class="text-xs text-assembly-muted hover:text-assembly-accent">
			← Retour à la liste des scrutins
		</a>
	</div>

	<div class="card p-6 mb-6">
		<div class="text-xs text-assembly-muted mb-1">
			Scrutin n° {data.detail.scrnum} · Session {libelleSession(data.detail.sesann)} ·
			{data.detail.date.slice(0, 10)}
		</div>
		<h1 class="title-display text-2xl mb-3">{data.detail.titre}</h1>
		<div class="flex items-center gap-4 text-sm">
			<span class="text-vote-pour">{data.detail.pour} pour</span>
			<span class="text-vote-contre">{data.detail.contre} contre</span>
			<span class="text-vote-abstention">{data.detail.abstention} abstention</span>
			<span class="text-assembly-muted">{data.detail.nonVotant} non-votant</span>
		</div>
		<div class="mt-3 text-xs">
			Sort : <span class="font-semibold">{data.detail.sort || 'non précisé'}</span>
		</div>
	</div>

	<div class="card p-5 mb-6">
		<h2 class="title-display text-lg mb-3">Décompte par groupe</h2>
		<div class="space-y-2">
			{#each data.detail.groupes as g (g.code)}
				{@const meta = groupesByCode.get(g.code)}
				<div class="flex items-center gap-3 text-sm">
					<span
						class="w-3 h-3 rounded-full flex-shrink-0"
						style="background-color: {meta?.couleur ?? '#475569'}"
					></span>
					<span class="font-semibold w-24 truncate">{meta?.libelleAbrege ?? g.code}</span>
					<span class="text-vote-pour tabular-nums w-12 text-right">{g.decompte.pour}</span>
					<span class="text-vote-contre tabular-nums w-12 text-right">{g.decompte.contre}</span>
					<span class="text-vote-abstention tabular-nums w-12 text-right">{g.decompte.abstention}</span>
					<span class="text-assembly-muted tabular-nums w-12 text-right">{g.decompte.nonVotant}</span>
					<span class="text-[10px] text-assembly-muted">
						maj. {g.positionMajoritaire}
					</span>
				</div>
			{/each}
		</div>
	</div>

	<div class="card p-5">
		<h2 class="title-display text-lg mb-2">Frondeurs</h2>
		{#if data.detail.frondeurs.length === 0}
			<p class="text-xs text-assembly-muted italic">Aucun frondeur sur ce scrutin.</p>
		{:else}
			<p class="text-xs text-assembly-muted mb-2">
				{data.detail.frondeurs.length} sénateur{data.detail.frondeurs.length > 1
					? 's'
					: ''} ont voté contre la position majoritaire de leur groupe.
			</p>
			<div class="text-[10px] text-assembly-muted">
				Le détail (cartes des frondeurs) arrive en PR C.
			</div>
		{/if}
	</div>
</section>
