<!--
	Racine neutre `/` (cf ADR 0030).

	Hub d'orientation entre les espaces AN, Sénat, Élus.
	Pas de données live (ancienne home AN déplacée sous /assemblee/) —
	présentation produit + 3 portes d'entrée + bloc « À propos » assumant
	la posture éditoriale du projet.
-->
<svelte:head>
	<title>PolitiDex — Le Pokédex des élus nationaux français</title>
	<meta
		name="description"
		content="PolitiDex regroupe les fiches Football Manager des députés et sénateurs français — votes, scrutins, hémicycles, classements. Open data, open source."
	/>
</svelte:head>

<section class="max-w-5xl mx-auto px-6 py-10 sm:py-14">
	<header class="mb-10 text-center">
		<h1 class="title-display text-4xl sm:text-5xl mb-2">PolitiDex</h1>
		<p class="text-assembly-muted text-lg">Le Pokédex des élus nationaux français</p>
		<p class="text-assembly-muted text-sm mt-4 max-w-2xl mx-auto">
			Cartes Football Manager, hémicycles, scrutins, classements — tout ce qu'il faut pour suivre
			les députés et sénateurs sous l'ère Macron, en open data.
		</p>
	</header>

	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
				Liste cross-chambre dédupliquée — une fiche par personne, qu'elle soit députée,
				sénatrice ou les deux.
			</div>
		</a>
	</div>

	<div class="mt-12 card p-6 sm:p-8 text-sm leading-relaxed">
		<h2 class="title-display text-2xl mb-3">À propos</h2>
		<p class="text-assembly-muted">
			PolitiDex collecte les <strong>données ouvertes Etalab</strong> (Open Data Assemblée nationale,
			Open Data Sénat) et les présente avec une UX inspirée de <em>Football Manager</em> et du <em>Pokédex</em>
			: une carte par élu, hémicycles interactifs, classements ludiques, badges, infos pédagogiques sur chaque
			métrique.
		</p>
		<p class="text-assembly-muted mt-3">
			La posture est <strong>assumée</strong> : on n'est pas Sciences Po. On préfère une métrique
			simple et compréhensible (cf <a class="underline hover:text-assembly-accent" href="/faq#overall">Overall</a>,
			<a class="underline hover:text-assembly-accent" href="/faq#elu-carriere">carrière cross-chambre</a>) à
			un score complexe et opaque. Toute décision structurante est consignée en
			<a class="underline hover:text-assembly-accent" href="https://github.com/IMhide/hemicycle-manager/tree/main/decisions" target="_blank" rel="noopener">ADR publique</a>.
		</p>
		<p class="text-assembly-muted mt-3">
			Code <a class="underline hover:text-assembly-accent" href="https://github.com/IMhide/hemicycle-manager/blob/main/LICENSE" target="_blank" rel="noopener">Unlicense</a>
			(domaine public). Données sous Licence Ouverte (Etalab). Le projet est <strong>open source bénévole</strong> :
			<a class="underline hover:text-assembly-accent" href="https://github.com/IMhide/hemicycle-manager/issues" target="_blank" rel="noopener">les contributions sont bienvenues</a>.
		</p>
	</div>

	<div class="mt-10 text-center text-xs text-assembly-muted">
		<a class="underline hover:text-assembly-accent" href="/faq">📚 FAQ — Comment ça marche ?</a>
		·
		<a
			class="underline hover:text-assembly-accent"
			href="https://github.com/IMhide/hemicycle-manager"
			target="_blank"
			rel="noopener">⭐ GitHub</a
		>
	</div>
</section>
