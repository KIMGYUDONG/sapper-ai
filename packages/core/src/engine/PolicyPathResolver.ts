import { existsSync, lstatSync, realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, relative, resolve, sep } from 'node:path'

export type PolicyPathSource = 'project' | 'global'

export interface ResolvedPolicyPath {
  path: string
  source: PolicyPathSource
}

export interface ResolvePolicyPathOptions {
  repoRoot: string
  homeDir?: string
}

const PROJECT_POLICY_FILES = ['sapperai.config.yaml', 'sapperai.config.yml'] as const

function isSubpath(parentDir: string, childPath: string): boolean {
  const rel = relative(parentDir, childPath)
  if (rel === '') return true
  if (rel === '..' || rel.startsWith(`..${sep}`)) return false
  // Defensive: relative() can return a path with a drive letter on Windows; treat those as not subpaths.
  if (rel.includes(':')) return false
  return true
}

function assertAutoDiscoveredPathStaysWithinRoot(candidatePath: string, allowedRoot: string): void {
  const stat = lstatSync(candidatePath)
  if (!stat.isSymbolicLink()) {
    return
  }

  const resolvedCandidate = realpathSync(candidatePath)
  const resolvedRoot = realpathSync(allowedRoot)

  if (!isSubpath(resolvedRoot, resolvedCandidate)) {
    throw new Error(
      `Refusing auto-discovered policy symlink outside root. path=${candidatePath} realpath=${resolvedCandidate} root=${resolvedRoot}`
    )
  }
}

export function resolvePolicyPath(options: ResolvePolicyPathOptions): ResolvedPolicyPath | null {
  const repoRoot = resolve(options.repoRoot)

  for (const name of PROJECT_POLICY_FILES) {
    const candidate = resolve(join(repoRoot, name))
    if (!existsSync(candidate)) continue

    assertAutoDiscoveredPathStaysWithinRoot(candidate, repoRoot)
    return { path: candidate, source: 'project' }
  }

  const home = options.homeDir ?? homedir()
  const globalRoot = resolve(join(home, '.sapperai'))
  const globalCandidate = resolve(join(globalRoot, 'policy.yaml'))
  if (!existsSync(globalCandidate)) {
    return null
  }

  // If the policy file is a symlink, ensure it doesn't escape the ~/.sapperai/ directory.
  assertAutoDiscoveredPathStaysWithinRoot(globalCandidate, dirname(globalCandidate))
  return { path: globalCandidate, source: 'global' }
}

