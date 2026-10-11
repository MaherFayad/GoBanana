// GoBanana docs. Built with base /docs and copied into banana-server/public/docs by
// banana-server/scripts/build-docs.mjs, so the Worker serves them on the same domain.
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightLinksValidator from 'starlight-links-validator';

const tool = (name) => ({ label: name, slug: `reference/tools/${name.replaceAll('_', '-')}` });

export default defineConfig({
	site: 'https://gobanana-server.maherfayad55.workers.dev',
	base: '/docs',
	trailingSlash: 'always',
	vite: {
		build: {
			rollupOptions: {
				// MDX pages carry Astro's own head-inject directive; Vite flags it on every MDX page. Harmless.
				onwarn(warning, warn) {
					if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return;
					warn(warning);
				},
			},
		},
	},
	integrations: [
		starlight({
			title: 'GoBanana',
			description: 'Docs for GoBanana: wild design references and a moodboard canvas for your AI agent.',
			logo: { src: './src/assets/mark.svg', alt: '' },
			favicon: '/favicon.svg',
			defaultLocale: 'root',
			locales: {
				root: { label: 'English', lang: 'en' },
				ar: { label: 'العربية', lang: 'ar', dir: 'rtl' },
			},
			customCss: [
				'@fontsource/instrument-sans/400.css',
				'@fontsource/instrument-sans/500.css',
				'@fontsource/instrument-sans/600.css',
				'@fontsource/instrument-sans/700.css',
				'@fontsource/ibm-plex-sans-arabic/400.css',
				'@fontsource/ibm-plex-sans-arabic/500.css',
				'@fontsource/ibm-plex-sans-arabic/600.css',
				'@fontsource/ibm-plex-sans-arabic/700.css',
				'./src/styles/theme.css',
			],
			components: {
				ThemeProvider: './src/components/ThemeProvider.astro',
				ThemeSelect: './src/components/ThemeSelect.astro',
				SiteTitle: './src/components/SiteTitle.astro',
				SocialIcons: './src/components/SiteLink.astro',
			},
			expressiveCode: { themes: ['github-dark'] },
			plugins: [starlightLinksValidator({ errorOnRelativeLinks: true })],
			sidebar: [
				{
					label: 'Start',
					translations: { ar: 'البداية' },
					items: [
						{ slug: 'start/introduction' },
						{ slug: 'start/install' },
						{ slug: 'start/connect' },
						{ slug: 'start/first-board' },
					],
				},
				{
					label: 'Guides',
					translations: { ar: 'الأدلة' },
					items: [
						{ slug: 'guides/bend' },
						{ slug: 'guides/references' },
						{ slug: 'guides/palette' },
						{ slug: 'guides/export' },
						{ slug: 'guides/canvases' },
						{ slug: 'guides/sharing' },
						{ slug: 'guides/troubleshooting' },
					],
				},
				{
					label: 'Reference',
					translations: { ar: 'المرجع' },
					items: [
						{ slug: 'reference/plans' },
						{ slug: 'reference/shortcuts' },
						{
							label: 'MCP tools',
							translations: { ar: 'أدوات MCP' },
							items: [
								{ slug: 'reference/tools', label: 'Overview', translations: { ar: 'نظرة عامة' } },
								tool('ping'),
								tool('bend_brief'),
								tool('rate_directions'),
								tool('search_references'),
								tool('rate_references'),
								tool('new_canvas'),
								tool('open_canvas'),
								tool('add_to_canvas'),
								tool('arrange_canvas'),
								tool('get_canvas'),
								tool('extract_palette'),
								tool('export_kit'),
							],
						},
					],
				},
			],
		}),
	],
});
