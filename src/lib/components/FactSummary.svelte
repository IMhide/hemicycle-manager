<script lang="ts">
	/**
	 * Bloc résumé factuel en langage naturel (cf ADR 0043, PR C).
	 *
	 * `title` est rendu en <h1> (un seul par page — c'est le titre principal de
	 * la fiche, posé au niveau page et non dans une carte rééchangeable).
	 * `summary` est le paragraphe NL qui nomme l'entité et ses chiffres clés —
	 * le texte exact que Google met en avant sur « nom + a voté » et que les IA
	 * citent (cf plan SEO §0bis).
	 *
	 * ♿ Contraste (ADR 0040) : tokens du design-system uniquement. `--fg` sur
	 * `--surface` ≥ 4.5:1 en Light ET Dark.
	 */
	interface Props {
		/** Titre principal de la fiche → <h1>. */
		title: string;
		/** Sous-titre court optionnel (rôle, groupe…), affiché sous le h1. */
		subtitle?: string | null;
		/** Paragraphe factuel en langage naturel. */
		summary: string;
	}

	let { title, subtitle = null, summary }: Props = $props();
</script>

<header class="mb-5">
	<h1 class="title-display text-3xl leading-tight sm:text-4xl">{title}</h1>
	{#if subtitle}
		<p class="mt-1 text-sm font-semibold uppercase tracking-widest text-fg-muted">
			{subtitle}
		</p>
	{/if}
	<p class="mt-3 max-w-2xl text-sm leading-relaxed text-fg">
		{summary}
	</p>
</header>
