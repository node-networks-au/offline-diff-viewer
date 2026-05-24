# NodeN Configuration Diff Viewer

A privacy-focused, side-by-side configuration/text diff viewer with
shareable, end-to-end-encrypted links. Forked from
[technikhil314/offline-diff-viewer](https://github.com/technikhil314/offline-diff-viewer)
and rebranded for the NodeN platform; the upstream BSD-4 license is
preserved.

Live at:
- **<https://diff.noden.com.au>** — production
- **<https://diff.dev.noden.com.au>** — dev

## What's in the fork

### Branding & UX

- **Source-level rebrand** to *NodeN Configuration Diff* — `<title>`,
  Open Graph + Twitter Card metadata, page manifest, and link-preview
  imagery all updated. Old upstream `og:url`-on-everything bug fixed
  so Slack/Teams/iMessage unfurls actually show the right title.
- **Portal-aligned visual identity** — navy (`#133353`) headings,
  warm-white (`#faf8fa`) page background, system-font UI chrome,
  white-card surfaces with soft shadows, accent blue (`#4a9eff`)
  focus rings. CSS custom properties in `styles/global.scss`. The
  navbar logo is sized + padded (44 px tall, 18 / 32 px chrome)
  to match the noden.com.au marketing-site wordmark dominance.
- **BSD-4 attribution** in the page footer (bottom-right corner):
  > *This product includes software developed by Nikhil Mehta.*
- **Single-route topology** — the upstream's `v1` (textarea-based)
  and `v2` (Monaco-based) pages are collapsed; `/` is the editor,
  `/diff` is the viewer. Legacy `/v2` and `/v2/diff` paths still
  return `301` from the nginx layer so old shared links keep working.

### Editor (home page, `/`)

- **Monaco editors** in two side-by-side cards. Default language is
  plain text — no JavaScript auto-formatting, no red squiggles, no
  autocompletes, no hover popovers. It's a paste box, not an IDE.
- **Always-on auto-detect** with a manual override hatch — every
  keystroke / paste triggers a debounced `detectLanguage()` pass
  unless the user has pinned a specific language. A scroll-icon
  button in each pane header opens the language picker (a native
  `<select>` triggered programmatically via `showPicker()` with
  a focus fallback). Picking *Auto-detect* resumes the background
  detection loop; picking a concrete language pins it.
- **Network-vendor language packs** (registered as Monarch tokenizers
  in `helpers/customLanguages.ts`):
  - **Juniper (Junos OS)** — both `set system host-name foo`
    set-style and `system { host-name foo; }` curly-block; `/* */`
    and `#` comments; IPv4/IPv6 highlighting; ~10 control verbs.
  - **Cisco IOS / IOS-XE / NX-OS** — `!` comments;
    `interface GigabitEthernet0/0` family; routing-protocol
    (`router bgp`, `router ospf`, `router eigrp`, …),
    `access-list`, `line vty/con/aux`, ~60 keyword set.
  - **MikroTik RouterOS** — `/interface bridge add …` path
    commands, `add/set/remove name=… ` key=value pairs, `#`
    comments.
- **Auto-detect heuristics** also cover JSON, YAML, Python,
  Dockerfile, Shell, HCL/Terraform, XML, SQL.
- **Editable pane labels** with placeholder text. Per-pane
  *Beautify* (Monaco's `editor.action.formatDocument`) and
  *Auto-detect* icon buttons in the pane header.
- **Full-height editors** — the panes claim all leftover vertical
  space between the navbar and the bottom controls; empty boxes
  fill the viewport, not a fixed 400 px well. The diff viewer on
  `/diff` follows the same cascade so the diff itself always sits
  within the viewport rather than overflowing the page.

### Diff viewer (`/diff`)

- **Side-by-side diff** with the **combined change heatmap doubling
  as the only scrollbar.** Monaco's diff editor renders a unified
  overview ruler at the rightmost column that aggregates added /
  removed line marks from BOTH sides into one heatmap (a per-side
  overview ruler can only show its own side's marks, so this is
  the only path to a true combined view). The column's width is
  hardcoded to 30 px in Monaco 0.43.x via
  `DiffEditorWidget.ENTIRE_DIFF_OVERVIEW_WIDTH`, a
  `public static readonly` field at
  `src/vs/editor/browser/widget/diffEditorWidget.ts` (vscode source
  at the `vscodeRef` pinned by monaco-editor v0.43.0). It's NOT an
  editor option, theme key, or CSS variable; nothing on the public
  `monaco.editor.*` namespace lets you set it.

  Our approach: **probe-and-walk-up monkey patch.** `createDiffEditor`
  instantiates the leaf subclass `StandaloneDiffEditor extends
  DiffEditorWidget`. Naively assigning `instance.constructor.X = 8`
  only creates a shadowing own-property on the subclass while the
  parent's value (which the layout code reads) is unchanged. So at
  the start of the `loader.init().then(monaco => …)` callback we
  create a throwaway diff editor in a detached DOM node to expose
  the real constructor (class names may be minified in the AMD
  CDN bundle, so direct ESM imports aren't available), walk UP the
  prototype chain to find the class that owns its OWN
  `ENTIRE_DIFF_OVERVIEW_WIDTH` property, patch it on the OWNER, and
  dispose the probe. The real diff editor constructed after that
  inherits the 8-px constant, and a `layout()` call right after
  construction guarantees the widths + canvases pick it up.

  Both per-side scrollbars are hidden (`vertical: 'hidden'`,
  `verticalScrollbarSize: 0`); the combined heatmap is the only
  visible vertical chrome on the page. Click + drag still work on
  the narrowed ruler because Monaco's
  `delegateVerticalScrollbarPointerDown` routes pointer events
  into the modified editor's underlying vertical scrollbar by
  **screen-Y coordinates**, independent of ruler X-width. Scroll
  affordances: mousewheel inside either pane (intra-diff sync
  drives both), click a change mark to jump to that line, or drag
  the heatmap like a scrollbar.
- **Editable pane labels** above the diff — rename either side and
  the URL hash is regenerated on the fly via `history.replaceState`,
  so the next *Copy link* picks up the new names.
- **Action bar** sits at the bottom of the page (below the diff
  shell, above the footer) and has two clusters:
  - Left: **Previous change** / **Next change** labelled pill
    buttons that step through diff hunks, with a soft
    `<idx>/<total> changes` counter pill nestled between them.
    The counter tracks position via the navigation buttons (wraps
    around at both ends) and resets to `1/<total>` whenever the
    diff is recomputed (Monaco's `onDidUpdateDiff`). When the two
    sides are identical it reads *No changes* and the nav
    buttons are visibly disabled.
  - Right: **Copy link** button. Modern in-button success state
    (Link → Copied (green) → Link) — no toast. For long
    payloads the button transitions to a *Generating…* state
    while the API mints an end-to-end-encrypted short link.
- **Stable shell dimensions** — the diff shell is sized by the
  flex cascade independent of content. Whether the page is still
  resolving an encrypted short link, has hit an error, or is
  showing a fully-rendered diff, the white card occupies the
  same flex-allocated region of the viewport. The loading /
  error text is rendered as a centered overlay inside the shell
  rather than as a separately-sized box.
- **Per-pane Edit pills** — hover the diff viewer to reveal a
  small *Edit* pill in the top-right of each pane. Clicking either
  one drops you back on the editor with both editors
  pre-populated (the URL hash carries the payload between routes).
- **Unified-view toggle removed** — side-by-side is the canonical
  layout.

### Theming & motion

- **Dark / light mode toggle** in the navbar (sun ↔ moon glyph)
  with a **250 ms crossfade** on background, text, border, and
  shadow across every structural surface. Monaco's own theme is
  swapped via `vs` ⇄ `vs-dark` and snaps (canvas repaint is not a
  property we control).
- **Dark-mode palette** layered on the same CSS custom properties
  — navy headings shift to white, card surfaces shift to
  `#1f2937`/`#0f172a`, accent blue lightens to `#60a5fa`.
- **Smooth in-button state transitions** on Copy link (Link →
  Generating… → Copied → Link), focus rings (`rgba(74,158,255,.3)`),
  hover lifts on cards, and `0.97` active-scale taps on pill
  buttons.

### Removed cruft from upstream

- Google AdSense `<script>` tag and `google-adsense-account`
  meta.
- Upstream "GitHub stars" badge, repo link, and `Sponsor` button
  from the navbar.
- "Made with ♥ using Nuxt & Tailwind by © Nikhil Mehta" footer
  (replaced with the legal-minimum BSD attribution).
- "A tool that helps you compare…" / "Don't worry, we don't
  store any of your data" upstream hero block on the home page
  (and the under-button privacy note that briefly replaced it —
  the BSD attribution in the bottom-right is the only auxiliary
  text on the editor route now).
- `twitter:creator` pointing at the upstream author.
- v1 (textarea-based) `/` and `/diff` pages and their `inlineDiff`
  / `singleDiff` / `swapDiffContent` components.
- Open Sans Google Fonts preconnect + import (system font stack
  used instead).
- Dual light/dark favicon split (one favicon set for both modes).
- The unified-view diff toggle, the swap-content button, and the
  success toast on Copy link.

### Container & deployment

- **Multi-stage Dockerfile** baking the Nuxt static export into
  `nginx:1.27.0-alpine-slim`. No runtime `npm ci && npm run
  generate` (saves 2 GB peak memory + ~3 min per pod start).
- **GitHub Actions workflow** in `.github/workflows/build-image.yml`
  builds + pushes `ghcr.io/node-networks-au/offline-diff-viewer:latest`
  + a `sha-<commit>` tag on every push to `develop`.
- Pre-built image consumed by both clusters via standard
  Kubernetes Deployment manifests (KRO RGD on dev,
  plain-kubectl manifest on prod). Dev + prod restart in lock-step
  after each build so both clusters resolve `:latest` to the same
  image digest.
- Private GHCR package authenticated via the 1Password-backed
  `s-k8s-read-packages` ExternalSecret (rendered into a
  `kubernetes.io/dockerconfigjson` Secret called `ghcr-pull` and
  referenced from each Deployment's `imagePullSecrets`).

## Privacy properties

Inherited from upstream and still true:

- **Short payloads** never leave the browser — `lhs`, `rhs`,
  `lhsLabel`, `rhsLabel` are gzip + base64-encoded into the URL
  fragment (`#…`), which browsers don't send to the server.
- **Long payloads** are AES-encrypted in the browser before any
  bytes hit the server; the symmetric key lives in the URL
  fragment too, so the server only ever sees opaque ciphertext.

## Building locally

```bash
npm ci
npm run dev          # nuxt dev on :3000
npm run generate     # static build into ./dist
```

## Upstream

This is a fork. Upstream:
<https://github.com/technikhil314/offline-diff-viewer> — BSD 4-clause,
© 2022 Nikhil Mehta. Substantive UI changes are in this fork; the
diff engine is upstream Monaco.

## License

BSD 4-clause (see `LICENSE`). The advertising clause is satisfied by
the bottom-right attribution in the rendered page footer.
