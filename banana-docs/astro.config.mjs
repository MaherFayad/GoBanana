// GoBanana docs. Built with base /docs and copied into banana-server/public/docs by
// banana-server/scripts/build-docs.mjs, so the Worker serves them on the same domain.
//
// Look: the GoBanana desktop (docs/site-redesign-spec.md, docs/design-language.md). Dark only,
// banana yellow accent, Instrument Sans, glass panels. Colors are copied from
// banana-server/styles/studio-tokens.css into src/styles/theme.css, never imported.
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightLinksValidator from 'starlight-links-validator';

const tool = (name) => ({ label: name, slug: `reference/tools/${name.replaceAll('_', '-')}` });

export default defineConfig({
	site: 'https://gobanana-server.maherfayad55.workers.dev',
	base: '/docs',
	trailingSlash: 'always',
	// Old page addresses that the site and earlier links used.
	redirects: {
		'/start/install/': '/docs/setup/overview/',
		'/ar/start/install/': '/docs/ar/setup/overview/',
	},
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
			description:
				'Docs for GoBanana: one wild idea for a page or two. Bend a page into directions, fill a moodboard with linked references, Frankenstein new pages and hand them to your coding agent.',
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
				Hero: './src/components/Hero.astro',
				PageTitle: './src/components/PageTitle.astro',
			},
			expressiveCode: {
				themes: ['github-dark'],
				useStarlightUiThemeColors: false,
				defaultProps: { wrap: true },
				styleOverrides: {
					borderRadius: '0.875rem',
					borderColor: '#ffffff1f',
					codeBackground: '#0d0d0d',
					codeFontSize: '0.8125rem',
					codeLineHeight: '1.65',
					uiFontFamily: "'Instrument Sans', 'IBM Plex Sans Arabic', system-ui, sans-serif",
					frames: {
						editorBackground: '#0d0d0d',
						terminalBackground: '#0d0d0d',
						editorTabBarBackground: '#161616',
						terminalTitlebarBackground: '#161616',
						editorActiveTabBackground: '#0d0d0d',
						editorActiveTabIndicatorTopColor: '#ffd84d',
						editorActiveTabIndicatorBottomColor: 'transparent',
						terminalTitlebarBorderBottomColor: '#ffffff14',
						editorTabBarBorderBottomColor: '#ffffff14',
						terminalTitlebarDotsForeground: '#e8e8e8',
						terminalTitlebarDotsOpacity: '0.55',
						frameBoxShadowCssValue: '0 24px 60px -24px #000000e6',
						inlineButtonBackground: '#ffffff',
						inlineButtonForeground: '#f4f4f5',
						inlineButtonBorder: '#ffffff33',
						tooltipSuccessBackground: '#ffd84d',
						tooltipSuccessForeground: '#111827',
					},
				},
			},
			plugins: [
				starlightLinksValidator({
					errorOnRelativeLinks: true,
					errorOnInvalidHashes: true,
				}),
			],
			sidebar: [
				{
					label: 'Get started',
					translations: { ar: 'البداية' },
					items: [
						{ slug: 'start/what-is-gobanana' },
						{ slug: 'start/how-it-works' },
						{ slug: 'start/first-board' },
						{ slug: 'start/plans' },
					],
				},
				{
					label: 'Set up',
					translations: { ar: 'الإعداد' },
					items: [
						{ slug: 'setup/overview' },
						{ slug: 'setup/claude-code' },
						{ slug: 'setup/claude-apps' },
						{ slug: 'setup/chatgpt' },
						{ slug: 'setup/cursor' },
						{ slug: 'setup/vs-code' },
						{ slug: 'setup/windsurf' },
						{ slug: 'setup/codex' },
						{ slug: 'setup/other-clients' },
						{ slug: 'setup/check' },
						{ slug: 'setup/troubleshooting' },
					],
				},
				{
					label: 'Guides',
					translations: { ar: 'الأدلة' },
					items: [
						{ slug: 'guides/go-wild' },
						{ slug: 'guides/where-weirdness-pays' },
						{ slug: 'guides/reading-a-board' },
						{ slug: 'guides/frankenstein' },
						{ slug: 'guides/palette' },
						{ slug: 'guides/handoff' },
						{ slug: 'guides/critique' },
						{ slug: 'guides/canvases' },
						{ slug: 'guides/mobbin' },
						{ slug: 'guides/taste-profile' },
					],
				},
				{
					label: 'Reference',
					translations: { ar: 'المرجع' },
					items: [
						{ slug: 'reference/skills' },
						{ slug: 'reference/exports' },
						{ slug: 'reference/sources' },
						{ slug: 'reference/platforms' },
						{ slug: 'reference/wildness' },
						{ slug: 'reference/plans' },
						{ slug: 'reference/shortcuts' },
						{
							label: 'MCP tools',
							translations: { ar: 'أدوات MCP' },
							collapsed: false,
							items: [
								{ slug: 'reference/tools', label: 'All tools', translations: { ar: 'كل الأدوات' } },
								tool('ping'),
								tool('bend_brief'),
								tool('search_references'),
								tool('rate_references'),
								tool('rate_directions'),
								tool('new_canvas'),
								tool('open_canvas'),
								tool('get_canvas'),
								tool('get_snapshot'),
								tool('add_to_canvas'),
								tool('arrange_canvas'),
								tool('delete_canvas'),
								tool('cut_parts'),
								tool('frankenstein_page'),
								tool('remix_frankenstein'),
								tool('update_frankenstein'),
								tool('extract_palette'),
								tool('export_kit'),
							],
						},
					],
				},
				{
					label: 'Help',
					translations: { ar: 'المساعدة' },
					items: [{ slug: 'faq' }, { slug: 'privacy-and-sources' }],
				},
			],
		}),
	],
});
