<script lang="ts">
	/**
	 * Recherche scopée à un scrutin : tape un nom (ou un libellé de groupe) et
	 * vois la position du votant + un lien vers sa fiche élu. Composant
	 * générique partagé AN/Sénat (cf ADR 0030 — hub `/elus/`).
	 *
	 * Le caller fournit la liste plate des votants déjà résolus
	 * (nom, prénom, groupe au moment du vote, position, href).
	 */
	import { normalize } from '$lib/search-index';
	import type { VoteEntry, VoteSearchPosition } from './VoteSearchBox.types';

	let { entries, label = 'votant' }: { entries: VoteEntry[]; label?: string } = $props();

	let query = $state('');
	const MAX_RESULTS = 30;

	const positionDisplay: Record<VoteSearchPosition, { emoji: string; label: string; cls: string }> = {
		pour: { emoji: '✅', label: 'Pour', cls: 'text-vote-pour' },
		contre: { emoji: '❌', label: 'Contre', cls: 'text-vote-contre' },
		abstention: { emoji: '⚪', label: 'Abstention', cls: 'text-vote-abstention' },
		nonVotant: { emoji: '➖', label: 'Non-votant', cls: 'text-fg-muted' },
		absent: { emoji: '·', label: 'Absent', cls: 'text-fg-muted' }
	};

	const filtered = $derived.by(() => {
		const q = normalize(query.trim());
		if (q.length < 2) return [] as VoteEntry[];
		const out: VoteEntry[] = [];
		for (const e of entries) {
			const hayName = normalize(`${e.prenom} ${e.nom}`);
			const hayGroupe = normalize(e.groupeLibelle);
			if (hayName.includes(q) || hayGroupe.includes(q)) {
				out.push(e);
				if (out.length >= MAX_RESULTS + 1) break;
			}
		}
		return out;
	});

	const totalMatches = $derived.by(() => {
		const q = normalize(query.trim());
		if (q.length < 2) return 0;
		let n = 0;
		for (const e of entries) {
			const hayName = normalize(`${e.prenom} ${e.nom}`);
			const hayGroupe = normalize(e.groupeLibelle);
			if (hayName.includes(q) || hayGroupe.includes(q)) n++;
		}
		return n;
	});

	const hasQuery = $derived(query.trim().length >= 2);
</script>

<div class="card p-4 sm:p-6">
	<label class="block">
		<div class="flex items-baseline gap-2 mb-2">
			<span class="title-display text-sm">Trouver un {label}</span>
			<span class="text-xs text-fg-muted">
				Tape un nom ou un groupe pour voir son vote
			</span>
		</div>
		<input
			type="search"
			bind:value={query}
			placeholder="ex. Tondelier, LFI, Larcher…"
			class="w-full px-3 py-2 bg-bg border border-border-soft focus:border-accent text-sm"
		/>
	</label>

	{#if hasQuery}
		{#if filtered.length === 0}
			<div class="mt-3 text-sm text-fg-muted italic">
				Aucun {label} ne correspond à « {query} ».
			</div>
		{:else}
			<div class="mt-3 text-xs text-fg-muted">
				{totalMatches} résultat{totalMatches > 1 ? 's' : ''}
				{#if totalMatches > MAX_RESULTS}— affichage des {MAX_RESULTS} premiers, affine ta recherche pour voir le reste{/if}
			</div>
			<ul class="mt-2 max-h-80 overflow-y-auto divide-y divide-border-soft">
				{#each filtered.slice(0, MAX_RESULTS) as e (e.id)}
					{@const disp = positionDisplay[e.position]}
					<li>
						{#if e.href}
							<a
								href={e.href}
								class="flex items-center gap-3 py-2 px-1 hover:bg-border-soft/40 rounded text-sm"
							>
								<span class="flex-1 min-w-0 truncate">
									<span class="font-medium">{e.prenom} {e.nom}</span>
									{#if e.groupeLibelle}
										<span class="text-fg-muted">
											· <span class="inline-flex items-center gap-1">
												{#if e.groupeCouleur}
													<span
														class="inline-block w-2 h-2 rounded-full"
														style="background-color: {e.groupeCouleur}"
													></span>
												{/if}
												{e.groupeLibelle}
											</span>
										</span>
									{/if}
								</span>
								<span class="whitespace-nowrap {disp.cls}">
									{disp.emoji} {disp.label}
								</span>
							</a>
						{:else}
							<div class="flex items-center gap-3 py-2 px-1 text-sm">
								<span class="flex-1 min-w-0 truncate">
									<span class="font-medium">{e.prenom} {e.nom}</span>
									{#if e.groupeLibelle}
										<span class="text-fg-muted">
											· <span class="inline-flex items-center gap-1">
												{#if e.groupeCouleur}
													<span
														class="inline-block w-2 h-2 rounded-full"
														style="background-color: {e.groupeCouleur}"
													></span>
												{/if}
												{e.groupeLibelle}
											</span>
										</span>
									{/if}
								</span>
								<span class="whitespace-nowrap {disp.cls}">
									{disp.emoji} {disp.label}
								</span>
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
</div>
