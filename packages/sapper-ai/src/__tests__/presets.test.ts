import { describe, expect, it } from 'vitest'

import { validatePolicy } from '@sapper-ai/core'

import { presets } from '../presets'

describe('presets', () => {
  it('each preset has name/description/policy and valid policy fields', () => {
    for (const [key, preset] of Object.entries(presets)) {
      expect(preset.name).toBe(key)
      expect(typeof preset.description).toBe('string')
      expect(preset.description.length).toBeGreaterThan(0)

      expect(preset.policy.mode === 'monitor' || preset.policy.mode === 'enforce').toBe(true)
      expect(preset.policy.defaultAction === 'allow' || preset.policy.defaultAction === 'block').toBe(true)
      expect(typeof preset.policy.failOpen).toBe('boolean')

      const thresholds = preset.policy.thresholds
      if (thresholds?.riskThreshold !== undefined) {
        expect(thresholds.riskThreshold).toBeGreaterThanOrEqual(0)
        expect(thresholds.riskThreshold).toBeLessThanOrEqual(1)
      }
      if (thresholds?.blockMinConfidence !== undefined) {
        expect(thresholds.blockMinConfidence).toBeGreaterThanOrEqual(0)
        expect(thresholds.blockMinConfidence).toBeLessThanOrEqual(1)
      }

      expect(() => validatePolicy(preset.policy)).not.toThrow()
    }
  })

  it('monitor/development presets use monitor mode; others enforce mode', () => {
    expect(presets.monitor.policy.mode).toBe('monitor')
    expect(presets.development.policy.mode).toBe('monitor')

    expect(presets.standard.policy.mode).toBe('enforce')
    expect(presets.strict.policy.mode).toBe('enforce')
    expect(presets.paranoid.policy.mode).toBe('enforce')
    expect(presets.ci.policy.mode).toBe('enforce')
  })

  it('strict/paranoid/ci presets are fail closed', () => {
    expect(presets.strict.policy.failOpen).toBe(false)
    expect(presets.paranoid.policy.failOpen).toBe(false)
    expect(presets.ci.policy.failOpen).toBe(false)
  })

  it('paranoid preset includes llm detector and development has highest thresholds', () => {
    expect(presets.paranoid.policy.detectors).toContain('llm')

    expect(presets.development.policy.thresholds?.riskThreshold).toBe(0.9)
    expect(presets.development.policy.thresholds?.blockMinConfidence).toBe(0.8)
  })
})
