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
	 *
	 * Design v2 (néo-brutalisme) : l'objet « trophée » du Pokédex.
	 * Rating Overall proéminent (façon FIFA), bandeau famille politique CHES
	 * en aplat, tier de rareté dérivé de l'overall, traitement brutaliste
	 * (bordures franches, ombre dure, press mécanique). Cf design-system/MASTER.md.
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

	/**
	 * Tier de rareté dérivé de l'Overall (design v2, MASTER.md §2).
	 * Seuils indicatifs — à figer en ADR pour cohérence avec ADR 0022.
	 */
	const tier = $derived.by<'bronze' | 'argent' | 'or' | 'legende'>(() => {
		if (overall >= 80) return 'legende';
		if (overall >= 65) return 'or';
		if (overall >= 50) return 'argent';
		return 'bronze';
	});

	const tierColor: Record<string, string> = {
		bronze: '#CD7F32',
		argent: '#C0C0C0',
		or: '#FFC400',
		legende: 'var(--accent)'
	};

	const tierLabel: Record<string, string> = {
		bronze: 'Bronze',
		argent: 'Argent',
		or: 'Or',
		legende: 'Légende'
	};

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

	/** Mandat le plus récent → couleur + libellé du bandeau famille politique (CHES). */
	const mandatRecent = $derived.by<EluMandatRef | null>(() => {
		if (elu.mandats.length === 0) return null;
		return [...elu.mandats].sort((a, b) => (a.debut < b.debut ? 1 : -1))[0];
	});
	const bandeauCouleur = $derived(mandatRecent?.groupeCouleur ?? 'var(--border-soft)');
	const bandeauLibelle = $derived(
		mandatRecent?.groupeLibelleAbrege ?? mandatRecent?.famille ?? '—'
	);
</script>

<!-- Carte FIFA brutaliste : cadre tier + ombre dure + press mécanique -->
<article
	class="brut brut-lg group relative flex flex-col"
	style="border-color: {tierColor[tier]};"
>
	<!-- Bandeau famille politique (aplat CHES) -->
	<div
		class="h-2.5 w-full"
		style="background: {bandeauCouleur};"
		aria-hidden="true"
	></div>

	<div class="p-5">
		<!-- En-tête FIFA : rating géant + tier + chambres -->
		<div class="flex items-start justify-between gap-3">
			<div class="leading-none">
				<div
					class="font-display font-bold tabular-nums leading-[0.85] text-6xl"
					style="color: {tierColor[tier]};"
				>
					{overall}
				</div>
				<div
					class="mt-1 inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-widest text-fg-muted"
				>
					<span>Overall · Carrière</span>
					<InfoTip title="Overall carrière cross-chambre" placement="bottom">
						Moyenne arithmétique simple des Overall de chaque mandat (AN ou Sénat). Cf
						<a href="/faq#elu-carriere" class="underline" style="color: var(--accent);">FAQ</a>
						et
						<a
							href="https://github.com/IMhide/hemicycle-manager/blob/main/decisions/0032-semantique-carriere-cross-chambre.md"
							class="underline">ADR 0032</a
						>.
						<div class="mt-1 text-fg-muted">
							Posture éditoriale assumée : <em>chaque mandat compte pareil</em>, pas de
							pondération par durée ni par nb de scrutins.
						</div>
					</InfoTip>
				</div>
				<!-- Badge tier de rareté (pill = seule exception au radius 0) -->
				<div
					class="mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
					style="background: {tierColor[tier]}; color: #0a0a0a;"
				>
					{tierLabel[tier]}
				</div>
			</div>
			<div class="space-y-1 text-right">
				{#each chambres as c (c)}
					<div
						class="inline-block px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest"
						style="border: 2px solid var(--border);"
					>
						{#if c === 'AN'}
							AN · <span class="text-fg">{nbMandatsAN} mdt{nbMandatsAN > 1 ? 's' : ''}</span>
						{:else}
							Sénat ·
							<span class="text-fg">{nbMandatsSenat} tri.{nbMandatsSenat > 1 ? '' : ''}</span>
						{/if}
					</div>
				{/each}
			</div>
		</div>

		<!-- Photo + identité -->
		<div class="mt-4 flex items-end gap-4">
			<img
				src={elu.photoUrl}
				alt="{elu.prenom} {elu.nom}"
				class="h-36 w-28 object-cover"
				style="border: 3px solid var(--border); background: var(--surface-2);"
				loading="lazy"
				referrerpolicy="no-referrer"
			/>
			<div class="min-w-0 flex-1 pb-1">
				<div class="text-[10px] font-medium uppercase tracking-widest text-fg-muted">
					{elu.civ}
				</div>
				<div class="title-display text-2xl leading-tight">{elu.prenom}</div>
				<div class="title-display text-3xl leading-tight">{elu.nom}</div>
				<div class="mt-2 space-y-0.5 text-xs text-fg-muted">
					{#if age !== null}<div>{age} ans</div>{/if}
					<div class="font-semibold" style="color: {bandeauCouleur};">{bandeauLibelle}</div>
					<div>
						{elu.mandats.length} mandat{elu.mandats.length > 1 ? 's' : ''} ·
						{elu.mandats.map(libelleMandat).join(' + ')}
					</div>
				</div>
			</div>
		</div>

		<!-- Radar -->
		<div class="mx-auto mt-5 max-w-[280px]">
			<StatRadar axes={radarAxes} size={260} strokeColor="var(--accent)" fillColor="rgba(255,230,0,0.2)" />
		</div>

		<!-- Stats -->
		<div
			class="mt-5 space-y-1.5 pt-4 text-sm"
			style="border-top: 2px solid var(--border-soft);"
		>
			<div class="flex items-center justify-between gap-2">
				<span class="flex items-center gap-1 text-fg-muted">
					Présence
					<InfoTip title="Présence cross-chambre" size="xs">
						Moyenne simple des taux de présence de chaque mandat (cf ADR 0032). Sémantique
						légèrement différente entre AN et Sénat (délégations Sénat ignorées en v1, cf ADR
						0027) — voir FAQ.
					</InfoTip>
				</span>
				<span class="title-display text-base tabular-nums" style="color: var(--vote-pour);">
					{pct(elu.radarCarriere.presence)}
				</span>
			</div>
			<div class="flex items-center justify-between gap-2">
				<span class="flex items-center gap-1 text-fg-muted">Participation</span>
				<span class="title-display text-base tabular-nums" style="color: var(--accent);">
					{pct(elu.radarCarriere.participation)}
				</span>
			</div>
			<div class="flex items-center justify-between gap-2">
				<span class="flex items-center gap-1 text-fg-muted">Loyauté (moy.)</span>
				<span class="title-display text-base tabular-nums">{pct(elu.radarCarriere.loyaute)}</span>
			</div>
			<div class="flex items-center justify-between gap-2">
				<span class="flex items-center gap-1 text-fg-muted">Volume (moy.)</span>
				<span class="title-display text-base tabular-nums">{pct(elu.radarCarriere.volume)}</span>
			</div>
		</div>

		<!-- Badges carrière -->
		{#if elu.badgesCarriere.length > 0}
			<div class="mt-5 pt-4" style="border-top: 2px solid var(--border-soft);">
				<div class="mb-2 text-[10px] font-medium uppercase tracking-widest text-fg-muted">
					Badges
				</div>
				<div class="flex flex-wrap gap-1.5">
					{#each elu.badgesCarriere as b (b)}
						<Badge id={b} kind="elu-carriere" />
					{/each}
				</div>
			</div>
		{/if}
	</div>
</article>

<style>
	/* Hover Pokédx/FIFA : la carte « monte » (ombre +) + léger scale.
	   Press mécanique géré via .brut + :active si rendu cliquable par le parent. */
	article {
		transition:
			transform 120ms ease-out,
			box-shadow 120ms ease-out;
	}
	@media (hover: hover) {
		article:hover {
			transform: translate(-2px, -2px);
			box-shadow: 8px 8px 0 0 var(--shadow-color);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		article,
		article:hover {
			transition: none;
			transform: none;
		}
	}
</style>
