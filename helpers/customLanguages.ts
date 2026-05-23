/**
 * Custom Monaco language registrations for network-vendor config
 * dialects that the upstream Monarch language pack doesn't ship:
 *
 *   - juniper       Junos OS: both set-style ("set system host-name foo")
 *                   and curly-brace block style ("system { host-name foo; }"),
 *                   with /* … *\/ and # comments.
 *   - cisco         IOS / IOS-XE / NX-OS: "!" comments + the usual
 *                   interface / router / acl directive vocabulary.
 *   - routeros      MikroTik RouterOS: "/interface print" command paths,
 *                   "add name=foo …" key=value pairs, # comments.
 *
 * These are deliberately light — basic keyword + IP + comment +
 * string highlighting is enough to be readable; we don't try to be a
 * full Junos parser. Call registerCustomLanguages(monaco) once after
 * loader.init() resolves (idempotent).
 */

let registered = false

export function registerCustomLanguages(monaco: any) {
  if (registered || !monaco) return
  registered = true

  /* ------------------------------------------------------------------
   * Juniper Junos OS
   * ------------------------------------------------------------------ */
  monaco.languages.register({ id: 'juniper' })
  monaco.languages.setMonarchTokensProvider('juniper', {
    defaultToken: '',
    tokenPostfix: '.juniper',
    brackets: [{ open: '{', close: '}', token: 'delimiter.curly' }],
    keywords: [
      'set', 'delete', 'show', 'commit', 'configure', 'edit', 'top', 'up',
      'exit', 'run', 'rollback', 'save', 'load', 'replace', 'override',
      'merge', 'inactive',
    ],
    tokenizer: {
      root: [
        [/\/\*/, 'comment', '@comment'],
        [/#.*$/, 'comment'],
        [/"([^"\\]|\\.)*"/, 'string'],
        [/\b(\d{1,3}\.){3}\d{1,3}(\/\d+)?\b/, 'number.ip'],
        [/\b[0-9a-fA-F:]+:[0-9a-fA-F:]+\/\d+\b/, 'number.ip'],
        [/\b\d+(\.\d+)*\b/, 'number'],
        [/[{}]/, '@brackets'],
        [/[;,]/, 'delimiter'],
        [/\b(set|delete|show|commit|configure|edit|top|up|exit|run|rollback|save|load|replace|override|merge|inactive)\b/, 'keyword'],
        [/[a-zA-Z_][\w.-]*/, 'identifier'],
      ],
      comment: [
        [/[^/*]+/, 'comment'],
        [/\*\//, 'comment', '@pop'],
        [/[/*]/, 'comment'],
      ],
    },
  })

  /* ------------------------------------------------------------------
   * Cisco IOS / IOS-XE / NX-OS
   * ------------------------------------------------------------------ */
  monaco.languages.register({ id: 'cisco' })
  monaco.languages.setMonarchTokensProvider('cisco', {
    defaultToken: '',
    tokenPostfix: '.cisco',
    ignoreCase: false,
    keywords: [
      'interface', 'ip', 'ipv6', 'no', 'shutdown', 'description', 'router',
      'bgp', 'ospf', 'ospfv3', 'eigrp', 'isis', 'rip', 'access-list', 'permit',
      'deny', 'line', 'vty', 'con', 'aux', 'password', 'secret', 'enable',
      'hostname', 'switchport', 'vlan', 'trunk', 'access', 'mode', 'duplex',
      'speed', 'spanning-tree', 'crypto', 'tunnel', 'vrf', 'route-map',
      'prefix-list', 'version', 'service', 'clock', 'ntp', 'username',
      'privilege', 'aaa', 'authentication', 'authorization', 'accounting',
      'radius', 'tacacs', 'snmp-server', 'logging', 'exit', 'end',
      'router-id', 'neighbor', 'remote-as', 'network', 'redistribute',
      'static', 'connected', 'mtu', 'mac-address', 'channel-group', 'lacp',
      'lldp', 'cdp', 'dot1q', 'encapsulation', 'standby', 'hsrp', 'vrrp',
    ],
    tokenizer: {
      root: [
        [/^\s*!.*$/, 'comment'],
        [/"([^"\\]|\\.)*"/, 'string'],
        [/\b(\d{1,3}\.){3}\d{1,3}(\/\d+)?\b/, 'number.ip'],
        [/\b[0-9a-fA-F:]+:[0-9a-fA-F:]+\/\d+\b/, 'number.ip'],
        [/\b\d+\b/, 'number'],
        [/\b\w[\w/.-]*/, {
          cases: { '@keywords': 'keyword', '@default': 'identifier' },
        }],
      ],
    },
  })

  /* ------------------------------------------------------------------
   * MikroTik RouterOS
   * ------------------------------------------------------------------ */
  monaco.languages.register({ id: 'routeros' })
  monaco.languages.setMonarchTokensProvider('routeros', {
    defaultToken: '',
    tokenPostfix: '.routeros',
    keywords: [
      'add', 'set', 'remove', 'print', 'enable', 'disable', 'find',
      'export', 'import', 'where', 'place-before', 'comment',
    ],
    pathStarts: [
      '/interface', '/ip', '/ipv6', '/routing', '/system', '/user', '/tool',
      '/log', '/snmp', '/certificate', '/file', '/queue', '/firewall',
      '/port', '/console',
    ],
    tokenizer: {
      root: [
        [/#.*$/, 'comment'],
        [/"([^"\\]|\\.)*"/, 'string'],
        [/\b(\d{1,3}\.){3}\d{1,3}(\/\d+)?\b/, 'number.ip'],
        [/\b\d+\b/, 'number'],
        [/^\/[a-z-]+(\s+[a-z-]+)*/, 'type'],
        [/\b(add|set|remove|print|enable|disable|find|export|import|where|place-before|comment)\b/, 'keyword'],
        [/[a-zA-Z_][\w-]*(?==)/, 'attribute.name'],
        [/=/, 'operator'],
        [/[a-zA-Z_][\w-]*/, 'identifier'],
      ],
    },
  })
}

/* Public language catalogue used by the UI dropdown. The first
 * entry is the auto-detect sentinel — the editor stays on
 * background detection unless the user pins something concrete.
 * The scroll-icon button next to the dropdown is the visible
 * affordance for "open this menu" (the <select> itself is
 * styled-but-still-native; clicking the scroll opens it
 * programmatically). */
export const LANGUAGE_OPTIONS: Array<{ id: string; label: string }> = [
  { id: '__auto__', label: 'Auto-detect' },
  { id: 'plaintext', label: 'Plain text' },
  { id: 'json', label: 'JSON' },
  { id: 'yaml', label: 'YAML' },
  { id: 'python', label: 'Python' },
  { id: 'dockerfile', label: 'Dockerfile' },
  { id: 'shell', label: 'Shell' },
  { id: 'hcl', label: 'HCL / Terraform' },
  { id: 'xml', label: 'XML' },
  { id: 'sql', label: 'SQL' },
  { id: 'juniper', label: 'Juniper (Junos)' },
  { id: 'cisco', label: 'Cisco (IOS/IOS-XE)' },
  { id: 'routeros', label: 'MikroTik RouterOS' },
]
