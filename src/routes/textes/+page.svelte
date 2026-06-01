<script lang="ts">
	/**
	 * Liste cross-chambre des textes législatifs (N3.d, cf ADR 0036).
	 *
	 * Affiche les `TexteUnifie` qui agrègent les `Texte` AN et `TexteSenat`
	 * Sénat sous une seule entité. Symétrique de `/elus/` pour les personnes.
	 *
	 * Filtres : recherche titre, chambre (AN / Sénat), état.
	 *
	 * Note : on n'expose pas de filtre/badge "Bicaméral" car notre indicateur
	 * `t.bicameral` reflète l'état de nos données (scrutins nominaux matchés
	 * dans les deux chambres) et non le bicaméralisme institutionnel français.
	 * Le simple fait d'avoir les deux colonnes remplies sur la fiche signale
	 * déjà cette propriété sans induire en erreur.
	 */

	import type { TexteUnifie } from '$lib/types';

	let { data } = $props();

	let search = $state('');
	type Scope = 'all' | 'an' | 'senat';
	let scope: Scope = $state('all');
	let scopeEtat: string | null = $state(null);
	let visibleCount = $state(50);

	const filtered = $derived.by(() => {
		const q = search.trim().toLowerCase();
		return data.textes.filter((t) => {
			if (q && !t.titre.toLowerCase().includes(q)) return false;
			if (scope === 'an' && !t.an) return false;
			if (scope === 'senat' && !t.senat) return false;
			if (scopeEtat && t.etat !== scopeEtat) return false;
			return true;
		});
	});

	// Le manifest est déjà trié par dateDebut décroissante côté pipeline
	const visible = $derived(filtered.slice(0, visibleCount));

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('fr-FR', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}

	/** Libellé court compact pour les chips, basé sur `TexteType`. */
	function typeBadge(t: string): string {
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
		scope = 'all';
		scopeEtat = null;
		visibleCount = 50;
	}

	// Stats globales
	const stats = $derived.by(() => {
		const total = data.textes.length;
		const promul = data.textes.filter((t: TexteUnifie) => t.etat === 'promulgue').length;
		return { total, promul };
	});
</script>

<svelte:head>
	<title>Textes législatifs — PolitiDex</title>
</svelte:head>

<section class="max-w-[1536px] mx-auto px-6 py-8 space-y-6">
	<div>
		<h1 class="text-2xl font-semibold mb-2">Textes législatifs</h1>
		<p class="text-sm text-fg-muted">
			Vue cross-chambre : chaque entrée regroupe les votes AN et Sénat sur un même texte législatif
			quand les deux chambres l'ont examiné. {stats.total} textes
			({stats.promul} promulgués) sur les législatures et triennats couverts.
		</p>
	</div>

	<div class="card p-4 space-y-3">
		<div class="flex flex-wrap gap-2 items-center">
			<input
				type="text"
				bind:value={search}
				placeholder="Rechercher un texte par titre…"
				class="flex-1 min-w-[200px] px-3 py-2 rounded-md bg-bg border border-border-soft text-sm"
			/>
			<div class="flex gap-1 flex-wrap">
				{#each [{ k: 'all', l: 'Toutes chambres' }, { k: 'an', l: 'AN' }, { k: 'senat', l: 'Sénat' }] as opt}
					<button
						class="px-3 py-1 text-xs rounded-md border {scope === opt.k
							? 'bg-accent text-accent-fg border-accent'
							: 'border-border-soft'}"
						onclick={() => (scope = opt.k as Scope)}
					>
						{opt.l}
					</button>
				{/each}
			</div>
			<div class="flex gap-1 flex-wrap">
				{#each [{ k: null, l: 'Tous états' }, { k: 'promulgue', l: 'Promulguée' }, { k: 'rejete', l: 'Rejeté' }, { k: 'en-cours', l: 'En cours' }] as opt}
					<button
						class="px-3 py-1 text-xs rounded-md border {scopeEtat === opt.k
							? 'bg-accent text-accent-fg border-accent'
							: 'border-border-soft'}"
						onclick={() => (scopeEtat = opt.k)}
					>
						{opt.l}
					</button>
				{/each}
			</div>
			{#if search || scope !== 'all' || scopeEtat}
				<button class="text-xs text-fg-muted hover:text-link" onclick={clearFilters}
					>Réinitialiser</button
				>
			{/if}
		</div>
		<div class="text-xs text-fg-muted">
			{filtered.length} texte{filtered.length > 1 ? 's' : ''} affiché{filtered.length > 1 ? 's' : ''}
		</div>
	</div>

	<div class="space-y-2">
		{#each visible as t (t.id)}
			<a
				href="/textes/{encodeURIComponent(t.id)}"
				class="card block p-4 hover:border-accent transition-colors"
			>
				<div class="flex items-start justify-between gap-3">
					<div class="min-w-0 flex-1">
						<div class="flex items-center gap-2 mb-1 flex-wrap">
							<span
								class="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-border-soft/50 text-fg-muted"
								title={t.typeLibelle}
							>
								{typeBadge(t.type)}
							</span>
							{#if t.bicameral}
								<span
									class="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-border-soft/40 text-fg-muted"
									title="Scrutins nominaux dans les deux chambres"
								>
									AN + Sénat
								</span>
							{:else if t.an}
								<span class="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-border-soft/40 text-fg-muted">
									AN
								</span>
							{:else if t.senat}
								<span class="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-border-soft/40 text-fg-muted">
									Sénat
								</span>
							{/if}
							{#if t.etat === 'promulgue'}
								<span class="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-vote-pour/20 text-vote-pour">
									Promulguée{#if t.datePromulgation}&nbsp;{formatDate(t.datePromulgation)}{/if}
								</span>
							{:else if t.etat === 'rejete'}
								<span class="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-vote-contre/10 text-vote-contre">
									Rejeté
								</span>
							{:else if t.etat === 'caduc' || t.etat === 'retire' || t.etat === 'fusionne'}
								<span class="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-border-soft/40 text-fg-muted">
									{t.etat === 'caduc' ? 'Caduc' : t.etat === 'retire' ? 'Retiré' : 'Fusionné'}
								</span>
							{:else if t.etat === 'en-cours'}
								<span class="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent/10 text-link">
									En cours
								</span>
							{/if}
							{#if t.numeroLoi}
								<span class="text-xs text-fg-muted">· Loi n° {t.numeroLoi}</span>
							{/if}
						</div>
						<div class="text-sm leading-snug font-medium line-clamp-2">{t.titre}</div>
						<div class="text-xs text-fg-muted mt-1">
							{t.nbScrutins} scrutin{t.nbScrutins > 1 ? 's' : ''}
							{#if t.bicameral}
								(AN&nbsp;{t.an?.nbScrutins} + Sénat&nbsp;{t.senat?.nbScrutins})
							{/if}
							· du {formatDate(t.dateDebut)} au {formatDate(t.dateFin)}
						</div>
					</div>
				</div>
			</a>
		{/each}
		{#if visibleCount < filtered.length}
			<button
				class="w-full py-3 text-sm text-fg-muted hover:text-link border border-border-soft rounded-md"
				onclick={() => (visibleCount += 50)}
			>
				Afficher {Math.min(50, filtered.length - visibleCount)} de plus ({filtered.length - visibleCount}
				restants)
			</button>
		{/if}
		{#if filtered.length === 0}
			<div class="card p-6 text-center text-sm text-fg-muted">
				Aucun texte ne correspond à ces filtres.
			</div>
		{/if}
	</div>
</section>
