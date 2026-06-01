<script lang="ts">
	/**
	 * Fiche FIFA d'une personne politique (cf ADR 0015, 0017).
	 *
	 * Modèle Phase 1 :
	 *   - vue carrière (mandat = null) : stats cumulées pondérées, badges carrière, pas de rang
	 *   - vue mandat (mandat fourni) : stats du mandat, rangs scopés législature, badges mandat + carrière
	 */
	import type { Personne, Groupe, Mandat, RatioStat, NullableRatioStat } from '$lib/types';
	import { POLITICAL_ORDER } from '$lib/political-order';
	import StatRadar from './StatRadar.svelte';
	import Badge from './Badge.svelte';
	import InfoTip from './InfoTip.svelte';
	import Rank from './Rank.svelte';

	interface Props {
		personne: Personne;
		groupe: Groupe | null;
		/** null = vue carrière, sinon vue mandat */
		mandat: Mandat | null;
	}

	let { personne, groupe, mandat }: Props = $props();

	const stats = $derived(mandat ? mandat.stats : personne.carriere);
	const rangs = $derived(mandat ? mandat.rangs : null);
	const circo = $derived(mandat?.circonscription ?? personne.mandats.at(-1)?.circonscription ?? null);

	const age = $derived.by(() => {
		if (!personne.identite.dateNaissance) return null;
		const birth = new Date(personne.identite.dateNaissance);
		const now = new Date();
		let a = now.getFullYear() - birth.getFullYear();
		const md = now.getMonth() - birth.getMonth() || now.getDate() - birth.getDate();
		if (md < 0) a -= 1;
		return a;
	});

	const radarAxes = $derived([
		{ label: 'Présence', value: stats.presence.rate, color: '#60a5fa' },
		{ label: 'Participation', value: stats.participation.rate, color: '#a78bfa' },
		{ label: 'Loyauté', value: stats.loyaute.rate ?? 0, color: '#34d399' },
		{ label: 'Volume', value: stats.volume, color: '#fbbf24' }
	]);

	// Badges affichés : badges carrière toujours visibles + badges mandat seulement en vue mandat
	const badgeIds = $derived.by(() => {
		const ids: { id: string; kind: 'mandat' | 'carriere' }[] = [];
		for (const b of personne.carriere.badgesCarriere) ids.push({ id: b, kind: 'carriere' });
		if (mandat) for (const b of mandat.badgesMandat) ids.push({ id: b, kind: 'mandat' });
		return ids;
	});

	const groupeRank = $derived(groupe?.libelleAbrege ? POLITICAL_ORDER[groupe.libelleAbrege] : null);

	// Overall — calculé côté pipeline, cf ADR 0022 (formule unique, neutre, sans loyauté).
	const overall = $derived(stats.overall);

	function pct(n: number | null): string {
		if (n === null) return 'N/A';
		return `${Math.round(n * 100)} %`;
	}

	const totalCohorte = $derived(rangs?.presence.total ?? 0);
</script>

<div class="brut brut-lg relative overflow-hidden">
	<!-- Bandeau famille politique (aplat) -->
	<div class="h-2.5 w-full" style="background: {groupe?.couleur ?? 'var(--border-soft)'};" aria-hidden="true"></div>
	<div class="p-5">
	<!-- Top bar: overall + group -->
	<div class="flex items-start justify-between gap-3 mb-4">
		<div>
			<div
				class="title-display text-5xl leading-none"
				style="color: {groupe?.couleur ?? 'var(--accent)'}"
			>
				{overall}
			</div>
			<div class="text-[10px] uppercase tracking-widest text-fg-muted mt-1 inline-flex items-center gap-1">
				<span>{mandat ? `Overall · ${mandat.legislature}ᵉ` : 'Overall · Carrière'}</span>
				<InfoTip title="Comment se calcule l'Overall ?" placement="bottom">
					Note 0–99 mesurant l'assiduité d'un parlementaire à voter les lois
					(<a href="/faq#overall" class="underline text-link">détails</a>) :
					<ul class="list-disc pl-4 mt-1 space-y-0.5">
						<li><b>55 %</b> Participation (votes Pour ou Contre exprimés)</li>
						<li><b>35 %</b> Volume (nb de scrutins votés, normalisé sur le centile 95 de la cohorte)</li>
						<li><b>10 %</b> Présence (compte aussi l'abstention)</li>
					</ul>
					<div class="mt-2 text-fg-muted">
						La loyauté à un groupe n'entre pas dans la note.
						Décision figée en <a href="https://github.com/IMhide/hemicycle-manager/blob/main/decisions/0022-score-overall.md" class="underline">ADR 0022</a>.
					</div>
				</InfoTip>
			</div>
		</div>
		{#if groupe}
			<div class="text-right">
				<div class="flex items-center gap-2 justify-end">
					<span class="w-2.5 h-2.5 rounded-full" style="background-color: {groupe.couleur}"></span>
					<span class="text-sm font-semibold">{groupe.libelleAbrege}</span>
				</div>
				<div class="text-[10px] text-fg-muted max-w-[200px] truncate">{groupe.libelle}</div>
				{#if groupeRank}
					<div class="text-[10px] text-fg-muted">
						Rang politique : {groupeRank.rank}/12
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Photo + identity -->
	<div class="flex items-end gap-4 mb-5">
		<div class="relative">
			<img
				src={personne.identite.photoUrl}
				alt="{personne.identite.prenom} {personne.identite.nom}"
				class="w-28 h-36 object-cover bg-surface-2"
				loading="lazy"
				referrerpolicy="no-referrer"
			/>
		</div>
		<div class="flex-1 min-w-0 pb-1">
			<div class="text-[10px] uppercase tracking-widest text-fg-muted">
				{personne.identite.civ}
			</div>
			<div class="title-display text-2xl leading-tight">{personne.identite.prenom}</div>
			<div class="title-display text-3xl leading-tight">{personne.identite.nom}</div>
			<div class="text-xs text-fg-muted mt-2 space-y-0.5">
				{#if age !== null}<div>{age} ans</div>{/if}
				{#if circo}
					<div>{circo.dep} · {circo.depNum}-{circo.num}</div>
				{/if}
				{#if personne.identite.professionDeclaree}
					<div class="italic truncate">{personne.identite.professionDeclaree}</div>
				{/if}
				{#if !mandat}
					<div class="text-link">
						{personne.carriere.nbMandats} mandat{personne.carriere.nbMandats > 1 ? 's' : ''}
						· {personne.carriere.legislatures.map((l) => `${l}ᵉ`).join(' + ')}
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Radar -->
	<div class="mb-5 max-w-[280px] mx-auto">
		<StatRadar
			axes={radarAxes}
			size={260}
			strokeColor={groupe?.couleur ?? 'var(--accent)'}
			fillColor="{groupe?.couleur ?? 'var(--accent)'}33"
		/>
	</div>

	<!-- Stats list -->
	<div class="space-y-1.5 text-sm border-t border-border-soft/50 pt-4">
		<div class="flex justify-between items-center gap-2">
			<span class="flex items-center gap-1 text-fg-muted">
				Présence
				<InfoTip title="Taux de présence" size="xs">
					Part des scrutins où le député était <strong>physiquement présent</strong> (vote exprimé,
					abstention ou non-votant). Calculé sur les scrutins postérieurs à sa prise de fonction.
					{#if !mandat}
						<br /><br />
						En vue carrière, la moyenne est <strong>pondérée par les scrutins éligibles</strong>
						de chaque mandat (cf ADR 0017).
					{/if}
				</InfoTip>
			</span>
			<span class="flex items-center gap-2">
				<span class="title-display text-base text-blue-400 tabular-nums"
					>{pct(stats.presence.rate)}</span
				>
				{#if rangs}
					<Rank rank={rangs.presence.rank} total={rangs.presence.total} />
				{/if}
			</span>
		</div>
		<div class="flex justify-between items-center gap-2">
			<span class="flex items-center gap-1 text-fg-muted">
				Participation
				<InfoTip title="Taux de participation" size="xs">
					Part des scrutins où le député a <strong>exprimé un vote</strong> (pour, contre ou
					abstention). Plus exigeant que la présence : un président de séance présent mais
					non-votant n'est pas inclus.
				</InfoTip>
			</span>
			<span class="flex items-center gap-2">
				<span class="title-display text-base text-purple-400 tabular-nums"
					>{pct(stats.participation.rate)}</span
				>
				{#if rangs}
					<Rank rank={rangs.participation.rank} total={rangs.participation.total} />
				{/if}
			</span>
		</div>
		<div class="flex justify-between items-center gap-2">
			<span class="flex items-center gap-1 text-fg-muted">
				Loyauté
				<InfoTip title="Taux de loyauté au groupe" size="xs">
					Part des votes <strong>alignés sur la majorité du groupe</strong>, parmi les scrutins où
					le député a exprimé un vote pour ou contre et où le groupe avait une majorité claire.
					Calculée par rapport au groupe d'appartenance <em>au moment du vote</em> (cf ADR 0016).
				</InfoTip>
			</span>
			<span class="flex items-center gap-2">
				<span class="title-display text-base text-emerald-400 tabular-nums"
					>{pct(stats.loyaute.rate)}</span
				>
				{#if rangs}
					<Rank rank={rangs.loyaute.rank} total={rangs.loyaute.total} />
				{/if}
			</span>
		</div>
		<div class="flex justify-between items-center gap-2">
			<span class="flex items-center gap-1 text-fg-muted">
				Frondes
				<InfoTip title="Frondes" size="xs">
					Nombre de votes <em>exprimés</em> opposés à la position majoritaire du groupe d'appartenance
					au moment du vote. Indicateur d'indépendance vis-à-vis de la ligne du parti.
				</InfoTip>
			</span>
			<span class="flex items-center gap-2">
				<span class="title-display text-base text-rose-400 tabular-nums">{stats.frondes.count}</span>
				{#if rangs}
					<Rank rank={rangs.frondes.rank} total={rangs.frondes.total} />
				{/if}
			</span>
		</div>

		<div
			class="grid grid-cols-3 gap-2 pt-3 mt-3 border-t border-border-soft/30 text-center"
		>
			<div>
				<div class="title-display text-lg text-vote-pour">{stats.presence.numerator}</div>
				<div class="text-[10px] text-fg-muted uppercase">Présents</div>
			</div>
			<div>
				<div class="title-display text-lg text-vote-contre">{stats.participation.numerator}</div>
				<div class="text-[10px] text-fg-muted uppercase">Votés</div>
			</div>
			<div>
				<div class="title-display text-lg text-vote-abstention">{stats.presence.denominator}</div>
				<div class="text-[10px] text-fg-muted uppercase">Éligibles</div>
			</div>
		</div>
	</div>

	<!-- Badges -->
	{#if badgeIds.length > 0}
		<div class="mt-5 pt-4" style="border-top: 2px solid var(--border-soft);">
			<div class="text-[10px] uppercase tracking-widest text-fg-muted mb-2">Badges</div>
			<div class="flex flex-wrap gap-1.5">
				{#each badgeIds as b (b.kind + ':' + b.id)}
					<Badge id={b.id} kind={b.kind} />
				{/each}
			</div>
		</div>
	{/if}
	</div>
</div>
