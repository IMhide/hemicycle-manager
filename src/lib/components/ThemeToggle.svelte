<script lang="ts">
	/**
	 * Bouton de bascule clair/sombre (design v2).
	 * Icônes SVG (soleil/lune) — pas d'emoji (cf MASTER.md §6).
	 */
	import { theme } from '$lib/theme.svelte';

	const isDark = $derived(theme.current === 'dark');
</script>

<button
	type="button"
	class="theme-toggle"
	onclick={() => theme.toggle()}
	aria-label={isDark ? 'Passer en thème clair' : 'Passer en thème sombre'}
	title={isDark ? 'Thème clair' : 'Thème sombre'}
>
	{#if isDark}
		<!-- Soleil (Lucide) -->
		<svg
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2.25"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<circle cx="12" cy="12" r="4" />
			<path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
		</svg>
	{:else}
		<!-- Lune (Lucide) -->
		<svg
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2.25"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
		</svg>
	{/if}
</button>

<style>
	.theme-toggle {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		flex-shrink: 0;
		color: var(--fg);
		background: var(--surface);
		border: 2px solid var(--border);
		transition:
			background 120ms ease-out,
			transform 120ms ease-out;
	}
	.theme-toggle:hover {
		background: var(--accent);
		color: var(--accent-fg);
	}
	.theme-toggle:active {
		transform: translate(1px, 1px);
	}
</style>
