import { describe, expect, it } from 'vitest'

import type { Policy } from '@sapper-ai/types'

import { applyThreatIntelBlocklist } from '../../engine/ThreatIntelPolicy'
import type { ThreatIntelEntry } from '../../intel/ThreatIntelStore'

const basePolicy: Policy = {
  mode: 'enforce',
  defaultAction: 'allow',
  failOpen: true,
}

function createEntry(overrides: Partial<ThreatIntelEntry> = {}): ThreatIntelEntry {
  return {
    id: 'test-entry',
    type: 'toolName',
    value: 'malicious-tool',
    reason: 'Known malicious',
    severity: 'high',
    source: 'test',
    addedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('applyThreatIntelBlocklist', () => {
  it('returns original policy when no entries', () => {
    const result = applyThreatIntelBlocklist(basePolicy, [])
    expect(result).toBe(basePolicy)
  })

  it('merges toolName entries into blocklist', () => {
    const entries = [createEntry({ type: 'toolName', value: 'evil-tool' })]
    const result = applyThreatIntelBlocklist(basePolicy, entries)
    expect(result.blocklist?.toolNames).toContain('evil-tool')
  })

  it('merges packageName entries into blocklist', () => {
    const entries = [createEntry({ type: 'packageName', value: 'evil-pkg' })]
    const result = applyThreatIntelBlocklist(basePolicy, entries)
    expect(result.blocklist?.packageNames).toContain('evil-pkg')
  })

  it('merges urlPattern entries into blocklist', () => {
    const entries = [createEntry({ type: 'urlPattern', value: 'evil\\.com' })]
    const result = applyThreatIntelBlocklist(basePolicy, entries)
    expect(result.blocklist?.urlPatterns).toContain('evil\\.com')
  })

  it('merges contentPattern entries into blocklist', () => {
    const entries = [createEntry({ type: 'contentPattern', value: 'malware.*payload' })]
    const result = applyThreatIntelBlocklist(basePolicy, entries)
    expect(result.blocklist?.contentPatterns).toContain('malware.*payload')
  })

  it('merges sha256 entries into blocklist', () => {
    const entries = [createEntry({ type: 'sha256', value: 'abc123' })]
    const result = applyThreatIntelBlocklist(basePolicy, entries)
    expect(result.blocklist?.sha256).toContain('abc123')
  })

  it('preserves existing blocklist entries', () => {
    const policy = {
      ...basePolicy,
      blocklist: { toolNames: ['existing-tool'] },
    } as Policy
    const entries = [createEntry({ type: 'toolName', value: 'new-tool' })]
    const result = applyThreatIntelBlocklist(policy, entries)
    expect(result.blocklist?.toolNames).toContain('existing-tool')
    expect(result.blocklist?.toolNames).toContain('new-tool')
  })

  it('deduplicates merged entries', () => {
    const policy = {
      ...basePolicy,
      blocklist: { toolNames: ['dup-tool'] },
    } as Policy
    const entries = [createEntry({ type: 'toolName', value: 'dup-tool' })]
    const result = applyThreatIntelBlocklist(policy, entries)
    const toolNames = result.blocklist?.toolNames ?? []
    expect(toolNames.filter((t) => t === 'dup-tool')).toHaveLength(1)
  })

  it('merges multiple entry types at once', () => {
    const entries = [
      createEntry({ id: '1', type: 'toolName', value: 'evil-tool' }),
      createEntry({ id: '2', type: 'packageName', value: 'evil-pkg' }),
      createEntry({ id: '3', type: 'sha256', value: 'deadbeef' }),
    ]
    const result = applyThreatIntelBlocklist(basePolicy, entries)
    expect(result.blocklist?.toolNames).toContain('evil-tool')
    expect(result.blocklist?.packageNames).toContain('evil-pkg')
    expect(result.blocklist?.sha256).toContain('deadbeef')
  })
})
