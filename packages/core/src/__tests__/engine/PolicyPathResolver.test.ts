import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { resolvePolicyPath } from '../../engine/PolicyPathResolver'

describe('resolvePolicyPath', () => {
  it('prefers project policy over global policy', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'sapper-core-policy-root-'))
    const home = mkdtempSync(join(tmpdir(), 'sapper-core-policy-home-'))

    try {
      writeFileSync(join(repoRoot, 'sapperai.config.yaml'), 'mode: enforce\ndefaultAction: allow\nfailOpen: true\n', 'utf8')
      const globalDir = join(home, '.sapperai')
      mkdirSync(globalDir, { recursive: true })
      writeFileSync(join(globalDir, 'policy.yaml'), 'mode: monitor\ndefaultAction: allow\nfailOpen: true\n', 'utf8')

      const resolved = resolvePolicyPath({ repoRoot, homeDir: home })
      expect(resolved).toEqual({ path: join(repoRoot, 'sapperai.config.yaml'), source: 'project' })
    } finally {
      rmSync(repoRoot, { recursive: true, force: true })
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('falls back to global policy when project policy is missing', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'sapper-core-policy-root-'))
    const home = mkdtempSync(join(tmpdir(), 'sapper-core-policy-home-'))

    try {
      const globalDir = join(home, '.sapperai')
      mkdirSync(globalDir, { recursive: true })
      writeFileSync(join(globalDir, 'policy.yaml'), 'mode: monitor\ndefaultAction: block\nfailOpen: false\n', 'utf8')

      const resolved = resolvePolicyPath({ repoRoot, homeDir: home })
      expect(resolved).toEqual({ path: join(globalDir, 'policy.yaml'), source: 'global' })
    } finally {
      rmSync(repoRoot, { recursive: true, force: true })
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('rejects project policy symlink that escapes repo root', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'sapper-core-policy-root-'))
    const outside = mkdtempSync(join(tmpdir(), 'sapper-core-policy-outside-'))

    try {
      const outsidePolicy = join(outside, 'outside.yaml')
      writeFileSync(outsidePolicy, 'mode: enforce\ndefaultAction: allow\nfailOpen: true\n', 'utf8')

      // Auto-discovered policy file is a symlink to a file outside the repo.
      symlinkSync(outsidePolicy, join(repoRoot, 'sapperai.config.yaml'))

      expect(() => resolvePolicyPath({ repoRoot })).toThrow(/Refusing auto-discovered policy symlink outside root/)
    } finally {
      rmSync(repoRoot, { recursive: true, force: true })
      rmSync(outside, { recursive: true, force: true })
    }
  })
})
