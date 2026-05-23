<template>
  <div class="contents">
    <div class="page-contents">
      <!-- Following hidden input is hacky way to update monaco editor theme when user changes theme manually -->
      <input
        type="hidden"
        class="invisible none"
        aria-hidden="true"
        inert
        :value="onThemeChange"
      />
      <Navbar />
      <main class="outline-none" tabindex="0">
        <DiffActionBar
          ref="actionBar"
          :diff-navigator="diffNavigator"
        />
        <section class="noden-diff-section">
          <!-- Editable per-pane labels. Both panes have an inline
               edit-icon overlay that surfaces on hover (top-right
               of each pane), so users can hop back to the editor
               without leaving the diff context. -->
          <div class="noden-diff-labels">
            <input
              v-model="lhsLabel"
              type="text"
              class="noden-pane-label"
              placeholder="Label this side..."
              aria-label="Left pane label"
            />
            <input
              v-model="rhsLabel"
              type="text"
              class="noden-pane-label"
              placeholder="Label this side..."
              aria-label="Right pane label"
            />
          </div>

          <!-- Diff viewer + hover-only edit pills positioned over each
               pane's top-right. The pills are full-opacity within the
               container on hover; subtle reveal so they don't compete
               with the diff content itself. -->
          <div
            v-show="!e2eDataStatusText"
            class="noden-diff-shell"
          >
            <div id="monaco-diff-viewer" class="noden-diff-viewer" />
            <NuxtLink
              :to="editLink"
              class="noden-pane-edit noden-pane-edit-left"
              title="Edit this diff"
              aria-label="Edit left pane"
            >
              <Pencil />
              <span>Edit</span>
            </NuxtLink>
            <NuxtLink
              :to="editLink"
              class="noden-pane-edit noden-pane-edit-right"
              title="Edit this diff"
              aria-label="Edit right pane"
            >
              <Pencil />
              <span>Edit</span>
            </NuxtLink>
          </div>

          <div
            v-if="e2eDataStatusText"
            role="alert"
            aria-busy="true"
            aria-live="polite"
            class="noden-diff-status"
          >
            <p>{{ e2eDataStatusText }}</p>
          </div>
        </section>
      </main>
    </div>
    <Footer />
  </div>
</template>

<script lang="ts">
import loader from '@monaco-editor/loader'
import pako from 'pako'
import Vue from 'vue'
import {
  getMonacoEditorDefaultOptions,
  undoUrlSafeBase64,
  doUrlSafeBase64,
  detectLanguage,
} from '../helpers/utils'
import { registerCustomLanguages } from '../helpers/customLanguages'
import DiffActionBar from '~/components/diffActionBar.vue'
import Footer from '~/components/footer.vue'
import Navbar from '~/components/navbar.vue'
import Pencil from '~/components/icons/pencil.vue'
import { getDecryptedText, getDepryctionKey } from '~/helpers/decrypt'
import { v2DiffData } from '~/helpers/types'
import {
  E2E_DATA_DECRYPTING_INFO,
  E2E_DATA_DECRYPTION_ERROR,
  E2E_DATA_FETCH_ERROR,
  E2E_DATA_FINALIZING_INFO,
  E2E_DATA_LOADING_INFO,
  E2E_DATA_NO_LONGER_AVAILABLE_ERROR,
} from '~/constants/messages'
import showTutorials from '~/helpers/driverjsTutorials'
export default Vue.extend({
  components: { DiffActionBar, Navbar, Footer, Pencil },
  layout: 'main',
  data(): v2DiffData {
    return {
      lhs: '',
      rhs: '',
      rhsLabel: '',
      lhsLabel: '',
      monacoDiffEditor: {},
      diffNavigator: {},
      isSideBySideDiff: true, // retained for typing compatibility; locked true
      e2eDataStatusText: '',
    }
  },
  head() {
    return {
      title: 'NodeN Configuration Diff',
    }
  },
  computed: {
    onThemeChange() {
      const theme = this.$store.state.theme.darkMode ? 'vs-dark' : 'light'
      this.monacoDiffEditor?.updateOptions?.({ theme })
      return this.$store.state.theme.darkMode
    },
    /* Per-panel edit pills point back to the editor home carrying
     * the current diff hash, so the editors mount pre-populated for
     * re-edit. SSR-safe (no window access during static generation). */
    editLink(): any {
      if (typeof window === 'undefined') return { path: '/' }
      return { path: '/', hash: window.location.hash || undefined }
    },
  },
  watch: {
    /* When the user renames either pane label, regenerate the URL
     * hash (which encodes lhs/rhs/lhsLabel/rhsLabel) and replace it
     * in the address bar via history.replaceState (no navigation).
     * The next copy-link / share-link picks up the new labels.
     * Cached E2E short-link is cleared so it gets re-issued against
     * the new payload. */
    lhsLabel() {
      this.syncLabelsToUrl()
    },
    rhsLabel() {
      this.syncLabelsToUrl()
    },
  },
  beforeMount() {
    if (!window.location.search.includes('id=')) {
      const _diff = this.$route.hash
      if (_diff) {
        this.unzipCommitData(_diff)
      }
    }
  },
  mounted() {
    if (window.location.search.includes('id=')) {
      this.getE2EData().then((data: string | null) => {
        if (!data) {
          return
        }
        this.unzipCommitData(data)
        this.e2eDataStatusText = ''
        this.renderDiff()
      })
    } else {
      this.renderDiff()
    }
  },
  methods: {
    // toggleDiffFashion removed — the unified-view toggle is gone
    // from the action bar; the side-by-side render is canonical.
    // swapDiffContent removed earlier (users found it confusing on
    // read-only diffs).

    /* Re-encode the current lhs/rhs/lhsLabel/rhsLabel payload into
     * the URL hash. Mirrors the gzip+base64 encoding the entry page
     * does on Compare; uses replaceState so we don't push a new
     * history entry every keystroke. Skips when the page is being
     * driven by a server-stored short link (the ?id= query path) —
     * in that case the cached e2eLink would be stale and we let it
     * regenerate next copy. */
    syncLabelsToUrl() {
      try {
        const lhs = String(this.lhs || '').trim()
        const rhs = String(this.rhs || '').trim()
        const payload = JSON.stringify({
          lhs,
          rhs,
          lhsLabel: this.lhsLabel,
          rhsLabel: this.rhsLabel,
        })
        const gzip = Buffer.from(pako.gzip(payload)).toString('base64')
        const hash = `#${doUrlSafeBase64(gzip)}`
        const url = window.location.search.includes('id=')
          ? window.location.pathname + window.location.search + hash
          : window.location.pathname + hash
        window.history.replaceState(null, '', url)
        // Reset the action-bar's cached E2E link so the next copy
        // generates a new server-side payload that reflects the
        // updated labels.
        const ab: any = this.$refs.actionBar
        if (ab && 'e2eLink' in ab) ab.e2eLink = null
      } catch (_e) {
        /* If anything in the encode path fails, leave the URL alone;
         * the user can still click Compare again to regenerate. */
      }
    },
    async getE2EData() {
      this.e2eDataStatusText = E2E_DATA_LOADING_INFO
      const url = new URL(window.location.href)
      const id = url.searchParams.get('id')
      const key = url.hash.replace(/^#/, '')
      let response = null
      let data = null
      try {
        response = await fetch(`/api/getLink?id=${id}`)
        data = await response.json()
      } catch (error) {
        console.error(error)
        this.e2eDataStatusText = E2E_DATA_FETCH_ERROR
        return null
      }
      try {
        if (data.length === 0) {
          this.e2eDataStatusText = E2E_DATA_NO_LONGER_AVAILABLE_ERROR
          return null
        }
        this.e2eDataStatusText = E2E_DATA_DECRYPTING_INFO
        await new Promise((resolve) => setTimeout(resolve, 500))
        const { data: encryptedData } = data[0]
        const decryptionKey = await getDepryctionKey(key)
        const decryptedData = await getDecryptedText(
          encryptedData,
          decryptionKey
        )
        this.e2eDataStatusText = E2E_DATA_FINALIZING_INFO
        await new Promise((resolve) => setTimeout(resolve, 500))
        return decryptedData
      } catch (error) {
        console.error(error)
        this.e2eDataStatusText = E2E_DATA_DECRYPTION_ERROR
        return null
      }
    },
    renderDiff() {
      const monacoDiffViewerEl = document.getElementById('monaco-diff-viewer')
      const theme = this.$cookies.isDarkMode ? 'vs-dark' : 'light'
      const monacoEditorOptions = getMonacoEditorDefaultOptions(theme)
      loader.init().then((monaco) => {
        registerCustomLanguages(monaco)
        if (monacoDiffViewerEl) {
          this.monacoDiffEditor = monaco.editor.createDiffEditor(
            monacoDiffViewerEl,
            {
              ...monacoEditorOptions,
              readOnly: true,
              wordWrap: 'on',
              diffAlgorithm: 'advanced',
              renderSideBySide: true, // unified view removed; SxS only
              /* Monaco needs a definite container height to lay out
               * its inner editors. With the flex-cascade making the
               * shell sized late, layout-on-create can latch onto a
               * zero-height container and render nothing visible.
               * automaticLayout polls every ~100ms and calls layout()
               * when the container resizes, which is exactly the
               * flex-grow behaviour we have on the shell. */
              automaticLayout: true,
              // Modernize the right-edge overview ruler (heat-map of
              // changes). Without a border it merges into the editor
              // chrome; 8-px slim scrollbar matches the portal-aligned
              // visual weight.
              overviewRulerBorder: false,
              overviewRulerLanes: 2,
              scrollbar: {
                useShadows: false,
                verticalScrollbarSize: 8,
                horizontalScrollbarSize: 8,
                verticalSliderSize: 8,
                horizontalSliderSize: 8,
              },
              renderLineHighlight: 'none',
              renderOverviewRuler: true,
            }
          ) as any
          if (this.monacoDiffEditor) {
            /* Dedupe per-pane scrollbars: hide the original pane's
             * vertical scrollbar entirely and keep a slim 8px
             * scrollbar on the modified pane. Both panes scroll in
             * lock-step thanks to Monaco's intra-diff sync, so a
             * single bar drives both. */
            try {
              this.monacoDiffEditor.getOriginalEditor().updateOptions({
                scrollbar: {
                  vertical: 'hidden',
                  verticalScrollbarSize: 0,
                  verticalSliderSize: 0,
                },
              })
              this.monacoDiffEditor.getModifiedEditor().updateOptions({
                scrollbar: {
                  vertical: 'auto',
                  verticalScrollbarSize: 8,
                  verticalSliderSize: 8,
                  useShadows: false,
                },
              })
            } catch (_e) {
              /* Older Monaco builds without getOriginal/getModified
               * keep the default per-pane scrollbars; harmless. */
            }
          }
          if (this.monacoDiffEditor) {
            // Auto-detect the language for each side independently so
            // YAML vs YAML diffs get YAML highlighting, Python vs
            // Python gets Python, etc. Falls back to plaintext when
            // neither side matches a known shape.
            this.monacoDiffEditor.setModel({
              original: monaco.editor.createModel(this.lhs, detectLanguage(this.lhs)),
              modified: monaco.editor.createModel(this.rhs, detectLanguage(this.rhs)),
            })
            this.diffNavigator = monaco.editor.createDiffNavigator(
              this.monacoDiffEditor,
              {
                followsCaret: true,
                ignoreCharChanges: true,
                alwaysRevealFirst: true,
              }
            )
          }
        }
        showTutorials(this.$cookies, this.$route.path, this.$cookies.isDarkMode)
      })
    },
    unzipCommitData(data: string) {
      const gunzip = pako.ungzip(Buffer.from(undoUrlSafeBase64(data), 'base64'))
      const diffData = JSON.parse(Buffer.from(gunzip).toString('utf8'))
      const { lhs, rhs, lhsLabel, rhsLabel } = diffData
      this.lhsLabel = lhsLabel
      this.rhsLabel = rhsLabel
      this.lhs = lhs
      this.rhs = rhs
      this.$store.commit('data/set', {
        lhs: this.lhs,
        rhs: this.rhs,
        lhsLabel: this.lhsLabel,
        rhsLabel: this.rhsLabel,
      })
    },
  },
})
</script>

<style>
/* Mirror the index page's flex-cascade so the diff viewer always
 * claims all leftover viewport height (between navbar / action bar
 * / pane-labels and the footer). main is flex-1 (from global.scss),
 * .noden-diff-section is the only flex-1 child of main, the shell
 * is the only flex-1 child of the section, the Monaco container
 * fills the shell. min-height: 0 at every step lets the children
 * actually shrink/grow within their parent. */
.noden-diff-section {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  gap: 12px;
  width: 100%;
  color: var(--noden-text-body, #2d2a2e);
}
.dark .noden-diff-section { color: #f9fafb; }

.noden-diff-labels {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  width: 100%;
}

/* Diff viewer container — host for the Monaco diff editor + the two
 * hover-revealed edit pills. Rounded card surface so the viewer
 * looks like one of the editor panes from the home page. */
.noden-diff-shell {
  position: relative;
  /* `0` basis so the shell can shrink under tight viewports without
   * forcing the page taller than 100vh. min-height keeps a small
   * floor on readability; max-height caps growth so the shell
   * never escapes the viewport. */
  flex: 1 1 0;
  min-height: 240px;
  max-height: calc(100vh - 12rem);
  width: 100%;
  background: var(--noden-bg-primary, #ffffff);
  border: 1px solid var(--noden-border-light, #e5e7eb);
  border-radius: 12px;
  box-shadow: var(--noden-card-shadow, 0 2px 8px rgba(45, 42, 46, 0.08));
  overflow: hidden;
}
.dark .noden-diff-shell {
  background: #0f172a;
  border-color: #374151;
}
.noden-diff-viewer {
  width: 100%;
  height: 100%;
  overflow: hidden;
}
/* Monaco lays its diff editor inside the .noden-diff-viewer host.
 * Force its outer wrappers to inherit the host's height so the
 * editor can never push the host past its parent's max-height. */
.noden-diff-viewer .monaco-diff-editor,
.noden-diff-viewer .monaco-editor {
  height: 100% !important;
}

/* Scrollbar dedup, DOM-level. Monaco's class names for the
 * original / modified panes vary across versions:
 *   - .editor.original / .editor.modified  (older)
 *   - .original-in-monaco-diff-editor /
 *     .modified-in-monaco-diff-editor       (newer)
 * Cover both. We hide the left-pane scrollbar, its
 * decorationsOverviewRuler, and the diff editor's own outer
 * overview-ruler column (it duplicates the modified pane's).
 * Block is non-scoped so it reaches Monaco's externally-
 * rendered DOM. */
.monaco-diff-editor .editor.original .monaco-scrollable-element > .scrollbar.vertical,
.monaco-diff-editor .original-in-monaco-diff-editor .monaco-scrollable-element > .scrollbar.vertical,
.monaco-diff-editor [class*="original-in"] .monaco-scrollable-element > .scrollbar.vertical {
  display: none !important;
  width: 0 !important;
}
.monaco-diff-editor .editor.original .decorationsOverviewRuler,
.monaco-diff-editor .original-in-monaco-diff-editor .decorationsOverviewRuler,
.monaco-diff-editor [class*="original-in"] .decorationsOverviewRuler {
  display: none !important;
}
/* Hide the right-edge global diff overview ruler that some Monaco
 * builds render alongside the per-pane ones — leaves the modified
 * pane's slim scrollbar as the single visible vertical affordance. */
.monaco-diff-editor .diffOverview {
  display: none !important;
}

/* Per-pane edit pill. Two of them: left pill anchors to the right
 * edge of the original (left) half of the diff, right pill anchors
 * to the right edge of the modified (right) half. Both navigate
 * back to / with the diff hash so the home page mounts with the
 * editors pre-populated for re-editing. Hover on the diff shell
 * fades them in; they stay just-visible at rest so the affordance
 * is discoverable but never competes with the diff content. */
.noden-pane-edit {
  position: absolute;
  top: 8px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--noden-text-secondary, #64748b);
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid var(--noden-border-light, #e5e7eb);
  border-radius: 999px;
  text-decoration: none;
  backdrop-filter: blur(4px);
  opacity: 0;
  transition: opacity 0.15s, background 0.15s, color 0.15s,
    border-color 0.15s, transform 0.1s;
  z-index: 2;
}
.noden-pane-edit :deep(svg) {
  width: 12px;
  height: 12px;
}
.noden-diff-shell:hover .noden-pane-edit,
.noden-pane-edit:focus-visible {
  opacity: 1;
}
.noden-pane-edit:hover {
  background: var(--noden-primary, #2563eb);
  color: #ffffff;
  border-color: var(--noden-primary, #2563eb);
}
.noden-pane-edit:active {
  transform: scale(0.96);
}
.noden-pane-edit-left {
  /* Sits at the right edge of the original (left) half. */
  right: calc(50% + 14px);
}
.noden-pane-edit-right {
  /* Far right of the modified (right) half, clearing the 8px
   * scrollbar AND the overview ruler (~14px) so the pill never
   * sits behind either. */
  right: 36px;
}
.dark .noden-pane-edit {
  background: rgba(31, 41, 55, 0.85);
  color: #d1d5db;
  border-color: #374151;
}
.dark .noden-pane-edit:hover {
  background: #2563eb;
  color: #ffffff;
  border-color: #2563eb;
}

.noden-diff-status {
  display: grid;
  place-items: center;
  width: 100%;
  min-height: 240px;
  padding: 24px;
  background: var(--noden-bg-primary, #ffffff);
  border: 1px solid var(--noden-border-light, #e5e7eb);
  border-radius: 12px;
  color: var(--noden-text-primary, #1e3a5f);
}
.dark .noden-diff-status {
  background: #0f172a;
  border-color: #374151;
  color: #ffffff;
}

.editor {
  max-height: max(500px, calc(100vh - 17rem));
}

/* Editable per-pane label. Looks like a plain heading until you
 * hover/focus, then it gets a subtle outline + cursor: text so the
 * affordance is obvious. */
.noden-pane-label {
  flex: 1 1 0;
  min-width: 0;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 1.05rem;
  font-weight: 600;
  text-align: center;
  color: var(--noden-brand, #133353);
  outline: none;
  transition: background 0.15s, border-color 0.15s;
}
.noden-pane-label::placeholder {
  color: var(--noden-text-secondary, #64748b);
  font-weight: 400;
}
.noden-pane-label:hover {
  border-color: var(--noden-border-light, #e5e7eb);
}
.noden-pane-label:focus {
  background: var(--noden-bg-primary, #ffffff);
  border-color: var(--noden-accent, #4a9eff);
  box-shadow: 0 0 0 3px rgba(74, 158, 255, 0.15);
}
.dark .noden-pane-label {
  color: #ffffff;
}
.dark .noden-pane-label:hover {
  border-color: #4b5563;
}
.dark .noden-pane-label:focus {
  background: #1f2937;
  border-color: #60a5fa;
}
</style>
