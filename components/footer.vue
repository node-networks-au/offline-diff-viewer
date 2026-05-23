<template>
  <footer class="noden-footer">
    <span>
      This product includes software developed by
      <a
        href="https://technikhil314.netlify.app"
        class="noden-footer-link"
      >Nikhil Mehta</a>.
    </span>
  </footer>
</template>
<script lang="ts">
import Vue from 'vue'
export default Vue.extend({})
</script>
<style scoped>
.noden-footer {
  display: flex;
  justify-content: flex-end; /* attribution sits bottom-right */
  align-items: center;
  padding: 8px 24px;
  width: 100%;
  font-size: 0.8rem;
  color: var(--noden-text-secondary, #64748b);
  background: transparent;
}
.dark .noden-footer { color: #9ca3af; }
.noden-footer-link {
  color: var(--noden-brand, #133353);
  font-weight: 500;
  text-decoration: none;
  margin-left: 4px;
}
.noden-footer-link:hover {
  text-decoration: underline;
  text-underline-offset: 2px;
}
.dark .noden-footer-link { color: #93c5fd; }
</style>
