import { describe, expect, it } from 'vitest'

import type { Policy } from '@sapper-ai/types'

import { createDetectors } from '../../engine/DetectorFactory'
import type { ThreatIntelEntry } from '../../intel/ThreatIntelStore'

const basePolicy: Policy = {
  mode: 'enforce',
  defaultAction: 'allow',
  failOpen: true,
}

const mockEntry: ThreatIntelEntry = {
  id: 'test-entry',
  type: 'toolName',
  value: 'malicious-tool',
  reason: 'Known malicious',
  severity: 'high',
  source: 'test',
  addedAt: new Date().toISOString(),
}

describe('createDetectors', () => {
  it('creates RulesDetector by default', () => {
    const detectors = createDetectors({ policy: basePolicy })
    expect(detectors).toHaveLength(1)
    expect(detectors[0]!.id).toBe('rules')
  })

  it('creates ThreatIntelDetector when entries provided', () => {
    const detectors = createDetectors({
      policy: basePolicy,
      threatIntelEntries: [mockEntry],
    })
    expect(detectors[0]!.id).toBe('threat-intel')
    expect(detectors[1]!.id).toBe('rules')
  })

  it('skips ThreatIntelDetector when entries empty', () => {
    const detectors = createDetectors({
      policy: basePolicy,
      threatIntelEntries: [],
    })
    expect(detectors.every((d) => d.id !== 'threat-intel')).toBe(true)
  })

  it('respects preferredDetectors', () => {
    const detectors = createDetectors({
      policy: basePolicy,
      preferredDetectors: ['rules', 'llm'],
    })
    const ids = detectors.map((d) => d.id)
    expect(ids).toContain('rules')
    expect(ids).toContain('llm')
  })

  it('falls back to RulesDetector when no detectors created', () => {
    const detectors = createDetectors({
      policy: basePolicy,
      preferredDetectors: [],
    })
    expect(detectors).toHaveLength(1)
    expect(detectors[0]!.id).toBe('rules')
  })

  it('creates LlmDetector with policy.llm config', () => {
    const policyWithLlm: Policy = {
      ...basePolicy,
      llm: { provider: 'openai', apiKey: 'test-key' },
    }
    const detectors = createDetectors({
      policy: policyWithLlm,
      preferredDetectors: ['llm'],
    })
    expect(detectors.some((d) => d.id === 'llm')).toBe(true)
  })

  it('uses policy.detectors when preferredDetectors not provided', () => {
    const policyWithDetectors = {
      ...basePolicy,
      detectors: ['rules'],
    } as Policy & { detectors: string[] }
    const detectors = createDetectors({ policy: policyWithDetectors })
    expect(detectors).toHaveLength(1)
    expect(detectors[0]!.id).toBe('rules')
  })
})
