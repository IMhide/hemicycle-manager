<script lang="ts">
	/**
	 * Liste des textes législatifs Sénat (N3.b navette). Un "texte Sénat" agrège
	 * tous les scrutins Sénat portant sur le même dossier législatif, croisé avec
	 * la table `loi` du dump dosleg. Cf scripts/lib/textes-senat.ts.
	 */

	let { data } = $props();

	let search = $state('');
	let scopeTriennat: string | null = $state(null);
	let visibleCount = $state(50);

	const triennatsSorted = $derived([...data.triennats].sort((a, b) => (a.id < b.id ? 1 : -1)));

	const filtered = $derived.by(() => {
		const q = search.trim().toLowerCase();
		return data.textes.filter((t) => {
			if (scopeTriennat !== null && t.triennat !== scopeTriennat) return false;
			if (q && !t.titre.toLowerCase().includes(q)) return false;
			return true;
		});
	});

	const sorted = $derived([...filtered].sort((a, b) => (a.dateFin < b.dateFin ? 1 : -1)));
	const visible = $derived(sorted.slice(0, visibleCount));

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('fr-FR', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}

	/** Libellé court compact pour les chips, aligné sur le libellé du Sénat. */
	function typeBadge(t: string): string {
		if (t === 'pjlf') return 'PLF';
		if (t === 'pjlr') return 'PLFR';
		if (t === 'pjfs') return 'PLFSS';
		if (t === 'pfsr') return 'PLFSSR';
		if (t === 'pjlo') return 'PJL-O';
		if (t === 'pjlc') return 'PJL-C';
		if (t === 'pjlg') return 'PJL-R';
		if (t === 'pjl') return 'PJL';
		if (t === 'prog') return 'PJL-P';
		if (t === 'pplo') return 'PPL-O';
		if (t === 'pplc') return 'PPL-C';
		if (t === 'ppro') return 'PPL-P';
		if (t === 'ppl') return 'PPL';
		if (t === 'refe') return 'PPL-11';
		if (t === 'pac') return 'PPR-EU';
		if (t === 'ppre') return 'PPR-RGL';
		if (t === 'ppra') return 'PPR';
		if (t === 'pprp') return 'PPR-34';
		if (t === 'enq') return 'CE';
		if (t === 'cvn') return 'CVN';
		if (t === 'mref') return 'M-REF';
		if (t === 'dape') return 'DAPE';
		return '?';
	}

	function clearFilters() {
		search = '';
		scopeTriennat = null;
		visibleCount = 50;
	}
</script>

<svelte:head>
	<title>Textes législatifs Sénat — PolitiDex</title>
</svelte:head>

<section class="max-w-7xl mx-auto px-6 py-8 space-y-6">
	<div>
		<h1 class="text-2xl font-semibold mb-2">Textes législatifs Sénat</h1>
		<p class="text-sm text-assembly-muted">
			Chaque "texte" regroupe tous les scrutins Sénat d'un même dossier législatif.
			{data.textes.length} textes sur les triennats couverts.
		</p>
	</div>

	<div class="card p-4 space-y-3">
		<div class="flex flex-wrap gap-2 items-center">
			<input
				type="text"
				bind:value={search}
				placeholder="Rechercher un texte par titre…"
				class="flex-1 min-w-[200px] px-3 py-2 rounded-md bg-assembly-bg border border-assembly-border text-sm"
			/>
			<div class="flex gap-1">
				<button
					class="px-3 py-1 text-xs rounded-md border {scopeTriennat === null
						? 'bg-assembly-accent/20 border-assembly-accent text-assembly-accent'
						: 'border-assembly-border'}"
					onclick={() => (scopeTriennat = null)}
				>
					Tous
				</button>
				{#each triennatsSorted as t}
					<button
						class="px-3 py-1 text-xs rounded-md border {scopeTriennat === t.id
							? 'bg-assembly-accent/20 border-assembly-accent text-assembly-accent'
							: 'border-assembly-border'}"
						onclick={() => (scopeTriennat = t.id)}
					>
						{t.id}
					</button>
				{/each}
			</div>
			{#if search || scopeTriennat !== null}
				<button class="text-xs text-assembly-muted hover:text-assembly-accent" onclick={clearFilters}
					>Réinitialiser</button
				>
			{/if}
		</div>
		<div class="text-xs text-assembly-muted">
			{filtered.length} texte{filtered.length > 1 ? 's' : ''} affiché{filtered.length > 1
				? 's'
				: ''}
		</div>
	</div>

	<div class="space-y-2">
		{#each visible as t (t.id)}
			<a
				href="/senat/textes/{encodeURIComponent(t.id)}"
				class="card block p-4 hover:border-assembly-accent transition-colors"
			>
				<div class="flex items-start justify-between gap-3">
					<div class="min-w-0 flex-1">
						<div class="flex items-center gap-2 mb-1 flex-wrap">
							<span
								class="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-assembly-border/50 text-assembly-muted"
								title={t.typeLibelle}
							>
								{typeBadge(t.type)}
							</span>
							<span class="text-xs text-assembly-muted">{t.triennat}</span>
							{#if t.etat === 'promulgue'}
								<span
									class="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-vote-pour/20 text-vote-pour"
								>
									Promulguée {t.datePromulgation ? formatDate(t.datePromulgation) : ''}
								</span>
							{:else if t.etat === 'rejete'}
								<span
									class="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-vote-contre/10 text-vote-contre"
								>
									Rejeté
								</span>
							{:else if t.etat === 'caduc' || t.etat === 'retire' || t.etat === 'fusionne'}
								<span
									class="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-assembly-border/40 text-assembly-muted"
								>
									{t.etat === 'caduc' ? 'Caduc' : t.etat === 'retire' ? 'Retiré' : 'Fusionné'}
								</span>
							{:else if t.etat === 'en-cours'}
								<span
									class="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-assembly-accent/10 text-assembly-accent"
								>
									En cours
								</span>
							{:else if /adopté/i.test(t.sortFinal)}
								<span
									class="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-vote-pour/10 text-vote-pour"
								>
									Adopté
								</span>
							{:else if /rejeté/i.test(t.sortFinal)}
								<span
									class="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-vote-contre/10 text-vote-contre"
								>
									Rejeté
								</span>
							{/if}
						</div>
						<div class="text-sm leading-snug font-medium line-clamp-2">
							{t.titre}
						</div>
						<div class="text-xs text-assembly-muted mt-1">
							{t.nbScrutins} scrutin{t.nbScrutins > 1 ? 's' : ''}
							· du {formatDate(t.dateDebut)} au {formatDate(t.dateFin)}
						</div>
					</div>
				</div>
			</a>
		{/each}
		{#if visibleCount < sorted.length}
			<button
				class="w-full py-3 text-sm text-assembly-muted hover:text-assembly-accent border border-assembly-border rounded-md"
				onclick={() => (visibleCount += 50)}
			>
				Afficher {Math.min(50, sorted.length - visibleCount)} de plus ({sorted.length -
					visibleCount} restants)
			</button>
		{/if}
		{#if sorted.length === 0}
			<div class="card p-6 text-center text-sm text-assembly-muted">
				Aucun texte ne correspond à ces filtres.
			</div>
		{/if}
	</div>
</section>
