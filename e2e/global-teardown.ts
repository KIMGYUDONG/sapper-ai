import fs from 'node:fs/promises'
import path from 'node:path'

type E2eState = {
  tempDir?: string
  childPid?: number
  configPath?: string
  originalConfigYaml?: string
  configFileExisted?: boolean
  mode: 'external' | 'spawned' | 'existing'
}

const STATE_PATH = path.join(__dirname, '.e2e-state.json')

async function readState(): Promise<E2eState | null> {
  try {
    const raw = await fs.readFile(STATE_PATH, 'utf8')
    return JSON.parse(raw) as E2eState
  } catch {
    return null
  }
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

async function stopProcess(pid: number): Promise<void> {
  if (!isAlive(pid)) return
  try {
    process.kill(pid, 'SIGINT')
  } catch {
    return
  }

  const start = Date.now()
  while (Date.now() - start < 10_000) {
    if (!isAlive(pid)) return
    await new Promise((r) => setTimeout(r, 250))
  }

  try {
    process.kill(pid, 'SIGKILL')
  } catch {
  }
}

export default async function globalTeardown(): Promise<void> {
  const state = await readState()
  if (!state) return

  if (state.mode === 'existing' && state.configPath) {
    if (state.configFileExisted === false) {
      try {
        await fs.rm(state.configPath, { force: true })
      } catch {
      }
    } else if (typeof state.originalConfigYaml === 'string') {
      try {
        await fs.writeFile(state.configPath, state.originalConfigYaml, 'utf8')
      } catch {
      }
    }
  }

  if (state.mode === 'spawned' && typeof state.childPid === 'number') {
    await stopProcess(state.childPid)
  }

  if (state.mode === 'spawned' && state.tempDir) {
    await fs.rm(state.tempDir, { recursive: true, force: true })
  }

  await fs.rm(STATE_PATH, { force: true })
}
