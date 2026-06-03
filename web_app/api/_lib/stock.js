function normalizeNumber(value) {
  const text = String(value ?? '').replace(/[,\s]/g, '')
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeBoolean(value) {
  return value === true || String(value).toUpperCase() === 'TRUE'
}

export function getToday() {
  return new Date().toISOString().slice(0, 10)
}

export function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`
}

export function inventoryStatus(currentQty) {
  if (currentQty < 0) return 'Âm tồn'
  if (currentQty === 0) return 'Hết hàng'
  return 'Còn hàng'
}

export function buildProducts(rawRows) {
  return rawRows
    .filter((row) => row.odoo_product_key)
    .map((row) => ({
      key: String(row.odoo_product_key),
      displayName: String(row.display_name || row.odoo_product_key),
      openingQty: normalizeNumber(row.quantity_on_hand),
      unit: String(row.unit || ''),
    }))
}

export function buildCatalog(rawRows) {
  return rawRows
    .filter((row) => row.sku)
    .map((row) => ({
      sku: String(row.sku),
      productName: String(row.product_name || ''),
      variationName: String(row.variation_name || ''),
      stock: normalizeNumber(row.stock),
      active: true,
    }))
}

export function buildMappings(rawRows) {
  return rawRows
    .filter((row) => row.shopee_sku)
    .map((row) => ({
      shopeeSku: String(row.shopee_sku),
      mappingType: String(row.mapping_type || ''),
      odooProductKey: row.odoo_product_key ? String(row.odoo_product_key) : undefined,
      mixGroupId: row.mix_group_id ? String(row.mix_group_id) : undefined,
      conversionQty: normalizeNumber(row.conversion_qty),
      active: normalizeBoolean(row.active),
    }))
}

export function buildMappingComponents(rawRows) {
  return rawRows
    .filter((row) => row.shopee_sku && row.odoo_product_key)
    .map((row) => ({
      shopeeSku: String(row.shopee_sku),
      componentNo: normalizeNumber(row.component_no),
      odooProductKey: String(row.odoo_product_key),
      componentQty: normalizeNumber(row.component_qty),
      active: normalizeBoolean(row.active),
    }))
}

export function buildMixOptions(rawRows, productsByKey) {
  return rawRows
    .filter((row) => row.mix_group_id && row.odoo_product_key)
    .map((row) => ({
      mixGroupId: String(row.mix_group_id),
      odooProductKey: String(row.odoo_product_key),
      displayName: String(row.display_name || productsByKey.get(String(row.odoo_product_key))?.displayName || row.odoo_product_key),
      unit: productsByKey.get(String(row.odoo_product_key))?.unit || '',
      active: normalizeBoolean(row.active),
    }))
}

export function buildInventoryReport(rawRows) {
  return rawRows
    .filter((row) => row.odoo_product_key)
    .map((row) => ({
      odooProductKey: String(row.odoo_product_key),
      displayName: String(row.display_name || row.odoo_product_key),
      currentQty: normalizeNumber(row.current_qty),
    }))
}

function sortReportRows(a, b) {
  return `${b.date}|${b.productKey}`.localeCompare(`${a.date}|${a.productKey}`)
}

export function buildDailyInboundReport(rawRows, productsByKey = new Map()) {
  const grouped = new Map()

  rawRows.forEach((row) => {
    if (String(row.type || '') !== 'IN' || !row.transaction_date || !row.odoo_product_key) {
      return
    }

    const date = String(row.transaction_date)
    const referenceType = String(row.reference_type || '')
    const productKey = String(row.odoo_product_key)
    const odooStatus = String(row.odoo_status || '')
    const qty = normalizeNumber(row.qty)
    if (qty <= 0) {
      return
    }

    const groupKey = `${date}\t${referenceType}\t${productKey}\t${odooStatus}`
    const current = grouped.get(groupKey) || {
      date,
      referenceType,
      productKey,
      displayName: String(productsByKey.get(productKey)?.displayName || productKey),
      qty: 0,
      count: 0,
      odooStatus,
    }
    current.qty += qty
    current.count += 1
    grouped.set(groupKey, current)
  })

  return Array.from(grouped.values()).sort(sortReportRows)
}

export function buildDailyOutboundReport(rawRows, productsByKey = new Map()) {
  const grouped = new Map()

  rawRows.forEach((row) => {
    if (String(row.type || '') !== 'OUT' || !row.transaction_date || !row.odoo_product_key) {
      return
    }

    const date = String(row.transaction_date)
    const productKey = String(row.odoo_product_key)
    const qty = Math.abs(normalizeNumber(row.qty))
    if (qty <= 0) {
      return
    }

    const groupKey = `${date}\t${productKey}`
    const current = grouped.get(groupKey) || {
      date,
      productKey,
      displayName: String(productsByKey.get(productKey)?.displayName || productKey),
      qty: 0,
      sourceIds: new Set(),
    }
    current.qty += qty
    current.sourceIds.add(String(row.source_input_id || row.transaction_id || ''))
    grouped.set(groupKey, current)
  })

  return Array.from(grouped.values())
    .map((row) => ({
      date: row.date,
      productKey: row.productKey,
      displayName: row.displayName,
      qty: row.qty,
      count: row.sourceIds.size,
    }))
    .sort(sortReportRows)
}

export function buildRecentTransactions(rawRows) {
  return rawRows
    .filter((row) => row.transaction_id)
    .map((row) => ({
      id: String(row.transaction_id),
      date: String(row.transaction_date || ''),
      type: String(row.type || ''),
      odooProductKey: String(row.odoo_product_key || ''),
      qty: normalizeNumber(row.qty),
      referenceType: String(row.reference_type || ''),
      referenceId: String(row.reference_id || ''),
      sourceInputId: String(row.source_input_id || ''),
      sourceShopeeSku: String(row.source_shopee_sku || ''),
      sourceMappingType: row.source_mapping_type ? String(row.source_mapping_type) : '',
      odooStatus: String(row.odoo_status || ''),
      createdBy: String(row.created_by || ''),
      note: String(row.note || ''),
    }))
    .sort((a, b) => `${b.date}|${b.id}`.localeCompare(`${a.date}|${a.id}`))
    .slice(0, 20)
}

export function buildLookupMaps({ products, mappings, mappingComponents, mixOptions, inventoryReport }) {
  const productsByKey = new Map(products.map((product) => [product.key, product]))
  const mappingsBySku = new Map(mappings.map((mapping) => [mapping.shopeeSku, mapping]))
  const componentsBySku = new Map()
  mappingComponents.forEach((component) => {
    if (!componentsBySku.has(component.shopeeSku)) {
      componentsBySku.set(component.shopeeSku, [])
    }
    componentsBySku.get(component.shopeeSku).push(component)
  })

  const mixOptionsByGroup = new Map()
  mixOptions.forEach((option) => {
    if (!mixOptionsByGroup.has(option.mixGroupId)) {
      mixOptionsByGroup.set(option.mixGroupId, [])
    }
    mixOptionsByGroup.get(option.mixGroupId).push(option)
  })

  const inventoryByProduct = new Map(inventoryReport.map((row) => [row.odooProductKey, row.currentQty]))

  return { productsByKey, mappingsBySku, componentsBySku, mixOptionsByGroup, inventoryByProduct }
}

function getMixOptions(mixGroupId, mixOptionsByGroup) {
  return (mixOptionsByGroup.get(mixGroupId) || []).filter((option) => option.active)
}

export function computeCatalogStocks({ shopeeCatalog, mappingsBySku, componentsBySku, mixOptionsByGroup, inventoryByProduct }) {
  return shopeeCatalog.map((item) => {
    const mapping = mappingsBySku.get(item.sku)
    if (!mapping || !mapping.active) {
      return ''
    }

    if (mapping.mappingType === 'FIXED_SKU' && mapping.odooProductKey) {
      const currentQty = inventoryByProduct.get(mapping.odooProductKey) || 0
      return Math.max(0, Math.floor(currentQty / mapping.conversionQty))
    }

    if (mapping.mappingType === 'MIX_COLOR' && mapping.mixGroupId) {
      const totalQty = getMixOptions(mapping.mixGroupId, mixOptionsByGroup).reduce(
        (sum, option) => sum + (inventoryByProduct.get(option.odooProductKey) || 0),
        0,
      )
      return Math.max(0, Math.floor(totalQty / mapping.conversionQty))
    }

    if (mapping.mappingType === 'COMBO_SKU') {
      const components = (componentsBySku.get(item.sku) || []).filter((component) => component.active)
      if (!components.length) {
        return ''
      }
      const bottlenecks = components.map((component) => {
        const currentQty = inventoryByProduct.get(component.odooProductKey) || 0
        return Math.floor(currentQty / component.componentQty)
      })
      return Math.max(0, Math.min(...bottlenecks))
    }

    return ''
  })
}

export function resolveBatchLine(line, lookups) {
  const catalogItem = lookups.catalogBySku.get(line.shopeeSku)
  const mapping = lookups.mappingsBySku.get(line.shopeeSku)

  if (!catalogItem) {
    throw new Error(`SKU Shopee không tồn tại: ${line.shopeeSku}`)
  }
  if (!mapping || !mapping.active) {
    throw new Error(`SKU Shopee chưa có mapping hoạt động: ${line.shopeeSku}`)
  }
  if (line.quantity <= 0) {
    throw new Error(`Số lượng phải lớn hơn 0 cho SKU ${line.shopeeSku}`)
  }

  const requiredQty = line.quantity * mapping.conversionQty

  if (mapping.mappingType === 'FIXED_SKU') {
    if (!mapping.odooProductKey) {
      throw new Error(`Thiếu odoo_product_key cho SKU ${line.shopeeSku}`)
    }
    return {
      catalogItem,
      mapping,
      requiredQty,
      outputs: [{ odooProductKey: mapping.odooProductKey, qty: requiredQty }],
    }
  }

  if (mapping.mappingType === 'COMBO_SKU') {
    const components = (lookups.componentsBySku.get(line.shopeeSku) || []).filter((component) => component.active)
    if (!components.length) {
      throw new Error(`Thiếu component cho combo SKU ${line.shopeeSku}`)
    }
    return {
      catalogItem,
      mapping,
      requiredQty,
      outputs: components.map((component) => ({
        odooProductKey: component.odooProductKey,
        qty: component.componentQty * line.quantity,
      })),
    }
  }

  const validOptions = new Set(getMixOptions(mapping.mixGroupId, lookups.mixOptionsByGroup).map((option) => option.odooProductKey))
  const outputs = (line.mixSelections || []).filter((selection) => selection.qty > 0)
  const totalQty = outputs.reduce((sum, selection) => sum + selection.qty, 0)

  if (!outputs.length) {
    throw new Error(`Chưa chọn product mix cho SKU ${line.shopeeSku}`)
  }
  if (outputs.some((selection) => !validOptions.has(selection.odooProductKey))) {
    throw new Error(`Có mã Odoo không hợp lệ trong mix của SKU ${line.shopeeSku}`)
  }
  if (totalQty !== requiredQty) {
    throw new Error(`Tổng số lượng mix phải bằng ${requiredQty} cho SKU ${line.shopeeSku}`)
  }

  return {
    catalogItem,
    mapping,
    requiredQty,
    outputs,
  }
}

export function assertEnoughStock(outputs, inventoryByProduct) {
  const totals = new Map()
  outputs.forEach((output) => {
    totals.set(output.odooProductKey, (totals.get(output.odooProductKey) || 0) + output.qty)
  })

  totals.forEach((qty, odooProductKey) => {
    const currentQty = inventoryByProduct.get(odooProductKey) || 0
    if (currentQty < qty) {
      throw new Error(`Thiếu tồn cho ${odooProductKey}: cần ${qty}, hiện có ${currentQty}`)
    }
  })
}

export function applyInventoryDelta(inventoryByProduct, outputs, direction) {
  outputs.forEach((output) => {
    const currentQty = inventoryByProduct.get(output.odooProductKey) || 0
    const delta = direction === 'OUT' ? -output.qty : output.qty
    inventoryByProduct.set(output.odooProductKey, currentQty + delta)
  })
}
