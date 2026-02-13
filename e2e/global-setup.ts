import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

type E2eState = {
  baseURL: string
  configPath?: string
  originalConfigYaml?: string
  configFileExisted?: boolean
  auditLogPath?: string
  threatIntelCachePath?: string
  tempDir?: string
  childPid?: number
  mode: 'external' | 'spawned' | 'existing'
}

const STATE_PATH = path.join(__dirname, '.e2e-state.json')

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.stat(filePath)
    return true
  } catch {
    return false
  }
}

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`Timed out waiting for server: ${url}`)
}

function getNpxCommand(): string {
  return process.platform === 'win32' ? 'npx.cmd' : 'npx'
}

export default async function globalSetup(): Promise<void> {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

  if (process.env.PLAYWRIGHT_BASE_URL) {
    const state: E2eState = { baseURL, mode: 'external' }
    await fs.writeFile(STATE_PATH, JSON.stringify(state, null, 2), 'utf8')
    return
  }

  const repoRoot = path.resolve(__dirname, '..')
  const probeUrl = `${baseURL}/dashboard`

  try {
    await waitForServer(probeUrl, 8_000)
    
    let configPath: string | undefined
    let originalConfigYaml: string | undefined
    let configFileExisted: boolean | undefined
    try {
      const res = await fetch(`${baseURL}/api/dashboard/policy`, { cache: 'no-store' })
      if (res.ok) {
        const payload = (await res.json()) as { filePath?: unknown }
        if (typeof payload.filePath === 'string') {
          configPath = payload.filePath
        }
      }
    } catch {
    }

    if (configPath) {
      const existed = await fileExists(configPath)
      configFileExisted = existed
      if (existed) {
        try {
          originalConfigYaml = await fs.readFile(configPath, 'utf8')
        } catch {
          originalConfigYaml = undefined
        }
      }
    }

    const state: E2eState = {
      baseURL,
      mode: 'existing',
      configPath,
      originalConfigYaml,
      configFileExisted,
    }
    await fs.writeFile(STATE_PATH, JSON.stringify(state, null, 2), 'utf8')
    return
  } catch {
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sapperai-e2e-'))
  const configPath = path.join(tempDir, 'sapperai.config.yaml')
  const auditLogPath = path.join(tempDir, 'sapperai-audit.jsonl')
  const threatIntelCachePath = path.join(tempDir, 'threat-intel.json')

  const initialPolicyYaml = [
    'mode: enforce',
    'defaultAction: allow',
    'failOpen: true',
    'detectors:',
    '  - rules',
    'thresholds:',
    '  riskThreshold: 0.7',
    '  blockMinConfidence: 0.5',
    '',
  ].join('\n')

  await fs.writeFile(configPath, initialPolicyYaml, 'utf8')
  await fs.writeFile(auditLogPath, '', 'utf8')

  const webDir = path.resolve(repoRoot, 'apps/web')
  const npx = getNpxCommand()
  const child = spawn(npx, ['next', 'dev', '--port', '3000'], {
    cwd: webDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      PORT: '3000',
      SAPPERAI_CONFIG_PATH: configPath,
      SAPPERAI_AUDIT_LOG_PATH: auditLogPath,
      SAPPERAI_THREAT_FEED_CACHE: threatIntelCachePath,
    },
  })

  const earlyExit = new Promise<never>((_, reject) => {
    child.once('exit', (code) => {
      reject(new Error(`Web server exited early (code: ${code ?? 'unknown'})`))
    })
  })

  await Promise.race([waitForServer(probeUrl, 60_000), earlyExit])

  const state: E2eState = {
    baseURL,
    configPath,
    auditLogPath,
    threatIntelCachePath,
    tempDir,
    childPid: child.pid,
    mode: 'spawned',
  }
  await fs.writeFile(STATE_PATH, JSON.stringify(state, null, 2), 'utf8')
}
