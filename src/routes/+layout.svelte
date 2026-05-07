<script lang="ts">
	import '../app.css';
	import GlobalSearch from '$lib/components/GlobalSearch.svelte';
	import { page } from '$app/stores';

	let { children } = $props();

	const pathname = $derived($page.url.pathname);
	const isAN = $derived(pathname.startsWith('/assemblee'));
	const isSenat = $derived(pathname.startsWith('/senat'));

	/** Active sur le bouton header courant (sticky highlight). */
	function navClass(active: boolean): string {
		return active ? 'btn-ghost text-assembly-accent' : 'btn-ghost';
	}

	/** Active sur les liens du sous-header (AN ou Sénat). */
	function subnavClass(active: boolean): string {
		return active
			? 'text-assembly-accent border-b-2 border-assembly-accent -mb-px font-semibold'
			: 'text-assembly-muted hover:text-assembly-text border-b-2 border-transparent -mb-px';
	}
</script>

<div class="min-h-screen flex flex-col">
	<header
		class="border-b border-assembly-border/60 backdrop-blur sticky top-0 z-20 bg-assembly-bg/80"
	>
		<div class="max-w-7xl mx-auto px-6 py-3 flex items-center gap-4">
			<a href="/" class="flex items-center gap-3 flex-shrink-0">
				<div
					class="w-9 h-9 rounded-lg bg-gradient-to-br from-assembly-accent to-orange-500 flex items-center justify-center"
				>
					<span class="text-assembly-bg font-display text-xl">P</span>
				</div>
				<div class="leading-tight hidden sm:block">
					<div class="title-display text-xl text-assembly-text">PolitiDex</div>
					<div class="text-[10px] uppercase tracking-widest text-assembly-muted">
						Élus nationaux
					</div>
				</div>
			</a>

			<div class="flex-1 max-w-md">
				<GlobalSearch />
			</div>

			<nav class="flex items-center gap-1 text-sm flex-shrink-0">
				<a
					href="/elus"
					class={navClass(pathname.startsWith('/elus'))}
					title="Tous les élus">Élus</a
				>
				<a
					href="/assemblee"
					class={navClass(isAN)}
					title="Assemblée nationale">🏛️ AN</a
				>
				<a href="/senat" class={navClass(isSenat)} title="Sénat">🏛️ Sénat</a>
				<a
					href="/faq"
					class={navClass(pathname.startsWith('/faq'))}
					title="FAQ — Comment ça marche ?">📚</a
				>
			</nav>
		</div>

		{#if isAN}
			<!-- Sous-header contextuel AN -->
			<div class="border-t border-assembly-border/40 bg-assembly-bg/60">
				<div class="max-w-7xl mx-auto px-6 flex items-center gap-5 text-sm overflow-x-auto">
					<span class="text-[10px] uppercase tracking-widest text-assembly-muted/70 py-2 flex-shrink-0">
						🏛️ AN
					</span>
					<a
						href="/assemblee"
						class="{subnavClass(pathname === '/assemblee/')} py-2 whitespace-nowrap"
					>
						Hémicycle
					</a>
					<a
						href="/assemblee/deputes"
						class="{subnavClass(pathname.startsWith('/assemblee/deputes'))} py-2 whitespace-nowrap"
					>
						Députés
					</a>
					<a
						href="/assemblee/groupes"
						class="{subnavClass(pathname.startsWith('/assemblee/groupes'))} py-2 whitespace-nowrap"
					>
						Groupes
					</a>
					<a
						href="/assemblee/scrutins"
						class="{subnavClass(pathname.startsWith('/assemblee/scrutins'))} py-2 whitespace-nowrap"
					>
						Scrutins
					</a>
					<a
						href="/assemblee/classements"
						class="{subnavClass(pathname.startsWith('/assemblee/classements'))} py-2 whitespace-nowrap"
					>
						🏆 Classement AN
					</a>
				</div>
			</div>
		{:else if isSenat}
			<!-- Sous-header contextuel Sénat -->
			<div class="border-t border-assembly-border/40 bg-assembly-bg/60">
				<div class="max-w-7xl mx-auto px-6 flex items-center gap-5 text-sm overflow-x-auto">
					<span class="text-[10px] uppercase tracking-widest text-assembly-muted/70 py-2 flex-shrink-0">
						🏛️ Sénat
					</span>
					<a
						href="/senat"
						class="{subnavClass(pathname === '/senat/')} py-2 whitespace-nowrap"
					>
						Hémicycle
					</a>
					<a
						href="/senat/senateurs"
						class="{subnavClass(pathname.startsWith('/senat/senateurs'))} py-2 whitespace-nowrap"
					>
						Sénateurs
					</a>
					<a
						href="/senat/triennats"
						class="{subnavClass(pathname.startsWith('/senat/triennats'))} py-2 whitespace-nowrap"
					>
						Triennats
					</a>
					<a
						href="/senat/scrutins"
						class="{subnavClass(pathname.startsWith('/senat/scrutins'))} py-2 whitespace-nowrap"
					>
						Scrutins
					</a>
					<a
						href="/senat/classements"
						class="{subnavClass(pathname.startsWith('/senat/classements'))} py-2 whitespace-nowrap"
					>
						🏆 Classement Sénat
					</a>
				</div>
			</div>
		{/if}
	</header>
	<main class="flex-1">
		{@render children()}
	</main>
	<footer
		class="border-t border-assembly-border/60 mt-12 py-6 text-center text-xs text-assembly-muted space-y-2"
	>
		<div>
			<a class="underline hover:text-assembly-accent" href="/faq">📚 FAQ — Comment ça marche ?</a>
			·
			<a
				class="underline hover:text-assembly-accent"
				href="https://github.com/IMhide/hemicycle-manager"
				target="_blank"
				rel="noopener">⭐ Code source sur GitHub</a
			>
		</div>
		<div>
			Données :
			<a
				class="underline hover:text-assembly-accent"
				href="https://data.assemblee-nationale.fr"
				target="_blank"
				rel="noopener">Open Data Assemblée nationale</a
			>
			·
			<a
				class="underline hover:text-assembly-accent"
				href="https://data.senat.fr"
				target="_blank"
				rel="noopener">Open Data Sénat</a
			>
			— Licence Ouverte (Etalab) · Code sous
			<a
				class="underline hover:text-assembly-accent"
				href="https://github.com/IMhide/hemicycle-manager/blob/main/LICENSE"
				target="_blank"
				rel="noopener">Unlicense</a
			>
		</div>
		<div class="text-[11px] italic">
			Projet open source bénévole. Une idée, un bug, une feature ?
			<a
				class="underline hover:text-assembly-accent"
				href="https://github.com/IMhide/hemicycle-manager/issues"
				target="_blank"
				rel="noopener">Viens nous aider sur GitHub</a
			> 🙌
		</div>
	</footer>
</div>
