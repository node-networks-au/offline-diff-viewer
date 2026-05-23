<template>
  <section
    class="
      flex items-center justify-end gap-3 px-4 py-2 mb-4
      w-full rounded-md shadow-sm border
      bg-white dark:bg-gray-800
      border-gray-200 dark:border-gray-700
    "
  >
    <!-- Layout-toggle on the left of the right cluster; doesn't need
         to be visually separated since the chrome is a single row. -->
    <DiffStyle :click-handler="toggleDiffFashion" />

    <!-- Visual divider between layout-toggle and copy-link.  -->
    <span class="h-6 w-px bg-gray-200 dark:bg-gray-600" aria-hidden="true" />

    <CopyLink :click-handler="copyUrlToClipboard" :copied="copied" />

    <!-- Far-right cluster: previous / next diff navigators as
         icon-only arrow buttons. -->
    <span class="h-6 w-px bg-gray-200 dark:bg-gray-600" aria-hidden="true" />
    <button
      type="button"
      class="noden-icon-btn"
      aria-label="Go to previous diff"
      title="Previous diff"
      @click="goToPreviousDiff"
    >
      <Up />
    </button>
    <button
      type="button"
      class="noden-icon-btn"
      aria-label="Go to next diff"
      title="Next diff"
      @click="goToNextDiff"
    >
      <Down />
    </button>
  </section>
</template>

<script lang="ts">
import Vue from 'vue'
import CopyLink from '../buttons/copyLink.vue'
import DiffStyle from '../buttons/diffStyle.vue'
import Up from '~/components/icons/up.vue'
import Down from '~/components/icons/down.vue'
import { SIMPLE_DIFF_CHARACTER_LIMIT } from '~/constants/constants'
import {
  E2E_LINK_GENERATION_ERROR,
  E2E_LINK_GENERATION_SUCCESS,
  LINK_COPY_SUCCESS,
} from '~/constants/messages'
import {
  getEncryptedData,
  getEncryptionKey,
  getExtractedEncryptionKey,
} from '~/helpers/encrypt'
import { DiffActionBarData } from '~/helpers/types'
import { getRandomDiffId, putToClipboard } from '~/helpers/utils'
export default Vue.extend({
  components: { CopyLink, DiffStyle, Up, Down },
  props: {
    diffNavigator: {
      type: Object,
      required: true,
    },
    onDiffFashion: {
      type: Function,
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
    copyUrlToClipboard() {
      const isCurrentUrlExceedsCharacterLimit =
        window.location.href.length > SIMPLE_DIFF_CHARACTER_LIMIT
      if (isCurrentUrlExceedsCharacterLimit && this.e2eLink) {
        putToClipboard(this.e2eLink, LINK_COPY_SUCCESS, this.$store)
      } else if (isCurrentUrlExceedsCharacterLimit) {
        this.copyE2eUrlToClipboard()
      } else {
        putToClipboard(window.location.href, LINK_COPY_SUCCESS, this.$store)
        this.copied = true
        setTimeout(() => {
          this.copied = false
        }, 5000)
      }
    },
    async copyE2eUrlToClipboard() {
      try {
        this.copied = null
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
          headers: {
            'Content-Type': 'application/json',
          },
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
        newUrl.pathname = '/v2/diff'
        newUrl.hash = `#${extractedEncryptionKey}`
        newUrl.searchParams.set('id', data.address)
        putToClipboard(
          newUrl.toString(),
          E2E_LINK_GENERATION_SUCCESS,
          this.$store
        )
        this.e2eLink = newUrl.toString()
        this.copied = true
        setTimeout(() => {
          this.copied = false
        }, 5000)
      } catch (error: any) {
        this.showErrorToast(E2E_LINK_GENERATION_ERROR)
      } finally {
        setTimeout(() => {
          this.copied = false
        }, 5000)
      }
    },
    goToNextDiff() {
      this.diffNavigator.next()
    },
    goToPreviousDiff() {
      this.diffNavigator.previous()
    },
    toggleDiffFashion(value: boolean) {
      this.onDiffFashion(value)
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
/* Portal-aligned icon button used by the prev/next nav arrows. */
.noden-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 1px solid var(--noden-border-light, #e5e7eb);
  background: var(--noden-bg-primary, #ffffff);
  color: var(--noden-text-primary, #1e3a5f);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, transform 0.1s;
}
.noden-icon-btn:hover {
  background: var(--noden-primary-light, #dbeafe);
  border-color: var(--noden-primary, #2563eb);
  color: var(--noden-primary, #2563eb);
}
.noden-icon-btn:active {
  transform: scale(0.96);
}
.noden-icon-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(74, 158, 255, 0.3);
}
.dark .noden-icon-btn {
  background: #1f2937;
  border-color: #374151;
  color: #e5e7eb;
}
.dark .noden-icon-btn:hover {
  background: #2563eb;
  border-color: #2563eb;
  color: #ffffff;
}
</style>
