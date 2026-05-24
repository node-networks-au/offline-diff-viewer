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

          <!-- Diff viewer host. The shell is always rendered (so its
               flex-grown dimensions are identical whether the diff is
               loading, errored, or fully populated). The Monaco
               viewport hides behind v-show during e2e loading so the
               status overlay (centered inside the shell) is the only
               visible affordance. Edit pills are pinned to the
               viewport's top-right and gated on the same v-show, so
               they don't appear over a loading message. -->
          <div class="noden-diff-shell">
            <div
              v-show="!e2eDataStatusText"
              id="monaco-diff-viewer"
              class="noden-diff-viewer"
            />
            <NuxtLink
              v-show="!e2eDataStatusText"
              :to="editLink"
              class="noden-pane-edit noden-pane-edit-left"
              title="Edit this diff"
              aria-label="Edit left pane"
            >
              <Pencil />
              <span>Edit</span>
            </NuxtLink>
            <NuxtLink
              v-show="!e2eDataStatusText"
              :to="editLink"
              class="noden-pane-edit noden-pane-edit-right"
              title="Edit this diff"
              aria-label="Edit right pane"
            >
              <Pencil />
              <span>Edit</span>
            </NuxtLink>
            <div
              v-if="e2eDataStatusText"
              role="alert"
              aria-busy="true"
              aria-live="polite"
              class="noden-diff-status-inner"
            >
              <p>{{ e2eDataStatusText }}</p>
            </div>
          </div>
        </section>
        <DiffActionBar
          ref="actionBar"
          :diff-navigator="diffNavigator"
          :monaco-diff-editor="monacoDiffEditor"
        />
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
              /* Disable the diff editor's OWN combined overview ruler
               * (Monaco renders this as a separate ~14-px column to
               * the right of the modified pane, with the viewport
               * slider as a chunky gray rounded-rect — that's what was
               * appearing as an unhidable scrollbar). The heatmap +
               * scroll affordance is moved to the modified pane's
               * per-side overview ruler below, which Monaco renders
               * at the same width as the scrollbar (8 px here) and
               * fully wires for click-to-jump + drag-to-scroll. */
              overviewRulerBorder: false,
              renderLineHighlight: 'none',
              renderOverviewRuler: false,
            }
          ) as any
          if (this.monacoDiffEditor) {
            /* Dedupe per-pane scrollbars: hide the original pane's
             * vertical scrollbar entirely and keep a slim 8px
             * scrollbar on the modified pane. Both panes scroll in
             * lock-step thanks to Monaco's intra-diff sync, so a
             * single bar drives both. */
            try {
              /* Original pane: scrollbar + overview ruler BOTH off.
               * Intra-diff sync drives this pane from the modified
               * side's scrollbar, so a separate scroll affordance
               * here would only confuse. */
              this.monacoDiffEditor.getOriginalEditor().updateOptions({
                scrollbar: {
                  vertical: 'hidden',
                  verticalScrollbarSize: 0,
                  verticalSliderSize: 0,
                },
                overviewRulerLanes: 0,
                hideCursorInOverviewRuler: true,
              })
              /* Modified pane: slim 8-px scrollbar visible AND its
               * per-side overview ruler enabled with 3 lanes for
               * diff-mark rendering. Monaco draws the overview ruler
               * and the scrollbar in the SAME column (width =
               * verticalScrollbarSize), so the heatmap and the
               * scroll slider read as one unified 8-px chrome strip
               * on the right edge of the modified pane. Click + drag
               * on the slider scrolls; click on a change mark jumps
               * to that line. */
              this.monacoDiffEditor.getModifiedEditor().updateOptions({
                scrollbar: {
                  vertical: 'auto',
                  verticalScrollbarSize: 8,
                  verticalSliderSize: 8,
                  useShadows: false,
                },
                overviewRulerLanes: 3,
                hideCursorInOverviewRuler: true,
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
  /* basis 0 (not auto) so flex sizing is driven by the parent's
   * available height, not by the section's intrinsic content height.
   * overflow:hidden caps growth so the shell can never push past
   * the section's flex-allocated box. */
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
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
  /* Pure flex sizing — `0` basis + `min-height: 0` lets the shell
   * shrink to whatever the parent allocates. No min-height floor or
   * max-height cap; the cascade above (page-root 100vh → page-contents
   * flex-grow → main flex-grow → section flex-grow → shell flex-grow)
   * does the constraining. A min-height floor here was forcing the
   * shell past the viewport on tighter window heights. */
  flex: 1 1 0;
  min-height: 0;
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

/* Belt-and-suspenders scrollbar dedup on the ORIGINAL pane only.
 * Monaco's class names vary across versions:
 *   - .editor.original                        (older)
 *   - .original-in-monaco-diff-editor         (newer)
 * The updateOptions() call in mounted() already hides this, but
 * covering it here defends against bundle upgrades that ignore the
 * JS override. The modified pane intentionally keeps its scrollbar
 * (the unified scrollbar + heatmap column on the right edge). */
.monaco-diff-editor .editor.original .monaco-scrollable-element > .scrollbar.vertical,
.monaco-diff-editor [class*="original-in"] .monaco-scrollable-element > .scrollbar.vertical {
  display: none !important;
  width: 0 !important;
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
  /* Far right of the modified (right) half, clearing the 8-px
   * heatmap (now the only vertical chrome — no scrollbar) with a
   * small breathing-room gap so the pill never sits behind the
   * change marks. */
  right: 20px;
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

/* Loading / error overlay rendered INSIDE the shell, so the outer
 * card dimensions stay identical whether content is loaded or the
 * page is still resolving an encrypted short link. The status text
 * is centered inside the shell's flex-grown viewport. */
.noden-diff-status-inner {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  color: var(--noden-text-primary, #1e3a5f);
  pointer-events: none;
}
.dark .noden-diff-status-inner {
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
