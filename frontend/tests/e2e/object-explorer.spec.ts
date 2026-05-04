import { test, expect, Page } from '@playwright/test'
import { uniqueSuffix, createObjectType, deleteObjectType, type ObjectType } from './helpers'

function panelWithHeading(page: Page, name: string) {
  return page
    .locator('div.rounded-xl')
    .filter({ has: page.getByRole('heading', { name }) })
    .first()
}

test.describe('Object Explorer', () => {
  let objectType: ObjectType

  test.beforeEach(async ({ request }) => {
    objectType = await createObjectType(request, { name: `e2e_explorer_${uniqueSuffix()}` })
  })

  test.afterEach(async ({ request }) => {
    if (objectType) await deleteObjectType(request, objectType.id)
  })

  test('header shows the object type name and an empty state', async ({ page }) => {
    await page.goto(`/ontology/explorer/${objectType.id}`)
    await expect(page.getByRole('heading', { name: objectType.name })).toBeVisible()
    await expect(page.getByText('No properties defined.')).toBeVisible()
    await expect(page.getByText('No objects yet.')).toBeVisible()
    await expect(page.getByText('Select an object to view details.')).toBeVisible()
  })

  test('full lifecycle: add property → create instance → select → delete', async ({ page }) => {
    await page.goto(`/ontology/explorer/${objectType.id}`)

    // ── Add a `string` property "title" with a default ──
    const propsPanel = panelWithHeading(page, 'Properties')
    await propsPanel.getByRole('button').first().click() // + icon

    let propForm = propsPanel.locator('form')
    await propForm.getByPlaceholder('Property name').fill('title')
    await propForm.getByPlaceholder('Default value (optional)').fill('untitled')
    await propForm.getByRole('button', { name: 'Add' }).click()

    await expect(propsPanel.getByText('title', { exact: true })).toBeVisible()
    await expect(propsPanel.getByText('= untitled')).toBeVisible()

    // ── Add a required string property "owner" ──
    await propsPanel.getByRole('button').first().click()
    propForm = propsPanel.locator('form')
    await propForm.getByPlaceholder('Property name').fill('owner')
    await propForm.getByLabel('Required').check()
    await propForm.getByRole('button', { name: 'Add' }).click()

    await expect(propsPanel.getByText('required')).toBeVisible()
    await expect(propsPanel.getByText('owner', { exact: true })).toBeVisible()

    // ── Create an instance ──
    const objectsPanel = page.locator('div.rounded-xl').filter({
      has: page.getByRole('heading', { name: /Objects \(\d+\)/ }),
    }).first()
    await objectsPanel.getByRole('button').first().click() // + icon

    const createForm = objectsPanel.locator('form')
    const formInputs = createForm.locator('input')
    await formInputs.nth(0).fill('My first item') // title
    await formInputs.nth(1).fill('alice')         // owner (required)
    await createForm.getByRole('button', { name: 'Create' }).click()

    // The list shows "Object #<id>" since title_property is unset.
    const objectButton = objectsPanel.locator('button', { hasText: /^Object #\d+/ })
    await expect(objectButton).toHaveCount(1)
    await expect(objectsPanel.getByRole('heading', { name: 'Objects (1)' })).toBeVisible()

    // ── Click the object to open detail panel ──
    await objectButton.click()

    const detailPanel = panelWithHeading(page, 'Object Detail')
    await expect(detailPanel.getByText(/^ID:\s+\d+/)).toBeVisible()
    await expect(detailPanel.getByText('My first item')).toBeVisible()
    await expect(detailPanel.getByText('alice')).toBeVisible()
    await expect(detailPanel.getByText('No links')).toBeVisible()

    // ── Delete the instance via the trash button in the detail header ──
    await detailPanel.locator('button').first().click()
    await expect(detailPanel.getByText('Select an object to view details.')).toBeVisible()
    await expect(objectsPanel.getByText('No objects yet.')).toBeVisible()
  })

  test('default value is shown with (default) marker when property is added after the instance', async ({ page, request }) => {
    // Create the instance FIRST (no properties yet defined) so the default value
    // doesn't get materialized into instance.properties at write time.
    const objRes = await request.post('/api/ontology/objects', {
      data: { object_type_id: objectType.id, properties: {} },
    })
    expect(objRes.ok()).toBe(true)

    // THEN define the property with a default. The existing instance's properties
    // don't get back-filled, so the UI must overlay the schema default.
    const propRes = await request.post('/api/ontology/properties', {
      data: {
        object_type_id: objectType.id,
        name: 'status',
        api_name: 'status',
        data_type: 'string',
        is_required: false,
        default_value: 'pending',
      },
    })
    expect(propRes.ok()).toBe(true)

    await page.goto(`/ontology/explorer/${objectType.id}`)

    const objectsPanel = page.locator('div.rounded-xl').filter({
      has: page.getByRole('heading', { name: /Objects \(1\)/ }),
    }).first()
    await objectsPanel.locator('button', { hasText: /^Object #\d+/ }).click()

    const detailPanel = panelWithHeading(page, 'Object Detail')
    await expect(detailPanel.getByText('pending')).toBeVisible()
    await expect(detailPanel.getByText('(default)')).toBeVisible()
  })
})
