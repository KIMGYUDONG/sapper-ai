import { describe, expect, it, vi } from 'vitest'

import { runPostinstall } from '../postinstall'

describe('postinstall', () => {
  it('prints guidance message', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      runPostinstall()
      const output = logSpy.mock.calls.map((c) => String(c[0])).join('\n')
      expect(output).toMatch(/SapperAI installed\./)
      expect(output).toMatch(/npx sapper-ai scan/)
    } finally {
      logSpy.mockRestore()
    }
  })

  it('never throws', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    expect(() => runPostinstall()).not.toThrow()
    logSpy.mockRestore()
  })
})
