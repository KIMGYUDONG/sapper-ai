#!/usr/bin/env node
const { existsSync } = require('node:fs')
const { resolve } = require('node:path')

const port = process.env.PORT ?? '4100'
const standaloneDir = resolve(__dirname, '../standalone')

console.log(`\n  SapperAI Dashboard: http://localhost:${port}/dashboard\n`)

process.env.PORT = port

const candidates = ['server.js', 'apps/web/server.js']
const entry = candidates.map((p) => resolve(standaloneDir, p)).find((p) => existsSync(p))

if (!entry) {
  console.error(`\n  Missing standalone server entry in: ${standaloneDir}`)
  console.error('  Expected one of: server.js, apps/web/server.js\n')
  process.exit(1)
}

require(entry)
