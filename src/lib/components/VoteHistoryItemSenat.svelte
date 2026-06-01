<script lang="ts">
	import type { ScrutinSenatIndex, VotePosition } from '$lib/types';

	interface Props {
		scrutin: ScrutinSenatIndex;
		position: VotePosition;
		isFronde: boolean;
	}

	let { scrutin, position, isFronde }: Props = $props();

	const positionStyle = $derived(
		{
			pour: { bg: 'bg-vote-pour/20', text: 'text-vote-pour', label: 'POUR' },
			contre: { bg: 'bg-vote-contre/20', text: 'text-vote-contre', label: 'CONTRE' },
			abstention: { bg: 'bg-vote-abstention/20', text: 'text-vote-abstention', label: 'ABST.' },
			nonVotant: { bg: 'bg-surface-2', text: 'text-fg-muted', label: 'N.V.' },
			absent: { bg: 'bg-surface-2', text: 'text-fg-muted', label: 'ABSENT' }
		}[position]
	);

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('fr-FR', {
			day: 'numeric',
			month: 'short',
			year: '2-digit'
		});
	}

	function truncate(s: string, n: number): string {
		return s.length > n ? s.slice(0, n - 1) + '…' : s;
	}

	function sortClass(s: string | null | undefined): string {
		const t = (s ?? '').toLowerCase();
		if (t.includes('adopt')) return 'text-vote-pour';
		if (t.includes('rejet') || t.includes('refus')) return 'text-vote-contre';
		return '';
	}
</script>

<a
	href="/senat/scrutins/{scrutin.uid}/"
	class="card p-3 flex items-center gap-3 hover:border-accent/60 transition-colors"
>
	<div class="text-xs text-fg-muted whitespace-nowrap w-16 flex-shrink-0">
		{formatDate(scrutin.date)}
	</div>

	<div class="min-w-0 flex-1">
		<div class="text-sm leading-snug">{truncate(scrutin.titre, 110)}</div>
		<div class="text-[10px] text-fg-muted mt-0.5">
			n°{scrutin.scrnum} ·
			<span class={sortClass(scrutin.sort)}>{scrutin.sort || 'n/a'}</span>
		</div>
	</div>

	<div class="flex items-center gap-2 flex-shrink-0">
		{#if isFronde}
			<span
				class="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-rose-400/15 text-rose-300 border border-rose-400/30"
				title="Vote opposé à la majorité du groupe"
			>
				🔥 FRONDE
			</span>
		{/if}
		<span
			class="text-xs font-bold px-2 py-0.5 rounded {positionStyle.bg} {positionStyle.text} tabular-nums"
		>
			{positionStyle.label}
		</span>
	</div>
</a>
