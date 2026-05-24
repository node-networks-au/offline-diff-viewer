<template>
  <section class="noden-diff-actions">
    <!-- Left side: labelled navigation between diff hunks + counter. -->
    <div class="noden-diff-actions-nav">
      <button
        type="button"
        class="noden-pill-btn"
        :disabled="totalChanges === 0"
        aria-label="Go to previous change"
        @click="goToPreviousDiff"
      >
        <Up />
        <span>Previous change</span>
      </button>
      <div
        class="noden-change-counter"
        :class="{ 'noden-change-counter--empty': totalChanges === 0 }"
        aria-live="polite"
      >
        <template v-if="totalChanges > 0">
          {{ currentChange }}/{{ totalChanges }} {{ totalChanges === 1 ? 'change' : 'changes' }}
        </template>
        <template v-else>
          No changes
        </template>
      </div>
      <button
        type="button"
        class="noden-pill-btn"
        :disabled="totalChanges === 0"
        aria-label="Go to next change"
        @click="goToNextDiff"
      >
        <span>Next change</span>
        <Down />
      </button>
    </div>

    <!-- Right side: copy-link CTA. -->
    <CopyLink :click-handler="copyUrlToClipboard" :copied="copied" />
  </section>
</template>

<script lang="ts">
import Vue from 'vue'
import CopyLink from './buttons/copyLink.vue'
import Up from '~/components/icons/up.vue'
import Down from '~/components/icons/down.vue'
import { SIMPLE_DIFF_CHARACTER_LIMIT } from '~/constants/constants'
import { E2E_LINK_GENERATION_ERROR } from '~/constants/messages'
import {
  getEncryptedData,
  getEncryptionKey,
  getExtractedEncryptionKey,
} from '~/helpers/encrypt'
import { DiffActionBarData } from '~/helpers/types'
import { getRandomDiffId } from '~/helpers/utils'
export default Vue.extend({
  components: { CopyLink, Up, Down },
  props: {
    diffNavigator: {
      type: Object,
      required: true,
    },
    monacoDiffEditor: {
      type: Object,
      required: false,
      default: () => ({}),
    },
  },
  data(): DiffActionBarData {
    return {
      copied: false,
      comparator: null,
      comparer: null,
      treeWalker: null,
      e2eLink: null,
      /* 1-indexed position of the change the user navigated to most
       * recently. Initialized to 1 when totalChanges flips positive
       * (alwaysRevealFirst:true on the diff navigator parks the cursor
       * on the first change as soon as the diff is computed). */
      currentChange: 0,
      totalChanges: 0,
    }
  },
  watch: {
    /* Subscribe to Monaco's onDidUpdateDiff so the counter refreshes
     * whenever the diff is recomputed (initial load, model swap, etc).
     * The prop starts as a placeholder {} and is replaced with the
     * real editor instance after monaco.editor.createDiffEditor()
     * resolves in diff.vue — the watcher fires on that swap. */
    monacoDiffEditor: {
      immediate: true,
      handler(editor) {
        if (this._updateDiffDisposer) {
          this._updateDiffDisposer.dispose()
          this._updateDiffDisposer = null
        }
        if (!editor || typeof editor.onDidUpdateDiff !== 'function') return
        this._updateDiffDisposer = editor.onDidUpdateDiff(() =>
          this.refreshChangeCount()
        )
        this.refreshChangeCount()
      },
    },
  },
  mounted() {
    document.addEventListener('keydown', this.handleCtrlC)
  },
  beforeDestroy() {
    document.removeEventListener('keydown', this.handleCtrlC)
    if (this._updateDiffDisposer) {
      this._updateDiffDisposer.dispose()
      this._updateDiffDisposer = null
    }
  },
  methods: {
    handleCtrlC(event: KeyboardEvent) {
      const { metaKey, ctrlKey, key } = event
      if (
        (metaKey || ctrlKey) &&
        key === 'c' &&
        !window?.getSelection()?.toString()
      ) {
        const button: HTMLButtonElement = document.getElementById(
          'copyLinkButton'
        ) as HTMLButtonElement
        button.click()
      }
    },
    /* Copy-link UX: no toast. The button itself transitions
     * Link → Copied → Link via the `copied` state (see
     * components/buttons/copyLink.vue). Two paths:
     *   - small URL → just navigator.clipboard.writeText().
     *   - URL over SIMPLE_DIFF_CHARACTER_LIMIT → hit the API to mint
     *     an end-to-end-encrypted short link, copy that. Short link
     *     is cached on `this.e2eLink` until the labels change (see
     *     diff.vue's syncLabelsToUrl). */
    async copyUrlToClipboard() {
      const longUrl =
        window.location.href.length > SIMPLE_DIFF_CHARACTER_LIMIT
      try {
        if (longUrl && this.e2eLink) {
          await navigator.clipboard.writeText(this.e2eLink)
        } else if (longUrl) {
          await this.copyE2eUrlToClipboard()
          return
        } else {
          await navigator.clipboard.writeText(window.location.href)
        }
        this.flashCopied()
      } catch {
        this.showErrorToast('Failed to copy link to clipboard')
      }
    },
    async copyE2eUrlToClipboard() {
      try {
        this.copied = null /* "Generating..." */
        const id = getRandomDiffId()
        const keyBuffer = await getEncryptionKey()
        const encryptedDataText = await getEncryptedData(
          window.location.hash.replace(/^#/, ''),
          keyBuffer
        )
        const extractedEncryptionKey = await getExtractedEncryptionKey(
          keyBuffer
        )
        const response = await fetch('/api/createLink', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: encryptedDataText,
            id,
          }),
        })
        const data = await response.json()
        if (!data.success) {
          throw new Error(E2E_LINK_GENERATION_ERROR)
        }
        const newUrl = new URL(window.location.origin)
        newUrl.pathname = '/diff'
        newUrl.hash = `#${extractedEncryptionKey}`
        newUrl.searchParams.set('id', data.address)
        await navigator.clipboard.writeText(newUrl.toString())
        this.e2eLink = newUrl.toString()
        this.flashCopied()
      } catch (error: any) {
        this.copied = false
        this.showErrorToast(E2E_LINK_GENERATION_ERROR)
      }
    },
    flashCopied() {
      this.copied = true
      setTimeout(() => {
        this.copied = false
      }, 2000)
    },
    /* Pull line-change count from Monaco. getLineChanges() returns
     * null until the diff is computed for the first time, after which
     * onDidUpdateDiff fires and we re-read. Reset currentChange to 1
     * when totalChanges flips positive (diff navigator parks on first
     * change via alwaysRevealFirst:true), or 0 when there are no
     * changes. */
    refreshChangeCount() {
      try {
        const changes =
          (this.monacoDiffEditor as any)?.getLineChanges?.() || []
        this.totalChanges = changes.length
        this.currentChange = this.totalChanges > 0 ? 1 : 0
      } catch (_e) {
        /* If Monaco hasn't finished initialising the line-change set
         * we leave the counter at its current value rather than
         * flashing it back to 0. */
      }
    },
    goToNextDiff() {
      this.diffNavigator?.next?.()
      if (this.totalChanges > 0) {
        this.currentChange =
          (this.currentChange % this.totalChanges) + 1
      }
    },
    goToPreviousDiff() {
      this.diffNavigator?.previous?.()
      if (this.totalChanges > 0) {
        this.currentChange =
          this.currentChange <= 1
            ? this.totalChanges
            : this.currentChange - 1
      }
    },
    showErrorToast(content: string) {
      this.$store.commit('toast/show', {
        show: true,
        content,
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
  },
})
</script>
<style lang="scss">
.copy-uri-button:hover svg {
  @apply rotate-12;
}
.noden-diff-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 16px;
  /* Action bar sits below the diff shell, so the spacing goes above
   * it (separating bar from shell). Footer below the bar already has
   * its own padding. */
  margin-top: 16px;
  flex-shrink: 0;
  width: 100%;
  background: var(--noden-bg-primary, #ffffff);
  border: 1px solid var(--noden-border-light, #e5e7eb);
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(45, 42, 46, 0.04);
}
.dark .noden-diff-actions {
  background: #1f2937;
  border-color: #374151;
}
.noden-diff-actions-nav {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

/* Counter pill between Previous / Next. Reads as a soft label, not
 * an interactive control — no background hover, just sits between
 * the buttons showing "<idx>/<total> changes". Fixed min-width to
 * prevent layout jitter as digits change. */
.noden-change-counter {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 7rem;
  padding: 6px 10px;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--noden-text-secondary, #64748b);
  background: var(--noden-bg-secondary, #f7f5f7);
  border: 1px solid var(--noden-border-light, #e5e7eb);
  border-radius: 999px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  user-select: none;
}
.noden-change-counter--empty {
  font-style: italic;
  opacity: 0.7;
}
.dark .noden-change-counter {
  background: #111827;
  border-color: #374151;
  color: #9ca3af;
}

.noden-pill-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 0.85rem;
  font-weight: 500;
  border-radius: 6px;
  border: 1px solid var(--noden-border-light, #e5e7eb);
  background: var(--noden-bg-primary, #ffffff);
  color: var(--noden-text-primary, #1e3a5f);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s,
    box-shadow 0.15s, transform 0.1s;
}
.noden-pill-btn :deep(svg) {
  width: 14px;
  height: 14px;
}
.noden-pill-btn:hover {
  background: var(--noden-primary-light, #dbeafe);
  border-color: var(--noden-primary, #2563eb);
  color: var(--noden-primary, #2563eb);
}
.noden-pill-btn:active {
  transform: scale(0.97);
}
.noden-pill-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(74, 158, 255, 0.3);
}
/* Disabled state when there are no changes to step through — keep
 * the button visible but mute it so the affordance is clearly off. */
.noden-pill-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.noden-pill-btn:disabled:hover {
  background: var(--noden-bg-primary, #ffffff);
  border-color: var(--noden-border-light, #e5e7eb);
  color: var(--noden-text-primary, #1e3a5f);
}
.dark .noden-pill-btn:disabled:hover {
  background: #111827;
  border-color: #374151;
  color: #e5e7eb;
}
.dark .noden-pill-btn {
  background: #111827;
  border-color: #374151;
  color: #e5e7eb;
}
.dark .noden-pill-btn:hover {
  background: #2563eb;
  border-color: #2563eb;
  color: #ffffff;
}
</style>
