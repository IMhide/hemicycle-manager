<script lang="ts">
	/**
	 * Compact FIFA-style card shown on hover (Sénat).
	 *
	 * Modèle Phase 3 (cf ADR 0023..0028) : on affiche un `Senateur`. Si `triennat`
	 * est fourni, on est en vue triennat (stats + rangs scopés triennat, ADR 0028).
	 * Sinon on est en vue carrière (cumul pondéré, pas de rang).
	 */
	import type { Senateur, GroupeSenat, MandatSenat, TriennatStats } from '$lib/types';
	import {
		lookupEluUrlForMatriculeTriennat,
		lookupEluUrlCarriereForMatricule
	} from '$lib/elus';
	import Rank from './Rank.svelte';

	interface Props {
		senateur: Senateur;
		groupe: GroupeSenat | null;
		/** Si fourni : vue triennat. Si null : vue carrière. */
		triennat: string | null;
	}

	let { senateur, groupe, triennat }: Props = $props();

	const mandatTriennat = $derived.by(
		(): { mandat: MandatSenat; triennat: TriennatStats } | null => {
			if (triennat === null) return null;
			for (const m of senateur.mandats) {
				const t = m.triennats.find((tt) => tt.triennat === triennat);
				if (t) return { mandat: m, triennat: t };
			}
			return null;
		}
	);

	const stats = $derived(mandatTriennat ? mandatTriennat.triennat.stats : senateur.carriere);
	const rangs = $derived(mandatTriennat ? mandatTriennat.triennat.rangs : null);
	const frondes = $derived(stats.frondes.count);
	const overall = $derived(stats.overall);

	const href = $derived(
		triennat !== null
			? lookupEluUrlForMatriculeTriennat(senateur.id, triennat) ?? '/elus/'
			: lookupEluUrlCarriereForMatricule(senateur.id) ?? '/elus/'
	);

	function pct(n: number | null): string {
		return n === null ? 'N/A' : `${Math.round(n * 100)} %`;
	}

	const circo = $derived(
		mandatTriennat?.mandat.circonscription ?? senateur.mandats.at(-1)?.circonscription ?? null
	);
</script>

<div class="brut p-3" style="min-width: 260px;">
	<!-- Bandeau famille politique -->
	<div class="h-1.5 -mx-3 -mt-3 mb-3" style="background: {groupe?.couleur ?? 'var(--border-soft)'};" aria-hidden="true"></div>
	<div class="flex items-start gap-3">
		<img
			src={senateur.identite.photoUrl}
			alt=""
			class="w-16 h-20 object-cover flex-shrink-0"
			style="border: 2px solid var(--border); background: var(--surface-2);"
			loading="lazy"
			referrerpolicy="no-referrer"
		/>
		<div class="min-w-0 flex-1">
			<div class="flex items-baseline justify-between gap-2">
				<div
					class="title-display text-xl leading-none"
					style="color: {groupe?.couleur ?? 'var(--fg)'}"
				>
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
				<div class="text-[10px] uppercase tracking-widest text-fg-muted">
					{senateur.identite.civ}
				</div>
				<div class="title-display text-sm leading-tight">{senateur.identite.prenom}</div>
				<div class="title-display text-base leading-tight">{senateur.identite.nom}</div>
			</div>
			{#if circo}
				<div class="text-[10px] text-fg-muted mt-1 truncate">{circo}</div>
			{/if}
			{#if triennat === null}
				<div class="text-[9px] text-fg-muted mt-1 italic">
					Carrière · {senateur.carriere.nbMandats} mandat{senateur.carriere.nbMandats > 1
						? 's'
						: ''} · {senateur.carriere.triennats.length} triennat{senateur.carriere.triennats
						.length > 1
						? 's'
						: ''}
				</div>
			{/if}
		</div>
	</div>

	<div class="grid grid-cols-3 gap-2 mt-3 pt-2 border-t border-border-soft/40 text-center">
		<div>
			<div class="text-[9px] uppercase text-fg-muted">Présence</div>
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
			<div class="text-[9px] uppercase text-fg-muted">Loyauté</div>
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
			<div class="text-[9px] uppercase text-fg-muted">Frondes</div>
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

	<div class="text-[9px] text-fg-muted text-center mt-2 italic">
		Cliquez pour voir la fiche complète · <a href={href} class="hidden">{href}</a>
	</div>
</div>
