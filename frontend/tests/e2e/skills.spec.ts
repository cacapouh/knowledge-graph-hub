import { test, expect } from '@playwright/test'
import {
  uniqueSuffix,
  listSkills,
  deleteSkill,
  autoAcceptDialogs,
  cardWithHeading,
} from './helpers'

test('creates a Skill (prompt only, no MCPs)', async ({ page, request }) => {
  const name = `e2e_skill_${uniqueSuffix()}`
  let createdId: number | null = null

  try {
    await page.goto('/skills')
    await page.getByRole('button', { name: 'New Skill' }).click()

    const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Create' }) })
    await form.locator('input').first().fill(name)
    await form.locator('textarea').first().fill('e2e test prompt body')
    await form.getByRole('button', { name: 'Create' }).click()

    await expect(page.getByRole('heading', { name, level: 2 })).toBeVisible()

    const list = await listSkills(request)
    const created = list.find((s) => s.name === name)
    expect(created).toBeTruthy()
    createdId = created!.id
  } finally {
    if (createdId !== null) await deleteSkill(request, createdId)
  }
})

test('creates a Skill with a stdio MCP', async ({ page, request }) => {
  const name = `e2e_skill_mcp_${uniqueSuffix()}`
  let createdId: number | null = null

  try {
    await page.goto('/skills')
    await page.getByRole('button', { name: 'New Skill' }).click()

    const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Create' }) })
    await form.locator('input').first().fill(name)
    await form.locator('textarea').first().fill('skill with mcp')

    // Add an MCP entry
    await form.getByRole('button', { name: /Add MCP/ }).click()
    const mcpBlock = form.locator('div.bg-gray-50').last()
    await mcpBlock.getByPlaceholder(/MCP name/).fill('playwright')
    await mcpBlock.getByPlaceholder('command (e.g. npx)').fill('npx')
    await mcpBlock.getByPlaceholder(/args/).fill('-y\n@modelcontextprotocol/server-playwright')

    await form.getByRole('button', { name: 'Create' }).click()

    const card = cardWithHeading(page, name)
    await expect(card.locator('text=playwright')).toBeVisible()
    // The badge is a single span with text "playwright stdio".
    await expect(card.getByText(/playwright\s+stdio/)).toBeVisible()

    const list = await listSkills(request)
    const created = list.find((s) => s.name === name)
    expect(created).toBeTruthy()
    expect(created!.mcps[0].name).toBe('playwright')
    expect(created!.mcps[0].type).toBe('stdio')
    expect(created!.mcps[0].command).toBe('npx')
    createdId = created!.id
  } finally {
    if (createdId !== null) await deleteSkill(request, createdId)
  }
})

test('edits a Skill in place', async ({ page, request }) => {
  const original = `e2e_skill_edit_${uniqueSuffix()}`
  const updated = `${original}_renamed`

  const created = await request.post('/api/skills', {
    data: { name: original, description: '', prompt: 'orig', mcps: [] },
  }).then((r) => r.json())

  try {
    await page.goto('/skills')
    const card = cardWithHeading(page, original)
    await expect(card).toBeVisible()

    await card.getByRole('button', { name: 'Edit' }).click()

    const editForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Save' }) })
    await editForm.locator('input').first().fill(updated)
    await editForm.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByRole('heading', { name: updated, level: 2 })).toBeVisible()
    await expect(page.getByRole('heading', { name: original, level: 2, exact: true })).toHaveCount(0)
  } finally {
    await deleteSkill(request, created.id)
  }
})

test('deletes a Skill via the UI (confirm dialog)', async ({ page, request }) => {
  autoAcceptDialogs(page)

  const name = `e2e_skill_del_${uniqueSuffix()}`
  const created = await request.post('/api/skills', {
    data: { name, description: '', prompt: 'to-delete', mcps: [] },
  }).then((r) => r.json())

  try {
    await page.goto('/skills')
    const card = cardWithHeading(page, name)
    await expect(card).toBeVisible()

    await card.getByRole('button', { name: 'Delete' }).click()

    await expect(page.getByRole('heading', { name, level: 2 })).toHaveCount(0)

    const list = await listSkills(request)
    expect(list.find((s) => s.name === name)).toBeUndefined()
  } catch (e) {
    await deleteSkill(request, created.id).catch(() => {})
    throw e
  }
})
