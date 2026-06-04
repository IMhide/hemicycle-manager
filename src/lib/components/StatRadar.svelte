<script lang="ts">
	/**
	 * Lightweight radar chart for the FIFA-style stat panel.
	 * Each axis is a stat in [0,1]. Renders as an SVG polygon over a
	 * polar grid. No D3 dependency — basic trig is enough.
	 */
	interface Axis {
		label: string;
		value: number; // 0..1
		color?: string;
	}

	interface Props {
		axes: Axis[];
		size?: number;
		strokeColor?: string;
		fillColor?: string;
	}

	let {
		axes,
		size = 240,
		strokeColor = 'var(--accent)',
		fillColor = 'rgba(255, 230, 0, 0.22)'
	}: Props = $props();

	const cx = $derived(size / 2);
	const cy = $derived(size / 2);
	const radius = $derived(size * 0.28);
	const labelRadius = $derived(radius + size * 0.1);
	// Marge horizontale de la viewBox : place pour les labels latéraux longs.
	const padX = $derived(size * 0.22);

	function pointAt(axisIndex: number, ratio: number, r: number) {
		// Top axis is index 0 (angle = -π/2); axes laid out clockwise.
		const angle = -Math.PI / 2 + (2 * Math.PI * axisIndex) / axes.length;
		const x = cx + Math.cos(angle) * r * ratio;
		const y = cy + Math.sin(angle) * r * ratio;
		return { x, y, angle };
	}

	const polygonPoints = $derived(
		axes
			.map((a, i) => {
				const p = pointAt(i, Math.max(0, Math.min(1, a.value)), radius);
				return `${p.x},${p.y}`;
			})
			.join(' ')
	);

	const gridLevels = [0.25, 0.5, 0.75, 1];
</script>

<!-- viewBox élargie horizontalement (marge `pad`) pour que les labels latéraux
     longs (« Participation », « Volume ») ne soient pas clippés. -->
<svg viewBox="{-padX} 0 {size + padX * 2} {size}" style="width: 100%; height: auto; max-width: {size + padX * 2}px; display: block; margin: 0 auto;" role="img" aria-label="Radar des statistiques">
	<!-- Grid circles -->
	{#each gridLevels as level}
		<circle
			cx={cx}
			cy={cy}
			r={radius * level}
			fill="none"
			stroke="var(--border-soft)"
			opacity="0.4"
			stroke-width="0.5"
		/>
	{/each}

	<!-- Axis lines -->
	{#each axes as _, i}
		{@const p = pointAt(i, 1, radius)}
		<line x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="var(--border-soft)" opacity="0.5" stroke-width="0.5" />
	{/each}

	<!-- Polygon -->
	<polygon points={polygonPoints} fill={fillColor} stroke={strokeColor} stroke-width="2" />

	<!-- Vertices -->
	{#each axes as a, i}
		{@const p = pointAt(i, Math.max(0, Math.min(1, a.value)), radius)}
		<circle cx={p.x} cy={p.y} r="3" fill={a.color ?? strokeColor} />
	{/each}

	<!-- Labels and values -->
	{#each axes as a, i}
		{@const p = pointAt(i, 1, labelRadius)}
		{@const anchor = p.x < cx - 5 ? 'end' : p.x > cx + 5 ? 'start' : 'middle'}
		<text
			x={p.x}
			y={p.y}
			text-anchor={anchor}
			dominant-baseline="middle"
			fill="var(--fg-muted)"
			font-size="10"
			font-family='"Space Grotesk", system-ui'
			class="select-none"
		>
			<tspan font-weight="600" fill="var(--fg)">{a.label}</tspan>
			<tspan x={p.x} dy="12" fill={a.color ?? 'var(--accent)'} font-weight="700">
				{Math.round(a.value * 100)}%
			</tspan>
		</text>
	{/each}
</svg>
