<template>
  <nav class="noden-nav">
    <div class="noden-nav-inner">
      <!-- Brand wordmark, always returns to the editor home. -->
      <NuxtLink :to="brandLink" class="noden-brand-link" aria-label="NodeN home">
        <Brand />
      </NuxtLink>

      <!-- "Edit this diff" now lives as per-pane hover pills inside
           the diff viewer itself, so the navbar stays clean. -->
      <slot name="left" />
      <div class="flex-1"></div>
      <slot name="right" />

      <button
        type="button"
        class="noden-theme-toggle"
        :aria-label="darkMode ? 'Switch to light theme' : 'Switch to dark theme'"
        @click="toggleDarkMode"
      >
        <Moon v-if="darkMode" />
        <Sun v-if="!darkMode" />
      </button>
    </div>
  </nav>
</template>

<script lang="ts">
import Vue from 'vue'
import Back from '~/components/icons/back.vue'
import Sun from '~/components/icons/sun.vue'
import Moon from '~/components/icons/moon.vue'
import Brand from '~/components/icons/brand.vue'
let darkMode: Boolean | null = null
export default Vue.extend({
  components: { Sun, Moon, Back, Brand },
  data() {
    return { darkMode }
  },
  computed: {
    brandLink(): string {
      return '/'
    },
  },
  mounted() {
    if (darkMode === null) {
      this.darkMode = darkMode = this.$cookies.isDarkMode
      if (darkMode) {
        document.documentElement.classList.add('dark')
        document.cookie = `darkMode=${darkMode}; Secure; max-age=31536000; path=/;`
        this.$store.commit('theme/set', darkMode)
      }
    }
    document.documentElement.classList.remove('hidden')
  },
  methods: {
    toggleDarkMode() {
      const currentDarkMode = this.darkMode
      document.documentElement.classList[!currentDarkMode ? 'add' : 'remove'](
        'dark'
      )
      document.cookie = `darkMode=${!currentDarkMode}; Secure; max-age=31536000; path=/;`
      this.$store.commit('theme/set', !currentDarkMode)
      this.darkMode = !currentDarkMode
    },
  },
})
</script>

<style scoped>
.noden-nav {
  position: sticky;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  background: var(--noden-bg-primary, #ffffff);
  border-bottom: 1px solid var(--noden-border-light, #e5e7eb);
}
.dark .noden-nav {
  background: #0f172a;
  border-bottom-color: #1f2937;
}
.noden-nav-inner {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  max-width: 1600px;
  margin: 0 auto;
  /* Vertical padding matches the noden.com.au marketing-site header
   * (logo gets ~20-24px of clear-space around it on both axes). */
  padding: 18px 32px;
}
.noden-brand-link {
  display: inline-flex;
  align-items: center;
  text-decoration: none;
}
.noden-brand-link :deep(.logo-brand) {
  /* Bumped from 28px → 44px to mirror the noden.com.au logo
   * dominance in the page chrome. The marketing site uses
   * a similar 40-48px wordmark. */
  height: 44px;
}
.noden-nav-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--noden-text-secondary, #64748b);
  text-decoration: none;
  border: 1px solid transparent;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.noden-nav-link :deep(svg) {
  width: 14px;
  height: 14px;
}
.noden-nav-link:hover {
  background: var(--noden-primary-light, #dbeafe);
  color: var(--noden-primary, #2563eb);
}
.dark .noden-nav-link { color: #9ca3af; }
.dark .noden-nav-link:hover {
  background: #1e293b;
  color: #ffffff;
}

.noden-theme-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  border: 1px solid var(--noden-border-light, #e5e7eb);
  background: transparent;
  color: var(--noden-text-primary, #1e3a5f);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, transform 0.1s;
}
.noden-theme-toggle :deep(svg) {
  width: 18px;
  height: 18px;
}
.noden-theme-toggle:hover {
  background: var(--noden-bg-secondary, #f7f5f7);
  border-color: var(--noden-border-medium, #d1d5db);
}
.noden-theme-toggle:active {
  transform: scale(0.95);
}
.dark .noden-theme-toggle {
  border-color: #374151;
  color: #f9fafb;
}
.dark .noden-theme-toggle:hover {
  background: #1f2937;
  border-color: #4b5563;
}

.flex-1 { flex: 1 1 0; }
</style>
