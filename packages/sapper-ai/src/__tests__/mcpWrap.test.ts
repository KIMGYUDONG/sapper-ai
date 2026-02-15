import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { unwrapMcpConfigFile, wrapMcpConfigFile } from '../mcp/wrapConfig'

describe('mcp wrap-config', () => {
  it('wraps and unwraps a JSONC config (roundtrip)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sapper-ai-mcp-wrap-'))
    try {
      const configPath = join(dir, 'config.json')

      const jsonc = [
        '{',
        '  // comment',
        '  "mcpServers": {',
        '    "example": {',
        '      "command": "node",',
        '      "args": ["server.js",],',
        '    },',
        '  },',
        '}',
        '',
      ].join('\n')

      writeFileSync(configPath, jsonc, 'utf8')

      const preview = await wrapMcpConfigFile({ filePath: configPath, mcpVersion: '0.2.1', format: 'jsonc', dryRun: true })
      expect(preview.changed).toBe(true)
      expect(preview.changedServers).toEqual(['example'])
      expect(preview.backupPath).toBeUndefined()
      expect(readFileSync(configPath, 'utf8')).toBe(jsonc)

      const wrapped = await wrapMcpConfigFile({ filePath: configPath, mcpVersion: '0.2.1', format: 'jsonc' })
      expect(wrapped.changed).toBe(true)
      expect(wrapped.changedServers).toEqual(['example'])
      expect(typeof wrapped.backupPath).toBe('string')
      expect(existsSync(wrapped.backupPath!)).toBe(true)

      const parsedWrapped = JSON.parse(readFileSync(configPath, 'utf8')) as any
      expect(parsedWrapped.mcpServers.example.command).toBe('npx')
      expect(parsedWrapped.mcpServers.example.args).toEqual([
        '-y',
        '--package',
        '@sapper-ai/mcp@0.2.1',
        'sapperai-proxy',
        '--',
        'node',
        'server.js',
      ])

      const noChange = await wrapMcpConfigFile({ filePath: configPath, mcpVersion: '0.2.1', format: 'jsonc' })
      expect(noChange.changed).toBe(false)

      const unwrapPreview = await unwrapMcpConfigFile({ filePath: configPath, format: 'jsonc', dryRun: true })
      expect(unwrapPreview.changed).toBe(true)
      expect(unwrapPreview.changedServers).toEqual(['example'])
      expect(readFileSync(configPath, 'utf8')).toContain('"sapperai-proxy"')

      const unwrapped = await unwrapMcpConfigFile({ filePath: configPath, format: 'jsonc' })
      expect(unwrapped.changed).toBe(true)
      expect(typeof unwrapped.backupPath).toBe('string')
      expect(existsSync(unwrapped.backupPath!)).toBe(true)

      const parsedUnwrapped = JSON.parse(readFileSync(configPath, 'utf8')) as any
      expect(parsedUnwrapped.mcpServers.example.command).toBe('node')
      expect(parsedUnwrapped.mcpServers.example.args).toEqual(['server.js'])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

