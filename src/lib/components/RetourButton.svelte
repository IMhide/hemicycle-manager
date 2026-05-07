<script lang="ts">
	/**
	 * Bouton « ← Retour » générique (cf ADR 0030, 0032).
	 *
	 * Appelle `history.back()` côté client. Pas de logique contextuelle :
	 * pas de lecture du `referrer`, pas de label dynamique. Masqué quand
	 * `window.history.length <= 1` (cas d'un lien direct sans historique).
	 */
	import { onMount } from 'svelte';

	let visible = $state(false);

	onMount(() => {
		if (typeof window !== 'undefined') {
			visible = window.history.length > 1;
		}
	});

	function handleClick(e: MouseEvent) {
		e.preventDefault();
		if (typeof window !== 'undefined') window.history.back();
	}
</script>

{#if visible}
	<button
		type="button"
		class="text-sm text-assembly-muted hover:text-assembly-accent inline-flex items-center gap-1"
		onclick={handleClick}
		aria-label="Revenir à la page précédente"
	>
		← Retour
	</button>
{/if}
