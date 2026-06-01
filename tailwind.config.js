/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	darkMode: ['class', '[data-theme="dark"]'],
	theme: {
		extend: {
			colors: {
				// ── Tokens sémantiques (cf design-system/MASTER.md §2) ──
				// Lus depuis les variables CSS définies dans app.css (Light + Dark).
				bg: 'var(--bg)',
				surface: 'var(--surface)',
				'surface-2': 'var(--surface-2)',
				fg: 'var(--fg)',
				'fg-muted': 'var(--fg-muted)',
				'border-soft': 'var(--border-soft)',
				accent: 'var(--accent)',
				'accent-fg': 'var(--accent-fg)',
				link: 'var(--link)',

				// Vote (aplats brutalistes — toujours doublés d'un libellé/icône)
				vote: {
					pour: 'var(--vote-pour)',
					contre: 'var(--vote-contre)',
					abstention: 'var(--vote-abstention)',
					absent: 'var(--vote-absent)'
				},

				// Tiers de rareté carte personne
				tier: {
					bronze: '#CD7F32',
					argent: '#C0C0C0',
					or: '#FFC400',
					legende: 'var(--accent)'
				}

				// NB : ancien namespace `assembly.*` supprimé. Migration progressive des
				// composants encore référencés vers les tokens ci-dessus.
			},
			borderColor: {
				DEFAULT: 'var(--border)',
				brut: 'var(--border)'
			},
			borderWidth: {
				brut: '3px',
				'brut-2': '2px'
			},
			borderRadius: {
				// Brutalisme : radius 0 par défaut (sauf pills)
				none: '0'
			},
			boxShadow: {
				// Ombres dures décalées — SANS flou (signature brutaliste)
				brut: '4px 4px 0 0 var(--shadow-color)',
				'brut-lg': '6px 6px 0 0 var(--shadow-color)',
				'brut-sm': '2px 2px 0 0 var(--shadow-color)'
			},
			fontFamily: {
				display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
				body: ['"Space Grotesk"', 'system-ui', 'sans-serif']
			},
			transitionDuration: {
				brut: '120ms'
			}
		}
	},
	plugins: []
};
