<script lang="ts">
	import type { Groupe } from '$lib/types';

	interface Props {
		groupe: Groupe;
		decompte: { pour: number; contre: number; abstention: number; nonVotant: number };
		positionMajoritaire: string;
	}

	let { groupe, decompte, positionMajoritaire }: Props = $props();

	const total = $derived(groupe.effectif);
	const expressed = $derived(decompte.pour + decompte.contre + decompte.abstention);
	const absent = $derived(Math.max(0, total - expressed - decompte.nonVotant));

	const segments = $derived([
		{ key: 'pour', count: decompte.pour, color: '#22c55e' },
		{ key: 'contre', count: decompte.contre, color: '#ef4444' },
		{ key: 'abstention', count: decompte.abstention, color: '#eab308' },
		{ key: 'nonVotant', count: decompte.nonVotant, color: '#64748b' },
		{ key: 'absent', count: absent, color: '#1e293b' }
	]);

	function pct(n: number): string {
		return total > 0 ? `${(n / total) * 100}%` : '0%';
	}
</script>

<div class="flex items-center gap-3">
	<div class="flex items-center gap-2 w-32 flex-shrink-0">
		<span class="w-2.5 h-2.5 rounded-full" style="background-color: {groupe.couleur}"></span>
		<span class="font-medium text-sm truncate">{groupe.libelleAbrege}</span>
	</div>

	<div
		class="flex-1 h-6 rounded overflow-hidden flex bg-assembly-bg/40 border border-assembly-border/40"
		title="{groupe.libelle} — majorité : {positionMajoritaire}"
	>
		{#each segments as seg (seg.key)}
			{#if seg.count > 0}
				<div
					class="h-full transition-all"
					style="width: {pct(seg.count)}; background-color: {seg.color}"
					title="{seg.key} : {seg.count}"
				></div>
			{/if}
		{/each}
	</div>

	<div class="flex gap-2 text-xs flex-shrink-0 w-44 justify-end">
		<span class="text-vote-pour tabular-nums">{decompte.pour}</span>
		<span class="text-assembly-muted">·</span>
		<span class="text-vote-contre tabular-nums">{decompte.contre}</span>
		<span class="text-assembly-muted">·</span>
		<span class="text-vote-abstention tabular-nums">{decompte.abstention}</span>
		<span class="text-assembly-muted ml-2 tabular-nums w-12 text-right">/{total}</span>
	</div>
</div>
