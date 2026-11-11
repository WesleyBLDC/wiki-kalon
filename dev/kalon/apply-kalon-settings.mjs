#!/usr/bin/env node
/*
  Wiki.js Kalon: apply Kalon's default settings to a running instance.

  Kalon is designed for a few settings that differ from stock Wiki.js, and uses them in testing and in
  production alike. It never changes the database or the stored defaults, so a fresh instance starts
  with stock settings until they are applied. This script logs in as a local administrator and changes
  them through the same REST API the admin area uses:

    node dev/kalon/apply-kalon-settings.mjs [--url http://localhost:3000] [--email admin@example.com]

  The password is read from KALON_ADMIN_PASSWORD (default: upstream's first-run `12345678`). An
  instance whose administrators sign in only through a provider sets the same values in the admin area.
  `KALON.md` lists them in its "Default settings" table; change both together.
*/

/** What differs from a stock install. */
export const KALON_SETTINGS = {
  // -> The editors Kalon is designed around; the others stay installed and can be switched back on
  editors: {
    visual: true,
    excalidraw: true,
    redirect: true,
    markdown: false,
    asciidoc: false,
    blog: false,
    feedback: false
  },
  theme: {
    dark: true,
    contentWidth: 'centered',
    colorPrimary: '#1f6fc5'
  },
  features: {
    browse: true
  }
}

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const base = `${arg('url', 'http://localhost:3000').replace(/\/$/, '')}/_api`
const email = arg('email', 'admin@example.com')
const password = process.env.KALON_ADMIN_PASSWORD || '12345678'

let cookie = ''

async function call(method, path, body) {
  const init = { method, headers: { 'content-type': 'application/json', cookie } }
  if (body) {
    init.body = JSON.stringify(body)
  }
  const res = await fetch(base + path, init)
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const kv = c.split(';')[0]
    const name = kv.split('=')[0]
    cookie = [...cookie.split('; ').filter((x) => x && !x.startsWith(`${name}=`)), kv].join('; ')
  }
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = text
  }
  if (!res.ok) {
    throw new Error(`${method} ${path}: ${res.status} ${text.slice(0, 300)}`)
  }
  return json
}

const boot = await call('GET', '/bootstrap')
const siteId = boot.site.id
const strategyId = boot.site.authStrategies?.[0]?.id

const login = await call('PUT', `/sites/${siteId}/auth/login`, {
  strategyId,
  username: email,
  password
})
if (!login?.authenticated) {
  throw new Error(`Login failed for ${email}: ${JSON.stringify(login).slice(0, 200)}`)
}

const site = await call('GET', `/sites/${siteId}`)

const editors = structuredClone(site.editors ?? {})
for (const [name, isActive] of Object.entries(KALON_SETTINGS.editors)) {
  editors[name] = { ...editors[name], isActive }
}
await call('PUT', `/sites/${siteId}`, {
  editors,
  features: { ...site.features, ...KALON_SETTINGS.features }
})
await call('PUT', `/sites/${siteId}/theme`, { ...site.theme, ...KALON_SETTINGS.theme })

const after = await call('GET', `/sites/${siteId}`)
const active = Object.entries(after.editors)
  .filter(([, e]) => e.isActive)
  .map(([n]) => n)
console.log(`Editors on: ${active.join(', ')}`)
console.log(
  `Theme: dark ${after.theme.dark}, width ${after.theme.contentWidth}, primary ${after.theme.colorPrimary}`
)
console.log(`Browse: ${after.features.browse}`)
