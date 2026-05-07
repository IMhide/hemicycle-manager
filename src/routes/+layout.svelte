<script lang="ts">
	import '../app.css';
	import GlobalSearch from '$lib/components/GlobalSearch.svelte';
	let { children } = $props();
</script>

<div class="min-h-screen flex flex-col">
	<header class="border-b border-assembly-border/60 backdrop-blur sticky top-0 z-20 bg-assembly-bg/80">
		<div class="max-w-7xl mx-auto px-6 py-3 flex items-center gap-4">
			<a href="/" class="flex items-center gap-3 flex-shrink-0">
				<div class="w-9 h-9 rounded-lg bg-gradient-to-br from-assembly-accent to-orange-500 flex items-center justify-center">
					<span class="text-assembly-bg font-display text-xl">P</span>
				</div>
				<div class="leading-tight hidden sm:block">
					<div class="title-display text-xl text-assembly-text">PolitiDex</div>
					<div class="text-[10px] uppercase tracking-widest text-assembly-muted">Élus nationaux</div>
				</div>
			</a>

			<!-- Search bar (Facebook-style) -->
			<div class="flex-1 max-w-md">
				<GlobalSearch />
			</div>

			<nav class="flex items-center gap-1 text-sm flex-shrink-0">
				<a href="/assemblee" class="btn-ghost hidden md:inline-block" title="Hémicycle Assemblée nationale">🏛️ AN</a>
				<a href="/senat" class="btn-ghost hidden md:inline-block" title="Hémicycle Sénat">🏛️ Sénat</a>
				<a href="/assemblee/deputes" class="btn-ghost" title="Députés">Députés</a>
				<a href="/senat/senateurs" class="btn-ghost" title="Sénateurs">Sénateurs</a>
				<a href="/assemblee/groupes" class="btn-ghost" title="Groupes">Groupes</a>
				<a href="/assemblee/scrutins" class="btn-ghost hidden md:inline-block" title="Scrutins">Scrutins</a>
				<a href="/assemblee/classements" class="btn-ghost hidden md:inline-block" title="Classements AN">🏆 AN</a>
				<a href="/senat/classements" class="btn-ghost hidden md:inline-block" title="Classements Sénat">🏆 Sénat</a>
				<a href="/faq" class="btn-ghost" title="FAQ — Comment ça marche ?">📚</a>
			</nav>
		</div>
	</header>
	<main class="flex-1">
		{@render children()}
	</main>
	<footer class="border-t border-assembly-border/60 mt-12 py-6 text-center text-xs text-assembly-muted space-y-2">
		<div>
			<a class="underline hover:text-assembly-accent" href="/faq">📚 FAQ — Comment ça marche ?</a>
			· <a class="underline hover:text-assembly-accent" href="https://github.com/IMhide/hemicycle-manager" target="_blank" rel="noopener">⭐ Code source sur GitHub</a>
		</div>
		<div>
			Données :
			<a class="underline hover:text-assembly-accent" href="https://data.assemblee-nationale.fr" target="_blank" rel="noopener">Open Data Assemblée nationale</a>
			·
			<a class="underline hover:text-assembly-accent" href="https://data.senat.fr" target="_blank" rel="noopener">Open Data Sénat</a>
			— Licence Ouverte (Etalab) · Code sous <a class="underline hover:text-assembly-accent" href="https://github.com/IMhide/hemicycle-manager/blob/main/LICENSE" target="_blank" rel="noopener">Unlicense</a>
		</div>
		<div class="text-[11px] italic">
			Projet open source bénévole. Une idée, un bug, une feature ?
			<a class="underline hover:text-assembly-accent" href="https://github.com/IMhide/hemicycle-manager/issues" target="_blank" rel="noopener">Viens nous aider sur GitHub</a> 🙌
		</div>
	</footer>
</div>
