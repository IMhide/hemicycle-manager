<script lang="ts">
	/**
	 * Compact FIFA-style card shown on hover.
	 *
	 * Modèle Phase 1 (cf ADR 0015, 0017) : on affiche une `Personne`. Si un
	 * `mandat` est passé en prop, on est en vue mandat (stats + rangs scopés
	 * législature). Sinon on est en vue carrière (cumul pondéré, pas de rang).
	 */
	import type { Personne, Groupe, Mandat } from '$lib/types';
	import { lookupEluUrlForPaIdLeg, lookupEluUrlCarriereForPaId } from '$lib/elus';
	import Rank from './Rank.svelte';

	interface Props {
		personne: Personne;
		groupe: Groupe | null;
		/** Si fourni : vue mandat. Si null : vue carrière. */
		mandat: Mandat | null;
		/** Total cohorte pour le rang (n'est lu qu'en vue mandat). */
		total?: number;
	}

	let { personne, groupe, mandat, total = 577 }: Props = $props();

	const stats = $derived(mandat ? mandat.stats : personne.carriere);
	const rangs = $derived(mandat ? mandat.rangs : null);
	const frondes = $derived(stats.frondes.count);

	// Overall — calculé côté pipeline, cf ADR 0022 (aligné avec DeputeCard).
	const overall = $derived(stats.overall);

	const href = $derived(
		mandat
			? lookupEluUrlForPaIdLeg(personne.id, mandat.legislature) ?? '/elus/'
			: lookupEluUrlCarriereForPaId(personne.id) ?? '/elus/'
	);

	function pct(n: number | null): string {
		return n === null ? 'N/A' : `${Math.round(n * 100)} %`;
	}

	const circo = $derived(mandat?.circonscription ?? personne.mandats.at(-1)?.circonscription ?? null);
</script>

<div
	class="card p-3 shadow-2xl"
	style="background: radial-gradient(circle at 20% 0%, {groupe?.couleur ?? '#475569'}33 0%, transparent 60%), linear-gradient(180deg, #1e293b, #0f172a); border-color: {groupe?.couleur ?? '#475569'}55; min-width: 260px;"
>
	<div class="flex items-start gap-3">
		<img
			src={personne.identite.photoUrl}
			alt=""
			class="w-16 h-20 object-cover rounded border border-assembly-border bg-assembly-border flex-shrink-0"
			loading="lazy"
			referrerpolicy="no-referrer"
		/>
		<div class="min-w-0 flex-1">
			<div class="flex items-baseline justify-between gap-2">
				<div class="title-display text-xl leading-none" style="color: {groupe?.couleur ?? '#fbbf24'}">
					{overall}
				</div>
				{#if groupe}
					<div class="flex items-center gap-1 text-[10px]">
						<span class="w-1.5 h-1.5 rounded-full" style="background-color: {groupe.couleur}"></span>
						<span class="font-semibold">{groupe.libelleAbrege}</span>
					</div>
				{/if}
			</div>
			<div class="mt-1">
				<div class="text-[10px] uppercase tracking-widest text-assembly-muted">{personne.identite.civ}</div>
				<div class="title-display text-sm leading-tight">{personne.identite.prenom}</div>
				<div class="title-display text-base leading-tight">{personne.identite.nom}</div>
			</div>
			{#if circo}
				<div class="text-[10px] text-assembly-muted mt-1">
					{circo.dep} · {circo.depNum}-{circo.num}
				</div>
			{/if}
			{#if !mandat}
				<div class="text-[9px] text-assembly-muted mt-1 italic">
					Carrière · {personne.carriere.nbMandats} mandat{personne.carriere.nbMandats > 1 ? 's' : ''}
				</div>
			{/if}
		</div>
	</div>

	<div class="grid grid-cols-3 gap-2 mt-3 pt-2 border-t border-assembly-border/40 text-center">
		<div>
			<div class="text-[9px] uppercase text-assembly-muted">Présence</div>
			<div class="title-display text-base text-blue-400 leading-tight tabular-nums">
				{pct(stats.presence.rate)}
			</div>
			{#if rangs}
				<div class="mt-0.5">
					<Rank rank={rangs.presence.rank} total={rangs.presence.total} size="xs" />
				</div>
			{/if}
		</div>
		<div>
			<div class="text-[9px] uppercase text-assembly-muted">Loyauté</div>
			<div class="title-display text-base text-emerald-400 leading-tight tabular-nums">
				{pct(stats.loyaute.rate)}
			</div>
			{#if rangs}
				<div class="mt-0.5">
					<Rank rank={rangs.loyaute.rank} total={rangs.loyaute.total} size="xs" />
				</div>
			{/if}
		</div>
		<div>
			<div class="text-[9px] uppercase text-assembly-muted">Frondes</div>
			<div class="title-display text-base text-rose-400 leading-tight tabular-nums">
				{frondes}
			</div>
			{#if rangs}
				<div class="mt-0.5">
					<Rank rank={rangs.frondes.rank} total={rangs.frondes.total} size="xs" />
				</div>
			{/if}
		</div>
	</div>

	<div class="text-[9px] text-assembly-muted text-center mt-2 italic">
		Cliquez pour voir la fiche complète
	</div>
</div>
