<template>
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <!-- Rolled scroll glyph — bottom roller + curling top edge, two
         horizontal text strokes inside. Visual language: "the
         document's syntax / written language". Same stroke weight
         (2) as the Beautify icon so the two sit visually balanced
         in the pane header. -->
    <path d="M8 21h11a2 2 0 0 0 2-2v-1h-9v1a2 2 0 0 1-4 0z" />
    <path d="M19 18V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3" />
    <path d="M3 5a2 2 0 0 0 4 0V5" />
    <line x1="8" y1="9" x2="15" y2="9" />
    <line x1="8" y1="13" x2="15" y2="13" />
  </svg>
</template>
<script lang="ts">
import Vue from 'vue'
export default Vue.extend({})
</script>
