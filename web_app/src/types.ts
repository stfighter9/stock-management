export type MappingType = 'FIXED_SKU' | 'MIX_COLOR' | 'COMBO_SKU'
export type TransactionType = 'IN' | 'OUT' | 'ADJUST' | 'CANCEL_REVERSAL'
export type ReferenceType = 'TRANSFER_FROM_MAIN' | 'RETURN_FROM_CUSTOMER' | 'SHOPEE_ORDER' | 'STOCKTAKE'
export type OdooStatus = 'Chờ ghi nhận Odoo' | 'Đã ghi nhận Odoo' | 'Không cần ghi nhận'
export type ViewId = 'dashboard' | 'orders' | 'returns' | 'inbound' | 'mapping' | 'reports'
export type FlowMode = 'OUT' | 'IN'
export type ReportTab = 'inventory' | 'inbound' | 'outbound'

export type Product = {
  key: string
  displayName: string
  openingQty: number
  unit: string
}

export type ShopeeCatalogItem = {
  sku: string
  productName: string
  variationName: string
  stock: number
  active: boolean
}

export type ShopeeMapping = {
  shopeeSku: string
  mappingType: MappingType
  odooProductKey?: string
  mixGroupId?: string
  conversionQty: number
  active: boolean
}

export type ShopeeMappingComponent = {
  shopeeSku: string
  componentNo: number
  odooProductKey: string
  componentQty: number
  active: boolean
}

export type MixColorOption = {
  mixGroupId: string
  odooProductKey: string
  displayName: string
  unit: string
  active: boolean
}

export type InventoryTransaction = {
  id: string
  date: string
  type: TransactionType
  odooProductKey: string
  qty: number
  referenceType: ReferenceType
  referenceId: string
  sourceInputId: string
  sourceShopeeSku: string
  sourceMappingType: MappingType | ''
  odooStatus: OdooStatus
  createdBy: string
  note: string
}

export type MixSelection = {
  odooProductKey: string
  qty: number
}

export type InventoryReportEntry = {
  odooProductKey: string
  displayName: string
  currentQty: number
}

export type InventoryRow = Product & {
  currentQty: number
}

export type CatalogRow = ShopeeCatalogItem & {
  mappingType: MappingType | 'UNMAPPED'
  detail: string
}

export type BatchLine = {
  lineId: string
  referenceId: string
  query: string
  selectedSku: string
  qty: number
  mixSelections: MixSelection[]
  expanded: boolean
}

export type BatchOutputRow = {
  odooProductKey: string
  qty: number
}

export type BatchLineResult = {
  line: BatchLine
  catalogItem?: ShopeeCatalogItem
  mapping?: ShopeeMapping
  requiredQty: number
  outputs: BatchOutputRow[]
  errors: string[]
}

export type DailyInboundRow = {
  date: string
  referenceType: ReferenceType
  productKey: string
  displayName: string
  qty: number
  count: number
  odooStatus: OdooStatus
}

export type DailyOutboundRow = {
  date: string
  productKey: string
  displayName: string
  qty: number
  count: number
}

export type BootstrapData = {
  products: Product[]
  shopeeCatalog: ShopeeCatalogItem[]
  shopeeMappings: ShopeeMapping[]
  mappingComponents: ShopeeMappingComponent[]
  mixOptions: MixColorOption[]
  inventoryReport: InventoryReportEntry[]
  dailyInboundReport: DailyInboundRow[]
  dailyOutboundReport: DailyOutboundRow[]
  recentTransactions: InventoryTransaction[]
}

export type BatchMutationLine = {
  shopeeSku: string
  quantity: number
  mixSelections: MixSelection[]
}

export type PickBatchPayload = {
  pickBatchId: string
  createdBy: string
  note: string
  lines: BatchMutationLine[]
}

export type ReturnBatchPayload = {
  returnBatchId: string
  createdBy: string
  note: string
  lines: BatchMutationLine[]
}

export type InboundPayload = {
  referenceId: string
  odooProductKey: string
  qty: number
  createdBy: string
  note: string
}

export type ApiResponse<T> = {
  success: boolean
  message: string
  data: T
}
