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
					<span class="text-assembly-bg font-display text-xl">H</span>
				</div>
				<div class="leading-tight hidden sm:block">
					<div class="title-display text-xl text-assembly-text">Hémicycle Manager</div>
					<div class="text-[10px] uppercase tracking-widest text-assembly-muted">17e législature</div>
				</div>
			</a>

			<!-- Search bar (Facebook-style) -->
			<div class="flex-1 max-w-md">
				<GlobalSearch />
			</div>

			<nav class="flex items-center gap-1 text-sm flex-shrink-0">
				<a href="/" class="btn-ghost hidden md:inline-block">Hémicycle</a>
				<a href="/deputes" class="btn-ghost">Députés</a>
				<a href="/classements" class="btn-ghost hidden md:inline-block">🏆</a>
				<a href="/groupes" class="btn-ghost">Groupes</a>
				<a href="/scrutins" class="btn-ghost hidden md:inline-block">Scrutins</a>
			</nav>
		</div>
	</header>
	<main class="flex-1">
		{@render children()}
	</main>
	<footer class="border-t border-assembly-border/60 mt-12 py-6 text-center text-xs text-assembly-muted">
		Données : <a class="underline hover:text-assembly-accent" href="https://data.assemblee-nationale.fr" target="_blank" rel="noopener">Open Data Assemblée nationale</a>
		— Licence Ouverte (Etalab)
	</footer>
</div>
