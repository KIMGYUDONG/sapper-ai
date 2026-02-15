import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { ThreatIntelStore, buildMatchListFromIntel } from '../../intel/ThreatIntelStore'

describe('ThreatIntelStore', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('syncs entries from remote source and persists snapshot', async () => {
    const root = mkdtempSync(join(tmpdir(), 'intel-store-'))
    tempDirs.push(root)

    const feedUrl = 'https://threat-feed.test/feed'
    const fetchImpl: typeof fetch = async (input) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url

      if (url === feedUrl) {
        return new Response(
          JSON.stringify({
            entries: [
              {
                id: 'malicious-tool-1',
                type: 'toolName',
                value: 'evil_tool',
                reason: 'Known malware',
                severity: 'critical',
              },
              {
                type: 'urlPattern',
                value: 'evil\\.example',
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }

      return new Response('not found', { status: 404 })
    }

    const store = new ThreatIntelStore({
      cachePath: join(root, 'intel.json'),
      fetchImpl,
    })

    const syncResult = await store.syncFromSources([feedUrl])
    expect(syncResult.acceptedEntries).toBe(2)

    const snapshot = await store.loadSnapshot()
    expect(snapshot.entries).toHaveLength(2)
    expect(snapshot.entries[0]?.id).toBe('malicious-tool-1')

    const matchList = buildMatchListFromIntel(snapshot.entries)
    expect(matchList.toolNames).toContain('evil_tool')
    expect(matchList.urlPatterns).toContain('evil\\.example')
  })

  it('preserves existing cached entries when syncing new feed entries', async () => {
    const root = mkdtempSync(join(tmpdir(), 'intel-merge-'))
    tempDirs.push(root)

    const feedUrl = 'https://threat-feed.test/merge-feed'
    const fetchImpl: typeof fetch = async (input) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url

      if (url === feedUrl) {
        return new Response(
          JSON.stringify({
            entries: [
              {
                id: 'new-entry',
                type: 'packageName',
                value: 'new_package',
                reason: 'new',
                severity: 'critical',
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }

      return new Response('not found', { status: 404 })
    }

    const store = new ThreatIntelStore({
      cachePath: join(root, 'intel.json'),
      fetchImpl,
    })

    await store.saveSnapshot({
      version: 1,
      updatedAt: new Date().toISOString(),
      entries: [
        {
          id: 'cached-entry',
          type: 'toolName',
          value: 'persist_me',
          reason: 'cached',
          severity: 'high',
          source: 'seed',
          addedAt: new Date().toISOString(),
        },
      ],
    })

    await store.syncFromSources([feedUrl])
    const snapshot = await store.loadSnapshot()

    expect(snapshot.entries.some((entry) => entry.id === 'cached-entry')).toBe(true)
    expect(snapshot.entries.some((entry) => entry.id === 'new-entry')).toBe(true)
  })
})
