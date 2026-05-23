<template>
  <section class="noden-diff-actions">
    <!-- Left side: labelled navigation between diff hunks. -->
    <div class="noden-diff-actions-nav">
      <button
        type="button"
        class="noden-pill-btn"
        aria-label="Go to previous change"
        @click="goToPreviousDiff"
      >
        <Up />
        <span>Previous change</span>
      </button>
      <button
        type="button"
        class="noden-pill-btn"
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
  },
  data(): DiffActionBarData {
    return {
      copied: false,
      comparator: null,
      comparer: null,
      treeWalker: null,
      e2eLink: null,
    }
  },
  mounted() {
    document.addEventListener('keydown', this.handleCtrlC)
  },
  beforeDestroy() {
    document.removeEventListener('keydown', this.handleCtrlC)
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
    goToNextDiff() {
      this.diffNavigator.next()
    },
    goToPreviousDiff() {
      this.diffNavigator.previous()
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
  margin-bottom: 16px;
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
