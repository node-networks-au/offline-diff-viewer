import path from 'path'
import MonacoWebpackPlugin from 'monaco-editor-webpack-plugin'

const BASE_URL = 'https://diffviewer.vercel.app'
const TITLE_DESCRIPTION =
  'A tool that helps you compare, differentiate, analyze, visualize text online'
const DESCRIPTION =
  'A privacy focused tool and/or utility that allows you to compare/analyze/contrast/differentiate/visualize/analyze pieces of texts'
export default {
  ssr: false,
  head: {
    title: 'NodeN Configuration Diff',
    script: [
      {
        src: 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4467877923505914',
        crossorigin: 'anonymous',
      },
    ],
    meta: [
      { charset: 'utf-8' },
      {
        name: 'keywords',
        content:
          'compare text, difference, diff view, diff viewer, diff checker, hamming distance, difference, data privacy, differentiate, differentiator, text differentiator',
      },
      { name: 'color-scheme', content: 'dark light' },
      {
        name: 'viewport',
        content: 'width=750px; initial-scale=1',
      },
      { name: 'format-detection', content: 'telephone=no' },
      { name: 'theme-color', content: '#2563EB' },
      { name: 'og:url', property: 'og:url', content: `${BASE_URL}` },
      {
        name: 'og:image',
        property: 'og:url',
        content: `${BASE_URL}/brand-430x495.png`,
      },
      { name: 'twitter:title', property: 'og:url', content: DESCRIPTION },
      { name: 'og:title', property: 'og:url', content: DESCRIPTION },
      { name: 'og:type', property: 'og:url', content: 'website' },
      { name: 'description', property: 'og:url', content: DESCRIPTION },
      { name: 'og:description', property: 'og:url', content: DESCRIPTION },
      { name: 'twitter:description', property: 'og:url', content: DESCRIPTION },
      { name: 'twitter:card', property: 'og:url', content: 'summary' },
      {
        name: 'twitter:creator',
        property: 'og:url',
        content: '@technikhil314',
      },
      {
        name: 'og:image',
        property: 'og:url',
        content: `${BASE_URL}/128x128.png`,
      },
      {
        name: 'og:image',
        property: 'og:url',
        content: `${BASE_URL}/brand-192x192.png`,
      },
      {
        name: 'og:image',
        property: 'og:url',
        content: `${BASE_URL}/brand-200x200.png`,
      },
      {
        name: 'og:image',
        property: 'og:url',
        content: `${BASE_URL}/brand-512x512.png`,
      },
      {
        name: 'og:image',
        property: 'og:url',
        content: `${BASE_URL}/brand-800x800.png`,
      },
      {
        name: 'image',
        property: 'og:url',
        content: `${BASE_URL}/brand-1200x600.png`,
      },
      { name: 'og:image:alt', property: 'og:url', content: DESCRIPTION },
      {
        name: 'twitter:image',
        property: 'og:url',
        content: `${BASE_URL}/128x128.png`,
      },
      {
        name: 'google-adsense-account',
        content: 'ca-pub-4467877923505914',
      },
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
