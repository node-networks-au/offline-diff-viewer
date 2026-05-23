<template>
  <div class="page-contents">
    <Navbar />
    <!-- Hidden input — Vue reactivity hook that re-applies the
         Monaco theme when the dark-mode toggle flips. -->
    <input
      type="hidden"
      inert
      :value="onThemeChange"
      class="invisible none"
      aria-hidden="true"
    />
    <main class="noden-page" tabindex="0">
      <form class="noden-form" @submit="checkForm">
        <section class="noden-panes">
          <!-- LEFT PANE -->
          <article class="noden-pane">
            <div class="noden-pane-head">
              <input
                id="lhsLabel"
                v-model="lhsLabel"
                name="lhsLabel"
                type="text"
                class="noden-pane-label-input"
                placeholder="Label this side…"
                aria-label="Original text block label"
              />
              <!-- Scroll-icon button opens the language picker. The
                   <select> is the actual menu source so a11y stays
                   intact; the button just programmatically pops it. -->
              <button
                type="button"
                class="noden-pane-icon-btn"
                :aria-label="'Change syntax (current: ' + lhsLangLabel + ')'"
                :title="'Syntax: ' + lhsLangLabel"
                @click="openLangPicker('lhs')"
              >
                <Scan />
              </button>
              <select
                ref="lhsLangSelect"
                v-model="lhsLang"
                class="noden-lang-select-hidden"
                aria-hidden="true"
                tabindex="-1"
                @change="onLangChange('lhs')"
              >
                <option
                  v-for="opt in languageOptions"
                  :key="opt.id"
                  :value="opt.id"
                >{{ opt.label }}</option>
              </select>
              <button
                type="button"
                class="noden-pane-icon-btn"
                aria-label="Beautify entered text"
                title="Beautify"
                @click="lhsEditor && lhsEditor.trigger('editor', 'editor.action.formatDocument')"
              >
                <PrettyCode />
              </button>
            </div>
            <div id="lhs" name="lhs" class="noden-editor" />
          </article>

          <!-- RIGHT PANE -->
          <article class="noden-pane">
            <div class="noden-pane-head">
              <input
                id="rhsLabel"
                v-model="rhsLabel"
                name="rhsLabel"
                type="text"
                class="noden-pane-label-input"
                placeholder="Label this side…"
                aria-label="Changed text block label"
              />
              <button
                type="button"
                class="noden-pane-icon-btn"
                :aria-label="'Change syntax (current: ' + rhsLangLabel + ')'"
                :title="'Syntax: ' + rhsLangLabel"
                @click="openLangPicker('rhs')"
              >
                <Scan />
              </button>
              <select
                ref="rhsLangSelect"
                v-model="rhsLang"
                class="noden-lang-select-hidden"
                aria-hidden="true"
                tabindex="-1"
                @change="onLangChange('rhs')"
              >
                <option
                  v-for="opt in languageOptions"
                  :key="opt.id"
                  :value="opt.id"
                >{{ opt.label }}</option>
              </select>
              <button
                type="button"
                class="noden-pane-icon-btn"
                aria-label="Beautify entered text"
                title="Beautify"
                @click="rhsEditor && rhsEditor.trigger('editor', 'editor.action.formatDocument')"
              >
                <PrettyCode />
              </button>
            </div>
            <div id="rhs" name="rhs" class="noden-editor" />
          </article>
        </section>

        <div class="noden-actions">
          <button
            type="button"
            class="noden-btn noden-btn-ghost"
            aria-label="Clear both text blocks"
            @click="clear"
          >
            <Bin />
            <span>Clear</span>
          </button>
          <button
            id="submitButton"
            class="noden-btn noden-btn-primary"
            aria-label="Compare the two text blocks"
          >
            <span>Compare</span>
            <Forward />
          </button>
        </div>

      </form>
    </main>
    <Footer />
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import pako from 'pako'
import loader from '@monaco-editor/loader'
import {
  doUrlSafeBase64,
  undoUrlSafeBase64,
  getMonacoEditorDefaultOptions,
  detectLanguage,
} from '../helpers/utils'
import {
  registerCustomLanguages,
  LANGUAGE_OPTIONS,
} from '../helpers/customLanguages'
import showTutorials from '../helpers/driverjsTutorials'
import Navbar from '~/components/navbar.vue'
import Footer from '~/components/footer.vue'
import Bin from '~/components/icons/bin.vue'
import Forward from '~/components/icons/forward.vue'
import PrettyCode from '~/components/icons/prettyCode.vue'
import Scan from '~/components/icons/scan.vue'
import { DIFF_USER_BLANK_SIDE_ERROR } from '~/constants/messages'
export default Vue.extend({
  components: { Navbar, Footer, Bin, Forward, PrettyCode, Scan },
  layout: 'main',
  data() {
    /* Spread the in-memory store so navigating back from /diff
     * lands here with the editors pre-populated. The hash-fallback
     * below handles deep-link / refresh cases where the store is
     * empty but the URL still carries a #<gzip+b64> payload. */
    return {
      ...this.$store.state.data,
      lhsEditor: null,
      rhsEditor: null,
      /* Per-pane state:
       *   lhs/rhsLang   — selected Monaco language id. '__auto__'
       *                   means background detection drives the
       *                   model language; any concrete id pins it.
       *                   Auto-detect is the default and always
       *                   runs in the background unless the user
       *                   has manually pinned a language. */
      lhsLang: '__auto__',
      rhsLang: '__auto__',
      languageOptions: LANGUAGE_OPTIONS,
      /* Reference to the loaded monaco module, populated once
       * loader.init() resolves. */
      monaco: null as any,
    }
  },
  computed: {
    onThemeChange() {
      const theme = this.$store.state.theme.darkMode ? 'vs-dark' : 'light'
      this.lhsEditor?.updateOptions({ theme })
      this.rhsEditor?.updateOptions({ theme })
      return this.$store.state.theme.darkMode
    },
    lhsLangLabel(): string {
      return LANGUAGE_OPTIONS.find((o) => o.id === this.lhsLang)?.label || 'Auto-detect'
    },
    rhsLangLabel(): string {
      return LANGUAGE_OPTIONS.find((o) => o.id === this.rhsLang)?.label || 'Auto-detect'
    },
  },
  beforeMount() {
    /* Hash-based re-edit: if the URL carries a gzip+b64 payload
     * (typically arrived here from the diff page's edit button),
     * inflate it into the in-memory state so the editors mount
     * with the prior content + labels. */
    if (
      typeof window !== 'undefined' &&
      window.location.hash &&
      window.location.hash.length > 1 &&
      !this.lhs &&
      !this.rhs
    ) {
      try {
        const raw = window.location.hash.replace(/^#/, '')
        const gunzip = pako.ungzip(Buffer.from(undoUrlSafeBase64(raw), 'base64'))
        const parsed = JSON.parse(new TextDecoder().decode(gunzip))
        this.lhs = parsed.lhs || ''
        this.rhs = parsed.rhs || ''
        this.lhsLabel = parsed.lhsLabel || ''
        this.rhsLabel = parsed.rhsLabel || ''
        this.$store.commit('data/set', {
          lhs: this.lhs,
          rhs: this.rhs,
          lhsLabel: this.lhsLabel,
          rhsLabel: this.rhsLabel,
        })
      } catch (_e) {
        /* Malformed hash → ignore and show empty editors. */
      }
    }
  },
  mounted() {
    document.addEventListener('keydown', this.handleCtrlEnter)
    const lhs = document.getElementById('lhs')
    const rhs = document.getElementById('rhs')
    const theme = this.$cookies.isDarkMode ? 'vs-dark' : 'light'
    const monacoEditorOptions = getMonacoEditorDefaultOptions(theme)
    loader.init().then((monaco) => {
      registerCustomLanguages(monaco)
      this.monaco = monaco
      showTutorials(this.$cookies, this.$route.path, this.$cookies.isDarkMode)
      /* Background auto-detect — runs whenever the pane's
       * selected language is the auto sentinel. Manually picking
       * a concrete language from the dropdown stops this from
       * overwriting the user's choice. */
      const reDetect = (side: 'lhs' | 'rhs') => {
        const editor = side === 'lhs' ? this.lhsEditor : this.rhsEditor
        const choice = side === 'lhs' ? this.lhsLang : this.rhsLang
        if (!editor || choice !== '__auto__') return
        const value = editor.getValue() || ''
        const lang = detectLanguage(value)
        const model = editor.getModel()
        if (model && monaco.editor.setModelLanguage) {
          monaco.editor.setModelLanguage(model, lang)
        }
      }
      if (lhs) {
        this.lhsEditor = monaco.editor.create(lhs, {
          ...monacoEditorOptions,
          value: this.lhs || '',
          wordWrap: 'on',
          automaticLayout: true,
        })
        reDetect('lhs')
        this.lhsEditor.onDidPaste(() => reDetect('lhs'))
        let lhsTimer: any = null
        this.lhsEditor.onDidChangeModelContent(() => {
          clearTimeout(lhsTimer)
          lhsTimer = setTimeout(() => reDetect('lhs'), 300)
        })
      }
      if (rhs) {
        this.rhsEditor = monaco.editor.create(rhs, {
          ...monacoEditorOptions,
          value: this.rhs || '',
          wordWrap: 'on',
          automaticLayout: true,
        })
        reDetect('rhs')
        this.rhsEditor.onDidPaste(() => reDetect('rhs'))
        let rhsTimer: any = null
        this.rhsEditor.onDidChangeModelContent(() => {
          clearTimeout(rhsTimer)
          rhsTimer = setTimeout(() => reDetect('rhs'), 300)
        })
      }
    })
  },
  beforeDestroy() {
    document.removeEventListener('keydown', this.handleCtrlEnter)
  },
  methods: {
    handleCtrlEnter(event: KeyboardEvent) {
      const { metaKey, ctrlKey, key } = event
      if ((metaKey || ctrlKey) && key === 'Enter') {
        const button: HTMLButtonElement = document.getElementById(
          'submitButton'
        ) as HTMLButtonElement
        button?.click()
      }
    },
    checkForm(e: Event) {
      e.preventDefault()
      const formData = new FormData(e.currentTarget as HTMLFormElement)
      const originalLhs = this.lhsEditor?.getValue() ?? ''
      const originalRhs = this.rhsEditor?.getValue() ?? ''
      const lhsLabel = (formData.get('lhsLabel') as string) || this.lhsLabel || ''
      const rhsLabel = (formData.get('rhsLabel') as string) || this.rhsLabel || ''
      if (!originalLhs || !originalRhs) {
        this.showError()
        return
      }
      const lhs = originalLhs.trim()
      const rhs = originalRhs.trim()
      this.$store.commit('data/set', {
        lhs: originalLhs,
        rhs: originalRhs,
        lhsLabel,
        rhsLabel,
      })
      const gzip = Buffer.from(
        pako.gzip(
          JSON.stringify({
            lhs,
            rhs,
            lhsLabel,
            rhsLabel,
          })
        )
      ).toString('base64')
      this.$router.push({
        path: '/diff',
        hash: `#${doUrlSafeBase64(gzip)}`,
      })
    },
    showError() {
      this.$store.commit('toast/show', {
        show: true,
        content: DIFF_USER_BLANK_SIDE_ERROR,
        iconHTML: `
            <svg
              class="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              ></path>
            </svg>
          `,
        theme: 'error',
      })
    },
    clear() {
      this.lhsEditor?.getModel().setValue('')
      this.rhsEditor?.getModel().setValue('')
      this.lhsLabel = ''
      this.rhsLabel = ''
    },
    /* Picking from the (hidden) syntax dropdown — '__auto__'
     * resumes background detection and applies the detected
     * language now; concrete ids pin the model. */
    onLangChange(side: 'lhs' | 'rhs') {
      const choice = side === 'lhs' ? this.lhsLang : this.rhsLang
      const editor = side === 'lhs' ? this.lhsEditor : this.rhsEditor
      const monaco = (this as any).monaco
      if (!editor || !monaco) return
      const model = editor.getModel()
      if (!model) return
      if (choice === '__auto__') {
        monaco.editor.setModelLanguage(model, detectLanguage(editor.getValue() || ''))
      } else {
        monaco.editor.setModelLanguage(model, choice)
      }
    },
    /* Scroll-icon click pops the native <select>. Browsers that
     * support HTMLSelectElement.showPicker() (Chromium, Firefox
     * ≥104, Safari ≥17.4) get a programmatic open; older builds
     * fall back to .focus() + a synthetic mousedown which most
     * UAs treat as "open". */
    openLangPicker(side: 'lhs' | 'rhs') {
      const ref = side === 'lhs' ? 'lhsLangSelect' : 'rhsLangSelect'
      const sel = this.$refs[ref] as HTMLSelectElement | undefined
      if (!sel) return
      try {
        ;(sel as any).showPicker?.()
        if (!('showPicker' in sel)) sel.focus()
      } catch {
        sel.focus()
      }
    },
  },
})
</script>

<style scoped>
/* Fill-the-window cascade — the page root is flex-column with min
 * height = viewport; the form claims the remaining space; the
 * pane-grid is the only flex-grow child so the editors fill all
 * leftover vertical room (down to a 320px floor on tiny viewports).
 * min-height: 0 at every step is the magic that lets flex children
 * actually shrink/grow within their parent. */
.noden-page {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  gap: 1rem;
  margin-top: 1rem;
  padding: 0 0.5rem;
  outline: none;
}
.noden-form {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  gap: 1rem;
  width: 100%;
}
.noden-panes {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  width: 100%;
  /* `0` basis so the grid shrinks under tight viewports rather
   * than pushing the page past 100vh. Cap with max-height so the
   * editors never escape the viewport, regardless of how much
   * chrome is above or below them. */
  flex: 1 1 0;
  min-height: 240px;
  max-height: calc(100vh - 12rem);
}
@media (max-width: 768px) {
  .noden-panes { grid-template-columns: 1fr; }
}

/* Each pane is a portal-aligned card: white surface, soft shadow,
 * 12px radius. Header above the editor holds the editable label +
 * a discreet beautify icon button. */
.noden-pane {
  display: flex;
  flex-direction: column;
  background: var(--noden-bg-primary, #ffffff);
  border: 1px solid var(--noden-border-light, #e5e7eb);
  border-radius: 12px;
  box-shadow: var(--noden-card-shadow, 0 2px 8px rgba(45,42,46,0.08));
  overflow: hidden;
  transition: border-color 0.15s, box-shadow 0.2s;
}
.noden-pane:focus-within {
  border-color: var(--noden-accent, #4a9eff);
  box-shadow: 0 0 0 3px rgba(74, 158, 255, 0.15),
    var(--noden-card-shadow, 0 2px 8px rgba(45,42,46,0.08));
}
.dark .noden-pane {
  background: #1f2937;
  border-color: #374151;
}

.noden-pane-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 8px 12px;
  border-bottom: 1px solid var(--noden-border-light, #e5e7eb);
  background: var(--noden-bg-secondary, #f7f5f7);
}
.dark .noden-pane-head {
  background: #111827;
  border-bottom-color: #374151;
}

.noden-pane-label-input {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--noden-brand, #133353);
  outline: none;
  transition: background 0.15s, border-color 0.15s;
}
.noden-pane-label-input::placeholder {
  color: var(--noden-text-secondary, #64748b);
  font-weight: 400;
}
.noden-pane-label-input:hover {
  border-color: var(--noden-border-light, #e5e7eb);
}
.noden-pane-label-input:focus {
  background: var(--noden-bg-primary, #ffffff);
  border-color: var(--noden-accent, #4a9eff);
  box-shadow: 0 0 0 3px rgba(74, 158, 255, 0.15);
}
.dark .noden-pane-label-input { color: #ffffff; }
.dark .noden-pane-label-input:hover { border-color: #4b5563; }
.dark .noden-pane-label-input:focus {
  background: #0f172a;
  border-color: #60a5fa;
}

.noden-pane-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  width: 30px;
  height: 30px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--noden-text-secondary, #64748b);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.noden-pane-icon-btn:hover {
  background: var(--noden-primary-light, #dbeafe);
  border-color: var(--noden-primary, #2563eb);
  color: var(--noden-primary, #2563eb);
}
.noden-pane-icon-btn :deep(svg) {
  width: 16px;
  height: 16px;
}

/* Hidden language <select>. We keep it in the DOM (a11y, native
 * keyboard handling, and HTMLSelectElement.showPicker() needs a
 * real element) but visually collapse it to zero footprint; the
 * scroll-icon button next to it is the user-facing affordance.
 * Note: `display: none` would defeat showPicker(), so we use a
 * clip + sr-only-style trick instead. */
.noden-lang-select-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
  opacity: 0;
  pointer-events: none;
}

/* Syntax / language selector next to the beautify button. Native
 * <select> styled to match the .noden-pane-icon-btn / label-input
 * surface — minimal chrome, portal-blue focus ring, monospaced font
 * inherits from form-control so editor + selector visually agree. */
/* (legacy .noden-lang-select styles removed — the dropdown is now
 * visually hidden and triggered by the scroll-icon button.) */

.noden-editor {
  flex: 1 1 auto;
  min-height: 0; /* allow shrink within flex parent */
  background: var(--noden-bg-primary, #ffffff);
}
.dark .noden-editor { background: #0f172a; }

.noden-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.noden-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 20px;
  font-size: 0.9rem;
  font-weight: 500;
  border-radius: 8px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s,
    box-shadow 0.2s, transform 0.1s;
  outline: none;
}
.noden-btn :deep(svg) {
  width: 16px;
  height: 16px;
}
.noden-btn:focus-visible {
  box-shadow: 0 0 0 3px rgba(74, 158, 255, 0.3);
}
.noden-btn:active {
  transform: scale(0.97);
}
.noden-btn-primary {
  background: var(--noden-primary, #2563eb);
  color: #ffffff;
}
.noden-btn-primary:hover {
  background: var(--noden-primary-hover, #1d4ed8);
}
.noden-btn-ghost {
  background: transparent;
  color: var(--noden-text-secondary, #64748b);
  border-color: var(--noden-border-light, #e5e7eb);
}
.noden-btn-ghost:hover {
  background: var(--noden-bg-secondary, #f7f5f7);
  color: var(--noden-text-primary, #1e3a5f);
  border-color: var(--noden-border-medium, #d1d5db);
}
.dark .noden-btn-ghost {
  color: #9ca3af;
  border-color: #374151;
}
.dark .noden-btn-ghost:hover {
  background: #1f2937;
  color: #e5e7eb;
  border-color: #4b5563;
}

</style>
