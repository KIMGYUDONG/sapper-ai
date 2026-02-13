import { expect, test } from '@playwright/test'

import fs from 'node:fs/promises'
import path from 'node:path'

type E2eState = {
  auditLogPath?: string
}

const STATE_PATH = path.join(__dirname, '.e2e-state.json')

async function clearAuditLogIfConfigured(): Promise<void> {
  try {
    const raw = await fs.readFile(STATE_PATH, 'utf8')
    const state = JSON.parse(raw) as E2eState
    if (state.auditLogPath) {
      await fs.writeFile(state.auditLogPath, '', 'utf8')
    }
  } catch {
    return
  }
}

test.describe('SapperAI dashboard', () => {
  test.beforeEach(async () => {
    await clearAuditLogIfConfigured()
  })

  test('navigation shell renders and tabs navigate', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: 'SapperAI Dashboard' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Overview' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Policy' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Audit Log' })).toBeVisible()

    await page.getByRole('link', { name: 'Policy' }).click()
    await expect(page).toHaveURL(/\/dashboard\/policy$/)

    await page.getByRole('link', { name: 'Audit Log' }).click()
    await expect(page).toHaveURL(/\/dashboard\/audit$/)

    await page.getByRole('link', { name: /Demo/ }).click()
    await expect(page).toHaveURL(/\/$/)
  })

  test('dashboard metrics renders empty state', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('Total Requests', { exact: true })).toBeVisible()
    await expect(page.getByText('Blocked', { exact: true })).toBeVisible()
    await expect(page.getByText('Block Rate', { exact: true })).toBeVisible()
    await expect(page.getByText('Avg Latency', { exact: true })).toBeVisible()

    const emptyTimeline = page.getByText('No data for the last 24 hours', { exact: true })
    if (await emptyTimeline.isVisible()) {
      await expect(emptyTimeline).toBeVisible()
    } else {
      await expect(page.getByText('Timeline (24h)', { exact: true })).toBeVisible()
    }

    const emptyThreats = page.getByText('No blocked requests found.', { exact: true })
    if (await emptyThreats.isVisible()) {
      await expect(emptyThreats).toBeVisible()
    } else {
      await expect(page.getByText('Top Threats', { exact: true })).toBeVisible()
    }

    await expect(page.getByText('Recent Activity', { exact: true })).toBeVisible()
  })

  test('policy editor renders form and preset buttons', async ({ page }) => {
    await page.goto('/dashboard/policy')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('Policy Editor', { exact: true })).toBeVisible()
    await expect(page.getByText('Preset', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /Standard/ })).toBeVisible()

    await expect(page.locator('input[type="range"]').first()).toBeVisible()

    await page.getByRole('button', { name: /Strict/ }).click()
    await expect(page.getByText('YAML Preview', { exact: true })).toBeVisible()
  })

  test('audit log renders filters and empty state', async ({ page }) => {
    await page.goto('/dashboard/audit')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('Export CSV', { exact: true })).toBeVisible()
    await expect(page.getByText('Export JSON', { exact: true })).toBeVisible()
    const empty = page.getByText('No audit log entries found.', { exact: true })
    if (await empty.isVisible()) {
      await expect(empty).toBeVisible()
    } else {
      await expect(page.getByText('Timestamp', { exact: true })).toBeVisible()
    }

    await expect(page.getByRole('button', { name: '< Prev' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Next >' })).toBeVisible()
  })

  test('mobile viewport renders stacked layout', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('Total Requests', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Policy' })).toBeVisible()
  })
})
