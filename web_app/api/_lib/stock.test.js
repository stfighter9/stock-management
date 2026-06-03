import test from 'node:test'
import assert from 'node:assert/strict'

import {
  applyInventoryDelta,
  assertEnoughStock,
  buildCatalog,
  buildDailyInboundReport,
  buildDailyOutboundReport,
  buildInventoryReport,
  buildLookupMaps,
  buildMappingComponents,
  buildMappings,
  buildMixOptions,
  buildProducts,
  buildRecentTransactions,
  computeCatalogStocks,
  resolveBatchLine,
} from './stock.js'

function makeFixture() {
  const products = buildProducts([
    { odoo_product_key: 'ODOO-A', display_name: 'Ao do', quantity_on_hand: '12', unit: 'pcs' },
    { odoo_product_key: 'ODOO-B', display_name: 'Ao xanh', quantity_on_hand: '5', unit: 'pcs' },
    { odoo_product_key: 'ODOO-C', display_name: 'Combo phu kien', quantity_on_hand: '9', unit: 'pcs' },
    { odoo_product_key: 'ODOO-D', display_name: 'Hop qua', quantity_on_hand: '8', unit: 'pcs' },
  ])
  const catalog = buildCatalog([
    { sku: 'SKU-FIXED', product_name: 'Fixed', variation_name: 'Red', stock: '0' },
    { sku: 'SKU-MIX', product_name: 'Mix', variation_name: 'Color', stock: '0' },
    { sku: 'SKU-COMBO', product_name: 'Combo', variation_name: '', stock: '0' },
  ])
  const mappings = buildMappings([
    { shopee_sku: 'SKU-FIXED', mapping_type: 'FIXED_SKU', odoo_product_key: 'ODOO-A', conversion_qty: '2', active: 'TRUE' },
    { shopee_sku: 'SKU-MIX', mapping_type: 'MIX_COLOR', mix_group_id: 'GROUP-1', conversion_qty: '1', active: 'TRUE' },
    { shopee_sku: 'SKU-COMBO', mapping_type: 'COMBO_SKU', conversion_qty: '1', active: 'TRUE' },
  ])
  const mappingComponents = buildMappingComponents([
    { shopee_sku: 'SKU-COMBO', component_no: '1', odoo_product_key: 'ODOO-C', component_qty: '3', active: 'TRUE' },
    { shopee_sku: 'SKU-COMBO', component_no: '2', odoo_product_key: 'ODOO-D', component_qty: '2', active: 'TRUE' },
  ])
  const productsByKey = new Map(products.map((product) => [product.key, product]))
  const mixOptions = buildMixOptions(
    [
      { mix_group_id: 'GROUP-1', odoo_product_key: 'ODOO-A', active: 'TRUE' },
      { mix_group_id: 'GROUP-1', odoo_product_key: 'ODOO-B', active: 'TRUE' },
    ],
    productsByKey,
  )
  const inventoryReport = buildInventoryReport([
    { odoo_product_key: 'ODOO-A', display_name: 'Ao do', current_qty: '12' },
    { odoo_product_key: 'ODOO-B', display_name: 'Ao xanh', current_qty: '5' },
    { odoo_product_key: 'ODOO-C', display_name: 'Combo phu kien', current_qty: '9' },
    { odoo_product_key: 'ODOO-D', display_name: 'Hop qua', current_qty: '8' },
  ])
  const lookups = buildLookupMaps({
    products,
    mappings,
    mappingComponents,
    mixOptions,
    inventoryReport,
  })

  return {
    products,
    catalog,
    mappings,
    mappingComponents,
    mixOptions,
    inventoryReport,
    lookups,
    catalogBySku: new Map(catalog.map((item) => [item.sku, item])),
  }
}

test('computeCatalogStocks handles FIXED_SKU, MIX_COLOR, COMBO_SKU', () => {
  const fixture = makeFixture()

  const stocks = computeCatalogStocks({
    shopeeCatalog: fixture.catalog,
    mappingsBySku: fixture.lookups.mappingsBySku,
    componentsBySku: fixture.lookups.componentsBySku,
    mixOptionsByGroup: fixture.lookups.mixOptionsByGroup,
    inventoryByProduct: fixture.lookups.inventoryByProduct,
  })

  assert.deepEqual(stocks, [6, 17, 3])
})

test('resolveBatchLine expands FIXED_SKU correctly', () => {
  const fixture = makeFixture()

  const result = resolveBatchLine(
    { shopeeSku: 'SKU-FIXED', quantity: 3, mixSelections: [] },
    { ...fixture.lookups, catalogBySku: fixture.catalogBySku },
  )

  assert.equal(result.requiredQty, 6)
  assert.deepEqual(result.outputs, [{ odooProductKey: 'ODOO-A', qty: 6 }])
})

test('resolveBatchLine expands COMBO_SKU components per quantity', () => {
  const fixture = makeFixture()

  const result = resolveBatchLine(
    { shopeeSku: 'SKU-COMBO', quantity: 2, mixSelections: [] },
    { ...fixture.lookups, catalogBySku: fixture.catalogBySku },
  )

  assert.equal(result.requiredQty, 2)
  assert.deepEqual(result.outputs, [
    { odooProductKey: 'ODOO-C', qty: 6 },
    { odooProductKey: 'ODOO-D', qty: 4 },
  ])
})

test('resolveBatchLine validates MIX_COLOR selections against required quantity', () => {
  const fixture = makeFixture()

  assert.throws(
    () =>
      resolveBatchLine(
        {
          shopeeSku: 'SKU-MIX',
          quantity: 3,
          mixSelections: [
            { odooProductKey: 'ODOO-A', qty: 1 },
            { odooProductKey: 'ODOO-B', qty: 1 },
          ],
        },
        { ...fixture.lookups, catalogBySku: fixture.catalogBySku },
      ),
    /Total mix quantity must equal 3/,
  )
})

test('assertEnoughStock fails when aggregated outputs exceed inventory', () => {
  const fixture = makeFixture()

  assert.throws(
    () =>
      assertEnoughStock(
        [
          { odooProductKey: 'ODOO-A', qty: 8 },
          { odooProductKey: 'ODOO-A', qty: 5 },
        ],
        fixture.lookups.inventoryByProduct,
      ),
    /Insufficient stock for ODOO-A: need 13, have 12/,
  )
})

test('applyInventoryDelta updates inventory in both OUT and IN directions', () => {
  const inventoryByProduct = new Map([
    ['ODOO-A', 12],
    ['ODOO-B', 5],
  ])

  applyInventoryDelta(inventoryByProduct, [{ odooProductKey: 'ODOO-A', qty: 4 }], 'OUT')
  applyInventoryDelta(inventoryByProduct, [{ odooProductKey: 'ODOO-B', qty: 3 }], 'IN')

  assert.equal(inventoryByProduct.get('ODOO-A'), 8)
  assert.equal(inventoryByProduct.get('ODOO-B'), 8)
})

test('report builders normalize rows and sort recent transactions descending', () => {
  const productsByKey = new Map([
    ['ODOO-A', { displayName: 'Ao do' }],
    ['ODOO-B', { displayName: 'Ao xanh' }],
  ])
  const inbound = buildDailyInboundReport([
    {
      transaction_date: '2026-06-03',
      type: 'IN',
      reference_type: 'RETURN_FROM_CUSTOMER',
      odoo_product_key: 'ODOO-A',
      qty: '4',
      odoo_status: 'Pending Odoo sync',
    },
  ], productsByKey)
  const outbound = buildDailyOutboundReport([
    {
      transaction_date: '2026-06-03',
      type: 'OUT',
      odoo_product_key: 'ODOO-B',
      qty: '-7',
      source_input_id: 'ORDER-1',
    },
  ], productsByKey)
  const transactions = buildRecentTransactions([
    {
      transaction_id: 'TX-1',
      transaction_date: '2026-06-02',
      type: 'OUT',
      odoo_product_key: 'ODOO-A',
      qty: '-2',
      reference_id: 'REF-1',
    },
    {
      transaction_id: 'TX-2',
      transaction_date: '2026-06-03',
      type: 'IN',
      odoo_product_key: 'ODOO-B',
      qty: '5',
      reference_id: 'REF-2',
    },
  ])

  assert.deepEqual(inbound, [
    {
      date: '2026-06-03',
      referenceType: 'RETURN_FROM_CUSTOMER',
      productKey: 'ODOO-A',
      displayName: 'Ao do',
      qty: 4,
      count: 1,
      odooStatus: 'Pending Odoo sync',
    },
  ])
  assert.deepEqual(outbound, [
    {
      date: '2026-06-03',
      productKey: 'ODOO-B',
      displayName: 'Ao xanh',
      qty: 7,
      count: 1,
    },
  ])
  assert.deepEqual(
    transactions.map((item) => item.id),
    ['TX-2', 'TX-1'],
  )
})
