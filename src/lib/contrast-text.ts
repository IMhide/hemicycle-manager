/**
 * Choisit une couleur de texte lisible (noir ou blanc) sur un fond donné,
 * d'après la luminance relative WCAG. Utilisé pour les logos/pastilles dont
 * le fond est une couleur de groupe arbitraire (certaines sont claires, ex.
 * centristes jaune, d'autres sombres) : on ne peut pas hardcoder #fff.
 *
 * @param hex couleur de fond au format `#rrggbb` (ou `#rgb`).
 * @returns `'#0a0a0a'` (texte sombre) ou `'#ffffff'` (texte clair).
 */
export function readableTextOn(hex: string): string {
	const c = hex.replace('#', '');
	const full =
		c.length === 3
			? c
					.split('')
					.map((ch) => ch + ch)
					.join('')
			: c;
	if (full.length !== 6) return '#0a0a0a';
	const r = parseInt(full.slice(0, 2), 16) / 255;
	const g = parseInt(full.slice(2, 4), 16) / 255;
	const b = parseInt(full.slice(4, 6), 16) / 255;
	const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
	const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
	// Seuil ~0.4 : au-dessus le fond est clair → texte sombre, sinon texte clair.
	return luminance > 0.4 ? '#0a0a0a' : '#ffffff';
}
