<script lang="ts">
	import type { Groupe } from '$lib/types';

	interface Props {
		groupe: Groupe;
		size?: 'sm' | 'md' | 'lg';
		showFullName?: boolean;
		linked?: boolean;
	}

	let { groupe, size = 'md', showFullName = false, linked = true }: Props = $props();

	const sizeClasses = $derived(
		{
			sm: 'text-xs gap-1.5',
			md: 'text-sm gap-2',
			lg: 'text-base gap-2.5'
		}[size]
	);
	const dotSize = $derived({ sm: 'w-2 h-2', md: 'w-2.5 h-2.5', lg: 'w-3 h-3' }[size]);
</script>

{#if linked}
	<a
		href="/assemblee/groupes/{groupe.legislature}/{groupe.id}/"
		class="inline-flex items-center {sizeClasses} hover:text-link transition-colors"
	>
		<span class="{dotSize} rounded-full flex-shrink-0" style="background-color: {groupe.couleur}"></span>
		<span class="font-semibold">{groupe.libelleAbrege}</span>
		{#if showFullName}
			<span class="text-fg-muted truncate">— {groupe.libelle}</span>
		{/if}
	</a>
{:else}
	<span class="inline-flex items-center {sizeClasses}">
		<span class="{dotSize} rounded-full flex-shrink-0" style="background-color: {groupe.couleur}"></span>
		<span class="font-semibold">{groupe.libelleAbrege}</span>
		{#if showFullName}
			<span class="text-fg-muted truncate">— {groupe.libelle}</span>
		{/if}
	</span>
{/if}
