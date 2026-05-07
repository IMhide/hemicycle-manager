<script lang="ts">
	/**
	 * Filtres communs pour les listes d'élus (`/elus`, `/assemblee/deputes`,
	 * `/senat/senateurs`).
	 *
	 * Trois critères :
	 *  - **Sexe** : radio Tous / M. / Mme
	 *  - **Famille politique** : multi-OR (case à cocher par famille)
	 *  - **Badges** : multi-OR (case à cocher par badge)
	 *
	 * Le composant ne sait pas filtrer lui-même — il expose les sélections
	 * via `bind:`. Le caller applique les filtres dans son `$derived`.
	 *
	 * Cf ADR 0034 (familles politiques) + ADR 0017 (badges).
	 */
	import type { FamilleDef } from '$lib/familles';

	export interface BadgeOption {
		id: string;
		label: string;
		emoji: string;
	}

	let {
		sexe = $bindable('tous'),
		famillesSelected = $bindable<string[]>([]),
		badgesSelected = $bindable<string[]>([]),
		familles,
		badges,
		showSexe = true
	}: {
		sexe?: 'tous' | 'M' | 'F';
		famillesSelected?: string[];
		badgesSelected?: string[];
		familles: FamilleDef[];
		badges: BadgeOption[];
		showSexe?: boolean;
	} = $props();

	function toggleFamille(id: string) {
		famillesSelected = famillesSelected.includes(id)
			? famillesSelected.filter((f) => f !== id)
			: [...famillesSelected, id];
	}
	function toggleBadge(id: string) {
		badgesSelected = badgesSelected.includes(id)
			? badgesSelected.filter((b) => b !== id)
			: [...badgesSelected, id];
	}
	function resetAll() {
		sexe = 'tous';
		famillesSelected = [];
		badgesSelected = [];
	}

	const hasAny = $derived(
		sexe !== 'tous' || famillesSelected.length > 0 || badgesSelected.length > 0
	);
</script>

<div class="space-y-4 text-sm">
	{#if showSexe}
		<div>
			<div class="text-xs uppercase tracking-widest text-assembly-muted mb-1.5">Sexe</div>
			<div class="flex gap-1">
				{#each [['tous', 'Tous'], ['M', 'M.'], ['F', 'Mme']] as [val, label] (val)}
					<button
						class="btn px-3 py-1 text-xs flex-1 {sexe === val
							? 'bg-assembly-accent text-assembly-bg'
							: 'border border-assembly-border text-assembly-muted hover:text-assembly-text'}"
						onclick={() => (sexe = val as 'tous' | 'M' | 'F')}
					>
						{label}
					</button>
				{/each}
			</div>
		</div>
	{/if}

	{#if familles.length > 0}
		<div>
			<div class="text-xs uppercase tracking-widest text-assembly-muted mb-1.5">
				Familles politiques
				{#if famillesSelected.length > 0}
					<span class="text-assembly-accent">({famillesSelected.length})</span>
				{/if}
			</div>
			<div class="flex flex-col gap-1 max-h-72 overflow-y-auto pr-1">
				{#each familles as f (f.id)}
					{@const checked = famillesSelected.includes(f.id)}
					<button
						class="text-xs text-left px-2 py-1 rounded {checked
							? 'bg-assembly-accent/15 border border-assembly-accent/60 text-assembly-text'
							: 'border border-assembly-border text-assembly-muted hover:text-assembly-text'}"
						onclick={() => toggleFamille(f.id)}
						title={f.id}
					>
						<span class="inline-block w-3 mr-1">{checked ? '✓' : ' '}</span>
						{f.label}
					</button>
				{/each}
			</div>
		</div>
	{/if}

	{#if badges.length > 0}
		<div>
			<div class="text-xs uppercase tracking-widest text-assembly-muted mb-1.5">
				Badges
				{#if badgesSelected.length > 0}
					<span class="text-assembly-accent">({badgesSelected.length})</span>
				{/if}
			</div>
			<div class="flex flex-col gap-1">
				{#each badges as b (b.id)}
					{@const checked = badgesSelected.includes(b.id)}
					<button
						class="text-xs text-left px-2 py-1 rounded {checked
							? 'bg-assembly-accent/15 border border-assembly-accent/60 text-assembly-text'
							: 'border border-assembly-border text-assembly-muted hover:text-assembly-text'}"
						onclick={() => toggleBadge(b.id)}
					>
						<span class="inline-block w-3 mr-1">{checked ? '✓' : ' '}</span>
						<span class="mr-1">{b.emoji}</span>
						{b.label}
					</button>
				{/each}
			</div>
		</div>
	{/if}

	{#if hasAny}
		<button class="btn-ghost w-full text-xs" onclick={resetAll}>
			Réinitialiser les filtres
		</button>
	{/if}
</div>
