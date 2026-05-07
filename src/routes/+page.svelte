<!--
	Racine neutre `/` (cf ADR 0030).

	Cette page sert de hub d'orientation entre les espaces AN, Sénat, Élus
	et Classement global. Elle ne contient pas de données live (ancienne home
	AN déplacée sous /assemblee/) — uniquement une présentation produit + 4
	portes d'entrée.

	En PR #C : version minimale (texte + cartes). En PR #G : enrichie (hero,
	bloc À propos, lien GitHub).
-->
<svelte:head>
	<title>PolitiDex — Le Pokédex des élus nationaux français</title>
	<meta
		name="description"
		content="PolitiDex regroupe les fiches Football Manager des députés et sénateurs français — votes, scrutins, hémicycles, classements."
	/>
</svelte:head>

<section class="max-w-5xl mx-auto px-6 py-10">
	<header class="mb-8 text-center">
		<h1 class="title-display text-4xl mb-2">PolitiDex</h1>
		<p class="text-assembly-muted text-lg">Le Pokédex des élus nationaux français</p>
		<p class="text-assembly-muted text-sm mt-3 max-w-2xl mx-auto">
			Cartes Football Manager, hémicycles, scrutins, classements — tout ce qu'il faut pour suivre
			les députés et sénateurs sous l'ère Macron, en open data.
		</p>
	</header>

	<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
		<a
			href="/assemblee"
			class="card p-6 hover:border-assembly-accent/60 transition-colors flex flex-col gap-2"
		>
			<div class="text-2xl">🏛️</div>
			<div class="title-display text-xl">Assemblée nationale</div>
			<div class="text-sm text-assembly-muted">
				15ᵉ + 16ᵉ + 17ᵉ législatures (ère Macron complète)
			</div>
		</a>
		<a
			href="/senat"
			class="card p-6 hover:border-assembly-accent/60 transition-colors flex flex-col gap-2"
		>
			<div class="text-2xl">🏛️</div>
			<div class="title-display text-xl">Sénat</div>
			<div class="text-sm text-assembly-muted">
				Triennats 2017-2020, 2020-2023, 2023-2026
			</div>
		</a>
		<a
			href="/elus"
			class="card p-6 hover:border-assembly-accent/60 transition-colors flex flex-col gap-2"
		>
			<div class="text-2xl">🗂️</div>
			<div class="title-display text-xl">Tous les élus</div>
			<div class="text-sm text-assembly-muted">
				Liste cross-chambre dédupliquée (députés + sénateurs)
			</div>
		</a>
		<a
			href="/classement"
			class="card p-6 hover:border-assembly-accent/60 transition-colors flex flex-col gap-2"
		>
			<div class="text-2xl">🏆</div>
			<div class="title-display text-xl">Classement global</div>
			<div class="text-sm text-assembly-muted">
				Top élus toutes chambres, par score Overall carrière
			</div>
		</a>
	</div>

	<div class="mt-10 text-center text-xs text-assembly-muted">
		<a class="underline hover:text-assembly-accent" href="/faq">📚 FAQ — Comment ça marche ?</a>
	</div>
</section>
