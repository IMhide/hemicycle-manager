<script lang="ts">
	/**
	 * Bandeau chronologique navette parlementaire (N3.d + ADR 0037).
	 *
	 * Affiche la timeline `texte.timelineNavette` (extraite du dump
	 * `actesLegislatifs` AN, cf scripts/lib/timeline-navette.ts) :
	 *  - Chaque acte est un jalon coloré (bleu AN / rouge Sénat / violet CMP / or CC / vert JO)
	 *  - Si l'acte correspond à un scrutin nominal connu, l'utilisateur peut
	 *    cliquer pour voir la fiche scrutin
	 *  - Sinon (vote à main levée, dépôt, CMP procédurale), juste l'info date+label
	 *
	 * Layout : frise horizontale scrollable sur desktop, empilage vertical
	 * sur mobile (flex-wrap).
	 *
	 * Fallback : si `timelineNavette` est vide (texte non enrichi), on affiche
	 * un message explicite plutôt que rien.
	 */
	import type { TexteUnifie, TimelineActe, TimelineChambre } from '$lib/types';

	let { texte }: { texte: TexteUnifie } = $props();

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('fr-FR', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}

	function chambreClass(c: TimelineChambre): string {
		// Bleu AN / rouge Sénat / violet CMP / amber CC / vert promulgation
		if (c === 'AN') return 'bg-blue-500/15 text-blue-300 border-blue-500/40';
		if (c === 'SEN') return 'bg-red-500/15 text-red-300 border-red-500/40';
		if (c === 'CMP') return 'bg-purple-500/15 text-purple-300 border-purple-500/40';
		if (c === 'CC') return 'bg-amber-500/15 text-amber-300 border-amber-500/40';
		if (c === 'JO') return 'bg-vote-pour/15 text-vote-pour border-vote-pour/40';
		return 'bg-assembly-border/50 text-assembly-fg border-assembly-border';
	}

	/** Si l'acte a un scrutinUid, on construit l'URL vers la fiche scrutin. */
	function scrutinHref(a: TimelineActe): string | null {
		if (!a.scrutinUid || !a.scrutinChambre) return null;
		const base = a.scrutinChambre === 'SEN' ? '/senat/scrutins' : '/assemblee/scrutins';
		return `${base}/${encodeURIComponent(a.scrutinUid)}`;
	}

	/** Picto compact qui résume la nature de l'acte. */
	function picto(a: TimelineActe): string {
		if (a.phase === 'depot') return '📥';
		if (a.phase === 'promulgation') return '📜';
		if (a.phase === 'cmp') return '🤝';
		if (a.phase === 'conseil-constitutionnel') return '⚖️';
		if (a.phase === 'engagement-responsabilite') return '⚡'; // 49.3
		if (a.phase === 'motion-censure') return '🚫';
		if (a.phase === 'retrait') return '↩️';
		if (a.scrutinUid) return '🗳️'; // vote nominal
		return '✋'; // vote à main levée (acte de vote sans scrutin nominal)
	}
</script>

<div class="card p-4">
	<div class="text-xs uppercase tracking-widest text-assembly-muted mb-3">
		Parcours navette parlementaire
		{#if texte.timelineNavette.length > 0}
			· {texte.timelineNavette.length} étape{texte.timelineNavette.length > 1 ? 's' : ''}
		{/if}
	</div>

	{#if texte.timelineNavette.length === 0}
		<div class="text-xs text-assembly-muted/80 italic py-2">
			Pas de timeline disponible : ce texte n'a pas été enrichi par le dump
			Etalab des dossiers législatifs.
		</div>
	{:else}
		<div class="flex flex-wrap items-stretch gap-2 sm:gap-0 overflow-x-auto pb-1">
			{#each texte.timelineNavette as a, i}
				{@const href = scrutinHref(a)}
				<div class="flex items-stretch shrink-0">
					{#if href}
						<a
							{href}
							class="rounded-md border px-3 py-2 text-center min-w-[140px] hover:scale-[1.03] transition-transform {chambreClass(
								a.chambre
							)}"
							title="Cliquer pour voir le scrutin {a.scrutinUid}"
						>
							<div class="text-base leading-none mb-1">{picto(a)}</div>
							<div class="text-[10px] uppercase tracking-wider opacity-90 leading-tight">
								{a.label}
							</div>
							<div class="text-xs font-medium mt-0.5">{formatDate(a.date)}</div>
						</a>
					{:else}
						<div
							class="rounded-md border px-3 py-2 text-center min-w-[140px] {chambreClass(a.chambre)}"
							title={a.phase === 'depot' || a.phase === 'cmp' || a.phase === 'promulgation' || a.phase === 'conseil-constitutionnel'
								? a.label
								: 'Vote sans scrutin nominal (main levée, vote bloqué, etc.)'}
						>
							<div class="text-base leading-none mb-1">{picto(a)}</div>
							<div class="text-[10px] uppercase tracking-wider opacity-90 leading-tight">
								{a.label}
							</div>
							<div class="text-xs font-medium mt-0.5">{formatDate(a.date)}</div>
						</div>
					{/if}
					{#if i < texte.timelineNavette.length - 1}
						<div class="hidden sm:flex items-center px-1 text-assembly-muted/40">→</div>
					{/if}
				</div>
			{/each}
		</div>

		<!-- Légende compacte -->
		<div class="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-assembly-muted">
			<span class="inline-flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-blue-500"></span>AN</span>
			<span class="inline-flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-red-500"></span>Sénat</span>
			<span class="inline-flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-purple-500"></span>CMP</span>
			<span class="inline-flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-amber-500"></span>Conseil constitutionnel</span>
			<span class="inline-flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-vote-pour"></span>Promulgation</span>
			<span class="ml-2">🗳️ = scrutin nominal · ✋ = main levée</span>
		</div>
	{/if}
</div>
