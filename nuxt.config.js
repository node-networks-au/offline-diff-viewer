import path from 'path'
import MonacoWebpackPlugin from 'monaco-editor-webpack-plugin'

const BASE_URL = 'https://diff.noden.com.au'
// Open Graph + Twitter Card metadata. The upstream applied
// `property: 'og:url'` to every meta tag, which made Slack / Teams /
// iMessage only ever see the last og:url and never the real
// og:title / og:description. Rewritten with the correct property=
// attributes (the actual key social-card crawlers read by).
const TITLE = 'NodeN Configuration Diff'
const DESCRIPTION =
  'Compare configurations and text side-by-side. Shareable, ' +
  'end-to-end-encrypted links — your data is never stored server-side.'
const OG_IMAGE = `${BASE_URL}/favicon-512x512.png`
export default {
  ssr: false,
  head: {
    title: TITLE,
    /* Upstream's Google AdSense script removed — we don't run ads. */
    script: [],
    meta: [
      { charset: 'utf-8' },
      {
        hid: 'keywords',
        name: 'keywords',
        content:
          'configuration diff, text diff, side by side diff, encrypted diff link, noden, configuration management, network configuration',
      },
      { name: 'color-scheme', content: 'dark light' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'format-detection', content: 'telephone=no' },
      { name: 'theme-color', content: '#133353' },

      /* Plain meta description (Google search snippet). */
      { hid: 'description', name: 'description', content: DESCRIPTION },

      /* Open Graph (Slack, Teams, iMessage, Discord, LinkedIn, Facebook). */
      { hid: 'og:site_name', property: 'og:site_name', content: 'NodeN' },
      { hid: 'og:type', property: 'og:type', content: 'website' },
      { hid: 'og:url', property: 'og:url', content: BASE_URL },
      { hid: 'og:title', property: 'og:title', content: TITLE },
      { hid: 'og:description', property: 'og:description', content: DESCRIPTION },
      { hid: 'og:image', property: 'og:image', content: OG_IMAGE },
      { hid: 'og:image:width', property: 'og:image:width', content: '512' },
      { hid: 'og:image:height', property: 'og:image:height', content: '512' },
      { hid: 'og:image:alt', property: 'og:image:alt', content: 'NodeN' },

      /* Twitter / X cards. summary_large_image would prefer a 1200×630
       * banner; we don't have a branded banner yet, so `summary` keeps
       * the 512×512 logo as a small square thumbnail. */
      { hid: 'twitter:card', name: 'twitter:card', content: 'summary' },
      { hid: 'twitter:title', name: 'twitter:title', content: TITLE },
      { hid: 'twitter:description', name: 'twitter:description', content: DESCRIPTION },
      { hid: 'twitter:image', name: 'twitter:image', content: OG_IMAGE },
      { hid: 'twitter:image:alt', name: 'twitter:image:alt', content: 'NodeN' },
    ],
    link: [
      { rel: 'manifest', href: '/manifest.json' },
      {
        rel: 'sitemap',
        type: 'application/xml',
        title: 'Sitemap',
        href: '/sitemap.xml',
      },
      /* No Google Fonts — we use the system font stack to match the
       * portal-ui look (matches whatever the user's OS is rendering
       * for native chrome). Saves a network round-trip on first paint. */
      /* NodeN-branded favicons. The light/dark dual-favicon dance the
       * upstream did is collapsed to a single set — the noden logo
       * works on both backgrounds (navy fill on light bg; the navbar
       * inverts to white via CSS filter on dark bg). */
      { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
      { rel: 'shortcut icon', type: 'image/x-icon', href: '/favicon.ico' },
      { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' },
      { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
      { rel: 'icon', type: 'image/png', sizes: '512x512', href: '/favicon-512x512.png' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
    ],
  },

  // Global CSS: https://go.nuxtjs.dev/config-css
  css: ['~/styles/global.scss'],

  // Plugins to run before rendering page: https://go.nuxtjs.dev/config-plugins
  plugins: ['~/plugins/cookie-injector.client.ts'],

  // Auto import components: https://go.nuxtjs.dev/config-components
  components: true,

  // Modules for dev and build (recommended): https://go.nuxtjs.dev/config-modules
  buildModules: [
    // https://go.nuxtjs.dev/typescript
    '@nuxt/typescript-build',
    // https://go.nuxtjs.dev/stylelint
    '@nuxtjs/stylelint-module',
    // https://go.nuxtjs.dev/tailwindcss
    '@nuxtjs/tailwindcss',
  ],

  // Modules: https://go.nuxtjs.dev/config-modules
  modules: [
    // https://go.nuxtjs.dev/pwa
    '@nuxtjs/pwa',
    '@nuxtjs/sitemap',
  ],

  // PWA module configuration: https://go.nuxtjs.dev/pwa
  pwa: {
    manifest: {
      lang: 'en',
    },
  },

  // sitemap autogeneration https://github.com/nuxt-community/sitemap-module
  sitemap: {
    hostname: BASE_URL,
  },

  // Build Configuration: https://go.nuxtjs.dev/config-build
  build: {
    extractCSS: true,
    productionSourceMap: false,
    extend(config, { isClient }) {
      if (isClient && process.env.NODE_ENV === 'development') {
        config.resolve.alias.vscode = path.resolve(
          './node_modules/monaco-languageclient/lib/vscode-compatibility'
        )
        config.plugins.push(
          new MonacoWebpackPlugin({
            languages: ['javascript'],
            features: ['coreCommands', 'find'],
          })
        )
        config.devtool = 'source-map'
      }
    },
  },
}
