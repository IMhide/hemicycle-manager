<script lang="ts">
	/**
	 * Fiche FIFA d'un sénateur (cf ADR 0023, 0024, transposition de ADR 0017).
	 *
	 * Modèle Phase 3 :
	 *   - vue carrière (sesann = null) : stats cumulées pondérées, badges carrière, pas de rang
	 *   - vue session (sesann fourni) : stats de la session, rangs scopés session, badges mandat + carrière
	 *
	 * Au Sénat, un sénateur a N mandats. Chaque mandat couvre M sessions. Les rangs/stats
	 * scopés se lisent sur la SessionStats correspondante (mandat.sessions[]).
	 */
	import type { Senateur, GroupeSenat, MandatSenat, SessionStats } from '$lib/types';
	import { POLITICAL_ORDER } from '$lib/political-order';
	import StatRadar from './StatRadar.svelte';
	import Badge from './Badge.svelte';
	import InfoTip from './InfoTip.svelte';
	import Rank from './Rank.svelte';

	interface Props {
		senateur: Senateur;
		groupe: GroupeSenat | null;
		/** null = vue carrière, sinon sesann (ex: 2024) */
		sesann: number | null;
	}

	let { senateur, groupe, sesann }: Props = $props();

	const mandatSession = $derived.by((): { mandat: MandatSenat; session: SessionStats } | null => {
		if (sesann === null) return null;
		for (const m of senateur.mandats) {
			const s = m.sessions.find((sess) => sess.sesann === sesann);
			if (s) return { mandat: m, session: s };
		}
		return null;
	});

	const stats = $derived(mandatSession ? mandatSession.session.stats : senateur.carriere);
	const rangs = $derived(mandatSession ? mandatSession.session.rangs : null);
	const circo = $derived(
		mandatSession?.mandat.circonscription ?? senateur.mandats.at(-1)?.circonscription ?? null
	);

	const age = $derived.by(() => {
		if (!senateur.identite.dateNaissance) return null;
		const birth = new Date(senateur.identite.dateNaissance);
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

	const badgeIds = $derived.by(() => {
		const ids: { id: string; kind: 'mandat' | 'carriere' }[] = [];
		for (const b of senateur.carriere.badgesCarriere) ids.push({ id: b, kind: 'carriere' });
		if (mandatSession) {
			for (const b of mandatSession.mandat.badgesMandat) ids.push({ id: b, kind: 'mandat' });
		}
		return ids;
	});

	const groupeRank = $derived(
		groupe?.libelleAbrege ? POLITICAL_ORDER[groupe.libelleAbrege] : null
	);

	const overall = $derived(stats.overall);

	function pct(n: number | null): string {
		if (n === null) return 'N/A';
		return `${Math.round(n * 100)} %`;
	}

	function libelleSession(s: number): string {
		return `${s}-${(s + 1).toString().slice(-2)}`;
	}
</script>

<div
	class="card relative overflow-hidden p-5"
	style="background: radial-gradient(circle at 30% 0%, {groupe?.couleur ?? '#475569'}33 0%, transparent 60%), linear-gradient(180deg, #1e293b, #0f172a);"
>
	<!-- Top bar: overall + group -->
	<div class="flex items-start justify-between gap-3 mb-4">
		<div>
			<div
				class="title-display text-5xl leading-none"
				style="color: {groupe?.couleur ?? '#fbbf24'}"
			>
				{overall}
			</div>
			<div class="text-[10px] uppercase tracking-widest text-assembly-muted mt-1 inline-flex items-center gap-1">
				<span>{sesann !== null ? `Overall · ${libelleSession(sesann)}` : 'Overall · Carrière'}</span>
				<InfoTip title="Comment se calcule l'Overall ?" placement="bottom">
					Note 0–99 mesurant l'assiduité d'un parlementaire à voter les lois
					(<a href="/faq#overall" class="underline text-assembly-accent">détails</a>) :
					<ul class="list-disc pl-4 mt-1 space-y-0.5">
						<li><b>55 %</b> Participation (votes Pour ou Contre exprimés)</li>
						<li><b>35 %</b> Volume (nb de scrutins votés, normalisé sur le centile 95 de la cohorte)</li>
						<li><b>10 %</b> Présence (compte aussi l'abstention)</li>
					</ul>
					<div class="mt-2 text-assembly-muted">
						La loyauté à un groupe n'entre pas dans la note. Décision figée en
						<a href="https://github.com/IMhide/hemicycle-manager/blob/main/decisions/0022-score-overall.md" class="underline">ADR 0022</a>.
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
				<div class="text-[10px] text-assembly-muted max-w-[200px] truncate">{groupe.libelle}</div>
				{#if groupeRank}
					<div class="text-[10px] text-assembly-muted">
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
				src={senateur.identite.photoUrl}
				alt="{senateur.identite.prenom} {senateur.identite.nom}"
				class="w-28 h-36 object-cover rounded-md border-2 border-assembly-border bg-assembly-border"
				loading="lazy"
				referrerpolicy="no-referrer"
			/>
		</div>
		<div class="flex-1 min-w-0 pb-1">
			<div class="text-[10px] uppercase tracking-widest text-assembly-muted">
				{senateur.identite.civ}
			</div>
			<div class="title-display text-2xl leading-tight">{senateur.identite.prenom}</div>
			<div class="title-display text-3xl leading-tight">{senateur.identite.nom}</div>
			<div class="text-xs text-assembly-muted mt-2 space-y-0.5">
				{#if age !== null}<div>{age} ans</div>{/if}
				{#if circo}<div>{circo}</div>{/if}
				{#if senateur.identite.professionDeclaree}
					<div class="italic truncate">{senateur.identite.professionDeclaree}</div>
				{/if}
				{#if sesann === null}
					<div class="text-assembly-accent/80">
						{senateur.carriere.nbMandats} mandat{senateur.carriere.nbMandats > 1 ? 's' : ''}
						· {senateur.carriere.sessions.length} session{senateur.carriere.sessions.length > 1 ? 's' : ''}
					</div>
				{/if}
				<div class="text-[10px] text-assembly-muted">
					{senateur.identite.etat === 'ACTIF' ? '🟢 En exercice' : '⚪ Ancien·ne'}
				</div>
			</div>
		</div>
	</div>

	<!-- Radar -->
	<div class="mb-5 max-w-[280px] mx-auto">
		<StatRadar
			axes={radarAxes}
			size={260}
			strokeColor={groupe?.couleur ?? '#fbbf24'}
			fillColor="{groupe?.couleur ?? '#fbbf24'}33"
		/>
	</div>

	<!-- Stats list -->
	<div class="space-y-1.5 text-sm border-t border-assembly-border/50 pt-4">
		<div class="flex justify-between items-center gap-2">
			<span class="flex items-center gap-1 text-assembly-muted">
				Présence
				<InfoTip title="Taux de présence" size="xs">
					Part des scrutins où le sénateur était <strong>physiquement présent</strong> (vote
					exprimé, abstention ou non-votant). Calculé sur les scrutins postérieurs à sa prise de
					fonction.
					{#if sesann === null}
						<br /><br />
						En vue carrière, la moyenne est <strong>pondérée par les scrutins éligibles</strong>
						de chaque session (cf ADR 0017 transposée).
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
			<span class="flex items-center gap-1 text-assembly-muted">
				Participation
				<InfoTip title="Taux de participation" size="xs">
					Part des scrutins où le sénateur a <strong>exprimé un vote</strong> (pour, contre ou
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
			<span class="flex items-center gap-1 text-assembly-muted">
				Loyauté
				<InfoTip title="Taux de loyauté au groupe" size="xs">
					Part des votes <strong>alignés sur la majorité du groupe</strong>, parmi les scrutins
					où le sénateur a exprimé un vote pour ou contre et où le groupe avait une majorité
					claire. Calculée par rapport au groupe d'appartenance <em>au moment du vote</em>.
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
			<span class="flex items-center gap-1 text-assembly-muted">
				Frondes
				<InfoTip title="Frondes" size="xs">
					Nombre de votes <em>exprimés</em> opposés à la position majoritaire du groupe
					d'appartenance au moment du vote. Indicateur d'indépendance vis-à-vis de la ligne du
					parti.
				</InfoTip>
			</span>
			<span class="flex items-center gap-2">
				<span class="title-display text-base text-rose-400 tabular-nums"
					>{stats.frondes.count}</span
				>
				{#if rangs}
					<Rank rank={rangs.frondes.rank} total={rangs.frondes.total} />
				{/if}
			</span>
		</div>

		<div class="grid grid-cols-3 gap-2 pt-3 mt-3 border-t border-assembly-border/30 text-center">
			<div>
				<div class="title-display text-lg text-vote-pour">{stats.presence.numerator}</div>
				<div class="text-[10px] text-assembly-muted uppercase">Présents</div>
			</div>
			<div>
				<div class="title-display text-lg text-vote-contre">{stats.participation.numerator}</div>
				<div class="text-[10px] text-assembly-muted uppercase">Votés</div>
			</div>
			<div>
				<div class="title-display text-lg text-vote-abstention">{stats.presence.denominator}</div>
				<div class="text-[10px] text-assembly-muted uppercase">Éligibles</div>
			</div>
		</div>
	</div>

	<!-- Badges -->
	{#if badgeIds.length > 0}
		<div class="mt-5 pt-4 border-t border-assembly-border/50">
			<div class="text-[10px] uppercase tracking-widest text-assembly-muted mb-2">🏆 Badges</div>
			<div class="flex flex-wrap gap-1.5">
				{#each badgeIds as b (b.kind + ':' + b.id)}
					<Badge id={b.id} kind={b.kind} />
				{/each}
			</div>
		</div>
	{/if}
</div>
