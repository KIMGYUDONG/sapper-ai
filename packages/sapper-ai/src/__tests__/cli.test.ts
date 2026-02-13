import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import { PolicyManager } from '@sapper-ai/core'

async function loadCliWithAnswers(answers: string[]) {
  vi.resetModules()

  vi.doMock('node:readline', () => {
    return {
      createInterface: () => {
        return {
          question: (_q: string, cb: (answer: string) => void) => {
            cb(answers.shift() ?? '')
          },
          close: () => {},
        }
      },
    }
  })

  return import('../cli')
}

describe('sapper-ai cli', () => {
  it('--help prints usage and returns exit code 0', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      const { runCli } = await loadCliWithAnswers([])
      const code = await runCli(['--help'])
      expect(code).toBe(0)
      const output = logSpy.mock.calls.map((c) => String(c[0])).join('\n')
      expect(output).toMatch(/Usage:/)
      expect(output).toMatch(/sapper-ai init/)
    } finally {
      logSpy.mockRestore()
    }
  })

  it('no args returns exit code 1', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      const { runCli } = await loadCliWithAnswers([])
      const code = await runCli([])
      expect(code).toBe(1)
      const output = logSpy.mock.calls.map((c) => String(c[0])).join('\n')
      expect(output).toMatch(/Usage:/)
    } finally {
      logSpy.mockRestore()
    }
  })

  it('init generates sapperai.config.yaml and it loads via PolicyManager', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sapper-ai-cli-'))
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(dir)
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    try {
      const { runCli } = await loadCliWithAnswers(['2', ''])
      const code = await runCli(['init'])
      expect(code).toBe(0)

      const yamlPath = join(dir, 'sapperai.config.yaml')
      const yaml = readFileSync(yamlPath, 'utf8')
      expect(yaml).toMatch(/mode: enforce/)
      expect(yaml).toMatch(/defaultAction: allow/)

      const policy = new PolicyManager().loadFromFile(yamlPath)
      expect(policy.mode).toBe('enforce')
    } finally {
      logSpy.mockRestore()
      cwdSpy.mockRestore()
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('init overwrite prompt abort does not modify file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sapper-ai-cli-overwrite-'))
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(dir)
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    try {
      const yamlPath = join(dir, 'sapperai.config.yaml')
      const original = 'mode: enforce\ndefaultAction: allow\nfailOpen: true\n'
      writeFileSync(yamlPath, original, 'utf8')

      const { runCli } = await loadCliWithAnswers(['2', '', 'n'])
      const code = await runCli(['init'])
      expect(code).toBe(0)
      const after = readFileSync(yamlPath, 'utf8')
      expect(after).toBe(original)
    } finally {
      logSpy.mockRestore()
      cwdSpy.mockRestore()
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('selected preset values appear in generated YAML', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sapper-ai-cli-preset-'))
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(dir)
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    try {
      const { runCli } = await loadCliWithAnswers(['3', ''])
      const code = await runCli(['init'])
      expect(code).toBe(0)

      const yamlPath = join(dir, 'sapperai.config.yaml')
      const yaml = readFileSync(yamlPath, 'utf8')
      expect(yaml).toMatch(/riskThreshold: 0.5/)
      expect(yaml).toMatch(/blockMinConfidence: 0.3/)
    } finally {
      logSpy.mockRestore()
      cwdSpy.mockRestore()
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
