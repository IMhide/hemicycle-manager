<!--
	Racine neutre `/` (cf ADR 0030).

	Hub d'orientation entre les espaces AN, Sénat, Élus, Textes.
	Design v2 (néo-brutalisme) : hero franc, 4 portes en blocs brutalistes
	(ombre dure + hover mécanique), bloc « À propos » assumant la posture
	éditoriale. Icônes SVG (Lucide), zéro emoji. Cf design-system/MASTER.md.
-->
<svelte:head>
	<title>PolitiDex — Le Pokédex des élus nationaux français</title>
	<meta
		name="description"
		content="PolitiDex regroupe les fiches Football Manager des députés et sénateurs français — votes, scrutins, hémicycles, classements. Open data, open source."
	/>
	<meta property="og:title" content="PolitiDex — Le Pokédex des élus nationaux français" />
	<meta
		property="og:description"
		content="Fiches Football Manager des députés et sénateurs français : votes, scrutins, hémicycles, classements. Open data, open source."
	/>
	<meta name="twitter:title" content="PolitiDex — Le Pokédex des élus nationaux français" />
	<meta
		name="twitter:description"
		content="Fiches Football Manager des députés et sénateurs français. Open data, open source."
	/>
</svelte:head>

<section class="mx-auto max-w-6xl px-6 py-10 sm:py-16">
	<!-- Hero -->
	<header class="mb-12">
		<div
			class="mb-5 inline-block px-3 py-1 text-[11px] font-bold uppercase tracking-widest"
			style="background: var(--accent); color: var(--accent-fg); border: 2px solid var(--border);"
		>
			Open data · Open source
		</div>
		<h1 class="title-display text-5xl leading-[0.9] sm:text-7xl">
			Le Pokédex des<br />élus nationaux
		</h1>
		<p class="mt-5 max-w-2xl text-lg text-fg-muted">
			Cartes Football Manager, hémicycles, scrutins, classements — tout ce qu'il faut pour suivre
			les députés et sénateurs sous l'ère Macron.
		</p>
	</header>

	<!-- 4 portes d'entrée (blocs brutalistes) -->
	<div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
		<a href="/assemblee" class="porte">
			<span class="porte-icon" aria-hidden="true">
				<!-- Landmark (Lucide) -->
				<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<line x1="3" y1="22" x2="21" y2="22" /><line x1="6" y1="18" x2="6" y2="11" /><line x1="10" y1="18" x2="10" y2="11" /><line x1="14" y1="18" x2="14" y2="11" /><line x1="18" y1="18" x2="18" y2="11" /><polygon points="12 2 20 7 4 7" />
				</svg>
			</span>
			<span class="porte-titre">Assemblée nationale</span>
			<span class="porte-desc">15ᵉ + 16ᵉ + 17ᵉ législatures (ère Macron complète)</span>
		</a>

		<a href="/senat" class="porte">
			<span class="porte-icon" aria-hidden="true">
				<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<line x1="3" y1="22" x2="21" y2="22" /><line x1="6" y1="18" x2="6" y2="11" /><line x1="10" y1="18" x2="10" y2="11" /><line x1="14" y1="18" x2="14" y2="11" /><line x1="18" y1="18" x2="18" y2="11" /><polygon points="12 2 20 7 4 7" />
				</svg>
			</span>
			<span class="porte-titre">Sénat</span>
			<span class="porte-desc">Triennats 2017-2020, 2020-2023, 2023-2026</span>
		</a>

		<a href="/elus" class="porte">
			<span class="porte-icon" aria-hidden="true">
				<!-- Users (Lucide) -->
				<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
				</svg>
			</span>
			<span class="porte-titre">Tous les élus</span>
			<span class="porte-desc">Une fiche par personne, qu'elle soit députée, sénatrice ou les deux.</span>
		</a>

		<a href="/textes" class="porte">
			<span class="porte-icon" aria-hidden="true">
				<!-- Scroll (Lucide) -->
				<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M8 21h12a2 2 0 0 0 2-2v-2H10v2a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v3h4" /><path d="M19 17V5a2 2 0 0 0-2-2H4" />
				</svg>
			</span>
			<span class="porte-titre">Textes législatifs</span>
			<span class="porte-desc">Chaque texte regroupe les votes AN et Sénat sur un même dossier (navette).</span>
		</a>
	</div>

	<!-- À propos -->
	<div class="brut mt-14 p-6 text-sm leading-relaxed sm:p-8">
		<h2 class="title-display mb-3 text-2xl">À propos</h2>
		<p class="text-fg-muted">
			PolitiDex collecte les <strong class="text-fg">données ouvertes Etalab</strong> (Open Data Assemblée
			nationale, Open Data Sénat) et les présente avec une UX inspirée de <em>Football Manager</em> et
			du <em>Pokédex</em> : une carte par élu, hémicycles interactifs, classements ludiques, badges, infos
			pédagogiques sur chaque métrique.
		</p>
		<p class="mt-3 text-fg-muted">
			La posture est <strong class="text-fg">assumée</strong> : on n'est pas Sciences Po. On préfère
			une métrique simple et compréhensible (cf
			<a class="text-link underline" href="/faq#overall">Overall</a>,
			<a class="text-link underline" href="/faq#elu-carriere">carrière cross-chambre</a>) à un score
			complexe et opaque. Toute décision structurante est consignée en
			<a class="text-link underline" href="https://github.com/IMhide/hemicycle-manager/tree/main/decisions" target="_blank" rel="noopener">ADR publique</a>.
		</p>
		<p class="mt-3 text-fg-muted">
			Code
			<a class="text-link underline" href="https://github.com/IMhide/hemicycle-manager/blob/main/LICENSE" target="_blank" rel="noopener">Unlicense</a>
			(domaine public). Données sous Licence Ouverte (Etalab). Le projet est
			<strong class="text-fg">open source bénévole</strong> :
			<a class="text-link underline" href="https://github.com/IMhide/hemicycle-manager/issues" target="_blank" rel="noopener">les contributions sont bienvenues</a>.
		</p>
	</div>
</section>

<style>
	.porte {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		padding: 1.5rem;
		background: var(--surface);
		border: 3px solid var(--border);
		box-shadow: 4px 4px 0 0 var(--shadow-color);
		transition:
			transform 120ms ease-out,
			box-shadow 120ms ease-out,
			background 120ms ease-out;
	}
	@media (hover: hover) {
		.porte:hover {
			transform: translate(-2px, -2px);
			box-shadow: 8px 8px 0 0 var(--shadow-color);
			background: var(--accent);
			color: var(--accent-fg);
		}
		.porte:hover :global(.porte-desc) {
			color: var(--accent-fg);
		}
	}
	.porte:active {
		transform: translate(2px, 2px);
		box-shadow: none;
	}
	.porte-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 48px;
		height: 48px;
		color: var(--fg);
		border: 2px solid var(--border);
	}
	.porte:hover .porte-icon {
		color: var(--accent-fg);
		border-color: var(--accent-fg);
	}
	.porte-titre {
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: -0.01em;
		font-size: 1.1rem;
		line-height: 1.1;
	}
	.porte-desc {
		font-size: 0.8rem;
		color: var(--fg-muted);
		line-height: 1.4;
	}
	@media (prefers-reduced-motion: reduce) {
		.porte,
		.porte:hover {
			transform: none;
			transition: none;
		}
	}
</style>
