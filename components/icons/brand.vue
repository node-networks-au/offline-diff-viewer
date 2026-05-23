<template>
  <img
    src="/node-networks-logo.svg"
    alt="NodeN"
    class="logo-brand"
  />
</template>
<script lang="ts">
import Vue from 'vue'
export default Vue.extend({})
</script>
<style scoped>
.logo-brand {
  height: 32px;
  width: auto;
  display: block;
}
.dark .logo-brand {
  /* Logo is navy on light; invert to white on dark backgrounds. */
  filter: brightness(0) invert(1);
}
</style>
