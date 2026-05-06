<script lang="ts">
	/**
	 * Classements Sénat (cf ADR 0017 transposée + ADR 0022).
	 *
	 * Deux modes inspirés du football, comme côté AN :
	 *
	 * - 🏆 LE CHAMPIONNAT (overall, cf ADR 0022)
	 *   - Top sénateurs (par session ou carrière)
	 *   - Top groupes (overallMoyen pré-calculé pipeline)
	 *   - Top blocs (5 blocs CHES, cf political-order)
	 *
	 * - ⚽ Les Coupes (présence/participation/loyauté/frondes, par session)
	 *   - Vues Global / Par groupe
	 *
	 * Au Sénat, l'unité de cohorte est la **session annuelle** (sept→sept), pas
	 * la législature (cf ADR 0023). La carrière n'existe que sur Le Championnat.
	 */
	import InfoTip from '$lib/components/InfoTip.svelte';
	import type { Senateur, MandatSenat, GroupeSenat, SessionStats } from '$lib/types';
	import { BLOCS, blocOf, type Bloc } from '$lib/political-order';

	let { data } = $props();

	type Mode = 'championship' | 'coupes';
	type ChampView = 'senateurs' | 'groupes' | 'blocs';
	type Metric = 'presence' | 'participation' | 'loyaute' | 'frondes';
	/** scopeSession = 0 → Carrière (uniquement valide sur Top sénateurs). */
	type ScopeSession = number;

	let mode: Mode = $state('championship');
	let champView: ChampView = $state('senateurs');
	let metric: Metric = $state('presence');
	let coupeView: 'global' | 'by-group' = $state('global');
	let topN = $state(20);

	const sessionsSorted = $derived([...data.sessions].sort((a, b) => b.sesann - a.sesann));
	let scopeSession: ScopeSession = $state(sessionsSorted[0]?.sesann ?? 2024);

	const groupesByCode = $derived.by(() => {
		const m = new Map<string, GroupeSenat[]>();
		for (const g of data.groupes) {
			const arr = m.get(g.code) ?? [];
			arr.push(g);
			m.set(g.code, arr);
		}
		return m;
	});

	const groupesScope = $derived(data.groupes.filter((g) => g.sesann === scopeSession));

	function libelleSession(sesann: number): string {
		return `${sesann}-${(sesann + 1).toString().slice(-2)}`;
	}

	// ────────────────────────────────────────────────────────────────────
	// Coupes (métriques)
	// ────────────────────────────────────────────────────────────────────

	const metricMeta = {
		presence: {
			label: 'Présence',
			emoji: '🎯',
			format: (sess: SessionStats) => `${(sess.stats.presence.rate * 100).toFixed(1)} %`,
			value: (sess: SessionStats) => sess.stats.presence.rate,
			rank: (sess: SessionStats) => sess.rangs.presence.rank,
			info: 'Part des scrutins où le sénateur était physiquement présent.',
			color: 'text-blue-400'
		},
		participation: {
			label: 'Participation',
			emoji: '✋',
			format: (sess: SessionStats) => `${(sess.stats.participation.rate * 100).toFixed(1)} %`,
			value: (sess: SessionStats) => sess.stats.participation.rate,
			rank: (sess: SessionStats) => sess.rangs.participation.rank,
			info: 'Part des scrutins où le sénateur a exprimé un vote pour, contre ou abstention.',
			color: 'text-purple-400'
		},
		loyaute: {
			label: 'Loyauté',
			emoji: '🤝',
			format: (sess: SessionStats) =>
				sess.stats.loyaute.rate === null
					? 'N/A'
					: `${(sess.stats.loyaute.rate * 100).toFixed(1)} %`,
			value: (sess: SessionStats) => sess.stats.loyaute.rate,
			rank: (sess: SessionStats) => sess.rangs.loyaute.rank,
			info: 'Part des votes alignés avec la majorité du groupe au moment du vote (cf ADR 0016 transposée).',
			color: 'text-emerald-400'
		},
		frondes: {
			label: 'Frondes',
			emoji: '🔥',
			format: (sess: SessionStats) => `${sess.stats.frondes.count}`,
			value: (sess: SessionStats) => sess.stats.frondes.count,
			rank: (sess: SessionStats) => sess.rangs.frondes.rank,
			info: 'Nombre de votes exprimés opposés à la majorité du groupe.',
			color: 'text-rose-400'
		}
	} as const;

	const currentMeta = $derived(metricMeta[metric]);

	function mandatPourSession(s: Senateur, sesann: number): MandatSenat | null {
		for (const m of s.mandats) {
			if (m.sessions.some((sess) => sess.sesann === sesann)) return m;
		}
		return null;
	}

	function sessionStatsFor(s: Senateur, sesann: number): SessionStats | null {
		const m = mandatPourSession(s, sesann);
		return m?.sessions.find((sess) => sess.sesann === sesann) ?? null;
	}

	function groupePrincipal(m: MandatSenat, sesann: number): GroupeSenat | null {
		const lastApp = m.appartenancesGroupe.at(-1);
		if (!lastApp) return null;
		const candidats = groupesByCode.get(lastApp.groupeCode);
		if (!candidats) return null;
		const exact = candidats.find((g) => g.sesann === sesann);
		return exact ?? [...candidats].sort((a, b) => b.sesann - a.sesann)[0];
	}

	/** Pour la vue carrière : groupe par session, dernière session avec mandat. */
	function groupesCarriere(s: Senateur): Array<{ sesann: number; groupe: GroupeSenat | null }> {
		const out: Array<{ sesann: number; groupe: GroupeSenat | null }> = [];
		const seen = new Set<string>();
		for (const sesann of [...s.carriere.sessions].sort((a, b) => a - b)) {
			const m = mandatPourSession(s, sesann);
			if (!m) continue;
			const lastApp = m.appartenancesGroupe.at(-1);
			if (!lastApp) continue;
			const key = `${sesann}-${lastApp.groupeCode}`;
			if (seen.has(key)) continue;
			seen.add(key);
			const candidats = groupesByCode.get(lastApp.groupeCode);
			const grp = candidats
				? candidats.find((g) => g.sesann === sesann) ??
					[...candidats].sort((a, b) => b.sesann - a.sesann)[0]
				: null;
			out.push({ sesann, groupe: grp });
		}
		return out;
	}

	/** Sénateurs avec un mandat couvrant la session scope, avec leur SessionStats. */
	const senateursSession = $derived.by(() => {
		const list: Array<{
			senateur: Senateur;
			mandat: MandatSenat;
			session: SessionStats;
		}> = [];
		for (const s of data.senateurs) {
			const m = mandatPourSession(s, scopeSession);
			const sess = sessionStatsFor(s, scopeSession);
			if (m && sess) list.push({ senateur: s, mandat: m, session: sess });
		}
		return list;
	});

	/** Tri Coupes par rang croissant. */
	const coupesSorted = $derived(
		[...senateursSession]
			.filter(({ session }) => currentMeta.value(session) !== null)
			.sort((a, b) => {
				const ra = currentMeta.rank(a.session);
				const rb = currentMeta.rank(b.session);
				if (ra === null && rb === null) return 0;
				if (ra === null) return 1;
				if (rb === null) return -1;
				return ra - rb;
			})
	);

	const coupesTopGlobal = $derived(coupesSorted.slice(0, topN));

	const coupesByGroup = $derived.by(() => {
		const grouped = new Map<string, typeof coupesSorted>();
		for (const entry of coupesSorted) {
			const g = groupePrincipal(entry.mandat, scopeSession);
			if (!g) continue;
			if (!grouped.has(g.code)) grouped.set(g.code, []);
			grouped.get(g.code)!.push(entry);
		}
		return groupesScope
			.map((g) => {
				const list = grouped.get(g.code) ?? [];
				return { groupe: g, top: list.slice(0, 5) };
			})
			.filter((entry) => entry.top.length > 0);
	});

	// ────────────────────────────────────────────────────────────────────
	// 🏆 LE CHAMPIONNAT — Top sénateurs
	// ────────────────────────────────────────────────────────────────────

	const championSenateurs = $derived.by(() => {
		const list: Array<{
			senateur: Senateur;
			mandat: MandatSenat | null;
			session: SessionStats | null;
			overall: number;
		}> = [];

		if (scopeSession === 0) {
			// Carrière
			for (const s of data.senateurs) {
				list.push({
					senateur: s,
					mandat: null,
					session: null,
					overall: s.carriere.overall
				});
			}
		} else {
			for (const { senateur, mandat, session } of senateursSession) {
				list.push({ senateur, mandat, session, overall: session.stats.overall });
			}
		}
		return list.sort((a, b) => b.overall - a.overall);
	});

	const championSenateursTop = $derived(championSenateurs.slice(0, topN));

	// ────────────────────────────────────────────────────────────────────
	// 🏆 LE CHAMPIONNAT — Top groupes (overall pré-calculé pipeline)
	// ────────────────────────────────────────────────────────────────────

	const championGroupes = $derived(
		[...groupesScope]
			.filter((g) => g.overallEffectif > 0)
			.sort((a, b) => b.overallMoyen - a.overallMoyen)
	);

	// ────────────────────────────────────────────────────────────────────
	// 🏆 LE CHAMPIONNAT — Top blocs
	// ────────────────────────────────────────────────────────────────────

	const championBlocs = $derived.by(() => {
		const acc = new Map<Bloc, { sum: number; count: number; groupes: GroupeSenat[] }>();
		for (const g of groupesScope) {
			if (g.overallEffectif === 0) continue;
			const b = blocOf(g.libelleAbrege);
			const cur = acc.get(b) ?? { sum: 0, count: 0, groupes: [] };
			cur.sum += g.overallMoyen * g.overallEffectif;
			cur.count += g.overallEffectif;
			cur.groupes.push(g);
			acc.set(b, cur);
		}
		return BLOCS.map((meta) => {
			const a = acc.get(meta.id);
			if (!a || a.count === 0) return null;
			return {
				meta,
				moyenne: Math.round(a.sum / a.count),
				effectif: a.count,
				groupes: a.groupes.sort((x, y) => y.overallMoyen - x.overallMoyen)
			};
		}).filter((x): x is NonNullable<typeof x> => x !== null);
	});

	const championBlocsSorted = $derived(
		[...championBlocs].sort((a, b) => b.moyenne - a.moyenne)
	);

	// ────────────────────────────────────────────────────────────────────
	// Helpers
	// ────────────────────────────────────────────────────────────────────

	function tierFor(rank: number, total: number): { medal: string; cls: string } {
		const ratio = rank / total;
		if (ratio <= 0.1) return { medal: '🥇', cls: 'border-amber-400/40 bg-amber-400/5' };
		if (ratio <= 0.25) return { medal: '🥈', cls: 'border-slate-400/40 bg-slate-400/5' };
		if (ratio <= 0.5) return { medal: '🥉', cls: 'border-orange-700/40 bg-orange-700/5' };
		return { medal: '', cls: '' };
	}

	function medalFor(rank: number): string {
		if (rank === 1) return '🥇';
		if (rank === 2) return '🥈';
		if (rank === 3) return '🥉';
		return `#${rank}`;
	}

	function setMode(m: Mode) {
		mode = m;
		topN = 20;
		if (m === 'coupes' && scopeSession === 0) {
			scopeSession = sessionsSorted[0]?.sesann ?? 2024;
		}
	}

	function setChampView(v: ChampView) {
		champView = v;
		topN = 20;
		if (v !== 'senateurs' && scopeSession === 0) {
			scopeSession = sessionsSorted[0]?.sesann ?? 2024;
		}
	}
</script>

<svelte:head>
	<title>Classements Sénat — PolitiDex</title>
</svelte:head>

<section class="max-w-7xl mx-auto px-6 py-8">
	<div class="flex items-baseline justify-between gap-4 flex-wrap mb-6">
		<div>
			<h1 class="title-display text-4xl">🏆 Classements Sénat</h1>
			<p class="text-assembly-muted text-sm mt-1">
				{#if mode === 'championship'}
					<b>Le Championnat</b> — classements par
					<a href="/faq#senat-overall" class="underline text-assembly-accent">Overall</a>
					(cf ADR 0022).
				{:else}
					<b>Les Coupes</b> — classements thématiques par session (cf ADR 0023).
				{/if}
			</p>
		</div>

		<div class="flex gap-1 bg-assembly-surface border border-assembly-border rounded-lg p-1">
			<button
				class="btn px-4 py-1.5 text-xs font-semibold {mode === 'championship'
					? 'bg-assembly-accent text-assembly-bg'
					: 'text-assembly-muted hover:text-slate-200'}"
				onclick={() => setMode('championship')}
			>
				🏆 Le Championnat
			</button>
			<button
				class="btn px-4 py-1.5 text-xs font-semibold {mode === 'coupes'
					? 'bg-assembly-accent text-assembly-bg'
					: 'text-assembly-muted hover:text-slate-200'}"
				onclick={() => setMode('coupes')}
			>
				⚽ Les Coupes
			</button>
		</div>
	</div>

	{#if mode === 'championship'}
		<details class="card p-4 mb-4 group">
			<summary class="cursor-pointer flex items-center gap-2 list-none">
				<span
					class="text-assembly-accent text-lg leading-none transition-transform group-open:rotate-90 select-none"
					aria-hidden="true">▸</span
				>
				<span class="title-display text-lg">🎮 Comment se calcule l'Overall&nbsp;?</span>
				<span class="ml-auto text-[10px] uppercase tracking-widest text-assembly-muted"
					>Note 0–99</span
				>
			</summary>
			<div class="mt-3 text-sm leading-relaxed text-slate-300 space-y-3">
				<p>
					Postulat&nbsp;: un parlementaire est un <i>employé du peuple</i>, payé pour voter des
					lois. Donc on récompense surtout l'acte de voter Pour ou Contre.
				</p>
				<div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
					<div class="p-3 rounded border border-assembly-border bg-purple-400/5">
						<div class="title-display text-2xl text-purple-300">55&nbsp;%</div>
						<div class="text-xs font-semibold mt-0.5">✋ Participation</div>
						<div class="text-[11px] text-assembly-muted mt-1">
							% des scrutins votés <b>Pour</b> ou <b>Contre</b>
						</div>
					</div>
					<div class="p-3 rounded border border-assembly-border bg-amber-400/5">
						<div class="title-display text-2xl text-amber-300">35&nbsp;%</div>
						<div class="text-xs font-semibold mt-0.5">📈 Volume</div>
						<div class="text-[11px] text-assembly-muted mt-1">
							Nb total de votes, normalisé sur le centile&nbsp;95 de la cohorte
						</div>
					</div>
					<div class="p-3 rounded border border-assembly-border bg-blue-400/5">
						<div class="title-display text-2xl text-blue-300">10&nbsp;%</div>
						<div class="text-xs font-semibold mt-0.5">🎯 Présence</div>
						<div class="text-[11px] text-assembly-muted mt-1">
							Idem participation mais l'<b>abstention</b> compte aussi
						</div>
					</div>
				</div>
				<p class="text-xs text-assembly-muted">
					La <b>Loyauté</b> n'entre <b>pas</b> dans la note. Les délégations de vote sont
					ignorées en v1 (cf
					<a
						href="https://github.com/IMhide/hemicycle-manager/blob/main/decisions/0027-delegations-vote-senat-v1.md"
						class="underline">ADR 0027</a
					>).
					<a href="/faq#senat-overall" class="underline hover:text-assembly-accent"
						>Plus d'explications</a
					>.
				</p>
			</div>
		</details>

		<div class="flex flex-wrap gap-2 mb-4">
			{#each [{ id: 'senateurs', label: 'Top sénateurs', emoji: '👤' }, { id: 'groupes', label: 'Top groupes', emoji: '🎽' }, { id: 'blocs', label: 'Top blocs', emoji: '🗺️' }] as v (v.id)}
				<button
					class="card px-4 py-2 flex items-center gap-2 transition-colors {champView === v.id
						? 'border-assembly-accent ring-1 ring-assembly-accent/40'
						: 'hover:border-assembly-accent/60'}"
					onclick={() => setChampView(v.id as ChampView)}
				>
					<span aria-hidden="true">{v.emoji}</span>
					<span class="font-semibold">{v.label}</span>
				</button>
			{/each}
		</div>

		<div class="flex items-center gap-1 text-xs mb-6 flex-wrap">
			{#if champView === 'senateurs'}
				<button
					class="px-3 py-1 rounded {scopeSession === 0
						? 'bg-assembly-accent text-assembly-bg font-semibold'
						: 'border border-assembly-border text-assembly-muted hover:text-slate-200'}"
					onclick={() => (scopeSession = 0)}
				>
					Carrière
				</button>
			{/if}
			{#each sessionsSorted.slice(0, 8) as sess (sess.sesann)}
				<button
					class="px-2 py-1 rounded text-[11px] {scopeSession === sess.sesann
						? 'bg-assembly-accent text-assembly-bg font-semibold'
						: 'border border-assembly-border text-assembly-muted hover:text-slate-200'}"
					onclick={() => (scopeSession = sess.sesann)}
				>
					{libelleSession(sess.sesann)}
				</button>
			{/each}
		</div>

		{#if champView === 'senateurs'}
			<div class="text-sm text-assembly-muted flex items-center gap-1 mb-4">
				{scopeSession === 0
					? 'Top sénateurs sur leur carrière entière (overall agrégé toutes sessions).'
					: `Top sénateurs de la session ${libelleSession(scopeSession)} (overall sur la session).`}
				<InfoTip title="Overall" size="xs">
					Note 0–99 : <b>55 %</b> Participation + <b>35 %</b> Volume (centile 95 cohorte) +
					<b>10 %</b> Présence. La loyauté n'entre pas dans la note (cf ADR 0022).
				</InfoTip>
			</div>

			<div class="space-y-1.5">
				{#each championSenateursTop as { senateur, mandat, session, overall }, i (senateur.id + (mandat ? scopeSession : 'c'))}
					{@const groupe = mandat ? groupePrincipal(mandat, scopeSession) : null}
					{@const rank = i + 1}
					{@const tier = tierFor(rank, championSenateurs.length)}
					<a
						href={mandat
							? `/senat/senateurs/${senateur.id}/?session=${scopeSession}`
							: `/senat/senateurs/${senateur.id}/`}
						class="card p-3 flex items-center gap-3 hover:border-assembly-accent/60 transition-colors {tier.cls}"
					>
						<div
							class="w-10 text-center title-display text-2xl tabular-nums flex-shrink-0 flex items-center justify-center"
						>
							{tier.medal || `#${rank}`}
						</div>
						<img
							src={senateur.identite.photoUrl}
							alt=""
							class="w-10 h-10 rounded-full object-cover bg-assembly-border flex-shrink-0"
							loading="lazy"
							referrerpolicy="no-referrer"
						/>
						<div class="min-w-0 flex-1">
							<div class="font-semibold truncate">
								{senateur.identite.prenom}
								{senateur.identite.nom}
							</div>
							<div class="flex items-center flex-wrap gap-x-2 gap-y-1 mt-0.5">
								{#if scopeSession === 0}
									{#each groupesCarriere(senateur).slice(-4) as { sesann, groupe: g } (sesann + (g?.code ?? ''))}
										<span class="inline-flex items-center gap-1 text-[10px]">
											<span class="text-assembly-muted tabular-nums">
												{libelleSession(sesann)}
											</span>
											{#if g}
												<span class="inline-flex items-center gap-1">
													<span
														class="w-1.5 h-1.5 rounded-full"
														style="background-color: {g.couleur}"
													></span>
													<span class="font-semibold">{g.libelleAbrege}</span>
												</span>
											{:else}
												<span class="text-assembly-muted italic">—</span>
											{/if}
										</span>
									{/each}
								{:else if groupe}
									<span class="inline-flex items-center gap-1.5 text-xs">
										<span
											class="w-2 h-2 rounded-full"
											style="background-color: {groupe.couleur}"
										></span>
										<span class="font-semibold">{groupe.libelleAbrege}</span>
									</span>
								{/if}
							</div>
						</div>
						<div class="title-display text-3xl tabular-nums flex-shrink-0 text-amber-400">
							{overall}
						</div>
					</a>
				{/each}
			</div>

			{#if topN < championSenateurs.length}
				<div class="mt-4 text-center">
					<button class="btn-ghost text-sm" onclick={() => (topN += 20)}>
						Charger 20 de plus ({championSenateurs.length - topN} restants)
					</button>
				</div>
			{/if}
		{:else if champView === 'groupes'}
			<div class="text-sm text-assembly-muted flex items-center gap-1 mb-4">
				Moyenne d'overall des membres de chaque groupe (session
				{libelleSession(scopeSession)}).
				<InfoTip title="Top groupes" size="xs">
					Chaque membre est rattaché à son groupe principal (dernière appartenance du mandat).
				</InfoTip>
			</div>

			<div class="space-y-1.5">
				{#each championGroupes as g, i (g.code)}
					{@const rank = i + 1}
					<a
						href="/senat/groupes/{scopeSession}/{g.code}/"
						class="card p-3 flex items-center gap-3 hover:border-assembly-accent/60 transition-colors"
						style="border-left: 4px solid {g.couleur}"
					>
						<div
							class="w-12 text-center title-display text-2xl tabular-nums flex-shrink-0 flex items-center justify-center"
						>
							{medalFor(rank)}
						</div>
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2">
								<span
									class="w-2.5 h-2.5 rounded-full flex-shrink-0"
									style="background-color: {g.couleur}"
								></span>
								<span class="font-semibold">{g.libelleAbrege}</span>
							</div>
							<div class="text-[11px] text-assembly-muted mt-0.5 truncate">
								{g.libelle} · {g.overallEffectif} membres
							</div>
						</div>
						<div class="title-display text-3xl tabular-nums flex-shrink-0 text-amber-400">
							{g.overallMoyen}
						</div>
					</a>
				{/each}
			</div>
		{:else}
			<div class="text-sm text-assembly-muted flex items-center gap-1 mb-4">
				Moyenne pondérée d'overall par bloc politique (session
				{libelleSession(scopeSession)}).
				<InfoTip title="Top blocs" size="xs">
					5 blocs basés sur les scores Chapel Hill 2024 (CHES). Les NI Sénat (`AUCUN`) sont
					rattachés au bloc Non-inscrits (cf ADR 0007).
				</InfoTip>
			</div>

			<div class="space-y-2">
				{#each championBlocsSorted as bloc, i (bloc.meta.id)}
					{@const rank = i + 1}
					<div class="card p-4" style="border-left: 6px solid {bloc.meta.color}">
						<div class="flex items-center gap-3 mb-3">
							<div
								class="w-12 text-center title-display text-2xl tabular-nums flex-shrink-0"
							>
								{medalFor(rank)}
							</div>
							<div class="flex-1 min-w-0">
								<div class="title-display text-xl flex items-center gap-2">
									<span aria-hidden="true">{bloc.meta.emoji}</span>
									{bloc.meta.label}
								</div>
								<div class="text-[11px] text-assembly-muted">
									{bloc.effectif} membres · {bloc.groupes.length} groupes
								</div>
							</div>
							<div class="title-display text-4xl tabular-nums flex-shrink-0 text-amber-400">
								{bloc.moyenne}
							</div>
						</div>
						<div class="flex flex-wrap gap-1.5 pl-15">
							{#each bloc.groupes as g (g.code)}
								<a
									href="/senat/groupes/{scopeSession}/{g.code}/"
									class="text-[11px] px-2 py-1 rounded border border-assembly-border hover:border-assembly-accent transition-colors flex items-center gap-1.5"
									style="border-left: 3px solid {g.couleur}"
								>
									<span class="font-semibold">{g.libelleAbrege}</span>
									<span class="text-assembly-muted tabular-nums">{g.overallMoyen}</span>
								</a>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{:else}
		<!-- ⚽ LES COUPES -->

		<div class="flex items-center gap-1 text-xs mb-4 flex-wrap">
			{#each sessionsSorted.slice(0, 8) as sess (sess.sesann)}
				<button
					class="px-2 py-1 rounded text-[11px] {scopeSession === sess.sesann
						? 'bg-assembly-accent text-assembly-bg font-semibold'
						: 'border border-assembly-border text-assembly-muted hover:text-slate-200'}"
					onclick={() => (scopeSession = sess.sesann)}
				>
					{libelleSession(sess.sesann)}
				</button>
			{/each}
			<span class="ml-3 text-[10px] text-assembly-muted italic">
				Pas de cohorte cross-session (cf ADR 0023).
			</span>
		</div>

		<div class="flex flex-wrap gap-2 mb-4">
			{#each Object.entries(metricMeta) as [key, meta] (key)}
				<button
					class="card px-4 py-2 flex items-center gap-2 transition-colors {metric === key
						? 'border-assembly-accent ring-1 ring-assembly-accent/40'
						: 'hover:border-assembly-accent/60'}"
					onclick={() => (metric = key as Metric)}
				>
					<span aria-hidden="true">{meta.emoji}</span>
					<span class="font-semibold">{meta.label}</span>
				</button>
			{/each}
		</div>

		<div class="flex items-center gap-2 mb-4">
			<div class="flex gap-1 bg-assembly-surface border border-assembly-border rounded-lg p-1">
				<button
					class="btn px-3 py-1 text-xs {coupeView === 'global'
						? 'bg-assembly-accent text-assembly-bg'
						: 'text-assembly-muted'}"
					onclick={() => (coupeView = 'global')}
				>
					Global
				</button>
				<button
					class="btn px-3 py-1 text-xs {coupeView === 'by-group'
						? 'bg-assembly-accent text-assembly-bg'
						: 'text-assembly-muted'}"
					onclick={() => (coupeView = 'by-group')}
				>
					Par groupe
				</button>
			</div>
			<div class="text-xs text-assembly-muted flex items-center gap-1">
				{currentMeta.info}
				<InfoTip title={currentMeta.label} size="xs">{currentMeta.info}</InfoTip>
			</div>
		</div>

		{#if coupeView === 'global'}
			<div class="space-y-1.5">
				{#each coupesTopGlobal as { senateur, mandat, session }, i (senateur.id)}
					{@const groupe = groupePrincipal(mandat, scopeSession)}
					{@const rank = currentMeta.rank(session)!}
					{@const tier = tierFor(rank, coupesSorted.length)}
					<a
						href="/senat/senateurs/{senateur.id}/?session={scopeSession}"
						class="card p-3 flex items-center gap-3 hover:border-assembly-accent/60 transition-colors {tier.cls}"
					>
						<div
							class="w-10 text-center title-display text-2xl tabular-nums flex-shrink-0 flex items-center justify-center"
						>
							{tier.medal || `#${rank}`}
						</div>
						<img
							src={senateur.identite.photoUrl}
							alt=""
							class="w-10 h-10 rounded-full object-cover bg-assembly-border flex-shrink-0"
							loading="lazy"
							referrerpolicy="no-referrer"
						/>
						<div class="min-w-0 flex-1">
							<div class="font-semibold truncate">
								{senateur.identite.prenom}
								{senateur.identite.nom}
							</div>
							{#if groupe}
								<div class="mt-0.5 inline-flex items-center gap-1.5 text-xs">
									<span
										class="w-2 h-2 rounded-full"
										style="background-color: {groupe.couleur}"
									></span>
									<span class="font-semibold">{groupe.libelleAbrege}</span>
								</div>
							{/if}
						</div>
						<div
							class="title-display text-2xl tabular-nums flex-shrink-0 {currentMeta.color}"
						>
							{currentMeta.format(session)}
						</div>
					</a>
				{/each}
			</div>

			{#if topN < coupesSorted.length}
				<div class="mt-4 text-center">
					<button class="btn-ghost text-sm" onclick={() => (topN += 20)}>
						Charger 20 de plus ({coupesSorted.length - topN} restants)
					</button>
				</div>
			{/if}
		{:else}
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
				{#each coupesByGroup as { groupe, top } (groupe.code)}
					<div class="card p-4" style="border-left: 4px solid {groupe.couleur}">
						<div class="flex items-center gap-2 mb-3">
							<span
								class="w-2.5 h-2.5 rounded-full"
								style="background-color: {groupe.couleur}"
							></span>
							<a
								href="/senat/groupes/{scopeSession}/{groupe.code}/"
								class="font-semibold hover:text-assembly-accent"
							>
								{groupe.libelleAbrege}
							</a>
							<span class="text-xs text-assembly-muted">— top {top.length}</span>
						</div>
						<div class="space-y-1.5">
							{#each top as { senateur, session }, i (senateur.id)}
								<a
									href="/senat/senateurs/{senateur.id}/?session={scopeSession}"
									class="flex items-center gap-3 p-2 rounded hover:bg-assembly-border/30 transition-colors"
								>
									<div
										class="w-6 text-center title-display text-sm tabular-nums text-assembly-muted"
									>
										#{i + 1}
									</div>
									<img
										src={senateur.identite.photoUrl}
										alt=""
										class="w-8 h-8 rounded-full object-cover bg-assembly-border flex-shrink-0"
										loading="lazy"
										referrerpolicy="no-referrer"
									/>
									<div class="min-w-0 flex-1">
										<div class="text-sm font-semibold truncate">
											{senateur.identite.prenom}
											{senateur.identite.nom}
										</div>
										<div class="text-[10px] text-assembly-muted">
											rang global #{currentMeta.rank(session)}
										</div>
									</div>
									<div class="title-display text-base tabular-nums {currentMeta.color}">
										{currentMeta.format(session)}
									</div>
								</a>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</section>
