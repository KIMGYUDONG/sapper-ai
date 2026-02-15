import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import type { Policy } from '@sapper-ai/types'

import {
  runBlocklistCheckCommand,
  runBlocklistListCommand,
  runBlocklistStatusCommand,
  runBlocklistSyncCommand,
} from '../commands/blocklist'

const policy: Policy = {
  mode: 'enforce',
  defaultAction: 'allow',
  failOpen: true,
  threatFeed: {
    enabled: true,
  },
} as Policy

describe('blocklist commands', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('sync/status/list/check flow works with cache file', async () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'sapper-blocklist-cmd-'))
    tempDirs.push(rootDir)
    const cachePath = join(rootDir, 'intel.json')

    const source = 'https://threat-feed.test/feed'
    const fetchImpl: typeof fetch = async (input) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url

      if (url === source) {
        return new Response(
          JSON.stringify({
            entries: [
              {
                id: 'ghsa-test-001',
                type: 'packageName',
                value: 'malicious-package',
                reason: 'Known malicious package',
                severity: 'critical',
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }

      return new Response('not found', { status: 404 })
    }

    const syncOutputs: string[] = []
    await runBlocklistSyncCommand({
      policy,
      sources: [source],
      cachePath,
      fetchImpl,
      write: (text) => syncOutputs.push(text),
    })
    const syncPayload = JSON.parse(syncOutputs.join('')) as { acceptedEntries: number }
    expect(syncPayload.acceptedEntries).toBe(1)

    const statusOutputs: string[] = []
    await runBlocklistStatusCommand({
      cachePath,
      write: (text) => statusOutputs.push(text),
    })
    const statusPayload = JSON.parse(statusOutputs.join('')) as { count: number }
    expect(statusPayload.count).toBe(1)

    const listOutputs: string[] = []
    await runBlocklistListCommand({
      cachePath,
      write: (text) => listOutputs.push(text),
    })
    const listPayload = JSON.parse(listOutputs.join('')) as { entries: Array<{ id: string }> }
    expect(listPayload.entries[0]?.id).toBe('ghsa-test-001')

    const checkOutputs: string[] = []
    await runBlocklistCheckCommand({
      cachePath,
      indicator: 'malicious-package',
      write: (text) => checkOutputs.push(text),
    })
    const checkPayload = JSON.parse(checkOutputs.join('')) as { matched: boolean }
    expect(checkPayload.matched).toBe(true)
  })
})
