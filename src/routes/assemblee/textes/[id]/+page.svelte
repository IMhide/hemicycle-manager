<script lang="ts">
	/**
	 * Fiche d'un texte législatif (cf ADR 0035).
	 *
	 * Affiche :
	 * - en-tête avec titre, statut (promulgué/adopté/rejeté), dates, type
	 * - métadonnées (procédure, initiateurs si proposition) quand enrichi
	 * - votes solennels mis en avant (1re lecture, navette, lecture définitive)
	 * - timeline complète des scrutins, groupés par lecture/date
	 */
	import { lookupEluUrlForPaIdLeg } from '$lib/elus';
	import type { Personne, ScrutinIndex } from '$lib/types';

	let { data } = $props();

	const t = $derived(data.texte);
	const scrutins = $derived(data.scrutins as ScrutinIndex[]);
	const personneById = $derived.by(() => {
		const m = new Map<string, Personne>();
		for (const p of data.personnes) m.set(p.id, p);
		return m;
	});

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('fr-FR', {
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
	}

	function typeBadge(typ: string): string {
		if (typ === 'projet-loi-finances') return 'PLF';
		if (typ === 'projet-loi-finances-rectificative') return 'PLFR';
		if (typ === 'projet-loi-financement-ss') return 'PLFSS';
		if (typ === 'projet-loi-organique') return 'PJL-O';
		if (typ === 'projet-loi-constitutionnelle') return 'PJL-C';
		if (typ === 'projet-loi') return 'PJL';
		if (typ === 'proposition-loi-organique') return 'PPL-O';
		if (typ === 'proposition-loi-constitutionnelle') return 'PPL-C';
		if (typ === 'proposition-loi') return 'PPL';
		if (typ === 'proposition-resolution-europeenne') return 'PPR-EU';
		if (typ === 'proposition-resolution') return 'PPR';
		return '?';
	}

	function typeLong(typ: string): string {
		if (typ === 'projet-loi-finances') return 'Projet de loi de finances';
		if (typ === 'projet-loi-finances-rectificative') return 'Projet de loi de finances rectificative';
		if (typ === 'projet-loi-financement-ss')
			return 'Projet de loi de financement de la sécurité sociale';
		if (typ === 'projet-loi-organique') return 'Projet de loi organique';
		if (typ === 'projet-loi-constitutionnelle') return 'Projet de loi constitutionnelle';
		if (typ === 'projet-loi') return 'Projet de loi';
		if (typ === 'proposition-loi-organique') return 'Proposition de loi organique';
		if (typ === 'proposition-loi-constitutionnelle') return 'Proposition de loi constitutionnelle';
		if (typ === 'proposition-loi') return 'Proposition de loi';
		if (typ === 'proposition-resolution-europeenne') return 'Proposition de résolution européenne';
		if (typ === 'proposition-resolution') return 'Proposition de résolution';
		return 'Texte';
	}

	/** Identifie les "votes clefs" du texte : ce sont les scrutins de type
	 *  "scrutin public solennel" (votes finaux par lecture) ainsi que tout
	 *  scrutin dont le titre commence par "l'ensemble" (vote sur l'ensemble
	 *  du texte). Trié chronologique. */
	const votesClefs = $derived.by(() => {
		// On part de l'index complet pour avoir le type de vote — l'idéal serait
		// d'avoir le typeVote dans ScrutinIndex, mais il n'y est pas. On se contente
		// donc d'un critère titre.
		return scrutins.filter((s) =>
			/^l[' ]ensemble\b|^la motion de rejet|^la motion référendaire/i.test(s.titre)
		);
	});

	const totalPour = $derived(scrutins.reduce((acc, s) => acc + s.pour, 0));
	const totalContre = $derived(scrutins.reduce((acc, s) => acc + s.contre, 0));
	const tauxAdoption = $derived.by(() => {
		const adoptes = scrutins.filter((s) => s.sort === 'adopté').length;
		return scrutins.length === 0 ? 0 : Math.round((adoptes * 100) / scrutins.length);
	});

	function shortTitre(titre: string): string {
		// Coupe les titres trop longs des scrutins ("l'amendement n° X de Mme Y…")
		// On garde la première phrase significative.
		return titre.length > 130 ? titre.slice(0, 130).trim() + '…' : titre;
	}
</script>

<svelte:head>
	<title>{t.titre} — PolitiDex</title>
</svelte:head>

<section class="max-w-7xl mx-auto px-6 py-8 space-y-6">
	<a
		href="/assemblee/textes/"
		class="text-sm text-assembly-muted hover:text-assembly-accent inline-flex items-center gap-1"
	>
		← Tous les textes
	</a>

	<!-- En-tête -->
	<div class="card p-6 space-y-3">
		<div class="flex items-start justify-between gap-4">
			<div class="min-w-0 flex-1">
				<div class="flex items-center gap-2 mb-2 flex-wrap">
					<span
						class="text-[11px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-assembly-border/50 text-assembly-muted"
						title={t.type}
					>
						{typeBadge(t.type)}
					</span>
					<span class="text-xs text-assembly-muted">
						{t.legislature}<sup>e</sup> législature
					</span>
					{#if t.procedureLibelle}
						<span class="text-xs text-assembly-muted">· {t.procedureLibelle}</span>
					{:else}
						<span class="text-xs text-assembly-muted">· {typeLong(t.type)}</span>
					{/if}
				</div>
				<h1 class="text-xl sm:text-2xl leading-snug font-semibold">{t.titre}</h1>
				<div class="text-xs text-assembly-muted mt-2">
					Du {formatDate(t.dateDebut)} au {formatDate(t.dateFin)} · {t.nbScrutins} scrutin{t.nbScrutins >
					1
						? 's'
						: ''}
					{#if t.nbVotesSolennels > 0}
						(dont {t.nbVotesSolennels} solennel{t.nbVotesSolennels > 1 ? 's' : ''})
					{/if}
				</div>
			</div>
			<div class="flex flex-col items-end gap-1">
				{#if t.datePromulgation}
					<div
						class="title-display text-lg px-3 py-1.5 rounded-md whitespace-nowrap bg-vote-pour/20 text-vote-pour"
					>
						Promulguée
					</div>
					<div class="text-xs text-assembly-muted">JO du {formatDate(t.datePromulgation)}</div>
				{:else if t.sortFinal === 'adopté'}
					<div
						class="title-display text-lg px-3 py-1.5 rounded-md whitespace-nowrap bg-vote-pour/20 text-vote-pour"
					>
						Adopté
					</div>
				{:else if t.sortFinal === 'rejeté'}
					<div
						class="title-display text-lg px-3 py-1.5 rounded-md whitespace-nowrap bg-vote-contre/20 text-vote-contre"
					>
						Rejeté
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

		{#if t.initiateurs.length > 0}
			<div class="text-sm text-assembly-muted pt-2 border-t border-assembly-border">
				<span class="text-assembly-muted">À l'initiative de </span>
				{#each t.initiateurs as paId, i}
					{@const personne = personneById.get(paId)}
					{#if personne}
						<a
							href={lookupEluUrlForPaIdLeg(paId, t.legislature)}
							class="text-assembly-accent hover:underline"
						>
							{personne.identite.prenom}
							{personne.identite.nom}
						</a>
					{:else}
						<span>{paId}</span>
					{/if}
					{#if i < t.initiateurs.length - 1}<span class="text-assembly-muted">, </span>{/if}
				{/each}
			</div>
		{/if}

		{#if !t.enrichiDossiersAN}
			<div
				class="text-xs text-assembly-muted/80 pt-2 border-t border-assembly-border italic"
				title="Le titre officiel de ce texte n'est pas exposé par Etalab. Affichage du titre dérivé des scrutins."
			>
				Métadonnées partielles : ce texte n'a pas été enrichi par le dump Etalab des dossiers
				législatifs.
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
			<div class="text-2xl font-semibold">{t.nbVotesSolennels}</div>
			<div class="text-xs text-assembly-muted">Vote{t.nbVotesSolennels > 1 ? 's' : ''} solennel{t.nbVotesSolennels > 1 ? 's' : ''}</div>
		</div>
		<div class="card p-4 text-center">
			<div class="text-2xl font-semibold">{tauxAdoption}%</div>
			<div class="text-xs text-assembly-muted">Taux d'adoption</div>
		</div>
		<div class="card p-4 text-center">
			<div class="text-2xl font-semibold">
				{Math.round((new Date(t.dateFin).getTime() - new Date(t.dateDebut).getTime()) / 86400000)}
			</div>
			<div class="text-xs text-assembly-muted">Jours d'examen</div>
		</div>
	</div>

	<!-- Votes clefs (ensemble, motions de rejet…) -->
	{#if votesClefs.length > 0}
		<div class="card p-6">
			<h2 class="text-lg font-semibold mb-4">Votes clefs</h2>
			<div class="space-y-2">
				{#each votesClefs as s}
					<a
						href="/assemblee/scrutins/{s.uid}"
						class="block p-3 rounded-md border border-assembly-border hover:border-assembly-accent transition-colors"
					>
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0 flex-1">
								<div class="text-xs text-assembly-muted">
									Scrutin n°{s.numero} · {formatDate(s.date)}
								</div>
								<div class="text-sm leading-snug mt-0.5">{shortTitre(s.titre)}</div>
								<div class="text-xs text-assembly-muted mt-1">
									<span class="text-vote-pour">{s.pour} pour</span> ·
									<span class="text-vote-contre">{s.contre} contre</span> ·
									<span>{s.abstention} abstention{s.abstention > 1 ? 's' : ''}</span>
								</div>
							</div>
							<div
								class="title-display text-sm px-2.5 py-1 rounded whitespace-nowrap {s.sort ===
								'adopté'
									? 'bg-vote-pour/20 text-vote-pour'
									: s.sort === 'rejeté'
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
			{#each scrutins as s, i}
				<a
					href="/assemblee/scrutins/{s.uid}"
					class="block px-3 py-2 rounded-md hover:bg-assembly-border/30 transition-colors"
				>
					<div class="flex items-start gap-3 text-sm">
						<div class="text-xs text-assembly-muted shrink-0 w-24">
							{formatDate(s.date)}
						</div>
						<div class="text-xs text-assembly-muted shrink-0 w-16 font-mono">
							n°{s.numero}
						</div>
						<div class="min-w-0 flex-1">
							<div class="leading-snug">{shortTitre(s.titre)}</div>
						</div>
						<div
							class="shrink-0 text-xs px-2 py-0.5 rounded {s.sort === 'adopté'
								? 'bg-vote-pour/15 text-vote-pour'
								: s.sort === 'rejeté'
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
