import type { Policy } from '@sapper-ai/types'

import { buildMatchListFromIntel, type ThreatIntelEntry } from '../intel/ThreatIntelStore'

function mergeUnique(left: string[] | undefined, right: string[] | undefined): string[] | undefined {
  const values = [...(left ?? []), ...(right ?? [])]
  if (values.length === 0) {
    return undefined
  }

  return Array.from(new Set(values))
}

export function applyThreatIntelBlocklist(policy: Policy, entries: ThreatIntelEntry[]): Policy {
  if (entries.length === 0) {
    return policy
  }

  const intel = buildMatchListFromIntel(entries)
  const extended = policy as Policy & {
    blocklist?: {
      toolNames?: string[]
      packageNames?: string[]
      urlPatterns?: string[]
      contentPatterns?: string[]
      sha256?: string[]
    }
  }

  return {
    ...policy,
    blocklist: {
      toolNames: mergeUnique(extended.blocklist?.toolNames, intel.toolNames),
      packageNames: mergeUnique(extended.blocklist?.packageNames, intel.packageNames),
      urlPatterns: mergeUnique(extended.blocklist?.urlPatterns, intel.urlPatterns),
      contentPatterns: mergeUnique(extended.blocklist?.contentPatterns, intel.contentPatterns),
      sha256: mergeUnique(extended.blocklist?.sha256, intel.sha256),
    },
  } as Policy
}
