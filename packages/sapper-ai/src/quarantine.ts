import { QuarantineManager } from '@sapper-ai/core'

export interface QuarantineListOptions {
  quarantineDir?: string
  write?: (text: string) => void
}

export interface QuarantineRestoreOptions {
  id: string
  quarantineDir?: string
  force?: boolean
  write?: (text: string) => void
}

export async function runQuarantineList(options: QuarantineListOptions = {}): Promise<number> {
  const manager = new QuarantineManager({ quarantineDir: options.quarantineDir })
  const records = await manager.list()
  const write = options.write ?? ((text: string) => process.stdout.write(text))

  write(
    `${JSON.stringify(
      {
        count: records.length,
        records,
      },
      null,
      2
    )}\n`
  )

  return 0
}

export async function runQuarantineRestore(options: QuarantineRestoreOptions): Promise<number> {
  const manager = new QuarantineManager({ quarantineDir: options.quarantineDir })
  await manager.restore(options.id, { force: options.force === true })

  const write = options.write ?? ((text: string) => process.stdout.write(text))
  write(`Restored quarantine record: ${options.id}\n`)
  return 0
}

