<script lang="ts">
	// Injecte un bloc JSON-LD (schema.org) dans le head (cf ADR 0045).
	// Le tag est reconstruit par concaténation pour ne pas écrire le mot-clé
	// d'ouverture/fermeture en clair (le préprocesseur Svelte délimite le bloc
	// de code par ces tokens et tronquerait le module).
	import { serializeJsonLd } from '$lib/jsonld';

	let { data }: { data: unknown } = $props();

	const TAGNAME = 'scr' + 'ipt';
	const tag = $derived(
		'<' + TAGNAME + ' type="application/ld+json">' + serializeJsonLd(data) + '</' + TAGNAME + '>'
	);
</script>

<svelte:head>
	{@html tag}
</svelte:head>
