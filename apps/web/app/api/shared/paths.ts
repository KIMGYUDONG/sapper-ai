import * as fs from 'node:fs'
import * as path from 'node:path'

const DEFAULT_CONFIG = 'sapperai.config.yaml'
const DEFAULT_AUDIT_LOG = 'sapperai-audit.jsonl'
const SERVERLESS_WRITABLE_DIR = '/tmp'

function shouldUseTmpDir(): boolean {
  if (
    process.cwd().startsWith('/var/task') ||
    process.env.VERCEL !== undefined ||
    process.env.NEXT_RUNTIME === 'nodejs' ||
    typeof process.env.AWS_LAMBDA_FUNCTION_NAME === 'string'
  ) {
    return true
  }

  // Fallback: test if cwd is writable
  try {
    const testPath = path.resolve(process.cwd(), '.write-test')
    fs.writeFileSync(testPath, '')
    fs.unlinkSync(testPath)
    return false
  } catch {
    return true
  }
}

function resolveDefaultPath(fileName: string): string {
  return shouldUseTmpDir() ? path.resolve(SERVERLESS_WRITABLE_DIR, fileName) : path.resolve(process.cwd(), fileName)
}

export function getConfigPath(): string {
  return process.env.SAPPERAI_CONFIG_PATH ?? resolveDefaultPath(DEFAULT_CONFIG)
}

export function getAuditLogPath(): string {
  return process.env.SAPPERAI_AUDIT_LOG_PATH ?? resolveDefaultPath(DEFAULT_AUDIT_LOG)
}

export function getIntelCachePath(): string | undefined {
  return process.env.SAPPERAI_THREAT_FEED_CACHE ?? undefined
}
