import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'

import { atomicWriteFile, backupFile, readFileIfExists } from '../utils/fs'
import { isSemver } from '../utils/semver'

import { parseJsonc } from './jsonc'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string')
}

export function checkNpxAvailable(): boolean {
  try {
    const result = spawnSync('npx', ['--version'], { stdio: 'ignore' })
    return result.status === 0
  } catch {
    return false
  }
}

export function resolveInstalledPackageVersion(packageName: string): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pkg = require(`${packageName}/package.json`) as { version?: unknown }
    const version = typeof pkg.version === 'string' ? pkg.version : null
    return version && version.length > 0 ? version : null
  } catch {
    return null
  }
}

function isWrappedBySapperProxy(command: unknown, args: unknown): boolean {
  if (command !== 'npx') return false
  if (!isStringArray(args)) return false

  if (args.length < 6) return false
  if (!(args[0] === '-y' || args[0] === '--yes')) return false
  if (args[1] !== '--package') return false
  if (typeof args[2] !== 'string' || !args[2].startsWith('@sapper-ai/mcp@')) return false
  if (args[3] !== 'sapperai-proxy') return false

  const sepIndex = args.indexOf('--')
  return sepIndex >= 0 && sepIndex + 1 < args.length
}

function buildWrappedCommand(originalCommand: string, originalArgs: string[], mcpVersion: string): { command: string; args: string[] } {
  return {
    command: 'npx',
    args: ['-y', '--package', `@sapper-ai/mcp@${mcpVersion}`, 'sapperai-proxy', '--', originalCommand, ...originalArgs],
  }
}

function unwrapWrappedCommand(args: string[]): { command: string; args: string[] } | null {
  const sepIndex = args.indexOf('--')
  if (sepIndex < 0) return null

  const originalCommand = args[sepIndex + 1]
  if (!originalCommand) return null

  const originalArgs = args.slice(sepIndex + 2)
  return { command: originalCommand, args: originalArgs }
}

export interface WrapMcpConfigOptions {
  filePath: string
  mcpVersion: string
  format?: 'json' | 'jsonc'
  dryRun?: boolean
}

export interface WrapMcpConfigResult {
  changed: boolean
  changedServers: string[]
  backupPath?: string
  restoredFromBackupPath?: string
}

export async function wrapMcpConfigFile(options: WrapMcpConfigOptions): Promise<WrapMcpConfigResult> {
  if (!isSemver(options.mcpVersion)) {
    throw new Error(`Invalid MCP version (expected semver): ${options.mcpVersion}`)
  }
  if (!existsSync(options.filePath)) {
    throw new Error(`Config file not found: ${options.filePath}`)
  }

  const raw = await readFileIfExists(options.filePath)
  if (raw === null) {
    throw new Error(`Unable to read config file: ${options.filePath}`)
  }

  const parsed = options.format === 'jsonc' ? (parseJsonc(raw) as unknown) : (JSON.parse(raw) as unknown)
  if (!isRecord(parsed)) {
    throw new Error(`Invalid config format (expected object): ${options.filePath}`)
  }

  const mcpServers = parsed.mcpServers
  if (!isRecord(mcpServers)) {
    return { changed: false, changedServers: [] }
  }

  const changedServers: string[] = []

  for (const [name, config] of Object.entries(mcpServers)) {
    if (!isRecord(config)) continue

    const command = config.command
    const args = config.args
    if (typeof command !== 'string') continue
    const argList = isStringArray(args) ? args : []

    if (isWrappedBySapperProxy(command, argList)) {
      continue
    }

    const wrapped = buildWrappedCommand(command, argList, options.mcpVersion)
    config.command = wrapped.command
    config.args = wrapped.args
    changedServers.push(name)
  }

  if (changedServers.length === 0) {
    return { changed: false, changedServers: [] }
  }

  if (options.dryRun === true) {
    return { changed: true, changedServers }
  }

  const backupPath = await backupFile(options.filePath)
  await atomicWriteFile(options.filePath, `${JSON.stringify(parsed, null, 2)}\n`)
  return { changed: true, changedServers, backupPath }
}

export interface UnwrapMcpConfigOptions {
  filePath: string
  format?: 'json' | 'jsonc'
  dryRun?: boolean
}

export async function unwrapMcpConfigFile(options: UnwrapMcpConfigOptions): Promise<WrapMcpConfigResult> {
  if (!existsSync(options.filePath)) {
    throw new Error(`Config file not found: ${options.filePath}`)
  }

  const raw = await readFileIfExists(options.filePath)
  if (raw === null) {
    throw new Error(`Unable to read config file: ${options.filePath}`)
  }

  let parsed: unknown
  try {
    parsed = options.format === 'jsonc' ? (parseJsonc(raw) as unknown) : (JSON.parse(raw) as unknown)
  } catch (error) {
    const restoredFromBackupPath = findLatestBackupPath(options.filePath)
    if (!restoredFromBackupPath) {
      throw error
    }

    if (options.dryRun === true) {
      return { changed: true, changedServers: [], restoredFromBackupPath }
    }

    const backupPath = await backupFile(options.filePath)
    const backupRaw = await readFileIfExists(restoredFromBackupPath)
    if (backupRaw === null) {
      throw error
    }

    await atomicWriteFile(options.filePath, backupRaw)
    return { changed: true, changedServers: [], backupPath, restoredFromBackupPath }
  }
  if (!isRecord(parsed)) {
    throw new Error(`Invalid config format (expected object): ${options.filePath}`)
  }

  const mcpServers = parsed.mcpServers
  if (!isRecord(mcpServers)) {
    return { changed: false, changedServers: [] }
  }

  const changedServers: string[] = []

  for (const [name, config] of Object.entries(mcpServers)) {
    if (!isRecord(config)) continue
    const command = config.command
    const args = config.args

    if (!isWrappedBySapperProxy(command, args)) {
      continue
    }

    const unwrapped = unwrapWrappedCommand(args as string[])
    if (!unwrapped) continue

    config.command = unwrapped.command
    config.args = unwrapped.args
    changedServers.push(name)
  }

  if (changedServers.length === 0) {
    return { changed: false, changedServers: [] }
  }

  if (options.dryRun === true) {
    return { changed: true, changedServers }
  }

  const backupPath = await backupFile(options.filePath)
  await atomicWriteFile(options.filePath, `${JSON.stringify(parsed, null, 2)}\n`)
  return { changed: true, changedServers, backupPath }
}

function findLatestBackupPath(originalPath: string): string | null {
  let latest: string | null = null

  const first = `${originalPath}.bak`
  if (existsSync(first)) {
    latest = first
  }

  for (let i = 1; i < 1000; i += 1) {
    const candidate = `${originalPath}.bak.${i}`
    if (existsSync(candidate)) {
      latest = candidate
    }
  }

  return latest
}
