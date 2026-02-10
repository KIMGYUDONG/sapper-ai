import { describe, it, expect } from 'vitest'
import { mcpVersion } from '../index'

describe('@sapper-ai/mcp', () => {
  it('should export mcpVersion from core', () => {
    expect(mcpVersion).toBe('0.1.0')
  })
})
