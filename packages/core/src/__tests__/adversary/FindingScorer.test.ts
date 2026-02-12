import { describe, expect, it } from 'vitest'

import { FindingScorer, type FindingScoreInput } from '../../adversary/FindingScorer'

const scorer = new FindingScorer()

describe('FindingScorer', () => {
  it('scores a blocked critical finding', () => {
    const input: FindingScoreInput = {
      outcome: 'blocked',
      risk: 0.9,
      confidence: 0.8,
      reproductionRate: 1,
      impact: 'critical',
    }
    const score = scorer.score(input)
    // severity = (0.9*0.5 + 0.8*0.3 + 1*0.2)*10 * 1 = (0.45+0.24+0.2)*10 = 8.9
    expect(score.severity10).toBeCloseTo(8.9, 1)
    // exposure = 8.9 * 0.35 = 3.115
    expect(score.exposure10).toBeCloseTo(3.12, 1)
  })

  it('scores an allowed critical finding with full exposure', () => {
    const input: FindingScoreInput = {
      outcome: 'allowed',
      risk: 0.9,
      confidence: 0.8,
      reproductionRate: 1,
      impact: 'critical',
    }
    const score = scorer.score(input)
    expect(score.severity10).toBeCloseTo(8.9, 1)
    // exposure = severity * 1 (allowed)
    expect(score.exposure10).toBeCloseTo(8.9, 1)
  })

  it('clamps severity at 10', () => {
    const input: FindingScoreInput = {
      outcome: 'allowed',
      risk: 1,
      confidence: 1,
      reproductionRate: 2,
      impact: 'critical',
    }
    const score = scorer.score(input)
    expect(score.severity10).toBe(10)
  })

  it('clamps severity at 0', () => {
    const input: FindingScoreInput = {
      outcome: 'allowed',
      risk: 0,
      confidence: 0,
      reproductionRate: 0,
      impact: 'low',
    }
    const score = scorer.score(input)
    expect(score.severity10).toBe(0)
    expect(score.exposure10).toBe(0)
  })

  it('uses correct impact weights', () => {
    const base = { outcome: 'allowed' as const, risk: 0, confidence: 0, reproductionRate: 1 }

    const critical = scorer.score({ ...base, impact: 'critical' })
    const high = scorer.score({ ...base, impact: 'high' })
    const medium = scorer.score({ ...base, impact: 'medium' })
    const low = scorer.score({ ...base, impact: 'low' })

    // Only impactWeight contributes: impactWeight * 0.2 * 10
    expect(critical.severity10).toBeCloseTo(2, 1) // 1 * 0.2 * 10
    expect(high.severity10).toBeCloseTo(1.6, 1)   // 0.8 * 0.2 * 10
    expect(medium.severity10).toBeCloseTo(1.1, 1)  // 0.55 * 0.2 * 10
    expect(low.severity10).toBeCloseTo(0.6, 1)     // 0.3 * 0.2 * 10
  })

  it('scales severity by reproductionRate', () => {
    const input: FindingScoreInput = {
      outcome: 'allowed',
      risk: 0.5,
      confidence: 0.5,
      reproductionRate: 0.5,
      impact: 'medium',
    }
    const full = scorer.score({ ...input, reproductionRate: 1 })
    const half = scorer.score({ ...input, reproductionRate: 0.5 })

    expect(half.severity10).toBeCloseTo(full.severity10 * 0.5, 1)
  })

  it('reduces exposure for blocked findings', () => {
    const input: FindingScoreInput = {
      outcome: 'blocked',
      risk: 0.8,
      confidence: 0.9,
      reproductionRate: 1,
      impact: 'high',
    }
    const score = scorer.score(input)
    expect(score.exposure10).toBeCloseTo(score.severity10 * 0.35, 1)
  })
})
