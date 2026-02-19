import { resolve } from 'node:path'

const DEFAULT_CONFIG = 'sapperai.config.yaml'
const DEFAULT_AUDIT_LOG = 'sapperai-audit.jsonl'
const SERVERLESS_WRITABLE_DIR = '/tmp'

function shouldUseTmpDir(): boolean {
  return (
    process.cwd().startsWith('/var/task') ||
    process.env.VERCEL === '1' ||
    typeof process.env.AWS_LAMBDA_FUNCTION_NAME === 'string'
  )
}

function resolveDefaultPath(fileName: string): string {
  return shouldUseTmpDir() ? resolve(SERVERLESS_WRITABLE_DIR, fileName) : resolve(process.cwd(), fileName)
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
