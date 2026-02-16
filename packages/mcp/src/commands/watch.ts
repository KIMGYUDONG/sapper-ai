import { AuditLogger } from '@sapper-ai/core'
import type { Policy } from '@sapper-ai/types'

import { FileWatcher } from '../services/FileWatcher'

interface WatchCommandDynamicOptions {
  enabled: boolean
  maxCases: number
  maxDurationMs: number
  seed: string
}

interface WatchCommandOptions {
  policy: Policy
  watchPaths?: string[]
  dynamic?: WatchCommandDynamicOptions
  env?: NodeJS.ProcessEnv
}

export async function runWatchCommand(options: WatchCommandOptions): Promise<void> {
  const env = options.env ?? process.env
  const auditLogger = new AuditLogger({ filePath: env.SAPPERAI_AUDIT_LOG_PATH ?? '/tmp/sapperai-proxy.audit.log' })
  const dynamic = options.dynamic ?? {
    enabled: false,
    maxCases: 8,
    maxDurationMs: 1500,
    seed: 'watch-default',
  }

  const watcherOptions: ConstructorParameters<typeof FileWatcher>[0] = {
    policy: options.policy,
    auditLogger,
    watchPaths: options.watchPaths,
    dynamic,
  }
  const watcher = new FileWatcher(watcherOptions)

  const closeWatcher = async () => {
    await watcher.close()
    process.exit(0)
  }

  process.once('SIGINT', () => {
    void closeWatcher()
  })

  process.once('SIGTERM', () => {
    void closeWatcher()
  })

  await watcher.start()
}
