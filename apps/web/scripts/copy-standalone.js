#!/usr/bin/env node
const fs = require('node:fs')
const path = require('node:path')

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
}

function copyDir(src, dest) {
  fs.cpSync(src, dest, { recursive: true })
}

function main() {
  const webDir = path.resolve(__dirname, '..')
  const repoRoot = path.resolve(webDir, '../..')

  const srcStandalone = path.resolve(webDir, '.next/standalone')
  const srcStatic = path.resolve(webDir, '.next/static')
  const srcPublic = path.resolve(webDir, 'public')

  const destStandalone = path.resolve(repoRoot, 'packages/dashboard/standalone')

  if (!fs.existsSync(srcStandalone)) {
    console.error(`\n  Missing ${srcStandalone}`)
    console.error('  Run: pnpm --filter @sapper-ai/web build (or pnpm build:standalone)\n')
    process.exit(1)
  }

  fs.rmSync(destStandalone, { recursive: true, force: true })
  ensureDir(destStandalone)

  copyDir(srcStandalone, destStandalone)

  if (fs.existsSync(srcStatic)) {
    ensureDir(path.join(destStandalone, '.next'))
    copyDir(srcStatic, path.join(destStandalone, '.next/static'))
  }

  if (fs.existsSync(srcPublic)) {
    copyDir(srcPublic, path.join(destStandalone, 'public'))
  }

  console.log(`\n  Copied standalone build to ${destStandalone}\n`)
}

main()
