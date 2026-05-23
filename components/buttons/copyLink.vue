<template>
  <button
    id="copyLinkButton"
    type="button"
    class="copy-link-btn"
    :class="{
      'is-copied': copied === true,
      'is-generating': copied === null,
    }"
    :disabled="copied === null || copied === true"
    aria-label="Click here to copy url to clipboard"
    @click="clickHandler"
  >
    <span class="inline-flex gap-2 items-center" aria-live="assertive" role="status">
      <span v-show="copied" aria-hidden="true">
        <Copied />
      </span>
      <span v-show="copied">Copied</span>
      <span v-show="!copied" aria-hidden="true">
        <Link />
      </span>
      <span v-show="!copied">{{
        copied === null ? 'Generating…' : 'Copy link'
      }}</span>
    </span>
  </button>
</template>
<script lang="ts">
import Vue from 'vue'
import Copied from '~/components/icons/copied.vue'
import Link from '~/components/icons/link.vue'
export default Vue.extend({
  components: { Link, Copied },
  props: {
    clickHandler: {
      type: Function,
      required: true,
    },
    /* `false` = idle (Link / Copy link), `true` = success
     * (Copied), `null` = in-flight server round-trip
     * (Generating…). */
    copied: {
      default: false,
    },
  },
})
</script>
<style scoped lang="scss">
.copy-link-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 16px;
  min-width: 140px;
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.2;
  border-radius: 6px;
  border: 1px solid transparent;
  cursor: pointer;
  background: var(--noden-primary, #2563eb);
  color: #ffffff;
  /* Smoothly cross-fade background + text on state transitions. */
  transition: background-color 0.25s ease, color 0.25s ease,
    border-color 0.25s ease, box-shadow 0.2s ease, transform 0.1s ease;
}
.copy-link-btn:hover {
  background: var(--noden-primary-hover, #1d4ed8);
}
.copy-link-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(74, 158, 255, 0.3);
}
.copy-link-btn:active {
  transform: scale(0.97);
}
.copy-link-btn.is-copied {
  background: #16a34a; /* success green */
  color: #ffffff;
  cursor: default;
}
.copy-link-btn.is-generating {
  background: var(--noden-primary-light, #dbeafe);
  color: var(--noden-primary, #2563eb);
  cursor: progress;
}
.copy-link-btn:disabled {
  opacity: 1; /* override browser default — we want full color */
}
/* SVG icons inherit currentColor; size them consistently. */
.copy-link-btn :deep(svg) {
  width: 16px;
  height: 16px;
  transition: transform 0.2s ease;
}
.copy-link-btn:not(.is-copied):not(.is-generating):hover :deep(svg) {
  transform: rotate(12deg);
}
</style>
