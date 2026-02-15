import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

export function findRepoRoot(startDir: string): string {
  const start = resolve(startDir)

  let current = start
  while (true) {
    const gitPath = resolve(current, '.git')
    if (existsSync(gitPath)) {
      return current
    }

    const parent = dirname(current)
    if (parent === current) {
      return start
    }

    current = parent
  }
}

