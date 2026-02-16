import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Policy } from '@sapper-ai/types'

import { AdversaryCampaignRunner } from '../services/AdversaryCampaignRunner'
import * as threatIntel from '../services/threatIntel'

const basePolicy: Policy = {
  mode: 'enforce',
  defaultAction: 'allow',
  failOpen: true,
}

describe('AdversaryCampaignRunner assessInMemory', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    vi.restoreAllMocks()
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('returns expected shape without writing campaign artifacts', async () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'sapper-adversary-inmem-'))
    tempDirs.push(rootDir)

    const beforeEntries = readdirSync(rootDir).sort()
    const runner = new AdversaryCampaignRunner()
    const result = await runner.assessInMemory({
      policy: basePolicy,
      target: {
        id: 'watch:plugin-alpha',
        sourcePath: join(rootDir, 'plugin.json'),
        sourceType: 'plugin',
        surface: '{"name":"plugin-alpha","safe":true}',
      },
      maxCases: 4,
      seed: 'shape-test',
    })
    const afterEntries = readdirSync(rootDir).sort()

    expect(result.totalCases).toBeGreaterThan(0)
    expect(result.vulnerableCases).toBeGreaterThanOrEqual(0)
    expect(result.vulnerableCases).toBe(result.findings.length)
    expect(result.vulnerable).toBe(result.vulnerableCases > 0)
    expect(afterEntries).toEqual(beforeEntries)
    if (result.findings.length > 0) {
      expect(result.findings[0]?.reproPath).toBe('in-memory')
    }
  })

  it('uses enforce semantics for vulnerability classification even with monitor policy', async () => {
    const runner = new AdversaryCampaignRunner()
    const target = {
      id: 'watch:mcp-server-alpha',
      sourcePath: '/tmp/config.mcp.json',
      sourceType: 'mcp_server',
      surface: '{"mcpServers":{"alpha":{"command":"node","args":["server.js"]}}}',
    }

    const monitorResult = await runner.assessInMemory({
      policy: {
        ...basePolicy,
        mode: 'monitor',
      } as Policy,
      target,
      maxCases: 4,
      seed: 'mode-test',
    })

    const enforceResult = await runner.assessInMemory({
      policy: {
        ...basePolicy,
        mode: 'enforce',
      } as Policy,
      target,
      maxCases: 4,
      seed: 'mode-test',
    })

    expect(monitorResult.totalCases).toBe(enforceResult.totalCases)
    expect(monitorResult.vulnerableCases).toBe(enforceResult.vulnerableCases)
    expect(monitorResult.vulnerable).toBe(true)
  })

  it('defaults to skipSync=true when loading threat intel for in-memory assessment', async () => {
    const loadThreatIntelEntriesSpy = vi
      .spyOn(threatIntel, 'loadThreatIntelEntries')
      .mockResolvedValue([])
    const runner = new AdversaryCampaignRunner()

    await runner.assessInMemory({
      policy: {
        ...basePolicy,
        threatFeed: {
          enabled: true,
          autoSync: true,
          sources: ['https://threat-feed.test/unreachable'],
        },
      } as Policy,
      target: {
        id: 'watch:config-alpha',
        sourcePath: '/tmp/config.json',
        sourceType: 'config',
        surface: '{"safe":true}',
      },
      maxCases: 1,
      seed: 'skip-sync-test',
    })

    expect(loadThreatIntelEntriesSpy).toHaveBeenCalledTimes(1)
    const callOptions = loadThreatIntelEntriesSpy.mock.calls[0]?.[2]
    expect(callOptions).toMatchObject({
      skipSync: true,
    })
  })

  it('uses watch-aligned defaults when in-memory limits are omitted', async () => {
    const runner = new AdversaryCampaignRunner()
    const result = await runner.assessInMemory({
      policy: basePolicy,
      target: {
        id: 'watch:default-budget',
        sourcePath: '/tmp/default-budget.json',
        sourceType: 'config',
        surface: '{"safe":true}',
      },
    })

    expect(result.totalCases).toBeLessThanOrEqual(8)
  })

  it('strips allowlist when normalizing policy for in-memory enforce evaluation', () => {
    const runner = new AdversaryCampaignRunner()
    const internal = runner as unknown as {
      toEnforcePolicy: (policy: Policy) => Policy & { allowlist?: unknown }
    }

    const normalized = internal.toEnforcePolicy({
      ...basePolicy,
      mode: 'monitor',
      allowlist: {
        contentPatterns: ['.*'],
      },
    } as Policy)

    expect(normalized.mode).toBe('enforce')
    expect(normalized.allowlist).toBeUndefined()
  })
})
