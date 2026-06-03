import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  Boxes,
  Check,
  ClipboardList,
  FileSpreadsheet,
  Layers3,
  PackageCheck,
  Plus,
  RefreshCcw,
  Search,
  Settings,
  ShoppingBag,
  Trash2,
  Undo2,
} from 'lucide-react'
import {
  confirmInbound,
  confirmPickBatch,
  confirmReturnBatch,
  loadBootstrap,
} from './lib/api'
import type {
  BatchLine,
  BatchLineResult,
  BatchMutationLine,
  BatchOutputRow,
  BootstrapData,
  CatalogRow,
  DailyInboundRow,
  DailyOutboundRow,
  FlowMode,
  InboundPayload,
  InventoryRow,
  InventoryTransaction,
  MixColorOption,
  MixSelection,
  Product,
  ReportTab,
  ShopeeCatalogItem,
  ShopeeMapping,
  ShopeeMappingComponent,
  ViewId,
} from './types'
import './App.css'

const navItems: Array<{ id: ViewId; label: string; icon: typeof Boxes }> = [
  { id: 'dashboard', label: 'Tổng quan', icon: Boxes },
  { id: 'orders', label: 'Pick kho', icon: ShoppingBag },
  { id: 'returns', label: 'Hàng hoàn', icon: Undo2 },
  { id: 'inbound', label: 'Nhập kho', icon: ArrowDownToLine },
  { id: 'mapping', label: 'Mapping', icon: Settings },
  { id: 'reports', label: 'Báo cáo', icon: BarChart3 },
]

const EMPTY_PRODUCTS: Product[] = []
const EMPTY_CATALOG: ShopeeCatalogItem[] = []
const EMPTY_MAPPINGS: ShopeeMapping[] = []
const EMPTY_COMPONENTS: ShopeeMappingComponent[] = []
const EMPTY_MIX_OPTIONS: MixColorOption[] = []
const EMPTY_TRANSACTIONS: InventoryTransaction[] = []
const EMPTY_DAILY_INBOUND: DailyInboundRow[] = []
const EMPTY_DAILY_OUTBOUND: DailyOutboundRow[] = []

function todayText() {
  return new Date().toISOString().slice(0, 10)
}

function formatQty(value: number) {
  return new Intl.NumberFormat('vi-VN').format(value)
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`
}

function createBlankLine(mode: FlowMode, overrides?: Partial<BatchLine>): BatchLine {
  return {
    lineId: makeId(mode === 'OUT' ? 'ORDER-LINE' : 'RETURN-LINE'),
    referenceId: '',
    query: '',
    selectedSku: '',
    qty: 1,
    mixSelections: [],
    expanded: true,
    ...overrides,
  }
}

function makeBatchCode(prefix: 'PICK' | 'RETURN') {
  const stamp = todayText().replaceAll('-', '')
  const suffix = String(Math.floor(Math.random() * 900) + 100)
  return `${prefix}-${stamp}-${suffix}`
}

function App() {
  const [activeView, setActiveView] = useState<ViewId>('dashboard')
  const [bootstrap, setBootstrap] = useState<BootstrapData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [query, setQuery] = useState('')

  const reloadBootstrap = useCallback(async () => {
    try {
      const data = await loadBootstrap()
      setBootstrap(data)
      setLoadError('')
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Không tải được dữ liệu Google Sheets')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadBootstrap()
      .then((data) => {
        setBootstrap(data)
        setLoadError('')
      })
      .catch((error: unknown) => {
        setLoadError(error instanceof Error ? error.message : 'Không tải được dữ liệu Google Sheets')
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  const products = bootstrap?.products ?? EMPTY_PRODUCTS
  const shopeeCatalog = bootstrap?.shopeeCatalog ?? EMPTY_CATALOG
  const shopeeMappings = bootstrap?.shopeeMappings ?? EMPTY_MAPPINGS
  const shopeeMappingComponents = bootstrap?.mappingComponents ?? EMPTY_COMPONENTS
  const mixOptions = bootstrap?.mixOptions ?? EMPTY_MIX_OPTIONS
  const transactions = bootstrap?.recentTransactions ?? EMPTY_TRANSACTIONS
  const dailyInbound = bootstrap?.dailyInboundReport ?? EMPTY_DAILY_INBOUND
  const dailyOutbound = bootstrap?.dailyOutboundReport ?? EMPTY_DAILY_OUTBOUND

  const productByKey = useMemo(() => new Map(products.map((product) => [product.key, product])), [products])
  const catalogBySku = useMemo(() => new Map(shopeeCatalog.map((item) => [item.sku, item])), [shopeeCatalog])
  const mappingBySku = useMemo(() => new Map(shopeeMappings.map((item) => [item.shopeeSku, item])), [shopeeMappings])
  const mixOptionsByGroup = useMemo(() => {
    const grouped = new Map<string, MixColorOption[]>()
    mixOptions.forEach((option) => {
      if (!grouped.has(option.mixGroupId)) grouped.set(option.mixGroupId, [])
      grouped.get(option.mixGroupId)?.push(option)
    })
    return grouped
  }, [mixOptions])
  const componentsBySku = useMemo(() => {
    const grouped = new Map<string, ShopeeMappingComponent[]>()
    shopeeMappingComponents.forEach((component) => {
      if (!grouped.has(component.shopeeSku)) grouped.set(component.shopeeSku, [])
      grouped.get(component.shopeeSku)?.push(component)
    })
    return grouped
  }, [shopeeMappingComponents])

  const stockByProduct = useMemo(() => {
    const totals = new Map<string, number>()
    ;(bootstrap?.inventoryReport ?? []).forEach((row) => {
      totals.set(row.odooProductKey, row.currentQty)
    })
    return totals
  }, [bootstrap?.inventoryReport])

  const inventoryRows = useMemo(() => {
    return products.map((product) => {
      const currentQty = stockByProduct.get(product.key) ?? 0
      return {
        ...product,
        currentQty,
      }
    })
  }, [products, stockByProduct])

  const catalogRows = useMemo(() => {
    return shopeeCatalog.map((item) => {
      const mapping = mappingBySku.get(item.sku)
      return {
        ...item,
        mappingType: (mapping?.mappingType ?? 'UNMAPPED') as CatalogRow['mappingType'],
        detail: describeCatalogMapping(mapping, componentsBySku),
      }
    })
  }, [componentsBySku, mappingBySku, shopeeCatalog])

  const filteredInventory = inventoryRows.filter((row) => {
    const text = `${row.key} ${row.displayName}`.toLowerCase()
    return text.includes(query.toLowerCase())
  })

  const filteredCatalogRows = catalogRows.filter((row) => {
    const text = `${row.sku} ${row.productName} ${row.variationName}`.toLowerCase()
    return text.includes(query.toLowerCase())
  })

  const filteredMappings = shopeeMappings.filter((row) => {
    const catalogItem = catalogBySku.get(row.shopeeSku)
    const text = `${row.shopeeSku} ${catalogItem?.productName ?? ''} ${catalogItem?.variationName ?? ''}`.toLowerCase()
    return text.includes(query.toLowerCase())
  })

  const filteredComponents = shopeeMappingComponents.filter((row) => {
    const text = `${row.shopeeSku} ${row.odooProductKey}`.toLowerCase()
    return text.includes(query.toLowerCase())
  })

  const filteredMixOptions = mixOptions.filter((row) => {
    const text = `${row.mixGroupId} ${row.odooProductKey} ${row.displayName}`.toLowerCase()
    return text.includes(query.toLowerCase())
  })

  const handleBatchConfirm = useCallback(async (mode: FlowMode, batchId: string, lines: BatchMutationLine[]) => {
    if (mode === 'OUT') {
      await confirmPickBatch({
        pickBatchId: batchId,
        createdBy: 'web-user',
        note: '',
        lines,
      })
    } else {
      await confirmReturnBatch({
        returnBatchId: batchId,
        createdBy: 'web-user',
        note: '',
        lines,
      })
    }

    await reloadBootstrap()
    setActiveView('dashboard')
  }, [reloadBootstrap])

  const handleInboundConfirm = useCallback(async (payload: InboundPayload) => {
    await confirmInbound(payload)
    await reloadBootstrap()
    setActiveView('dashboard')
  }, [reloadBootstrap])

  if (isLoading && !bootstrap) {
    return (
      <div className="app-shell">
        <main className="workspace">
          <div className="empty-state">Đang tải dữ liệu từ Google Sheets...</div>
        </main>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <PackageCheck size={22} />
          </div>
          <div>
            <strong>Kho Shopee</strong>
            <span>Odoo Sheets</span>
          </div>
        </div>
        <nav className="nav-list">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                className={activeView === item.id ? 'nav-item active' : 'nav-item'}
                key={item.id}
                onClick={() => setActiveView(item.id)}
                type="button"
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>
        <div className="sync-card">
          <FileSpreadsheet size={18} />
          <div>
            <strong>Google Sheets</strong>
            <span>{loadError ? 'Lỗi kết nối dữ liệu' : 'Dữ liệu runtime từ Google Sheets'}</span>
          </div>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Vận hành kho Shopee</p>
            <h1>{navItems.find((item) => item.id === activeView)?.label}</h1>
          </div>
          <div className="search-box">
            <Search size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm mã Odoo, SKU Shopee hoặc tên sản phẩm"
            />
          </div>
        </header>

        {loadError && <div className="notice danger">{loadError}</div>}

        {activeView === 'dashboard' && (
          <Dashboard
            inventoryRows={filteredInventory}
            catalogRows={filteredCatalogRows}
            transactions={transactions}
            dailyInbound={dailyInbound}
            dailyOutbound={dailyOutbound}
          />
        )}
        {activeView === 'orders' && (
          <ShopeeBatchScreen
            mode="OUT"
            catalogRows={catalogRows}
            catalogBySku={catalogBySku}
            componentsBySku={componentsBySku}
            mixOptionsByGroup={mixOptionsByGroup}
            productByKey={productByKey}
            stockByProduct={stockByProduct}
            mappingBySku={mappingBySku}
            onConfirm={handleBatchConfirm}
          />
        )}
        {activeView === 'returns' && (
          <ShopeeBatchScreen
            mode="IN"
            catalogRows={catalogRows}
            catalogBySku={catalogBySku}
            componentsBySku={componentsBySku}
            mixOptionsByGroup={mixOptionsByGroup}
            productByKey={productByKey}
            stockByProduct={stockByProduct}
            mappingBySku={mappingBySku}
            onConfirm={handleBatchConfirm}
          />
        )}
        {activeView === 'inbound' && (
          <InboundScreen products={products} onConfirm={handleInboundConfirm} />
        )}
        {activeView === 'mapping' && (
          <MappingScreen
            catalogRows={filteredCatalogRows}
            mappings={filteredMappings}
            components={filteredComponents}
            mixOptions={filteredMixOptions}
            products={products}
          />
        )}
        {activeView === 'reports' && (
          <ReportsScreen
            inventoryRows={filteredInventory}
            catalogRows={filteredCatalogRows}
            dailyInbound={dailyInbound}
            dailyOutbound={dailyOutbound}
          />
        )}
      </main>
    </div>
  )
}

function Dashboard({
  inventoryRows,
  catalogRows,
  transactions,
  dailyInbound,
  dailyOutbound,
}: {
  inventoryRows: InventoryRow[]
  catalogRows: CatalogRow[]
  transactions: InventoryTransaction[]
  dailyInbound: DailyInboundRow[]
  dailyOutbound: DailyOutboundRow[]
}) {
  const totalProducts = inventoryRows.length
  const outboundToday = dailyOutbound.filter((row) => row.date === todayText()).reduce((sum, row) => sum + row.qty, 0)
  const inboundToday = dailyInbound.filter((row) => row.date === todayText()).reduce((sum, row) => sum + row.qty, 0)
  const pendingMappings = catalogRows.filter((row) => row.mappingType === 'UNMAPPED').length

  return (
    <div className="view-stack">
      <section className="metrics-grid">
        <Metric icon={Layers3} label="Mã Odoo" value={totalProducts} />
        <Metric icon={ArrowUpFromLine} label="Xuất hôm nay" value={formatQty(outboundToday)} />
        <Metric icon={ArrowDownToLine} label="Nhập hôm nay" value={formatQty(inboundToday)} />
        <Metric icon={ClipboardList} label="SKU chưa mapping" value={pendingMappings} tone={pendingMappings > 0 ? 'danger' : 'ok'} />
      </section>

      <section className="split-grid">
        <Panel title="Tồn hiện tại" icon={Boxes}>
          <InventoryTable rows={inventoryRows.slice(0, 8)} compact />
        </Panel>
        <Panel title="Tồn hiển thị Shopee" icon={ShoppingBag}>
          <CatalogTable rows={catalogRows.slice(0, 8)} />
        </Panel>
      </section>

      <section className="split-grid">
        <Panel title="Giao dịch mới nhất" icon={RefreshCcw}>
          <TransactionList rows={transactions.slice(0, 8)} />
        </Panel>
        <Panel title="Tổng hợp xuất trong ngày" icon={ArrowUpFromLine}>
          <SimpleTable
            headers={['Mã Odoo', 'SL xuất', 'Dòng đơn']}
            rows={dailyOutbound.slice(0, 8).map((row) => [row.productKey, formatQty(row.qty), row.count])}
          />
        </Panel>
      </section>
    </div>
  )
}

function ShopeeBatchScreen({
  mode,
  catalogRows,
  catalogBySku,
  componentsBySku,
  mixOptionsByGroup,
  productByKey,
  stockByProduct,
  mappingBySku,
  onConfirm,
}: {
  mode: FlowMode
  catalogRows: CatalogRow[]
  catalogBySku: Map<string, ShopeeCatalogItem>
  componentsBySku: Map<string, ShopeeMappingComponent[]>
  mixOptionsByGroup: Map<string, MixColorOption[]>
  productByKey: Map<string, Product>
  stockByProduct: Map<string, number>
  mappingBySku: Map<string, ShopeeMapping>
  onConfirm: (mode: FlowMode, batchId: string, lines: BatchMutationLine[]) => Promise<void>
}) {
  const [pickBatchId] = useState(() => makeBatchCode('PICK'))
  const [returnBatchId] = useState(() => makeBatchCode('RETURN'))
  const [lines, setLines] = useState<BatchLine[]>([createBlankLine(mode)])
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const updateLine = (lineId: string, patch: Partial<BatchLine>) => {
    setLines((current) => current.map((line) => (line.lineId === lineId ? { ...line, ...patch } : line)))
  }

  const addLine = () => {
    setLines((current) => [...current, createBlankLine(mode)])
  }

  const removeLine = (lineId: string) => {
    setLines((current) => (current.length === 1 ? current : current.filter((line) => line.lineId !== lineId)))
  }

  const lineResults = useMemo(() => {
    return lines.map((line) =>
      resolveBatchLine({
        line,
        catalogBySku,
        mappingBySku,
        componentsBySku,
        mixOptionsByGroup,
      }),
    )
  }, [catalogBySku, componentsBySku, lines, mappingBySku, mixOptionsByGroup])

  const aggregatedOutputs = useMemo(() => {
    const totals = new Map<string, number>()
    lineResults.forEach((result) => {
      result.outputs.forEach((row) => {
        totals.set(row.odooProductKey, (totals.get(row.odooProductKey) ?? 0) + row.qty)
      })
    })

    return Array.from(totals.entries())
      .map(([odooProductKey, qty]) => {
        const currentQty = stockByProduct.get(odooProductKey) ?? 0
        return {
          odooProductKey,
          qty,
          currentQty,
          remainingQty: mode === 'OUT' ? currentQty - qty : currentQty + qty,
        }
      })
      .sort((a, b) => a.odooProductKey.localeCompare(b.odooProductKey))
  }, [lineResults, mode, stockByProduct])

  const batchErrors = useMemo(() => {
    const errors: string[] = []
    lineResults.forEach((result, index) => {
      if (result.errors.length > 0) {
        errors.push(`Dòng ${index + 1}: ${result.errors[0]}`)
      }
    })

    if (mode === 'OUT') {
      aggregatedOutputs.forEach((row) => {
        if (row.currentQty < row.qty) {
          errors.push(`Thiếu ${formatQty(row.qty - row.currentQty)} ở ${row.odooProductKey}`)
        }
      })
    }

    if (lineResults.every((result) => result.outputs.length === 0)) {
      errors.push('Chưa có dòng hợp lệ để tạo giao dịch')
    }

    return errors
  }, [aggregatedOutputs, lineResults, mode])

  const canConfirm = batchErrors.length === 0

  const activeBatchId = mode === 'OUT' ? pickBatchId : returnBatchId

  const confirm = async () => {
    if (!canConfirm) return

    const payloadLines = lineResults.flatMap((result) => {
      const catalogItem = result.catalogItem
      if (!catalogItem) return []
      return [{
        shopeeSku: catalogItem.sku,
        quantity: result.line.qty,
        mixSelections: result.line.mixSelections,
      }]
    })

    try {
      setSubmitError('')
      setIsSubmitting(true)
      await onConfirm(mode, activeBatchId, payloadLines)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Không xác nhận được batch')
    } finally {
      setIsSubmitting(false)
    }
  }

  const modeLabel = mode === 'OUT' ? 'Pick kho theo list SKU Shopee' : 'Nhập hoàn theo list SKU Shopee'
  const confirmLabel = mode === 'OUT' ? 'Xác nhận pick' : 'Xác nhận nhập hoàn'
  const batchIdLabel = mode === 'OUT' ? 'Pick Batch ID' : 'Return Batch ID'
  const batchIdValue = mode === 'OUT' ? pickBatchId : returnBatchId
  const addLineLabel = mode === 'OUT' ? 'Thêm SKU' : 'Thêm SKU hoàn'

  return (
    <section className="form-layout">
      <Panel title={modeLabel} icon={mode === 'OUT' ? ShoppingBag : Undo2}>
        <>
          <div className="batch-toolbar">
            <div className="batch-fixed-id">
              <span>{batchIdLabel}</span>
              <strong>{batchIdValue}</strong>
              <em>Hệ thống tự sinh</em>
            </div>
            <div className="stack-actions">
              <button className="secondary-action" type="button" onClick={addLine}>
                <Plus size={16} />
                <span>{addLineLabel}</span>
              </button>
            </div>
          </div>

          <div className="pick-table-wrap">
            <table className="pick-table">
              <thead>
                <tr>
                  <th />
                  <th>SKU</th>
                  <th>Product Name</th>
                  <th>Variation Name</th>
                  <th>Quantity</th>
                </tr>
              </thead>
              <tbody>
                {lineResults.map((result, index) => {
                  const catalogOptions = getCatalogOptions(catalogRows, result.line.query, result.line.selectedSku)
                  const productName = result.catalogItem?.productName ?? '-'
                  const variationName = result.catalogItem?.variationName ?? '-'
                  const canExpand = result.outputs.length > 0 || result.mapping?.mappingType === 'MIX_COLOR' || Boolean(result.errors[0])

                  return (
                    <Fragment key={result.line.lineId}>
                      <tr className="pick-parent-row">
                        <td className="expand-cell">
                          <button
                            className="expand-toggle"
                            disabled={!canExpand}
                            onClick={() => updateLine(result.line.lineId, { expanded: !result.line.expanded })}
                            type="button"
                          >
                            {result.line.expanded ? 'v' : '>'}
                          </button>
                        </td>
                        <td>
                          <div className="sku-cell">
                            <input
                              value={result.line.query}
                              onChange={(event) => updateLine(result.line.lineId, { query: event.target.value })}
                              placeholder="Tìm SKU / tên sản phẩm"
                            />
                            <select
                              value={result.line.selectedSku}
                              onChange={(event) => {
                                const nextSku = event.target.value
                                const nextMapping = mappingBySku.get(nextSku)
                                updateLine(result.line.lineId, {
                                  selectedSku: nextSku,
                                  expanded: true,
                                  mixSelections:
                                    nextMapping?.mappingType === 'MIX_COLOR'
                                      ? seedMixSelections(
                                          nextMapping.mixGroupId,
                                          mixOptionsByGroup,
                                          result.line.qty * nextMapping.conversionQty,
                                        )
                                      : [],
                                })
                              }}
                            >
                              <option value="">Chọn SKU ecom</option>
                              {catalogOptions.map((option) => (
                                <option key={option.sku} value={option.sku}>
                                  {option.sku} - {option.productName}
                                </option>
                              ))}
                            </select>
                            <button
                              className="line-remove"
                              disabled={lines.length === 1}
                              onClick={() => removeLine(result.line.lineId)}
                              type="button"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                        <td>{productName}</td>
                        <td>{variationName}</td>
                        <td className="qty-cell">
                          <input
                            min={1}
                            type="number"
                            value={result.line.qty}
                            onChange={(event) => {
                              const nextQty = Math.max(1, Number(event.target.value) || 1)
                              const nextMapping = mappingBySku.get(result.line.selectedSku)
                              updateLine(result.line.lineId, {
                                qty: nextQty,
                                mixSelections:
                                  nextMapping?.mappingType === 'MIX_COLOR' && result.line.mixSelections.length === 0
                                    ? seedMixSelections(nextMapping.mixGroupId, mixOptionsByGroup, nextQty * nextMapping.conversionQty)
                                    : result.line.mixSelections,
                              })
                            }}
                          />
                        </td>
                      </tr>
                      {result.line.expanded && (
                        <tr className="pick-child-row">
                          <td colSpan={5}>
                            <div className="pick-child-panel">
                              <div className="line-summary">
                                <strong>Dòng {index + 1}</strong>
                                <span>SKU ecom: {result.catalogItem?.sku ?? 'Chưa chọn'}</span>
                                <span>Mapping: {result.mapping?.mappingType ?? 'Thiếu mapping'}</span>
                                <span>Tồn ecom: {formatQty(result.catalogItem ? catalogRows.find((row) => row.sku === result.catalogItem?.sku)?.stock ?? 0 : 0)}</span>
                              </div>

                              <ConversionSummary mapping={result.mapping} shopeeQty={result.line.qty} requiredQty={result.requiredQty} />

                              {result.mapping?.mappingType === 'MIX_COLOR' && (
                                <MixSelectionEditor
                                  options={getMixOptions(result.mapping.mixGroupId, mixOptionsByGroup)}
                                  rows={result.line.mixSelections}
                                  requiredQty={result.requiredQty}
                                  onChange={(rows) => updateLine(result.line.lineId, { mixSelections: rows })}
                                />
                              )}

                              {result.errors[0] && <div className="notice danger line-notice">{result.errors[0]}</div>}
                              {result.outputs.length > 0 && !result.errors[0] && (
                                <div className="line-output-wrap">
                                  <LineOutputTable mode={mode} productByKey={productByKey} rows={result.outputs} stockByProduct={stockByProduct} />
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      </Panel>

      <Panel title="Tổng hợp quy đổi" icon={ClipboardList}>
        <div className="summary-stack">
          <div className="summary-metrics">
            <div>
              <span>Số dòng Shopee</span>
              <strong>{formatQty(lines.length)}</strong>
            </div>
            <div>
              <span>Tổng SL Shopee</span>
              <strong>{formatQty(lines.reduce((sum, line) => sum + line.qty, 0))}</strong>
            </div>
            <div>
              <span>Dòng Odoo</span>
              <strong>{formatQty(aggregatedOutputs.length)}</strong>
            </div>
          </div>

          {batchErrors.length > 0 ? (
            <div className="notice warning">
              {batchErrors[0]}
            </div>
          ) : (
            <div className="notice ok">
              Batch sẵn sàng tạo giao dịch
            </div>
          )}

          {submitError && <div className="notice danger">{submitError}</div>}

          <SimpleTable
            headers={['Product name (odoo)', 'Unit', 'Quantity', 'Stock']}
            rows={aggregatedOutputs.map((row) => [
              productByKey.get(row.odooProductKey)?.displayName ?? row.odooProductKey,
              productByKey.get(row.odooProductKey)?.unit ?? '-',
              formatQty(row.qty),
              formatQty(mode === 'OUT' ? row.currentQty : row.remainingQty),
            ])}
          />

          <button className="primary-action" disabled={!canConfirm || isSubmitting} type="button" onClick={() => void confirm()}>
            <Check size={18} />
            <span>{isSubmitting ? 'Đang ghi dữ liệu...' : confirmLabel}</span>
          </button>
        </div>
      </Panel>
    </section>
  )
}

function InboundScreen({
  products,
  onConfirm,
}: {
  products: Product[]
  onConfirm: (payload: InboundPayload) => Promise<void>
}) {
  const [productKey, setProductKey] = useState(products[0]?.key ?? '')
  const [qty, setQty] = useState(20)
  const [referenceId, setReferenceId] = useState('MAIN-TRANSFER-001')
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const selectedProductKey = productKey || products[0]?.key || ''

  const confirm = async () => {
    try {
      setSubmitError('')
      setIsSubmitting(true)
      await onConfirm({
        referenceId,
        odooProductKey: selectedProductKey,
        qty,
        createdBy: 'web-user',
        note: 'Nhập từ kho tổng',
      })
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Không tạo được giao dịch nhập')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="form-layout">
      <Panel title="Nhập từ kho tổng" icon={ArrowDownToLine}>
        <div className="form-grid">
          <Field label="Mã chứng từ">
            <input value={referenceId} onChange={(event) => setReferenceId(event.target.value)} />
          </Field>
          <Field label="Mã Odoo">
            <select value={selectedProductKey} onChange={(event) => setProductKey(event.target.value)}>
              {products.map((product) => (
                <option key={product.key} value={product.key}>
                  {product.key}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Số lượng nhập">
            <input min={1} type="number" value={qty} onChange={(event) => setQty(Number(event.target.value))} />
          </Field>
        </div>
        {submitError && <div className="notice danger">{submitError}</div>}
        <button className="primary-action" disabled={qty <= 0 || !selectedProductKey || isSubmitting} type="button" onClick={() => void confirm()}>
          <Plus size={18} />
          <span>{isSubmitting ? 'Đang ghi dữ liệu...' : 'Tạo giao dịch IN'}</span>
        </button>
      </Panel>
      <Panel title="Nguyên tắc" icon={FileSpreadsheet}>
        <div className="rule-list">
          <p>Nhập từ kho tổng dùng mã Odoo trực tiếp.</p>
          <p>Hàng hoàn đi qua list SKU Shopee, không nhập trực tiếp mã Odoo.</p>
          <p>Stock Shopee chỉ là số hiển thị, giao dịch thật luôn ghi theo mã Odoo.</p>
        </div>
      </Panel>
    </section>
  )
}

function MappingScreen({
  catalogRows,
  mappings,
  components,
  mixOptions,
  products,
}: {
  catalogRows: CatalogRow[]
  mappings: ShopeeMapping[]
  components: ShopeeMappingComponent[]
  mixOptions: MixColorOption[]
  products: Product[]
}) {
  return (
    <div className="view-stack">
      <Panel title="Shopee Catalog" icon={ShoppingBag}>
        <CatalogTable rows={catalogRows} />
      </Panel>

      <section className="split-grid">
        <Panel title="Shopee Mapping" icon={Settings}>
          <SimpleTable
            headers={['Shopee SKU', 'Type', 'Odoo / Mix group', 'Hệ số', 'Active']}
            rows={mappings.map((item) => [
              item.shopeeSku,
              item.mappingType,
              item.odooProductKey ?? item.mixGroupId ?? '',
              item.conversionQty,
              item.active ? 'TRUE' : 'FALSE',
            ])}
          />
        </Panel>
        <Panel title="Mapping Components" icon={Layers3}>
          <SimpleTable
            headers={['Shopee SKU', 'No', 'Mã Odoo', 'SL thành phần', 'Active']}
            rows={components.map((item) => [
              item.shopeeSku,
              item.componentNo,
              item.odooProductKey,
              item.componentQty,
              item.active ? 'TRUE' : 'FALSE',
            ])}
          />
        </Panel>
      </section>

      <section className="split-grid">
        <Panel title="Mix color options" icon={Layers3}>
          <SimpleTable
            headers={['mix_group_id', 'odoo_product_key', 'display_name', 'active']}
            rows={mixOptions.map((item) => [item.mixGroupId, item.odooProductKey, item.displayName, item.active ? 'TRUE' : 'FALSE'])}
          />
        </Panel>
        <Panel title="Danh mục mã Odoo" icon={Boxes}>
          <SimpleTable
            headers={['odoo_product_key', 'display_name', 'unit']}
            rows={products.map((item) => [item.key, item.displayName, item.unit])}
          />
        </Panel>
      </section>
    </div>
  )
}

function ReportsScreen({
  inventoryRows,
  catalogRows,
  dailyInbound,
  dailyOutbound,
}: {
  inventoryRows: InventoryRow[]
  catalogRows: CatalogRow[]
  dailyInbound: DailyInboundRow[]
  dailyOutbound: DailyOutboundRow[]
}) {
  const [activeTab, setActiveTab] = useState<ReportTab>('inventory')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const reportTabs: Array<{ id: ReportTab; label: string }> = [
    { id: 'inventory', label: 'Xem tồn kho hiện tại' },
    { id: 'inbound', label: 'Báo cáo nhập kho' },
    { id: 'outbound', label: 'Báo cáo xuất kho' },
  ]
  const isWithinDateRange = useCallback((date: string) => {
    if (dateFrom && date < dateFrom) return false
    if (dateTo && date > dateTo) return false
    return true
  }, [dateFrom, dateTo])

  const filteredInbound = useMemo(
    () => dailyInbound.filter((row) => isWithinDateRange(row.date)),
    [dailyInbound, isWithinDateRange],
  )

  const filteredOutbound = useMemo(
    () => dailyOutbound.filter((row) => isWithinDateRange(row.date)),
    [dailyOutbound, isWithinDateRange],
  )

  return (
    <div className="view-stack">
      <div className="subnav">
        {reportTabs.map((tab) => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? 'subnav-item active' : 'subnav-item'}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'inventory' && (
        <>
          <Panel title="Báo cáo tồn kho hiện tại" icon={Boxes}>
            <InventoryTable rows={inventoryRows} />
          </Panel>
          <Panel title="Tồn hiển thị trên Shopee" icon={ShoppingBag}>
            <CatalogTable rows={catalogRows} />
          </Panel>
        </>
      )}

      {activeTab === 'inbound' && (
        <section className="view-stack">
          <Panel title="Khoảng thời gian" icon={FileSpreadsheet}>
            <div className="form-grid report-filter-grid">
              <Field label="Từ ngày">
                <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
              </Field>
              <Field label="Đến ngày">
                <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
              </Field>
            </div>
          </Panel>
          <Panel title="Báo cáo nhập kho" icon={ArrowDownToLine}>
            <SimpleTable
              headers={['Ngày', 'Nguồn', 'Mã Odoo', 'Tên sản phẩm', 'SL nhập', 'Dòng', 'Odoo status']}
              rows={filteredInbound.map((row) => [
                row.date,
                row.referenceType,
                row.productKey,
                row.displayName,
                formatQty(row.qty),
                row.count,
                row.odooStatus,
              ])}
            />
          </Panel>
        </section>
      )}

      {activeTab === 'outbound' && (
        <section className="view-stack">
          <Panel title="Khoảng thời gian" icon={FileSpreadsheet}>
            <div className="form-grid report-filter-grid">
              <Field label="Từ ngày">
                <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
              </Field>
              <Field label="Đến ngày">
                <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
              </Field>
            </div>
          </Panel>
          <Panel title="Báo cáo xuất kho" icon={ArrowUpFromLine}>
            <SimpleTable
              headers={['Ngày', 'Mã Odoo', 'Tên sản phẩm', 'SL xuất', 'Dòng đơn']}
              rows={filteredOutbound.map((row) => [row.date, row.productKey, row.displayName, formatQty(row.qty), row.count])}
            />
          </Panel>
        </section>
      )}
    </div>
  )
}

function Metric({ icon: Icon, label, value, tone }: { icon: typeof Boxes; label: string; value: string | number; tone?: 'ok' | 'danger' }) {
  return (
    <article className={`metric ${tone ?? ''}`}>
      <Icon size={20} />
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}

function Panel({ title, icon: Icon, children }: { title: string; icon: typeof Boxes; children: React.ReactNode }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <Icon size={18} />
          <h2>{title}</h2>
        </div>
      </div>
      {children}
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

function ConversionSummary({
  mapping,
  shopeeQty,
  requiredQty,
}: {
  mapping?: ShopeeMapping
  shopeeQty: number
  requiredQty: number
}) {
  if (!mapping) {
    return <div className="notice danger">Thiếu mapping Shopee</div>
  }

  return (
    <div className="conversion-strip">
      <div>
        <span>Mapping</span>
        <strong>{mapping.mappingType}</strong>
      </div>
      <div>
        <span>SL Shopee</span>
        <strong>{formatQty(shopeeQty)}</strong>
      </div>
      <div>
        <span>Hệ số</span>
        <strong>{formatQty(mapping.conversionQty)}</strong>
      </div>
      <div>
        <span>SL Odoo quy đổi</span>
        <strong>{formatQty(requiredQty)}</strong>
      </div>
    </div>
  )
}

function MixSelectionEditor({
  options,
  rows,
  requiredQty,
  onChange,
}: {
  options: MixColorOption[]
  rows: MixSelection[]
  requiredQty: number
  onChange: (rows: MixSelection[]) => void
}) {
  const total = rows.reduce((sum, row) => sum + row.qty, 0)

  const update = (index: number, patch: Partial<MixSelection>) => {
    onChange(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)))
  }

  const remove = (index: number) => {
    onChange(rows.filter((_, rowIndex) => rowIndex !== index))
  }

  return (
    <div className="mix-editor">
      <div className={total === requiredQty ? 'notice ok' : 'notice warning'}>
        Tổng đã chọn {formatQty(total)} / {formatQty(requiredQty)}
      </div>
      <div className="mix-table">
        <div className="mix-table-head">
          <span>Product name (odoo)</span>
          <span>Unit</span>
          <span>Quantity</span>
          <span />
        </div>
        {rows.map((row, index) => {
          const selectedOption = options.find((option) => option.odooProductKey === row.odooProductKey)
          return (
            <div className="mix-row" key={`${row.odooProductKey}-${index}`}>
              <div className="mix-product-cell">
                <select value={row.odooProductKey} onChange={(event) => update(index, { odooProductKey: event.target.value })}>
                  {options.map((option) => (
                    <option key={option.odooProductKey} value={option.odooProductKey}>
                      {option.displayName}
                    </option>
                  ))}
                </select>
                <small>{selectedOption?.odooProductKey ?? ''}</small>
              </div>
              <div className="mix-unit-cell">{selectedOption?.unit ?? '-'}</div>
              <input min={0} type="number" value={row.qty} onChange={(event) => update(index, { qty: Number(event.target.value) })} />
              <button className="icon-action" disabled={rows.length === 1} type="button" onClick={() => remove(index)}>
                <Trash2 size={14} />
              </button>
            </div>
          )
        })}
      </div>
      <button
        className="secondary-action"
        type="button"
        onClick={() => onChange([...rows, { odooProductKey: options[0]?.odooProductKey ?? '', qty: 0 }])}
      >
        <Plus size={16} />
        <span>Thêm màu</span>
      </button>
    </div>
  )
}

function LineOutputTable({
  mode,
  productByKey,
  rows,
  stockByProduct,
}: {
  mode: FlowMode
  productByKey: Map<string, Product>
  rows: BatchOutputRow[]
  stockByProduct: Map<string, number>
}) {
  return (
    <SimpleTable
      headers={['Mã Odoo', 'Display Name', mode === 'OUT' ? 'SL cần pick' : 'SL nhập', 'Trạng thái']}
      rows={rows.map((row) => {
        const product = productByKey.get(row.odooProductKey)
        const currentQty = stockByProduct.get(row.odooProductKey) ?? 0
        return [
          row.odooProductKey,
          product?.displayName ?? row.odooProductKey,
          formatQty(row.qty),
          mode === 'OUT' ? (currentQty >= row.qty ? 'Đủ hàng' : `Thiếu ${formatQty(row.qty - currentQty)}`) : 'Sẵn sàng nhập',
        ]
      })}
    />
  )
}

function InventoryTable({ rows, compact = false }: { rows: InventoryRow[]; compact?: boolean }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Mã Odoo</th>
            {!compact && <th>Tên</th>}
            <th>Tồn hiện tại</th>
            {!compact && <th>ĐVT</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td className="mono">{row.key}</td>
              {!compact && <td>{row.displayName}</td>}
              <td>{formatQty(row.currentQty)}</td>
              {!compact && <td>{row.unit}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CatalogTable({ rows }: { rows: CatalogRow[] }) {
  return (
    <SimpleTable
      headers={['SKU', 'Product Name', 'Variation Name', 'Stock', 'Mapping', 'Chi tiết']}
      rows={rows.map((row) => [
        row.sku,
        row.productName,
        row.variationName,
        formatQty(row.stock),
        row.mappingType,
        row.detail,
      ])}
    />
  )
}

function TransactionList({ rows }: { rows: InventoryTransaction[] }) {
  return (
    <div className="transaction-list">
      {rows.map((row) => (
        <article className="transaction-item" key={row.id}>
          <div className={row.qty > 0 ? 'tx-icon in' : 'tx-icon out'}>
            {row.qty > 0 ? <ArrowDownToLine size={16} /> : <ArrowUpFromLine size={16} />}
          </div>
          <div>
            <strong>{row.odooProductKey}</strong>
            <span>{row.referenceType} · {row.referenceId}</span>
          </div>
          <b>{row.qty > 0 ? '+' : ''}{formatQty(row.qty)}</b>
        </article>
      ))}
    </div>
  )
}

function SimpleTable({ headers, rows }: { headers: string[]; rows: Array<Array<string | number>> }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {headers.map((header) => <th key={header}>{header}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td className={cellIndex === 0 ? 'mono' : ''} key={`${rowIndex}-${cellIndex}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function getMixOptions(mixGroupId: string | undefined, mixOptionsByGroup: Map<string, MixColorOption[]>) {
  if (!mixGroupId) return []
  return (mixOptionsByGroup.get(mixGroupId) ?? []).filter((option) => option.active)
}

function seedMixSelections(
  mixGroupId: string | undefined,
  mixOptionsByGroup: Map<string, MixColorOption[]>,
  totalQty: number,
) {
  const options = getMixOptions(mixGroupId, mixOptionsByGroup)
  return options.length > 0 ? [{ odooProductKey: options[0].odooProductKey, qty: totalQty }] : []
}

function describeCatalogMapping(
  mapping: ShopeeMapping | undefined,
  componentsBySku: Map<string, ShopeeMappingComponent[]>,
) {
  if (!mapping) return 'Chưa cấu hình'
  if (mapping.mappingType === 'FIXED_SKU') return mapping.odooProductKey ?? ''
  if (mapping.mappingType === 'MIX_COLOR') return `${mapping.mixGroupId ?? ''} / ${mapping.conversionQty}`
  const components = (componentsBySku.get(mapping.shopeeSku) ?? [])
    .filter((component) => component.active)
    .map((component) => `${component.odooProductKey} x ${component.componentQty}`)
  return components.join(' + ')
}

function resolveBatchLine({
  line,
  catalogBySku,
  mappingBySku,
  componentsBySku,
  mixOptionsByGroup,
}: {
  line: BatchLine
  catalogBySku: Map<string, ShopeeCatalogItem>
  mappingBySku: Map<string, ShopeeMapping>
  componentsBySku: Map<string, ShopeeMappingComponent[]>
  mixOptionsByGroup: Map<string, MixColorOption[]>
}): BatchLineResult {
  const errors: string[] = []
  const catalogItem = line.selectedSku ? catalogBySku.get(line.selectedSku) : undefined
  const mapping = line.selectedSku ? mappingBySku.get(line.selectedSku) : undefined
  const requiredQty = Math.max(0, line.qty) * (mapping?.conversionQty ?? 0)

  if (!line.selectedSku) errors.push('Chưa chọn SKU Shopee')
  if (line.qty <= 0) errors.push('Số lượng Shopee phải lớn hơn 0')
  if (line.selectedSku && !mapping) errors.push('SKU Shopee chưa có mapping')

  if (!mapping) {
    return { line, catalogItem, mapping, requiredQty, outputs: [], errors }
  }

  if (!mapping.active) {
    return { line, catalogItem, mapping, requiredQty, outputs: [], errors: [...errors, 'Mapping đang inactive'] }
  }

  if (mapping.mappingType === 'FIXED_SKU') {
    if (!mapping.odooProductKey) errors.push('Thiếu odoo_product_key')
    return {
      line,
      catalogItem,
      mapping,
      requiredQty,
      outputs: mapping.odooProductKey ? [{ odooProductKey: mapping.odooProductKey, qty: requiredQty }] : [],
      errors,
    }
  }

  if (mapping.mappingType === 'COMBO_SKU') {
    const components = (componentsBySku.get(mapping.shopeeSku) ?? []).filter((component) => component.active)
    if (components.length === 0) errors.push('Thiếu component cho combo')
    return {
      line,
      catalogItem,
      mapping,
      requiredQty,
      outputs: components.map((component) => ({
        odooProductKey: component.odooProductKey,
        qty: component.componentQty * line.qty,
      })),
      errors,
    }
  }

  const validOptions = new Set(getMixOptions(mapping.mixGroupId, mixOptionsByGroup).map((option) => option.odooProductKey))
  const outputs = line.mixSelections.filter((selection) => selection.qty > 0)
  const totalQty = outputs.reduce((sum, item) => sum + item.qty, 0)

  if (outputs.length === 0) errors.push('Chưa chọn mã Odoo cho mix màu')
  if (outputs.some((selection) => !validOptions.has(selection.odooProductKey))) errors.push('Có mã Odoo không thuộc mix group')
  if (totalQty !== requiredQty) errors.push(`Tổng mix phải bằng ${formatQty(requiredQty)}`)

  return {
    line,
    catalogItem,
    mapping,
    requiredQty,
    outputs,
    errors,
  }
}

function getCatalogOptions(rows: CatalogRow[], query: string, selectedSku: string) {
  const keyword = query.trim().toLowerCase()
  const filtered = rows.filter((row) => {
    if (!row.active) return false
    const text = `${row.sku} ${row.productName} ${row.variationName}`.toLowerCase()
    return keyword ? text.includes(keyword) : true
  })

  const sorted = filtered.sort((a, b) => a.sku.localeCompare(b.sku))
  const limited = keyword ? sorted.slice(0, 20) : sorted.slice(0, 12)

  if (selectedSku && !limited.find((row) => row.sku === selectedSku)) {
    const selectedRow = rows.find((row) => row.sku === selectedSku)
    if (selectedRow) return [selectedRow, ...limited]
  }

  return limited
}
export default App
