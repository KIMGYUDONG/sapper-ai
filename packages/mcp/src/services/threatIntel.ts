import type { Policy } from '@sapper-ai/types'

import { ThreatIntelStore } from '@sapper-ai/core'

export type ThreatIntelEntry = {
  id: string
  type: 'toolName' | 'packageName' | 'urlPattern' | 'contentPattern' | 'sha256'
  value: string
  reason: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  source: string
  addedAt: string
  expiresAt?: string
}

export async function loadThreatIntelEntries(
  policy: Policy,
  defaultStore: ThreatIntelStore,
  options: {
    skipSync?: boolean
  } = {}
): Promise<ThreatIntelEntry[]> {
  const extended = policy as Policy & {
    threatFeed?: {
      enabled?: boolean
      sources?: string[]
      autoSync?: boolean
      failOpen?: boolean
      cachePath?: string
    }
  }

  const feed = extended.threatFeed
  if (!feed?.enabled) {
    return []
  }

  const store = feed.cachePath ? new ThreatIntelStore({ cachePath: feed.cachePath }) : defaultStore
  if (!options.skipSync && feed.autoSync && Array.isArray(feed.sources) && feed.sources.length > 0) {
    await store.syncFromSources(feed.sources)
  }

  const snapshot = await store.loadSnapshot()
  return snapshot.entries
}
