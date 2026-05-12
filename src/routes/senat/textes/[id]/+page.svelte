<script lang="ts">
	/**
	 * Fiche d'un texte législatif Sénat (N3.b navette).
	 *
	 * Affiche :
	 * - en-tête : titre, état (promulgué / rejeté / caduc / etc.), dates, type
	 * - lien JO si disponible
	 * - votes clefs ("sur l'ensemble", motions)
	 * - timeline complète des scrutins
	 */
	import type { ScrutinSenatIndex } from '$lib/types';

	let { data } = $props();

	const t = $derived(data.texte);
	const scrutins = $derived(data.scrutins as ScrutinSenatIndex[]);

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('fr-FR', {
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
	}

	/** Libellé court (chip) — identique à la liste. */
	function typeBadge(typ: string): string {
		if (typ === 'pjlf') return 'PLF';
		if (typ === 'pjlr') return 'PLFR';
		if (typ === 'pjfs') return 'PLFSS';
		if (typ === 'pfsr') return 'PLFSSR';
		if (typ === 'pjlo') return 'PJL-O';
		if (typ === 'pjlc') return 'PJL-C';
		if (typ === 'pjlg') return 'PJL-R';
		if (typ === 'pjl') return 'PJL';
		if (typ === 'prog') return 'PJL-P';
		if (typ === 'pplo') return 'PPL-O';
		if (typ === 'pplc') return 'PPL-C';
		if (typ === 'ppro') return 'PPL-P';
		if (typ === 'ppl') return 'PPL';
		if (typ === 'refe') return 'PPL-11';
		if (typ === 'pac') return 'PPR-EU';
		if (typ === 'ppre') return 'PPR-RGL';
		if (typ === 'ppra') return 'PPR';
		if (typ === 'pprp') return 'PPR-34';
		if (typ === 'enq') return 'CE';
		if (typ === 'cvn') return 'CVN';
		if (typ === 'mref') return 'M-REF';
		if (typ === 'dape') return 'DAPE';
		return '?';
	}

	/** Identifie les "votes clefs" du texte : ceux dont le titre commence par
	 *  "sur l'ensemble" (votes sur l'ensemble), motions, ou rejets. */
	const votesClefs = $derived.by(() => {
		return scrutins.filter((s) =>
			/^sur l[' ]ensemble\b|^sur la motion|^sur la question préalable/i.test(s.titre)
		);
	});

	const totalPour = $derived(scrutins.reduce((acc, s) => acc + s.pour, 0));
	const totalContre = $derived(scrutins.reduce((acc, s) => acc + s.contre, 0));
	const tauxAdoption = $derived.by(() => {
		const adoptes = scrutins.filter((s) => /adopté/i.test(s.sort)).length;
		return scrutins.length === 0 ? 0 : Math.round((adoptes * 100) / scrutins.length);
	});

	function shortTitre(titre: string): string {
		return titre.length > 130 ? titre.slice(0, 130).trim() + '…' : titre;
	}
</script>

<svelte:head>
	<title>{t.titre} — PolitiDex</title>
</svelte:head>

<section class="max-w-7xl mx-auto px-6 py-8 space-y-6">
	<a
		href="/senat/textes/"
		class="text-sm text-assembly-muted hover:text-assembly-accent inline-flex items-center gap-1"
	>
		← Tous les textes Sénat
	</a>

	<!-- En-tête -->
	<div class="card p-6 space-y-3">
		<div class="flex items-start justify-between gap-4">
			<div class="min-w-0 flex-1">
				<div class="flex items-center gap-2 mb-2 flex-wrap">
					<span
						class="text-[11px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-assembly-border/50 text-assembly-muted"
						title={t.typeLibelle}
					>
						{typeBadge(t.type)}
					</span>
					<span class="text-xs text-assembly-muted">Triennat {t.triennat}</span>
					<span class="text-xs text-assembly-muted">· {t.typeLibelle}</span>
					{#if t.numeroLoi}
						<span class="text-xs text-assembly-muted">· Loi n° {t.numeroLoi}</span>
					{/if}
				</div>
				<h1 class="text-xl sm:text-2xl leading-snug font-semibold">{t.titre}</h1>
				<div class="text-xs text-assembly-muted mt-2">
					Du {formatDate(t.dateDebut)} au {formatDate(t.dateFin)} · {t.nbScrutins} scrutin{t.nbScrutins >
					1
						? 's'
						: ''}
				</div>
				{#if t.urlJO}
					<div class="mt-2">
						<a
							href={t.urlJO}
							target="_blank"
							rel="noopener noreferrer"
							class="text-xs inline-flex items-center gap-1 text-assembly-accent hover:underline"
							title="Texte au Journal Officiel (Légifrance)"
						>
							Texte au JO <span aria-hidden="true">↗</span>
						</a>
					</div>
				{/if}
			</div>
			<div class="flex flex-col items-end gap-1">
				{#if t.etat === 'promulgue'}
					<div
						class="title-display text-lg px-3 py-1.5 rounded-md whitespace-nowrap bg-vote-pour/20 text-vote-pour"
					>
						Promulguée
					</div>
					{#if t.datePromulgation}
						<div class="text-xs text-assembly-muted">JO du {formatDate(t.datePromulgation)}</div>
					{/if}
				{:else if t.etat === 'rejete'}
					<div
						class="title-display text-base px-3 py-1.5 rounded-md whitespace-nowrap bg-vote-contre/20 text-vote-contre"
					>
						Rejeté
					</div>
				{:else if t.etat === 'caduc'}
					<div
						class="title-display text-base px-3 py-1.5 rounded-md whitespace-nowrap bg-assembly-border text-assembly-muted"
					>
						Caduc
					</div>
				{:else if t.etat === 'retire'}
					<div
						class="title-display text-base px-3 py-1.5 rounded-md whitespace-nowrap bg-assembly-border text-assembly-muted"
					>
						Retiré
					</div>
				{:else if t.etat === 'fusionne'}
					<div
						class="title-display text-base px-3 py-1.5 rounded-md whitespace-nowrap bg-assembly-border text-assembly-muted"
					>
						Fusionné
					</div>
				{:else if t.etat === 'en-cours'}
					<div
						class="title-display text-base px-3 py-1.5 rounded-md whitespace-nowrap bg-assembly-accent/15 text-assembly-accent"
					>
						En cours
					</div>
				{:else}
					<div
						class="title-display text-base px-3 py-1.5 rounded-md whitespace-nowrap bg-assembly-border text-assembly-muted"
					>
						{t.sortFinal}
					</div>
				{/if}
			</div>
		</div>

		{#if !t.enrichiDosleg}
			<div
				class="text-xs text-assembly-muted/80 pt-2 border-t border-assembly-border italic"
				title="Le titre officiel de ce texte n'a pas été retrouvé dans le dump dosleg (libellé du Sénat)."
			>
				Métadonnées partielles : ce texte n'a pas été enrichi par le dump dosleg du Sénat (matching titre).
			</div>
		{/if}
	</div>

	<!-- Indicateurs -->
	<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
		<div class="card p-4 text-center">
			<div class="text-2xl font-semibold">{t.nbScrutins}</div>
			<div class="text-xs text-assembly-muted">Scrutins</div>
		</div>
		<div class="card p-4 text-center">
			<div class="text-2xl font-semibold">{totalPour}</div>
			<div class="text-xs text-assembly-muted">Votes pour cumulés</div>
		</div>
		<div class="card p-4 text-center">
			<div class="text-2xl font-semibold">{totalContre}</div>
			<div class="text-xs text-assembly-muted">Votes contre cumulés</div>
		</div>
		<div class="card p-4 text-center">
			<div class="text-2xl font-semibold">{tauxAdoption}%</div>
			<div class="text-xs text-assembly-muted">Taux d'adoption</div>
		</div>
	</div>

	<!-- Votes clefs (ensemble, motions, question préalable) -->
	{#if votesClefs.length > 0}
		<div class="card p-6">
			<h2 class="text-lg font-semibold mb-4">Votes clefs</h2>
			<div class="space-y-2">
				{#each votesClefs as s}
					<a
						href="/senat/scrutins/{s.uid}"
						class="block p-3 rounded-md border border-assembly-border hover:border-assembly-accent transition-colors"
					>
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0 flex-1">
								<div class="text-xs text-assembly-muted">
									Scrutin n°{s.scrnum} · session {s.sesann}-{s.sesann + 1} · {formatDate(s.date)}
								</div>
								<div class="text-sm leading-snug mt-0.5">{shortTitre(s.titre)}</div>
								<div class="text-xs text-assembly-muted mt-1">
									<span class="text-vote-pour">{s.pour} pour</span> ·
									<span class="text-vote-contre">{s.contre} contre</span> ·
									<span>{s.abstention} abstention{s.abstention > 1 ? 's' : ''}</span>
								</div>
							</div>
							<div
								class="title-display text-sm px-2.5 py-1 rounded whitespace-nowrap {/adopté/i.test(s.sort)
									? 'bg-vote-pour/20 text-vote-pour'
									: /rejeté/i.test(s.sort)
										? 'bg-vote-contre/20 text-vote-contre'
										: 'bg-assembly-border text-assembly-muted'}"
							>
								{s.sort}
							</div>
						</div>
					</a>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Timeline complète des scrutins -->
	<div class="card p-6">
		<h2 class="text-lg font-semibold mb-4">Tous les scrutins ({scrutins.length})</h2>
		<div class="space-y-1 max-h-[70vh] overflow-y-auto pr-2">
			{#each scrutins as s}
				<a
					href="/senat/scrutins/{s.uid}"
					class="block px-3 py-2 rounded-md hover:bg-assembly-border/30 transition-colors"
				>
					<div class="flex items-start justify-between gap-3">
						<div class="min-w-0 flex-1">
							<div class="text-[10px] text-assembly-muted">
								n°{s.scrnum} · {formatDate(s.date)}
							</div>
							<div class="text-xs leading-snug truncate">{s.titre}</div>
						</div>
						<div
							class="text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap {/adopté/i.test(s.sort)
								? 'bg-vote-pour/15 text-vote-pour'
								: /rejeté/i.test(s.sort)
									? 'bg-vote-contre/15 text-vote-contre'
									: 'bg-assembly-border/40 text-assembly-muted'}"
						>
							{s.sort}
						</div>
					</div>
				</a>
			{/each}
		</div>
	</div>
</section>
