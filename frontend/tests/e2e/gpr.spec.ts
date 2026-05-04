import { test, expect, Page } from '@playwright/test'
import {
  uniqueSuffix,
  createObjectType,
  deleteObjectType,
  createGpr,
  autoAcceptDialogs,
  type ObjectType,
} from './helpers'

/**
 * GPR detail embeds a DiffGraph (ReactFlow) where each node is a `<div role="button">`.
 * That pollutes `getByRole('button')` lookups, so we scope to actual <button> elements.
 */
function actionButton(page: Page, label: string) {
  return page.locator('button').filter({ hasText: new RegExp(`^\\s*${label}\\s*$`) })
}

test('GPR list page renders and shows seeded GPR', async ({ page, request }) => {
  const otype = await createObjectType(request, { name: `e2e_gpr_${uniqueSuffix()}` })
  const title = `e2e GPR ${uniqueSuffix()}`

  await createGpr(request, {
    title,
    operations: [
      { op: 'create_object', client_id: 'a', object_type: otype.api_name, properties: {} },
    ],
  })

  try {
    await page.goto('/gpr')
    await expect(page.getByRole('heading', { name: 'Graph Pull Requests' })).toBeVisible()

    const card = page.getByRole('link', { name: new RegExp(title) })
    await expect(card).toBeVisible()
    await expect(card).toContainText('Open')
    await expect(card).toContainText('1 op')
  } finally {
    await deleteObjectType(request, otype.id)
  }
})

test('GPR detail: Open status shows Approve & Apply + Close buttons', async ({ page, request }) => {
  const otype = await createObjectType(request, { name: `e2e_gpr_open_${uniqueSuffix()}` })
  const title = `e2e GPR open ${uniqueSuffix()}`
  const gpr = await createGpr(request, {
    title,
    operations: [{ op: 'create_object', client_id: 'a', object_type: otype.api_name, properties: {} }],
  })

  try {
    await page.goto(`/gpr/${gpr.id}`)
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
    await expect(actionButton(page, 'Approve & Apply')).toBeVisible()
    await expect(actionButton(page, 'Close')).toBeVisible()
  } finally {
    await deleteObjectType(request, otype.id)
  }
})

test('GPR detail: Approve & Apply transitions to Merged and shows Revert', async ({ page, request }) => {
  const otype: ObjectType = await createObjectType(request, { name: `e2e_gpr_apply_${uniqueSuffix()}` })
  const title = `e2e GPR apply ${uniqueSuffix()}`
  const gpr = await createGpr(request, {
    title,
    operations: [{ op: 'create_object', client_id: 'a', object_type: otype.api_name, properties: { v: '1' } }],
  })

  try {
    await page.goto(`/gpr/${gpr.id}`)
    await actionButton(page, 'Approve & Apply').click()

    // Detail page polls every 3s. Wait for status badge to flip to Merged.
    await expect(page.getByText('Merged').first()).toBeVisible({ timeout: 10_000 })
    await expect(actionButton(page, 'Revert')).toBeVisible()
  } finally {
    const instances = await request
      .get(`/api/ontology/objects?object_type_id=${otype.id}`)
      .then((r) => r.json())
    for (const obj of instances) {
      await request.delete(`/api/ontology/objects/${obj.id}`)
    }
    await deleteObjectType(request, otype.id)
  }
})

test('GPR detail: Close transitions an open GPR to Closed', async ({ page, request }) => {
  const otype = await createObjectType(request, { name: `e2e_gpr_close_${uniqueSuffix()}` })
  const title = `e2e GPR close ${uniqueSuffix()}`
  const gpr = await createGpr(request, {
    title,
    operations: [{ op: 'create_object', client_id: 'a', object_type: otype.api_name, properties: {} }],
  })

  try {
    await page.goto(`/gpr/${gpr.id}`)
    await actionButton(page, 'Close').click()
    await expect(page.getByText('Closed').first()).toBeVisible({ timeout: 10_000 })
  } finally {
    await deleteObjectType(request, otype.id)
  }
})

test('GPR detail: Revert (with confirm dialog) on a merged GPR', async ({ page, request }) => {
  autoAcceptDialogs(page)

  const otype = await createObjectType(request, { name: `e2e_gpr_revert_${uniqueSuffix()}` })
  const title = `e2e GPR revert ${uniqueSuffix()}`
  const gpr = await createGpr(request, {
    title,
    auto_merge: true,
    operations: [{ op: 'create_object', client_id: 'a', object_type: otype.api_name, properties: { v: 'pre' } }],
  })

  try {
    expect(gpr.status).toBe('merged')

    await page.goto(`/gpr/${gpr.id}`)
    await expect(page.getByText('Merged').first()).toBeVisible()

    await actionButton(page, 'Revert').click()
    await expect(page.getByText('Reverted').first()).toBeVisible({ timeout: 10_000 })
  } finally {
    const instances = await request
      .get(`/api/ontology/objects?object_type_id=${otype.id}`)
      .then((r) => r.json())
    for (const obj of instances) {
      await request.delete(`/api/ontology/objects/${obj.id}`)
    }
    await deleteObjectType(request, otype.id)
  }
})
