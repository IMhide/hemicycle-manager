<script lang="ts">
	/**
	 * Page 404 prérendue (cf ADR 0041). Cible de `error_page 404` dans nginx :
	 * un vrai 404 stylé, pas le soft-404 (home renvoyée en 200) d'avant.
	 *
	 * Rendue dans le chrome du +layout (header, recherche, nav), donc on ne
	 * fournit ici que le contenu central + des sorties de secours utiles.
	 */
</script>

<svelte:head>
	<title>Page introuvable (404) — PolitiDex</title>
	<meta name="robots" content="noindex" />
	<meta name="description" content="Cette page n'existe pas ou plus sur PolitiDex." />
</svelte:head>

<section class="mx-auto max-w-2xl px-6 py-16 sm:py-24 text-center">
	<div
		class="mb-6 inline-block px-3 py-1 text-[11px] font-bold uppercase tracking-widest"
		style="background: var(--accent); color: var(--accent-fg); border: 2px solid var(--border);"
	>
		Erreur 404
	</div>

	<h1 class="title-display text-6xl leading-[0.9] sm:text-8xl">Page introuvable</h1>

	<p class="mx-auto mt-5 max-w-md text-lg text-fg-muted">
		Cette page n'existe pas ou plus. Le lien est peut-être erroné, ou l'élu / le texte
		recherché n'est pas (encore) dans PolitiDex.
	</p>

	<div class="mt-8 flex flex-wrap items-center justify-center gap-3">
		<a
			href="/"
			class="px-4 py-2 text-sm font-bold uppercase tracking-widest"
			style="background: var(--accent); color: var(--accent-fg); border: 3px solid var(--border);"
		>
			Accueil
		</a>
		<a
			href="/elus/"
			class="px-4 py-2 text-sm font-semibold"
			style="border: 3px solid var(--border);"
		>
			Les élus
		</a>
		<a
			href="/textes/"
			class="px-4 py-2 text-sm font-semibold"
			style="border: 3px solid var(--border);"
		>
			Les textes
		</a>
	</div>

	<p class="mt-10 text-sm text-fg-muted">
		Astuce : utilisez la recherche en haut de page pour retrouver un député, un
		sénateur ou un texte de loi.
	</p>
</section>
