/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				vote: {
					pour: '#22c55e',
					contre: '#ef4444',
					abstention: '#94a3b8',
					absent: '#475569'
				},
				assembly: {
					bg: '#0f172a',
					surface: '#1e293b',
					border: '#334155',
					text: '#f1f5f9',
					muted: '#94a3b8',
					accent: '#fbbf24'
				}
			},
			fontFamily: {
				display: ['"Bebas Neue"', 'system-ui', 'sans-serif'],
				body: ['Inter', 'system-ui', 'sans-serif']
			}
		}
	},
	plugins: []
};
