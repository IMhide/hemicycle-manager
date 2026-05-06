<script lang="ts">
	/**
	 * Index des triennats sénatoriaux (cf ADR 0028).
	 * Grille des 7 triennats depuis 2006, avec dates, sessions couvertes, et
	 * comptes (sénateurs, scrutins).
	 */
	let { data } = $props();

	const triennatsSorted = $derived(
		[...data.triennats].sort((a, b) => b.dateDebut.localeCompare(a.dateDebut))
	);

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('fr-FR', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>Triennats — Sénat — PolitiDex</title>
</svelte:head>

<section class="max-w-5xl mx-auto px-6 py-8">
	<div class="mb-6">
		<h1 class="title-display text-4xl sm:text-5xl tracking-wider">Triennats du Sénat</h1>
		<p class="text-assembly-muted mt-2 max-w-3xl">
			Au Sénat, la moitié des sièges est renouvelée tous les 3 ans (séries 1 et 2).
			Le <b>triennat</b> — période entre 2 renouvellements — est l'unité de regroupement
			principale (équivalent de la législature côté Assemblée nationale).
			<a href="/faq#senat-triennat" class="text-assembly-accent hover:underline">
				En savoir plus dans la FAQ
			</a>.
		</p>
	</div>

	<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
		{#each triennatsSorted as t (t.id)}
			<a
				href="/senat/triennats/{t.id}/"
				class="card p-4 hover:border-assembly-accent/60 transition-colors flex flex-col gap-2"
			>
				<div class="flex items-baseline justify-between gap-2">
					<div class="title-display text-2xl">
						{t.id}{#if t.enCours} <span class="text-base align-middle opacity-80">⚡</span>{/if}
					</div>
					<div class="text-xs text-assembly-muted">
						{#if t.enCours}En cours{:else if t.tronque}Tronqué{:else}Terminé{/if}
					</div>
				</div>
				<div class="text-xs text-assembly-muted">
					{formatDate(t.dateDebut)} → {formatDate(t.dateFin)}
				</div>
				<div class="grid grid-cols-3 gap-2 mt-1 text-center">
					<div>
						<div class="text-[9px] uppercase text-assembly-muted">Sessions</div>
						<div class="title-display text-lg tabular-nums">{t.sessions.length}</div>
					</div>
					<div>
						<div class="text-[9px] uppercase text-assembly-muted">Sénateurs</div>
						<div class="title-display text-lg tabular-nums">{t.nbSenateursActifs}</div>
					</div>
					<div>
						<div class="text-[9px] uppercase text-assembly-muted">Scrutins</div>
						<div class="title-display text-lg tabular-nums">{t.nbScrutins}</div>
					</div>
				</div>
			</a>
		{/each}
	</div>
</section>
