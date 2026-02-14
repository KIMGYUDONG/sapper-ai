import { describe, expect, it } from 'vitest'

import * as sapperAi from '../index'

describe('exports completeness', () => {
  it.each([
    ['createGuard'],
    ['presets'],
    ['Guard'],
    ['DecisionEngine'],
    ['RulesDetector'],
    ['LlmDetector'],
    ['ThreatIntelDetector'],
    ['createDetectors'],
    ['AuditLogger'],
    ['PolicyManager'],
    ['validatePolicy'],
    ['Scanner'],
    ['QuarantineManager'],
    ['ThreatIntelStore'],
  ])('%s is exported and defined', (name) => {
    expect(sapperAi[name as keyof typeof sapperAi]).toBeDefined()
  })
})
