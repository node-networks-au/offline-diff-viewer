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
  focus rings. CSS custom properties in `styles/global.scss`.
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
- **Per-pane syntax selector** + **scan-to-detect** icon button:
  - The selector pins a specific Monaco language id.
  - The scan button flips the pane back to auto-detect mode and
    runs `detectLanguage()` against current content immediately.
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
  fill the viewport, not a fixed 400 px well.

### Diff viewer (`/diff`)

- **Side-by-side diff** with a single unified scrollbar — the
  original-side scrollbar is hidden, the modified-side is a slim
  8 px scrollbar that drives both panes via Monaco's intra-diff
  scroll sync. The right-edge overview ruler (change heat-map)
  stays put.
- **Editable pane labels** above the diff — rename either side and
  the URL hash is regenerated on the fly via `history.replaceState`,
  so the next *Copy link* picks up the new names.
- **Action bar** has two clusters:
  - Left: **Previous change** / **Next change** labelled pill
    buttons that step through diff hunks.
  - Right: **Copy link** button. Modern in-button success state
    (Link → Copied (green) → Link) — no toast. For long
    payloads the button transitions to a *Generating…* state
    while the API mints an end-to-end-encrypted short link.
- **Per-pane Edit pills** — hover the diff viewer to reveal a
  small *Edit* pill in the top-right of each pane. Clicking either
  one drops you back on the editor with both editors
  pre-populated (the URL hash carries the payload between routes).
- **Unified-view toggle removed** — side-by-side is the canonical
  layout.

### Container & deployment

- **Multi-stage Dockerfile** baking the Nuxt static export into
  `nginx:1.27.0-alpine-slim`. No runtime `npm ci && npm run
  generate` (saves 2 GB peak memory + ~3 min per pod start).
- **GitHub Actions workflow** in `.github/workflows/build-image.yml`
  builds + pushes `ghcr.io/node-networks-au/offline-diff-viewer:latest`
  on every push to `develop`.
- Pre-built image consumed by both clusters via standard
  Kubernetes Deployment manifests (KRO RGD on dev,
  plain-kubectl manifest on prod).

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
