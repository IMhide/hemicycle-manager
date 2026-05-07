<script lang="ts">
	/**
	 * Carte FIFA cross-chambre d'un élu (cf ADR 0030, 0032).
	 *
	 * Vue Carrière exclusivement : agrège les mandats AN + Sénat de la
	 * personne via le manifest `elus.json`. Pour les vues mandat (un
	 * mandat AN ou un triennat Sénat précis), la fiche `/elus/[id]` rend
	 * directement `DeputeCard` ou `SenateurCard` selon `?tab=...`.
	 *
	 * Sémantique de la moyenne simple, badges Bicameral/Veteran : cf ADR 0032.
	 */
	import type { Elu, EluMandatRef } from '$lib/elus';
	import StatRadar from './StatRadar.svelte';
	import Badge from './Badge.svelte';
	import InfoTip from './InfoTip.svelte';

	interface Props {
		elu: Elu;
	}

	let { elu }: Props = $props();

	const age = $derived.by(() => {
		if (!elu.dateNaissance) return null;
		const birth = new Date(elu.dateNaissance);
		const now = new Date();
		let a = now.getFullYear() - birth.getFullYear();
		const md = now.getMonth() - birth.getMonth() || now.getDate() - birth.getDate();
		if (md < 0) a -= 1;
		return a;
	});

	const radarAxes = $derived([
		{ label: 'Présence', value: elu.radarCarriere.presence, color: '#60a5fa' },
		{ label: 'Participation', value: elu.radarCarriere.participation, color: '#a78bfa' },
		{ label: 'Loyauté', value: elu.radarCarriere.loyaute, color: '#34d399' },
		{ label: 'Volume', value: elu.radarCarriere.volume, color: '#fbbf24' }
	]);

	const overall = $derived(elu.overallCarriere);

	function pct(v: number): string {
		return `${Math.round(v * 100)} %`;
	}

	const chambres = $derived.by(() => {
		const set = new Set<'AN' | 'SENAT'>();
		for (const m of elu.mandats) set.add(m.chambre);
		return [...set];
	});

	const nbMandatsAN = $derived(elu.mandats.filter((m) => m.chambre === 'AN').length);
	const nbMandatsSenat = $derived(elu.mandats.filter((m) => m.chambre === 'SENAT').length);

	function libelleMandat(m: EluMandatRef): string {
		if (m.chambre === 'AN') return `${m.legislature}ᵉ AN`;
		return `Sénat ${m.triennat}`;
	}
</script>

<div
	class="card relative overflow-hidden p-5"
	style="background: radial-gradient(circle at 30% 0%, rgba(168,85,247,0.18) 0%, transparent 60%), linear-gradient(180deg, #1e293b, #0f172a);"
>
	<!-- Top bar : overall + chambres -->
	<div class="flex items-start justify-between gap-3 mb-4">
		<div>
			<div class="title-display text-5xl leading-none text-amber-300">{overall}</div>
			<div
				class="text-[10px] uppercase tracking-widest text-assembly-muted mt-1 inline-flex items-center gap-1"
			>
				<span>Overall · Carrière cross-chambre</span>
				<InfoTip title="Overall carrière cross-chambre" placement="bottom">
					Moyenne arithmétique simple des Overall de chaque mandat (AN ou Sénat).
					Cf <a href="/faq#elu-carriere" class="underline text-assembly-accent">FAQ</a>
					et <a
						href="https://github.com/IMhide/hemicycle-manager/blob/main/decisions/0032-semantique-carriere-cross-chambre.md"
						class="underline">ADR 0032</a
					>.
					<div class="mt-1 text-assembly-muted">
						Posture éditoriale assumée : <em>chaque mandat compte pareil</em>, pas de
						pondération par durée ni par nb de scrutins.
					</div>
				</InfoTip>
			</div>
		</div>
		<div class="text-right space-y-0.5">
			{#each chambres as c (c)}
				<div class="text-[11px] uppercase tracking-widest text-assembly-muted">
					{#if c === 'AN'}
						🏛️ AN ·
						<span class="text-assembly-text">{nbMandatsAN} mandat{nbMandatsAN > 1 ? 's' : ''}</span>
					{:else}
						🏛️ Sénat ·
						<span class="text-assembly-text"
							>{nbMandatsSenat} triennat{nbMandatsSenat > 1 ? 's' : ''}</span
						>
					{/if}
				</div>
			{/each}
		</div>
	</div>

	<!-- Photo + identité -->
	<div class="flex items-end gap-4 mb-5">
		<div class="relative">
			<img
				src={elu.photoUrl}
				alt="{elu.prenom} {elu.nom}"
				class="w-28 h-36 object-cover rounded-md border-2 border-assembly-border bg-assembly-border"
				loading="lazy"
				referrerpolicy="no-referrer"
			/>
		</div>
		<div class="flex-1 min-w-0 pb-1">
			<div class="text-[10px] uppercase tracking-widest text-assembly-muted">{elu.civ}</div>
			<div class="title-display text-2xl leading-tight">{elu.prenom}</div>
			<div class="title-display text-3xl leading-tight">{elu.nom}</div>
			<div class="text-xs text-assembly-muted mt-2 space-y-0.5">
				{#if age !== null}<div>{age} ans</div>{/if}
				<div class="text-assembly-accent/80">
					{elu.mandats.length} mandat{elu.mandats.length > 1 ? 's' : ''} ·
					{elu.mandats.map(libelleMandat).join(' + ')}
				</div>
			</div>
		</div>
	</div>

	<!-- Radar -->
	<div class="mb-5 max-w-[280px] mx-auto">
		<StatRadar
			axes={radarAxes}
			size={260}
			strokeColor="#fbbf24"
			fillColor="#fbbf2433"
		/>
	</div>

	<!-- Stats list -->
	<div class="space-y-1.5 text-sm border-t border-assembly-border/50 pt-4">
		<div class="flex justify-between items-center gap-2">
			<span class="flex items-center gap-1 text-assembly-muted">
				Présence
				<InfoTip title="Présence cross-chambre" size="xs">
					Moyenne simple des taux de présence de chaque mandat (cf ADR 0032).
					Sémantique légèrement différente entre AN et Sénat (délégations Sénat ignorées
					en v1, cf ADR 0027) — voir FAQ.
				</InfoTip>
			</span>
			<span class="title-display text-base text-blue-400 tabular-nums">
				{pct(elu.radarCarriere.presence)}
			</span>
		</div>
		<div class="flex justify-between items-center gap-2">
			<span class="flex items-center gap-1 text-assembly-muted">Participation</span>
			<span class="title-display text-base text-purple-400 tabular-nums">
				{pct(elu.radarCarriere.participation)}
			</span>
		</div>
		<div class="flex justify-between items-center gap-2">
			<span class="flex items-center gap-1 text-assembly-muted">Loyauté (moy.)</span>
			<span class="title-display text-base text-emerald-400 tabular-nums">
				{pct(elu.radarCarriere.loyaute)}
			</span>
		</div>
		<div class="flex justify-between items-center gap-2">
			<span class="flex items-center gap-1 text-assembly-muted">Volume (moy.)</span>
			<span class="title-display text-base text-amber-400 tabular-nums">
				{pct(elu.radarCarriere.volume)}
			</span>
		</div>
	</div>

	<!-- Badges carrière -->
	{#if elu.badgesCarriere.length > 0}
		<div class="mt-5 pt-4 border-t border-assembly-border/50">
			<div class="text-[10px] uppercase tracking-widest text-assembly-muted mb-2">🏆 Badges</div>
			<div class="flex flex-wrap gap-1.5">
				{#each elu.badgesCarriere as b (b)}
					<Badge id={b} kind="elu-carriere" />
				{/each}
			</div>
		</div>
	{/if}
</div>
