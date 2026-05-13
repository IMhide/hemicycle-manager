<script lang="ts">
	/**
	 * Liste des textes législatifs (cf ADR 0035). Un "texte" agrège tous les
	 * scrutins d'un même dossier législatif (amendements, articles, votes solennels).
	 *
	 * Filtres : législature, type, recherche par titre. Tri par date de fin
	 * décroissante (plus récents d'abord).
	 */

	let { data } = $props();

	let search = $state('');
	let scopeLeg: number | null = $state(null);
	let visibleCount = $state(50);

	const legSorted = $derived([...data.legislatures].sort((a, b) => b.num - a.num));

	const filtered = $derived.by(() => {
		const q = search.trim().toLowerCase();
		return data.textes.filter((t) => {
			if (scopeLeg !== null && t.legislature !== scopeLeg) return false;
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

	function typeBadge(t: string): string {
		// Libellé court compact pour les chips
		if (t === 'projet-loi-finances') return 'PLF';
		if (t === 'projet-loi-finances-rectificative') return 'PLFR';
		if (t === 'projet-loi-financement-ss') return 'PLFSS';
		if (t === 'projet-loi-organique') return 'PJL-O';
		if (t === 'projet-loi-constitutionnelle') return 'PJL-C';
		if (t === 'projet-loi') return 'PJL';
		if (t === 'proposition-loi-organique') return 'PPL-O';
		if (t === 'proposition-loi-constitutionnelle') return 'PPL-C';
		if (t === 'proposition-loi') return 'PPL';
		if (t === 'proposition-resolution-europeenne') return 'PPR-EU';
		if (t === 'proposition-resolution') return 'PPR';
		return 'AUTRE';
	}

	function clearFilters() {
		search = '';
		scopeLeg = null;
		visibleCount = 50;
	}
</script>

<svelte:head>
	<title>Textes législatifs — PolitiDex</title>
</svelte:head>

<section class="max-w-7xl mx-auto px-6 py-8 space-y-6">
	<div>
		<h1 class="text-2xl font-semibold mb-2">Textes législatifs</h1>
		<p class="text-sm text-assembly-muted">
			Chaque "texte" regroupe tous les scrutins d'un même dossier législatif (amendements,
			articles, votes solennels). {data.textes.length} textes sur les législatures couvertes.
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
					class="px-3 py-1 text-xs rounded-md border {scopeLeg === null
						? 'bg-assembly-accent/20 border-assembly-accent text-assembly-accent'
						: 'border-assembly-border'}"
					onclick={() => (scopeLeg = null)}
				>
					Toutes
				</button>
				{#each legSorted as l}
					<button
						class="px-3 py-1 text-xs rounded-md border {scopeLeg === l.num
							? 'bg-assembly-accent/20 border-assembly-accent text-assembly-accent'
							: 'border-assembly-border'}"
						onclick={() => (scopeLeg = l.num)}
					>
						{l.num}<sup>e</sup>
					</button>
				{/each}
			</div>
			{#if search || scopeLeg !== null}
				<button class="text-xs text-assembly-muted hover:text-assembly-accent" onclick={clearFilters}
					>Réinitialiser</button
				>
			{/if}
		</div>
		<div class="text-xs text-assembly-muted">
			{filtered.length} texte{filtered.length > 1 ? 's' : ''} affiché{filtered.length > 1 ? 's' : ''}
		</div>
	</div>

	<div class="space-y-2">
		{#each visible as t (t.id)}
			<a
				href="/assemblee/textes/{encodeURIComponent(t.id)}"
				class="card block p-4 hover:border-assembly-accent transition-colors"
			>
				<div class="flex items-start justify-between gap-3">
					<div class="min-w-0 flex-1">
						<div class="flex items-center gap-2 mb-1">
							<span
								class="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-assembly-border/50 text-assembly-muted"
								title={t.type}
							>
								{typeBadge(t.type)}
							</span>
							<span class="text-xs text-assembly-muted">
								{t.legislature}<sup>e</sup> législature
							</span>
							{#if t.datePromulgation}
								<span
									class="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-vote-pour/20 text-vote-pour"
								>
									Promulguée {formatDate(t.datePromulgation)}
								</span>
							{:else if t.sortFinal === 'adopté'}
								<span
									class="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-vote-pour/10 text-vote-pour"
								>
									Adopté
								</span>
							{:else if t.sortFinal === 'rejeté'}
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
							{#if t.nbVotesSolennels > 0}
								· {t.nbVotesSolennels} vote{t.nbVotesSolennels > 1 ? 's' : ''} solennel{t.nbVotesSolennels >
								1
									? 's'
									: ''}
							{/if}
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
				Afficher {Math.min(50, sorted.length - visibleCount)} de plus ({sorted.length - visibleCount}
				restants)
			</button>
		{/if}
		{#if sorted.length === 0}
			<div class="card p-6 text-center text-sm text-assembly-muted">
				Aucun texte ne correspond à ces filtres.
			</div>
		{/if}
	</div>
</section>
