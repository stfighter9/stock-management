import { batchReadSheetRecords } from './sheets.js'
import {
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
} from './stock.js'

const BOOTSTRAP_SHEETS = [
  'Products',
  'Shopee_Catalog',
  'Shopee_Mapping',
  'Shopee_Mapping_Components',
  'Mix_Color_Options',
  'Inventory_Report',
  'Daily_Inbound_Report',
  'Daily_Outbound_Report',
  'Inventory_Transactions',
]

export async function loadBootstrapData() {
  const rawSheets = await batchReadSheetRecords(BOOTSTRAP_SHEETS)

  const products = buildProducts(rawSheets.Products || [])
  const productsByKey = new Map(products.map((product) => [product.key, product]))
  const shopeeCatalog = buildCatalog(rawSheets.Shopee_Catalog || [])
  const shopeeMappings = buildMappings(rawSheets.Shopee_Mapping || [])
  const mappingComponents = buildMappingComponents(rawSheets.Shopee_Mapping_Components || [])
  const mixOptions = buildMixOptions(rawSheets.Mix_Color_Options || [], productsByKey)
  const inventoryReport = buildInventoryReport(rawSheets.Inventory_Report || [])
  const dailyInboundReport = buildDailyInboundReport(rawSheets.Inventory_Transactions || [], productsByKey)
  const dailyOutboundReport = buildDailyOutboundReport(rawSheets.Inventory_Transactions || [], productsByKey)
  const recentTransactions = buildRecentTransactions(rawSheets.Inventory_Transactions || [])

  return {
    products,
    shopeeCatalog,
    shopeeMappings,
    mappingComponents,
    mixOptions,
    inventoryReport,
    dailyInboundReport,
    dailyOutboundReport,
    recentTransactions,
    lookups: buildLookupMaps({
      products,
      mappings: shopeeMappings,
      mappingComponents,
      mixOptions,
      inventoryReport,
    }),
    rawSheets,
  }
}
