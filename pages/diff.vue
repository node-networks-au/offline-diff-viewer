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
      <Navbar :show-back-button="true" />
      <main class="outline-none" tabindex="0">
        <DiffActionBar
          ref="actionBar"
          :diff-navigator="diffNavigator"
          :on-diff-fashion="toggleDiffFashion"
        />
        <section
          class="flex flex-wrap gap-4 items-stretch w-full text-gray-800 dark:text-gray-50"
        >
          <!-- Editable per-pane labels. The original render shipped
               these as <p> elements; users now want to rename each
               side after the diff is loaded. We bind via v-model
               directly to the page-level reactive lhsLabel/rhsLabel
               so any subsequent share-link generation picks up the
               updated names too. -->
          <div
            :class="{
              'flex w-full gap-4 items-center transition-opacity': true,
              'opacity-0': !isSideBySideDiff,
            }"
          >
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
          <div
            v-show="!e2eDataStatusText"
            id="monaco-diff-viewer"
            class="p-2 w-full h-screen rounded-md border border-gray-600 editor"
          ></div>
          <div
            v-if="e2eDataStatusText"
            role="alert"
            aria-busy="true"
            aria-live="polite"
            class="grid place-items-center p-2 w-full h-screen rounded-md border border-gray-600  editor"
          >
            <h1 class="text-xl font-bold text-center">
              {{ e2eDataStatusText }}
            </h1>
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
import DiffActionBar from '~/components/diffActionBar.vue'
import Footer from '~/components/footer.vue'
import Navbar from '~/components/navbar.vue'
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
  components: { DiffActionBar, Navbar, Footer },
  layout: 'main',
  data(): v2DiffData {
    return {
      lhs: '',
      rhs: '',
      rhsLabel: '',
      lhsLabel: '',
      monacoDiffEditor: {},
      diffNavigator: {},
      isSideBySideDiff: true,
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
    toggleDiffFashion(value: boolean) {
      this.monacoDiffEditor?.updateOptions?.({ renderSideBySide: value })
      this.isSideBySideDiff = value
    },
    // swapDiffContent removed — the swap button is gone from the
    // action bar (users found it confusing on read-only diffs).

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
        if (monacoDiffViewerEl) {
          this.monacoDiffEditor = monaco.editor.createDiffEditor(
            monacoDiffViewerEl,
            {
              ...monacoEditorOptions,
              readOnly: true,
              wordWrap: 'on',
              diffAlgorithm: 'advanced',
              // Modernize the right-edge overview ruler (heat-map of
              // changes). Without a border it merges into the editor
              // chrome; 12-px-wide scrollbar + rounded handles match
              // the portal-aligned visual weight.
              overviewRulerBorder: false,
              overviewRulerLanes: 3,
              scrollbar: {
                useShadows: false,
                verticalScrollbarSize: 12,
                horizontalScrollbarSize: 12,
                verticalSliderSize: 12,
                horizontalSliderSize: 12,
              },
              renderLineHighlight: 'none',
              renderOverviewRuler: true,
            }
          ) as any
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
