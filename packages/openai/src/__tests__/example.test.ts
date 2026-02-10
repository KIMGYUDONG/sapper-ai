import { describe, it, expect } from 'vitest'
import { openaiVersion } from '../index'

describe('@sapper-ai/openai', () => {
  it('should export openaiVersion from core', () => {
    expect(openaiVersion).toBe('0.1.0')
  })
})
