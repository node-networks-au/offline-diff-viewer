import { Store } from 'vuex'
import { ToastState } from '~/store/toast'

export function doUrlSafeBase64(decoded: string) {
  return decoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function undoUrlSafeBase64(_encoded: string) {
  let encoded = _encoded.replace(/-/g, '+').replace(/_/g, '/')
  while (encoded.length % 4) encoded += '='
  return encoded
}

export function urlEncode(unencoded: string): string {
  const encoded = globalThis.btoa(unencoded)
  return doUrlSafeBase64(encoded)
}

export function urlDecode(_encoded: string): string {
  const encoded = undoUrlSafeBase64(_encoded)
  return globalThis.atob(encoded)
}

export function escapeHtml(unsafe: string) {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function putToClipboard(
  textToPut: string,
  toastContent: string,
  store: Store<ToastState>
) {
  navigator.clipboard.writeText(textToPut)
  store.commit('toast/show', {
    show: true,
    content: toastContent,
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
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        ></path>
      </svg>
    `,
    theme: 'success',
  })
}

export function getMonacoEditorDefaultOptions(theme: string): any {
  return {
    // Default to plain text — auto-detect runs on submit / on paste
    // (see detectLanguage below) and switches to YAML / Python / JSON /
    // etc. when a confident match is found. Plain text avoids
    // JavaScript's aggressive auto-formatting and red-squiggle linting
    // for content that isn't actually JS.
    language: 'plaintext',
    theme,
    fontSize: parseFloat(getComputedStyle(document.documentElement).fontSize),
    fontFamily:
      "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, " +
      "'Liberation Mono', monospace",
    scrollBeyondLastLine: false,
    scrollBeyondLastColumn: 0,
    minimap: { enabled: false },
    contextmenu: false,
    // No autocomplete / inline suggestions / hover popovers while
    // typing — this is a diff paste box, not an IDE. Older Monaco
    // builds (bundled with Nuxt 2 here) type some of these as
    // booleans rather than string enums, so we stick with boolean
    // false where possible.
    quickSuggestions: false,
    suggestOnTriggerCharacters: false,
    acceptSuggestionOnEnter: 'off',
    wordBasedSuggestions: false,
    snippetSuggestions: 'none',
    parameterHints: { enabled: false },
    hover: { enabled: false },
    links: false,
    occurrencesHighlight: false,
    selectionHighlight: false,
    renderLineHighlight: 'none',
    inlineSuggest: { enabled: false },
  }
}

/**
 * Heuristic language detection for the paste boxes. Cheap regex
 * matches biased toward specificity — when nothing fires confidently
 * we stay on plain text. Returns a Monaco language id.
 */
export function detectLanguage(text: string): string {
  if (!text) return 'plaintext'
  const sample = text.slice(0, 4000)
  const trimmed = sample.trimStart()

  if (/^[\[{]/.test(trimmed)) {
    try {
      JSON.parse(text)
      return 'json'
    } catch {
      if (/^\s*[{[][\s\S]*"[^"]+"\s*:/.test(sample)) return 'json'
    }
  }
  // Juniper Junos — set-style or curly-block hierarchical config.
  if (/^\s*set\s+(system|interfaces|protocols|routing-options|policy-options|security|firewall|chassis|forwarding-options)\b/m.test(sample) ||
      /^\s*(system|protocols|interfaces|routing-options|policy-options|security|firewall)\s*\{/m.test(sample)) {
    return 'juniper'
  }
  // Cisco IOS / IOS-XE / NX-OS — "!" comments plus interface/router
  // vocabulary at line starts.
  if (/^!\s*(Last configuration|Building configuration|version |hostname )/m.test(sample) ||
      /^\s*(interface\s+(GigabitEthernet|FastEthernet|TenGigabitEthernet|TenGigE|Ethernet|Loopback|Vlan|Port-channel|Serial)|router\s+(bgp|ospf|eigrp|isis)|line\s+(vty|con|aux)|access-list\s+\d)/im.test(sample)) {
    return 'cisco'
  }
  // MikroTik RouterOS — script paths or add/set/remove key=value pairs.
  if (/^\s*\/(interface|ip|ipv6|routing|system|user|tool|queue|firewall|certificate)\b/m.test(sample) ||
      /^\s*(add|set|remove)\s+[a-z][\w-]*\s*=/m.test(sample)) {
    return 'routeros'
  }
  if (/^---\s*$/m.test(sample) ||
      /^[A-Za-z_][\w-]*:\s*(\S|$)/m.test(sample)) {
    if (!/^\s*\{[\s\S]*\}\s*$/.test(sample)) return 'yaml'
  }
  if (/^\s*(def |class |from \S+ import |import \S+|if __name__)/m.test(sample)) {
    return 'python'
  }
  if (/^\s*(FROM|RUN|CMD|COPY|ADD|EXPOSE|ENV|WORKDIR|ARG|LABEL)\s+/m.test(sample)) {
    return 'dockerfile'
  }
  if (/^#!\s*\/.+\b(sh|bash|zsh)\b/.test(trimmed) ||
      /^\s*(set -[eu]|export \w+=|sudo )/m.test(sample)) {
    return 'shell'
  }
  if (/^\s*(resource|data|module|variable|output|provider)\s+"[^"]+"\s*("[^"]+"\s*)?\{/m.test(sample)) {
    return 'hcl'
  }
  if (/^\s*<\?xml\b/.test(trimmed) ||
      /^\s*<!DOCTYPE\s+html/i.test(trimmed) ||
      /^\s*<[a-zA-Z][\w-]*[\s>]/.test(trimmed)) {
    return 'xml'
  }
  if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE TABLE|ALTER TABLE|DROP TABLE)\b/im.test(sample)) {
    return 'sql'
  }
  return 'plaintext'
}

export function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export function base64ToArrayBuffer(base64: string) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes.buffer;
}

export function getRandomDiffId() {
  const array = new Uint32Array(2);
  const randomValues = crypto.getRandomValues(array);
  const randomValuesHex = randomValues.map(value => value).join('');
  return `diff-${randomValuesHex}`
}
