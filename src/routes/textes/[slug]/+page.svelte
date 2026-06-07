<script lang="ts">
	/**
	 * Fiche unifiée cross-chambre d'un texte législatif (N3.d, cf ADR 0036).
	 *
	 * Layout wireframe B : header unifié + timeline navette en haut + 2 colonnes
	 * AN | Sénat côte à côte. Si mono-chambre, la colonne vide affiche un encart
	 * pédagogique "Pas examiné au Sénat / à l'AN".
	 */
	import { lookupEluUrlForPaIdLeg } from '$lib/elus';
	import type {
		Personne,
		ScrutinIndex,
		ScrutinSenatIndex,
		ActeurNom
	} from '$lib/types';
	import TimelineNavette from '$lib/components/TimelineNavette.svelte';

	let { data } = $props();

	const t = $derived(data.texte);
	const anTexte = $derived(data.anTexte);
	const senatTexte = $derived(data.senatTexte);
	const scrutinsAN = $derived(data.scrutinsAN as ScrutinIndex[]);
	const scrutinsSenat = $derived(data.scrutinsSenat as ScrutinSenatIndex[]);

	const personneById = $derived.by(() => {
		const m = new Map<string, Personne>();
		for (const p of data.personnes) m.set(p.id, p);
		return m;
	});
	const acteurNomById = $derived.by(() => {
		const m = new Map<string, ActeurNom>();
		for (const a of data.acteursNoms) m.set(a.id, a);
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
		return 'AUTRE';
	}

	function shortTitre(titre: string): string {
		return titre.length > 130 ? titre.slice(0, 130).trim() + '…' : titre;
	}

	// Votes clefs AN ("ensemble", motion rejet, motion référendaire)
	const votesClefsAN = $derived(
		scrutinsAN.filter((s) =>
			/^l[' ]ensemble\b|^la motion de rejet|^la motion référendaire/i.test(s.titre)
		)
	);
	// Votes clefs Sénat ("sur l'ensemble", motion, question préalable)
	const votesClefsSenat = $derived(
		scrutinsSenat.filter((s) =>
			/^sur l[' ]ensemble\b|^sur la motion|^sur la question préalable/i.test(s.titre)
		)
	);

	const tauxAdoptionAN = $derived.by(() => {
		const adoptes = scrutinsAN.filter((s) => s.sort === 'adopté').length;
		return scrutinsAN.length === 0 ? 0 : Math.round((adoptes * 100) / scrutinsAN.length);
	});
	const tauxAdoptionSenat = $derived.by(() => {
		const adoptes = scrutinsSenat.filter((s) => /adopté/i.test(s.sort)).length;
		return scrutinsSenat.length === 0 ? 0 : Math.round((adoptes * 100) / scrutinsSenat.length);
	});
</script>

<svelte:head>
	<title>{t.titre} — PolitiDex</title>
</svelte:head>

<section class="max-w-7xl mx-auto px-6 py-8 space-y-6">
	<a
		href="/textes/"
		class="text-sm text-fg-muted hover:text-link inline-flex items-center gap-1"
	>
		← Tous les textes
	</a>

	<!-- En-tête unifié -->
	<div class="card p-6 space-y-3">
		<div class="flex items-start justify-between gap-4 flex-wrap">
			<div class="min-w-0 flex-1">
				<div class="flex items-center gap-2 mb-2 flex-wrap">
					<span
						class="text-[11px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-border-soft/50 text-fg-muted"
						title={t.typeLibelle}
					>
						{typeBadge(t.type)}
					</span>
					{#if !t.bicameral && t.an}
						<span class="text-xs text-fg-muted">Assemblée nationale uniquement</span>
					{:else if !t.bicameral && t.senat}
						<span class="text-xs text-fg-muted">Sénat uniquement</span>
					{/if}
					{#if t.numeroLoi}
						<span class="text-xs text-fg-muted">· Loi n° {t.numeroLoi}</span>
					{/if}
					{#if t.procedureLibelle}
						<span class="text-xs text-fg-muted">· {t.procedureLibelle}</span>
					{:else}
						<span class="text-xs text-fg-muted">· {t.typeLibelle}</span>
					{/if}
				</div>
				<h1 class="text-xl sm:text-2xl leading-snug font-semibold">{t.titre}</h1>
				<div class="text-xs text-fg-muted mt-2">
					Du {formatDate(t.dateDebut)} au {formatDate(t.dateFin)} · {t.nbScrutins} scrutin{t.nbScrutins >
					1
						? 's'
						: ''}
				</div>
				{#if t.urlJO || t.senatUrl}
					<div class="mt-2 flex flex-wrap gap-3">
						{#if t.urlJO}
							<a
								href={t.urlJO}
								target="_blank"
								rel="noopener noreferrer"
								class="text-xs inline-flex items-center gap-1 text-link hover:underline"
								title="Texte au Journal Officiel (Légifrance)"
							>
								Texte au JO <span aria-hidden="true">↗</span>
							</a>
						{/if}
						{#if t.senatUrl}
							<a
								href={t.senatUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="text-xs inline-flex items-center gap-1 text-fg-muted hover:text-link hover:underline"
								title="Dossier officiel sur senat.fr"
							>
								Dossier senat.fr <span aria-hidden="true">↗</span>
							</a>
						{/if}
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
						<div class="text-xs text-fg-muted">JO du {formatDate(t.datePromulgation)}</div>
					{/if}
				{:else if t.etat === 'rejete'}
					<div
						class="title-display text-base px-3 py-1.5 rounded-md whitespace-nowrap bg-vote-contre/20 text-vote-contre"
					>
						Rejeté
					</div>
				{:else if t.etat === 'caduc' || t.etat === 'retire' || t.etat === 'fusionne'}
					<div
						class="title-display text-base px-3 py-1.5 rounded-md whitespace-nowrap bg-border-soft text-fg-muted"
					>
						{t.etat === 'caduc' ? 'Caduc' : t.etat === 'retire' ? 'Retiré' : 'Fusionné'}
					</div>
				{:else if t.etat === 'en-cours'}
					<div
						class="title-display text-base px-3 py-1.5 rounded-md whitespace-nowrap bg-accent/15 text-link"
					>
						En cours
					</div>
				{/if}
			</div>
		</div>

		{#if t.initiateurs.length > 0}
			<div class="text-sm text-fg-muted pt-2 border-t border-border-soft">
				<span class="text-fg-muted">À l'initiative de </span>
				{#each t.initiateurs as paId, i}
					{@const personne = personneById.get(paId)}
					{@const acteur = acteurNomById.get(paId)}
					{#if personne && t.an}
						<a
							href={lookupEluUrlForPaIdLeg(paId, t.an.texteId.startsWith('DLR5L17') ? 17 : t.an.texteId.startsWith('DLR5L16') ? 16 : 15)}
							class="text-link hover:underline"
						>
							{personne.identite.prenom} {personne.identite.nom}
						</a>
					{:else if acteur}
						<span class="text-fg" title="Acteur non-député">
							{acteur.prenom} {acteur.nom}
						</span>
					{:else}
						<span class="text-fg-muted/70">{paId}</span>
					{/if}
					{#if i < t.initiateurs.length - 1}<span class="text-fg-muted">, </span>{/if}
				{/each}
			</div>
		{/if}
	</div>

	<!-- Timeline navette -->
	<TimelineNavette texte={t} />

	<!-- Deux colonnes AN | Sénat -->
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
		<!-- Colonne AN -->
		<div class="card p-5 space-y-3">
			<h2 class="text-lg font-semibold flex items-center gap-2">
				<span class="inline-block w-3 h-3 rounded-full bg-blue-500"></span>
				Assemblée nationale
			</h2>

			{#if t.an && anTexte}
				<div class="grid grid-cols-3 gap-2">
					<div class="text-center bg-bg/40 rounded-md py-2">
						<div class="text-xl font-semibold">{anTexte.nbScrutins}</div>
						<div class="text-[10px] uppercase tracking-wider text-fg-muted">Scrutins</div>
					</div>
					<div class="text-center bg-bg/40 rounded-md py-2">
						<div class="text-xl font-semibold">{anTexte.nbVotesSolennels}</div>
						<div class="text-[10px] uppercase tracking-wider text-fg-muted">Solennels</div>
					</div>
					<div class="text-center bg-bg/40 rounded-md py-2">
						<div class="text-xl font-semibold">{tauxAdoptionAN}%</div>
						<div class="text-[10px] uppercase tracking-wider text-fg-muted">Adoption</div>
					</div>
				</div>

				{#if votesClefsAN.length > 0}
					<div>
						<div class="text-xs uppercase tracking-widest text-fg-muted mb-2 mt-2">
							Votes clefs
						</div>
						<div class="space-y-1.5">
							{#each votesClefsAN.slice(0, 3) as s}
								<a
									href="/assemblee/scrutins/{s.uid}"
									class="block p-2 rounded-md border border-border-soft hover:border-accent transition-colors text-xs"
								>
									<div class="flex items-start justify-between gap-2">
										<div class="min-w-0 flex-1">
											<div class="text-fg-muted">
												n°{s.numero} · {formatDate(s.date)}
											</div>
											<div class="leading-snug mt-0.5">{shortTitre(s.titre)}</div>
											<div class="text-fg-muted mt-1">
												<span class="text-vote-pour">{s.pour}</span> /
												<span class="text-vote-contre">{s.contre}</span> /
												<span>{s.abstention} abs</span>
											</div>
										</div>
										<div
											class="px-1.5 py-0.5 rounded whitespace-nowrap text-[10px] {s.sort === 'adopté'
												? 'bg-vote-pour/20 text-vote-pour'
												: s.sort === 'rejeté'
													? 'bg-vote-contre/20 text-vote-contre'
													: 'bg-border-soft text-fg-muted'}"
										>
											{s.sort}
										</div>
									</div>
								</a>
							{/each}
						</div>
					</div>
				{/if}

				<div>
					<div class="text-xs uppercase tracking-widest text-fg-muted mb-2 mt-2">
						Tous les scrutins ({scrutinsAN.length})
					</div>
					<div class="space-y-0.5 max-h-[420px] overflow-y-auto pr-2">
						{#each scrutinsAN as s}
							<a
								href="/assemblee/scrutins/{s.uid}"
								class="block px-2 py-1.5 rounded-md hover:bg-border-soft/30 transition-colors"
							>
								<div class="flex items-start justify-between gap-2">
									<div class="min-w-0 flex-1">
										<div class="text-[10px] text-fg-muted">
											n°{s.numero} · {formatDate(s.date)}
										</div>
										<div class="text-xs leading-snug truncate">{s.titre}</div>
									</div>
									<div
										class="text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap {s.sort ===
										'adopté'
											? 'bg-vote-pour/15 text-vote-pour'
											: s.sort === 'rejeté'
												? 'bg-vote-contre/15 text-vote-contre'
												: 'bg-border-soft/40 text-fg-muted'}"
									>
										{s.sort}
									</div>
								</div>
							</a>
						{/each}
					</div>
				</div>
			{:else}
				<div class="text-sm text-fg-muted italic py-8 text-center bg-bg/30 rounded-md">
					<div class="text-3xl mb-2 opacity-60">∅</div>
					<div>Pas examiné à l'Assemblée nationale</div>
					<div class="text-xs mt-1 opacity-70">
						Ce texte n'a pas (encore) fait l'objet de scrutins nominaux à l'AN.
					</div>
				</div>
			{/if}
		</div>

		<!-- Colonne Sénat -->
		<div class="card p-5 space-y-3">
			<h2 class="text-lg font-semibold flex items-center gap-2">
				<span class="inline-block w-3 h-3 rounded-full bg-red-500"></span>
				Sénat
			</h2>

			{#if t.senat && senatTexte}
				<div class="grid grid-cols-3 gap-2">
					<div class="text-center bg-bg/40 rounded-md py-2">
						<div class="text-xl font-semibold">{senatTexte.nbScrutins}</div>
						<div class="text-[10px] uppercase tracking-wider text-fg-muted">Scrutins</div>
					</div>
					<div class="text-center bg-bg/40 rounded-md py-2">
						<div class="text-xl font-semibold">{senatTexte.triennat}</div>
						<div class="text-[10px] uppercase tracking-wider text-fg-muted">Triennat</div>
					</div>
					<div class="text-center bg-bg/40 rounded-md py-2">
						<div class="text-xl font-semibold">{tauxAdoptionSenat}%</div>
						<div class="text-[10px] uppercase tracking-wider text-fg-muted">Adoption</div>
					</div>
				</div>

				{#if votesClefsSenat.length > 0}
					<div>
						<div class="text-xs uppercase tracking-widest text-fg-muted mb-2 mt-2">
							Votes clefs
						</div>
						<div class="space-y-1.5">
							{#each votesClefsSenat.slice(0, 3) as s}
								<a
									href="/senat/scrutins/{s.uid}"
									class="block p-2 rounded-md border border-border-soft hover:border-accent transition-colors text-xs"
								>
									<div class="flex items-start justify-between gap-2">
										<div class="min-w-0 flex-1">
											<div class="text-fg-muted">
												n°{s.scrnum} · {formatDate(s.date)}
											</div>
											<div class="leading-snug mt-0.5">{shortTitre(s.titre)}</div>
											<div class="text-fg-muted mt-1">
												<span class="text-vote-pour">{s.pour}</span> /
												<span class="text-vote-contre">{s.contre}</span> /
												<span>{s.abstention} abs</span>
											</div>
										</div>
										<div
											class="px-1.5 py-0.5 rounded whitespace-nowrap text-[10px] {/adopté/i.test(s.sort)
												? 'bg-vote-pour/20 text-vote-pour'
												: /rejeté/i.test(s.sort)
													? 'bg-vote-contre/20 text-vote-contre'
													: 'bg-border-soft text-fg-muted'}"
										>
											{s.sort}
										</div>
									</div>
								</a>
							{/each}
						</div>
					</div>
				{/if}

				<div>
					<div class="text-xs uppercase tracking-widest text-fg-muted mb-2 mt-2">
						Tous les scrutins ({scrutinsSenat.length})
					</div>
					<div class="space-y-0.5 max-h-[420px] overflow-y-auto pr-2">
						{#each scrutinsSenat as s}
							<a
								href="/senat/scrutins/{s.uid}"
								class="block px-2 py-1.5 rounded-md hover:bg-border-soft/30 transition-colors"
							>
								<div class="flex items-start justify-between gap-2">
									<div class="min-w-0 flex-1">
										<div class="text-[10px] text-fg-muted">
											n°{s.scrnum} · {formatDate(s.date)}
										</div>
										<div class="text-xs leading-snug truncate">{s.titre}</div>
									</div>
									<div
										class="text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap {/adopté/i.test(
											s.sort
										)
											? 'bg-vote-pour/15 text-vote-pour'
											: /rejeté/i.test(s.sort)
												? 'bg-vote-contre/15 text-vote-contre'
												: 'bg-border-soft/40 text-fg-muted'}"
									>
										{s.sort}
									</div>
								</div>
							</a>
						{/each}
					</div>
				</div>
			{:else}
				<div class="text-sm text-fg-muted italic py-8 text-center bg-bg/30 rounded-md">
					<div class="text-3xl mb-2 opacity-60">∅</div>
					<div>Pas examiné au Sénat</div>
					<div class="text-xs mt-1 opacity-70">
						{#if t.senatUrl}
							Le dossier existe côté Sénat mais aucun scrutin nominal n'a été tenu.
						{:else}
							Ce texte n'a pas (encore) été transmis au Sénat.
						{/if}
					</div>
				</div>
			{/if}
		</div>
	</div>
</section>
