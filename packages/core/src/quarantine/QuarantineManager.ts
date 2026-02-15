import {
  copyFile,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, join } from 'node:path'

import type { Decision } from '@sapper-ai/types'

export interface QuarantineRecord {
  id: string
  originalPath: string
  quarantinedPath: string
  quarantinedAt: string
  restoredAt?: string
  decision: Decision
}

interface QuarantineIndex {
  records: QuarantineRecord[]
}

interface QuarantineManagerOptions {
  quarantineDir?: string
}

interface RestoreOptions {
  force?: boolean
}

const INDEX_FILE = 'index.json'

export class QuarantineManager {
  private readonly quarantineDir: string
  private readonly indexPath: string

  constructor(options: QuarantineManagerOptions = {}) {
    this.quarantineDir = options.quarantineDir ?? join(homedir(), '.sapperai', 'quarantine')
    this.indexPath = join(this.quarantineDir, INDEX_FILE)
  }

  getQuarantineDir(): string {
    return this.quarantineDir
  }

  async quarantine(filePath: string, decision: Decision): Promise<QuarantineRecord> {
    await this.ensureBaseDirs()

    const id = this.createId()
    const sanitizedBase = basename(filePath).replace(/[^A-Za-z0-9._-]/g, '_')
    const quarantinedName = `${id}-${sanitizedBase}`
    const quarantinedPath = join(this.quarantineDir, quarantinedName)

    await this.moveFile(filePath, quarantinedPath)

    const record: QuarantineRecord = {
      id,
      originalPath: filePath,
      quarantinedPath,
      quarantinedAt: new Date().toISOString(),
      decision,
    }

    const index = await this.readIndex()
    index.records.push(record)
    await this.writeIndex(index)

    return record
  }

  async restore(id: string, options: RestoreOptions = {}): Promise<void> {
    await this.ensureBaseDirs()

    const index = await this.readIndex()
    const record = index.records.find((entry) => entry.id === id)
    if (!record) {
      throw new Error(`Quarantine record not found for id=${id}`)
    }

    const force = options.force === true
    const existing = await this.getExistingPathType(record.originalPath)
    if (existing) {
      if (!force) {
        throw new Error(`Refusing to overwrite existing path at ${record.originalPath}. Use force to overwrite.`)
      }
      if (existing === 'directory') {
        throw new Error(`Refusing to overwrite directory at ${record.originalPath}`)
      }

      // Remove the existing file/symlink to restore deterministically across platforms.
      await rm(record.originalPath, { force: true })
    }

    await mkdir(dirname(record.originalPath), { recursive: true })
    await this.moveFile(record.quarantinedPath, record.originalPath)
    record.restoredAt = new Date().toISOString()
    await this.writeIndex(index)
  }

  async list(): Promise<QuarantineRecord[]> {
    const index = await this.readIndex()
    return index.records
  }

  private async ensureBaseDirs(): Promise<void> {
    await mkdir(this.quarantineDir, { recursive: true })
  }

  private async readIndex(): Promise<QuarantineIndex> {
    await this.ensureBaseDirs()

    try {
      const raw = await readFile(this.indexPath, 'utf8')
      const parsed = JSON.parse(raw) as QuarantineIndex
      if (!Array.isArray(parsed.records)) {
        return { records: [] }
      }

      return parsed
    } catch {
      return { records: [] }
    }
  }

  private async writeIndex(index: QuarantineIndex): Promise<void> {
    await writeFile(this.indexPath, `${JSON.stringify(index, null, 2)}\n`, 'utf8')
  }

  private async moveFile(source: string, destination: string): Promise<void> {
    try {
      await rename(source, destination)
    } catch (error) {
      const errorCode = this.toErrorCode(error)
      if (errorCode !== 'EXDEV') {
        throw error
      }

      await copyFile(source, destination)
      await unlink(source)
    }
  }

  private toErrorCode(error: unknown): string | null {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
      return null
    }

    const code = (error as { code?: unknown }).code
    return typeof code === 'string' ? code : null
  }

  private createId(): string {
    const stamp = Date.now().toString(36)
    const random = Math.random().toString(36).slice(2, 10)
    return `${stamp}-${random}`
  }

  private async getExistingPathType(targetPath: string): Promise<'file' | 'directory' | 'other' | null> {
    try {
      const info = await stat(targetPath)
      if (info.isFile()) return 'file'
      if (info.isDirectory()) return 'directory'
      return 'other'
    } catch {
      return null
    }
  }
}
