import { appendObjects, updateCatalogStockColumn } from './sheets.js'
import {
  applyInventoryDelta,
  assertEnoughStock,
  computeCatalogStocks,
  getToday,
  makeId,
  resolveBatchLine,
} from './stock.js'

function requireNonEmptyString(value, label) {
  if (!value || !String(value).trim()) {
    throw new Error(`Missing ${label}`)
  }
  return String(value).trim()
}

function requirePositiveNumber(value, label) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`${label} must be greater than 0`)
  }
  return number
}

function makeShopeeProductName(catalogItem) {
  return [catalogItem.productName, catalogItem.variationName].filter(Boolean).join(' / ')
}

export async function confirmPickBatch(payload, bootstrap) {
  const pickBatchId = requireNonEmptyString(payload.pickBatchId, 'pick_batch_id')
  const createdBy = requireNonEmptyString(payload.createdBy || 'web-user', 'created_by')
  const note = String(payload.note || '')
  const lines = Array.isArray(payload.lines) ? payload.lines : []
  if (!lines.length) {
    throw new Error('Pick batch is empty')
  }

  const catalogBySku = new Map(bootstrap.shopeeCatalog.map((item) => [item.sku, item]))
  const lookups = {
    ...bootstrap.lookups,
    catalogBySku,
  }

  const resolvedLines = lines.map((line) =>
    resolveBatchLine(
      {
        shopeeSku: requireNonEmptyString(line.shopeeSku, 'shopeeSku'),
        quantity: requirePositiveNumber(line.quantity, 'quantity'),
        mixSelections: Array.isArray(line.mixSelections) ? line.mixSelections : [],
      },
      lookups,
    ),
  )

  const allOutputs = resolvedLines.flatMap((line) => line.outputs)
  assertEnoughStock(allOutputs, bootstrap.lookups.inventoryByProduct)

  const inputRows = []
  const outputRows = []
  const transactionRows = []

  resolvedLines.forEach((line) => {
    const inputId = makeId('ORDER')
    inputRows.push({
      input_id: inputId,
      order_batch_id: pickBatchId,
      order_id: '',
      input_shopee_sku: line.catalogItem.sku,
      shopee_product_name: makeShopeeProductName(line.catalogItem),
      order_qty: line.requiredQty / line.mapping.conversionQty,
      input_status: 'Picked',
      created_by: createdBy,
      note,
    })

    line.outputs.forEach((output) => {
      const currentQty = bootstrap.lookups.inventoryByProduct.get(output.odooProductKey) || 0
      outputRows.push({
        output_id: makeId('ORDER-OUT'),
        input_id: inputId,
        order_batch_id: pickBatchId,
        order_id: '',
        input_shopee_sku: line.catalogItem.sku,
        mapping_type: line.mapping.mappingType,
        odoo_product_key: output.odooProductKey,
        display_name: bootstrap.lookups.productsByKey.get(output.odooProductKey)?.displayName || output.odooProductKey,
        required_qty: output.qty,
        selected_qty: output.qty,
        stock_status: currentQty >= output.qty ? 'In stock' : 'Out of stock',
        confirm_status: 'Picked',
      })

      transactionRows.push({
        transaction_id: makeId('TX'),
        transaction_date: getToday(),
        type: 'OUT',
        odoo_product_key: output.odooProductKey,
        qty: -output.qty,
        reference_type: 'SHOPEE_ORDER',
        reference_id: pickBatchId,
        source_input_id: inputId,
        source_shopee_sku: line.catalogItem.sku,
        source_mapping_type: line.mapping.mappingType,
        odoo_status: 'No Odoo sync needed',
        created_by: createdBy,
        note,
      })
    })
  })

  await appendObjects('Manual_Order_Input', inputRows)
  await appendObjects('Order_Output', outputRows)
  await appendObjects('Inventory_Transactions', transactionRows)

  applyInventoryDelta(bootstrap.lookups.inventoryByProduct, allOutputs, 'OUT')
  const stockValues = computeCatalogStocks({
    shopeeCatalog: bootstrap.shopeeCatalog,
    mappingsBySku: bootstrap.lookups.mappingsBySku,
    componentsBySku: bootstrap.lookups.componentsBySku,
    mixOptionsByGroup: bootstrap.lookups.mixOptionsByGroup,
    inventoryByProduct: bootstrap.lookups.inventoryByProduct,
  })
  await updateCatalogStockColumn(stockValues)

  return {
    inputCount: inputRows.length,
    outputCount: outputRows.length,
    transactionCount: transactionRows.length,
  }
}

export async function confirmReturnBatch(payload, bootstrap) {
  const returnBatchId = requireNonEmptyString(payload.returnBatchId, 'return_batch_id')
  const createdBy = requireNonEmptyString(payload.createdBy || 'web-user', 'created_by')
  const note = String(payload.note || '')
  const lines = Array.isArray(payload.lines) ? payload.lines : []
  if (!lines.length) {
    throw new Error('Return batch is empty')
  }

  const catalogBySku = new Map(bootstrap.shopeeCatalog.map((item) => [item.sku, item]))
  const lookups = {
    ...bootstrap.lookups,
    catalogBySku,
  }

  const resolvedLines = lines.map((line) =>
    resolveBatchLine(
      {
        shopeeSku: requireNonEmptyString(line.shopeeSku, 'shopeeSku'),
        quantity: requirePositiveNumber(line.quantity, 'quantity'),
        mixSelections: Array.isArray(line.mixSelections) ? line.mixSelections : [],
      },
      lookups,
    ),
  )

  const allOutputs = resolvedLines.flatMap((line) => line.outputs)

  const inputRows = []
  const outputRows = []
  const transactionRows = []

  resolvedLines.forEach((line) => {
    const inputId = makeId('RETURN')
    inputRows.push({
      return_input_id: inputId,
      return_batch_id: returnBatchId,
      order_id: '',
      return_shopee_sku: line.catalogItem.sku,
      shopee_product_name: makeShopeeProductName(line.catalogItem),
      return_qty: line.requiredQty / line.mapping.conversionQty,
      return_status: 'Restocked',
      created_by: createdBy,
      note,
    })

    line.outputs.forEach((output) => {
      outputRows.push({
        return_output_id: makeId('RETURN-OUT'),
        return_input_id: inputId,
        return_batch_id: returnBatchId,
        order_id: '',
        return_shopee_sku: line.catalogItem.sku,
        mapping_type: line.mapping.mappingType,
        odoo_product_key: output.odooProductKey,
        display_name: bootstrap.lookups.productsByKey.get(output.odooProductKey)?.displayName || output.odooProductKey,
        return_required_qty: output.qty,
        selected_qty: output.qty,
        confirm_status: 'Restocked',
      })

      transactionRows.push({
        transaction_id: makeId('TX'),
        transaction_date: getToday(),
        type: 'IN',
        odoo_product_key: output.odooProductKey,
        qty: output.qty,
        reference_type: 'RETURN_FROM_CUSTOMER',
        reference_id: returnBatchId,
        source_input_id: inputId,
        source_shopee_sku: line.catalogItem.sku,
        source_mapping_type: line.mapping.mappingType,
        odoo_status: 'Pending Odoo sync',
        created_by: createdBy,
        note,
      })
    })
  })

  await appendObjects('Return_Input', inputRows)
  await appendObjects('Return_Output', outputRows)
  await appendObjects('Inventory_Transactions', transactionRows)

  applyInventoryDelta(bootstrap.lookups.inventoryByProduct, allOutputs, 'IN')
  const stockValues = computeCatalogStocks({
    shopeeCatalog: bootstrap.shopeeCatalog,
    mappingsBySku: bootstrap.lookups.mappingsBySku,
    componentsBySku: bootstrap.lookups.componentsBySku,
    mixOptionsByGroup: bootstrap.lookups.mixOptionsByGroup,
    inventoryByProduct: bootstrap.lookups.inventoryByProduct,
  })
  await updateCatalogStockColumn(stockValues)

  return {
    inputCount: inputRows.length,
    outputCount: outputRows.length,
    transactionCount: transactionRows.length,
  }
}

export async function confirmInbound(payload, bootstrap) {
  const referenceId = requireNonEmptyString(payload.referenceId, 'reference_id')
  const odooProductKey = requireNonEmptyString(payload.odooProductKey, 'odoo_product_key')
  const qty = requirePositiveNumber(payload.qty, 'qty')
  const createdBy = requireNonEmptyString(payload.createdBy || 'web-user', 'created_by')
  const note = String(payload.note || '')

  if (!bootstrap.lookups.productsByKey.has(odooProductKey)) {
    throw new Error(`Odoo product does not exist: ${odooProductKey}`)
  }

  const transactionRows = [
    {
      transaction_id: makeId('TX'),
      transaction_date: getToday(),
      type: 'IN',
      odoo_product_key: odooProductKey,
      qty,
      reference_type: 'TRANSFER_FROM_MAIN',
      reference_id: referenceId,
      source_input_id: makeId('INBOUND'),
      source_shopee_sku: '',
      source_mapping_type: '',
      odoo_status: 'Pending Odoo sync',
      created_by: createdBy,
      note,
    },
  ]

  await appendObjects('Inventory_Transactions', transactionRows)

  applyInventoryDelta(bootstrap.lookups.inventoryByProduct, [{ odooProductKey, qty }], 'IN')
  const stockValues = computeCatalogStocks({
    shopeeCatalog: bootstrap.shopeeCatalog,
    mappingsBySku: bootstrap.lookups.mappingsBySku,
    componentsBySku: bootstrap.lookups.componentsBySku,
    mixOptionsByGroup: bootstrap.lookups.mixOptionsByGroup,
    inventoryByProduct: bootstrap.lookups.inventoryByProduct,
  })
  await updateCatalogStockColumn(stockValues)

  return {
    transactionCount: transactionRows.length,
  }
}
