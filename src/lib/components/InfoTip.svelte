<script lang="ts">
	interface Props {
		title?: string;
		children: import('svelte').Snippet;
		size?: 'xs' | 'sm';
		/** Sens d'ouverture du tooltip. Défaut: 'top'. Utiliser 'bottom' quand
		 *  l'élément est près du haut de l'écran pour éviter le clipping. */
		placement?: 'top' | 'bottom';
	}

	let { title, children, size = 'sm', placement = 'top' }: Props = $props();
	let open = $state(false);

	const sizeClass = $derived(size === 'xs' ? 'w-3 h-3 text-[8px]' : 'w-4 h-4 text-[10px]');
	const panelPos = $derived(
		placement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
	);
	const arrowPos = $derived(
		placement === 'top'
			? 'top-full -mt-1 border-r border-b'
			: 'bottom-full -mb-1 border-l border-t'
	);
</script>

<span class="relative inline-flex items-center align-middle">
	<button
		type="button"
		class="{sizeClass} rounded-full bg-assembly-border/60 text-assembly-muted hover:bg-assembly-accent hover:text-assembly-bg flex items-center justify-center font-bold leading-none transition-colors"
		aria-label={title ?? "Plus d'informations"}
		onmouseenter={() => (open = true)}
		onmouseleave={() => (open = false)}
		onfocus={() => (open = true)}
		onblur={() => (open = false)}
		onclick={(e) => {
			e.preventDefault();
			open = !open;
		}}
	>i</button>

	{#if open}
		<span
			class="absolute z-50 {panelPos} left-1/2 -translate-x-1/2 w-64 p-3 rounded-lg bg-slate-900 border border-assembly-border shadow-xl text-xs leading-relaxed text-slate-200 normal-case font-normal tracking-normal"
			role="tooltip"
		>
			{#if title}
				<div class="title-display text-sm text-assembly-accent mb-1">{title}</div>
			{/if}
			{@render children()}
			<span
				class="absolute {arrowPos} left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 border-assembly-border rotate-45"
			></span>
		</span>
	{/if}
</span>
