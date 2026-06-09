<script lang="ts">
	import '../app.css';
	import GlobalSearch from '$lib/components/GlobalSearch.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import { page } from '$app/stores';

	let { children } = $props();

	const pathname = $derived($page.url.pathname);
	const isAN = $derived(pathname.startsWith('/assemblee'));
	const isSenat = $derived(pathname.startsWith('/senat'));

	const SITE_URL = 'https://politidex.fr';
	// Canonical auto-référent par défaut. Une page peut le surcharger en
	// exposant `canonicalOverride` dans son load() (ex. un scrutin canonicalisé
	// vers son texte parent, cf ADR 0043) → on n'émet alors PAS de self-canonical
	// pour éviter deux <link rel="canonical"> conflictuels.
	const canonicalOverride = $derived(
		($page.data as { canonicalOverride?: string }).canonicalOverride ?? null
	);
	const canonical = $derived(canonicalOverride ?? SITE_URL + pathname);

	/** Bouton de nav principale (header). Actif = fond jaune brutaliste. */
	function navClass(active: boolean): string {
		return active ? 'navlink navlink-active' : 'navlink';
	}

	/** Onglet de sous-header (AN/Sénat). Actif = pill jaune. */
	function subnavClass(active: boolean): string {
		return active ? 'subtab subtab-active' : 'subtab';
	}
</script>

<svelte:head>
	<link rel="canonical" href={canonical} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content={canonical} />
	<meta property="og:site_name" content="PolitiDex" />
	<meta property="og:locale" content="fr_FR" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:domain" content="politidex.fr" />
	<meta name="twitter:url" content={canonical} />
</svelte:head>

<div class="flex min-h-dvh flex-col">
	<header class="sticky top-0 z-20" style="background: var(--surface); border-bottom: 3px solid var(--border);">
		<div class="shell flex items-center gap-4 py-3">
			<a href="/" class="flex flex-shrink-0 items-center gap-3">
				<div
					class="flex h-10 w-10 items-center justify-center font-display text-2xl font-bold"
					style="background: var(--accent); color: var(--accent-fg); border: 3px solid var(--border);"
				>
					P
				</div>
				<div class="hidden leading-tight sm:block">
					<div class="title-display text-xl">PolitiDex</div>
					<div class="text-[10px] font-medium uppercase tracking-widest text-fg-muted">
						Élus nationaux
					</div>
				</div>
			</a>

			<div class="max-w-md flex-1">
				<GlobalSearch />
			</div>

			<nav class="flex flex-shrink-0 items-center gap-2 text-sm">
				<a href="/elus" class={navClass(pathname.startsWith('/elus'))} title="Tous les élus">Élus</a>
				<a href="/textes" class={navClass(pathname.startsWith('/textes'))} title="Textes législatifs">Textes</a>
				<a href="/assemblee" class={navClass(isAN)} title="Assemblée nationale">AN</a>
				<a href="/senat" class={navClass(isSenat)} title="Sénat">Sénat</a>
				<a href="/faq" class={navClass(pathname.startsWith('/faq'))} title="FAQ — Comment ça marche ?">FAQ</a>
				<ThemeToggle />
			</nav>
		</div>

		{#if isAN}
			<!-- Sous-header contextuel AN -->
			<div style="background: var(--surface-2); border-top: 2px solid var(--border);">
				<div class="shell flex items-center gap-2 overflow-x-auto py-2 text-sm">
					<span class="flex-shrink-0 pr-1 text-[10px] font-semibold uppercase tracking-widest text-fg-muted">
						Assemblée
					</span>
					<a href="/assemblee" class={subnavClass(pathname === '/assemblee/')}>Hémicycle</a>
					<a href="/assemblee/deputes" class={subnavClass(pathname.startsWith('/assemblee/deputes'))}>Députés</a>
					<a href="/assemblee/groupes" class={subnavClass(pathname.startsWith('/assemblee/groupes'))}>Groupes</a>
					<a href="/assemblee/scrutins" class={subnavClass(pathname.startsWith('/assemblee/scrutins'))}>Scrutins</a>
					<a href="/assemblee/classements" class={subnavClass(pathname.startsWith('/assemblee/classements'))}>Classement</a>
				</div>
			</div>
		{:else if isSenat}
			<!-- Sous-header contextuel Sénat -->
			<div style="background: var(--surface-2); border-top: 2px solid var(--border);">
				<div class="shell flex items-center gap-2 overflow-x-auto py-2 text-sm">
					<span class="flex-shrink-0 pr-1 text-[10px] font-semibold uppercase tracking-widest text-fg-muted">
						Sénat
					</span>
					<a href="/senat" class={subnavClass(pathname === '/senat/')}>Hémicycle</a>
					<a href="/senat/senateurs" class={subnavClass(pathname.startsWith('/senat/senateurs'))}>Sénateurs</a>
					<a href="/senat/groupes" class={subnavClass(pathname.startsWith('/senat/groupes'))}>Groupes</a>
					<a href="/senat/triennats" class={subnavClass(pathname.startsWith('/senat/triennats'))}>Triennats</a>
					<a href="/senat/scrutins" class={subnavClass(pathname.startsWith('/senat/scrutins'))}>Scrutins</a>
					<a href="/senat/classements" class={subnavClass(pathname.startsWith('/senat/classements'))}>Classement</a>
				</div>
			</div>
		{/if}
	</header>

	<main class="flex-1">
		{@render children()}
	</main>

	<footer
		class="mt-12 space-y-2 py-6 text-center text-xs text-fg-muted"
		style="border-top: 3px solid var(--border);"
	>
		<div>
			<a class="footlink" href="/faq">FAQ — Comment ça marche ?</a>
			·
			<a class="footlink" href="https://github.com/IMhide/hemicycle-manager" target="_blank" rel="noopener">
				Code source sur GitHub
			</a>
		</div>
		<div>
			Données :
			<a class="footlink" href="https://data.assemblee-nationale.fr" target="_blank" rel="noopener">Open Data Assemblée nationale</a>
			·
			<a class="footlink" href="https://data.senat.fr" target="_blank" rel="noopener">Open Data Sénat</a>
			— Licence Ouverte (Etalab) · Code sous
			<a class="footlink" href="https://github.com/IMhide/hemicycle-manager/blob/main/LICENSE" target="_blank" rel="noopener">Unlicense</a>
		</div>
		<div class="text-[11px] italic">
			Projet open source bénévole. Une idée, un bug, une feature ?
			<a class="footlink" href="https://github.com/IMhide/hemicycle-manager/issues" target="_blank" rel="noopener">Viens nous aider sur GitHub</a>
		</div>
	</footer>
</div>

<style>
	/* ── Conteneur principal (gutters cohérents, max-width lisible) ── */
	:global(.shell) {
		width: 100%;
		max-width: 80rem; /* 1280px */
		margin-inline: auto;
		padding-inline: 1.5rem;
	}
	@media (min-width: 1024px) {
		:global(.shell) {
			padding-inline: 2rem;
		}
	}

	/* ── Liens de nav principale (boutons brutalistes compacts) ── */
	.navlink {
		display: inline-flex;
		align-items: center;
		padding: 0.4rem 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.02em;
		border: 2px solid transparent;
		transition:
			background 120ms ease-out,
			border-color 120ms ease-out,
			transform 120ms ease-out;
	}
	.navlink:hover {
		border-color: var(--border);
		background: var(--surface-2);
	}
	.navlink:active {
		transform: translate(1px, 1px);
	}
	.navlink-active {
		background: var(--accent);
		color: var(--accent-fg);
		border-color: var(--border);
	}

	/* ── Onglets de sous-header (pills brutalistes) ── */
	.subtab {
		display: inline-flex;
		flex-shrink: 0;
		align-items: center;
		white-space: nowrap;
		padding: 0.3rem 0.7rem;
		border: 2px solid transparent;
		color: var(--fg-muted);
		font-weight: 500;
		transition:
			background 120ms ease-out,
			color 120ms ease-out,
			border-color 120ms ease-out;
	}
	.subtab:hover {
		color: var(--fg);
		border-color: var(--border);
	}
	.subtab-active {
		background: var(--accent);
		color: var(--accent-fg);
		border-color: var(--border);
		font-weight: 700;
	}

	.footlink {
		text-decoration: underline;
		transition: color 120ms ease-out;
	}
	.footlink:hover {
		color: var(--fg);
	}
</style>
