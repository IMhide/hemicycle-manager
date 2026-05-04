<script lang="ts">
	import type { Depute, Groupe, DeputeStats } from '$lib/types';
	import { POLITICAL_ORDER } from '$lib/political-order';
	import StatRadar from './StatRadar.svelte';
	import Badge from './Badge.svelte';
	import InfoTip from './InfoTip.svelte';
	import Rank from './Rank.svelte';
	import { computeBadges } from '$lib/badges';

	const TOTAL_DEPUTES = 577;

	interface Props {
		depute: Depute;
		groupe: Groupe | null;
		stats: DeputeStats;
	}

	let { depute, groupe, stats }: Props = $props();

	const age = $derived.by(() => {
		if (!depute.dateNaissance) return null;
		const birth = new Date(depute.dateNaissance);
		const now = new Date();
		let a = now.getFullYear() - birth.getFullYear();
		const md = now.getMonth() - birth.getMonth() || now.getDate() - birth.getDate();
		if (md < 0) a -= 1;
		return a;
	});

	const radarAxes = $derived([
		{
			label: 'Présence',
			value: stats.tauxPresence,
			color: '#60a5fa'
		},
		{
			label: 'Participation',
			value: stats.tauxParticipation,
			color: '#a78bfa'
		},
		{
			label: 'Loyauté',
			value: stats.tauxLoyaute ?? 0,
			color: '#34d399'
		},
		{
			label: 'Activité',
			value: Math.min(1, (stats.pour + stats.contre + stats.abstention) / 3000),
			color: '#fbbf24'
		}
	]);

	const badges = $derived(computeBadges(depute, stats));

	const groupeRank = $derived(
		groupe?.libelleAbrege ? POLITICAL_ORDER[groupe.libelleAbrege] : null
	);

	// "Overall" rating à la FIFA — moyenne pondérée des 4 stats radar.
	const overall = $derived(
		Math.round(
			(stats.tauxPresence * 0.3 +
				stats.tauxParticipation * 0.2 +
				(stats.tauxLoyaute ?? 0) * 0.3 +
				Math.min(1, (stats.pour + stats.contre + stats.abstention) / 3000) * 0.2) *
				99
		)
	);

	function pct(n: number | null): string {
		if (n === null) return 'N/A';
		return `${Math.round(n * 100)} %`;
	}
</script>

<div
	class="card relative overflow-hidden p-5"
	style="background: radial-gradient(circle at 30% 0%, {groupe?.couleur ?? '#475569'}33 0%, transparent 60%), linear-gradient(180deg, #1e293b, #0f172a);"
>
	<!-- Top bar: overall + group -->
	<div class="flex items-start justify-between gap-3 mb-4">
		<div>
			<div class="title-display text-5xl leading-none" style="color: {groupe?.couleur ?? '#fbbf24'}">
				{overall}
			</div>
			<div class="text-[10px] uppercase tracking-widest text-assembly-muted mt-1">Overall</div>
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
				src={depute.photoUrl}
				alt="{depute.prenom} {depute.nom}"
				class="w-28 h-36 object-cover rounded-md border-2 border-assembly-border bg-assembly-border"
				loading="lazy"
				referrerpolicy="no-referrer"
			/>
		</div>
		<div class="flex-1 min-w-0 pb-1">
			<div class="text-[10px] uppercase tracking-widest text-assembly-muted">{depute.civ ?? ''}</div>
			<div class="title-display text-2xl leading-tight">{depute.prenom}</div>
			<div class="title-display text-3xl leading-tight">{depute.nom}</div>
			<div class="text-xs text-assembly-muted mt-2 space-y-0.5">
				{#if age !== null}<div>{age} ans</div>{/if}
				{#if depute.circo}
					<div>{depute.circo.dep} · {depute.circo.depNum}-{depute.circo.num}</div>
				{/if}
				{#if depute.profession}<div class="italic truncate">{depute.profession}</div>{/if}
			</div>
		</div>
	</div>

	<!-- Radar -->
	<div class="mb-5 max-w-[280px] mx-auto">
		<StatRadar axes={radarAxes} size={260} strokeColor={groupe?.couleur ?? '#fbbf24'}
			fillColor="{groupe?.couleur ?? '#fbbf24'}33"
		/>
	</div>

	<!-- Stats list -->
	<div class="space-y-1.5 text-sm border-t border-assembly-border/50 pt-4">
		<div class="flex justify-between items-center gap-2">
			<span class="flex items-center gap-1 text-assembly-muted">
				Présence
				<InfoTip title="Taux de présence" size="xs">
					Part des scrutins où le député était <strong>physiquement présent</strong> (vote exprimé,
					abstention ou non-votant). Calculé sur les scrutins postérieurs à sa prise de fonction.
					<br /><br />
					⚠️ Mesure la présence aux <em>scrutins publics nominatifs</em> uniquement.
					Beaucoup de scrutins ne mobilisent qu'une partie des députés ; le maximum observé
					est ~80 %.
				</InfoTip>
			</span>
			<span class="flex items-center gap-2">
				<span class="title-display text-base text-blue-400 tabular-nums">{pct(stats.tauxPresence)}</span>
				<Rank rank={stats.rangs.presence} total={TOTAL_DEPUTES} />
			</span>
		</div>
		<div class="flex justify-between items-center gap-2">
			<span class="flex items-center gap-1 text-assembly-muted">
				Participation
				<InfoTip title="Taux de participation" size="xs">
					Part des scrutins où le député a <strong>exprimé un vote</strong> (pour, contre ou abstention).
					Plus exigeant que la présence : un président de séance présent mais non-votant n'est pas inclus.
				</InfoTip>
			</span>
			<span class="flex items-center gap-2">
				<span class="title-display text-base text-purple-400 tabular-nums">{pct(stats.tauxParticipation)}</span>
				<Rank rank={stats.rangs.participation} total={TOTAL_DEPUTES} />
			</span>
		</div>
		<div class="flex justify-between items-center gap-2">
			<span class="flex items-center gap-1 text-assembly-muted">
				Loyauté
				<InfoTip title="Taux de loyauté au groupe" size="xs">
					Part des votes <strong>alignés sur la majorité du groupe</strong>, parmi les scrutins où le député
					a exprimé un vote pour ou contre et où le groupe avait une majorité claire.
				</InfoTip>
			</span>
			<span class="flex items-center gap-2">
				<span class="title-display text-base text-emerald-400 tabular-nums">{pct(stats.tauxLoyaute)}</span>
				<Rank rank={stats.rangs.loyaute} total={TOTAL_DEPUTES} />
			</span>
		</div>
		<div class="flex justify-between items-center gap-2">
			<span class="flex items-center gap-1 text-assembly-muted">
				Frondes
				<InfoTip title="Frondes" size="xs">
					Nombre de votes <em>exprimés</em> opposés à la position majoritaire de son groupe.
					Indicateur d'indépendance vis-à-vis de la ligne du parti. Rang 1 = le plus de frondes.
				</InfoTip>
			</span>
			<span class="flex items-center gap-2">
				<span class="title-display text-base text-rose-400 tabular-nums">{stats.frondes}</span>
				<Rank rank={stats.rangs.frondes} total={TOTAL_DEPUTES} />
			</span>
		</div>

		<div class="grid grid-cols-3 gap-2 pt-3 mt-3 border-t border-assembly-border/30 text-center">
			<div>
				<div class="title-display text-lg text-vote-pour">{stats.pour}</div>
				<div class="text-[10px] text-assembly-muted uppercase">Pour</div>
			</div>
			<div>
				<div class="title-display text-lg text-vote-contre">{stats.contre}</div>
				<div class="text-[10px] text-assembly-muted uppercase">Contre</div>
			</div>
			<div>
				<div class="title-display text-lg text-vote-abstention">{stats.abstention}</div>
				<div class="text-[10px] text-assembly-muted uppercase">Abst.</div>
			</div>
		</div>
	</div>

	<!-- Badges -->
	{#if badges.length > 0}
		<div class="mt-5 pt-4 border-t border-assembly-border/50">
			<div class="text-[10px] uppercase tracking-widest text-assembly-muted mb-2">🏆 Badges</div>
			<div class="flex flex-wrap gap-1.5">
				{#each badges as b (b.id)}
					<Badge badge={b} />
				{/each}
			</div>
		</div>
	{/if}
</div>
