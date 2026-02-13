import fs from 'node:fs/promises'
import path from 'node:path'

import { expect, test } from '@playwright/test'

type E2eState = {
  baseURL: string
  configPath?: string
  auditLogPath?: string
  threatIntelCachePath?: string
  tempDir?: string
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

test.describe('Dashboard Phase 3', () => {
  test.beforeEach(async () => {
    const state = await readState()
    if (state?.auditLogPath) {
      await fs.writeFile(state.auditLogPath, '', 'utf8')
    }
  })

  test('tabs render in correct order', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const labels = await page.locator('nav a').allTextContents()
    expect(labels).toEqual(['Overview', 'Threat Intel', 'Campaign', 'Policy', 'Audit Log'])
  })

  test('threat intel tab renders empty state and controls', async ({ page }) => {
    await page.goto('/dashboard/threat-intel')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('Total Entries', { exact: true })).toBeVisible()
    await expect(page.getByText('Sources', { exact: true })).toBeVisible()
    await expect(page.getByText('Last Synced', { exact: true })).toBeVisible()
    await expect(page.getByText('Types', { exact: true })).toBeVisible()

    await expect(page.getByRole('button', { name: 'Sync Now' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Check' })).toBeVisible()
    await expect(page.getByText('Entries', { exact: true })).toBeVisible()
  })

  test('campaign tab can run with configured policy', async ({ page }) => {
    await page.goto('/dashboard/campaign')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('Run Campaign', { exact: true })).toBeVisible()
    await expect(page.getByText('현재 설정 파일 정책', { exact: true })).toBeVisible()
    await expect(page.getByText('기본 정책', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: '원클릭 캠페인 실행' }).click()
    await expect(page.getByText('Campaign Stats', { exact: true })).toBeVisible({ timeout: 60_000 })
  })

  test('advanced policy settings allow editing toolOverrides and matchlists', async ({ page }) => {
    await page.goto('/dashboard/policy')
    await page.waitForLoadState('networkidle')

    await page.locator('summary').filter({ hasText: 'Advanced Settings' }).click()

    await page.getByPlaceholder('tool name (e.g. read_file)').fill('read_file')
    await page.getByRole('button', { name: '+ Add Override' }).click()
    await expect(page.getByText('read_file', { exact: true })).toBeVisible()

    const allowlistEditor = page.getByTestId('matchlist-allowlist')

    await allowlistEditor.getByRole('button', { name: 'Add' }).first().click()

    const toolNamesInput = allowlistEditor.locator('input').first()
    await toolNamesInput.fill('shell')
    await toolNamesInput.press('Enter')

    await expect(allowlistEditor.getByRole('button', { name: 'shell' })).toBeVisible()
  })

  test('policy hot-reload affects /api/detect', async ({ request }) => {
    const state = await readState()
    test.skip(!state?.configPath, 'No config path available for policy reload test.')

    const configPath = state!.configPath!

    const enforcePolicy = [
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

    const monitorPolicy = [
      'mode: monitor',
      'defaultAction: allow',
      'failOpen: true',
      'detectors:',
      '  - rules',
      'thresholds:',
      '  riskThreshold: 0.7',
      '  blockMinConfidence: 0.5',
      '',
    ].join('\n')

    await fs.writeFile(configPath, enforcePolicy, 'utf8')
    await new Promise((r) => setTimeout(r, 150))

    const blockRes = await request.post('/api/detect', {
      data: { toolName: 'shell', arguments: { cmd: 'rm -rf / --no-preserve-root' } },
    })
    expect(blockRes.ok()).toBeTruthy()
    const blockDecision = (await blockRes.json()) as { action?: string }
    if (blockDecision.action !== 'block') {
      test.skip(state?.mode === 'existing', 'Policy reload test requires isolated server (spawned mode).')
    }
    expect(blockDecision.action).toBe('block')

    await fs.writeFile(configPath, monitorPolicy, 'utf8')
    await new Promise((r) => setTimeout(r, 150))

    const allowRes = await request.post('/api/detect', {
      data: { toolName: 'shell', arguments: { cmd: 'rm -rf / --no-preserve-root' } },
    })
    expect(allowRes.ok()).toBeTruthy()
    const allowDecision = (await allowRes.json()) as { action?: string }
    expect(allowDecision.action).toBe('allow')

    await fs.writeFile(configPath, enforcePolicy, 'utf8')
    await new Promise((r) => setTimeout(r, 150))
  })
})
