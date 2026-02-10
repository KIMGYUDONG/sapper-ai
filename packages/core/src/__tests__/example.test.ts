import { describe, it, expect } from 'vitest'
import { coreVersion } from '../index'

describe('@sapper-ai/core', () => {
  it('should export coreVersion from types', () => {
    expect(coreVersion).toBe('0.1.0')
  })
})
