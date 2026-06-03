import fs from 'node:fs'
import { google } from 'googleapis'

const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID
const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE || '../smart-sandbox-424309-n5-c615a9ae9610.json'

const SHEETS = [
  {
    name: 'Products',
    headers: ['odoo_product_key', 'display_name', 'quantity_on_hand', 'unit'],
  },
  {
    name: 'Shopee_Catalog',
    headers: ['sku', 'product_name', 'variation_name', 'stock'],
  },
  {
    name: 'Shopee_Mapping',
    headers: ['shopee_sku', 'mapping_type', 'odoo_product_key', 'mix_group_id', 'conversion_qty', 'active', 'note'],
  },
  {
    name: 'Shopee_Mapping_Components',
    headers: ['shopee_sku', 'component_no', 'odoo_product_key', 'component_qty', 'active', 'note'],
  },
  {
    name: 'Mix_Color_Options',
    headers: ['mix_group_id', 'odoo_product_key', 'display_name', 'active'],
  },
  {
    name: 'Manual_Order_Input',
    headers: ['input_id', 'order_batch_id', 'order_id', 'input_shopee_sku', 'shopee_product_name', 'order_qty', 'input_status', 'created_by', 'note'],
  },
  {
    name: 'Order_Output',
    headers: ['output_id', 'input_id', 'order_batch_id', 'order_id', 'input_shopee_sku', 'mapping_type', 'odoo_product_key', 'display_name', 'required_qty', 'selected_qty', 'stock_status', 'confirm_status'],
  },
  {
    name: 'Return_Input',
    headers: ['return_input_id', 'return_batch_id', 'order_id', 'return_shopee_sku', 'shopee_product_name', 'return_qty', 'return_status', 'created_by', 'note'],
  },
  {
    name: 'Return_Output',
    headers: ['return_output_id', 'return_input_id', 'return_batch_id', 'order_id', 'return_shopee_sku', 'mapping_type', 'odoo_product_key', 'display_name', 'return_required_qty', 'selected_qty', 'confirm_status'],
  },
  {
    name: 'Inventory_Transactions',
    headers: ['transaction_id', 'transaction_date', 'type', 'odoo_product_key', 'qty', 'reference_type', 'reference_id', 'source_input_id', 'source_shopee_sku', 'source_mapping_type', 'odoo_status', 'created_by', 'note'],
  },
  {
    name: 'Inventory_Report',
    headers: ['odoo_product_key', 'display_name', 'current_qty', 'odoo_quantity_on_hand', 'difference_qty', 'status'],
  },
  {
    name: 'Daily_Inbound_Report',
    headers: ['report_date', 'reference_type', 'odoo_product_key', 'display_name', 'total_in_qty', 'source_count', 'odoo_status'],
  },
  {
    name: 'Daily_Outbound_Report',
    headers: ['report_date', 'odoo_product_key', 'display_name', 'total_out_qty', 'source_order_count'],
  },
]

function requireEnv(value, name) {
  if (!value) {
    throw new Error(`Missing ${name}`)
  }
  return value
}

function mapExistingRow(existingHeaders, row) {
  return Object.fromEntries(existingHeaders.map((header, index) => [header, row[index] ?? '']))
}

function remapRows(existingHeaders, targetHeaders, rows) {
  if (!existingHeaders.length) {
    return rows
  }

  return rows.map((row) => {
    const record = mapExistingRow(existingHeaders, row)
    return targetHeaders.map((header) => record[header] ?? '')
  })
}

async function main() {
  const creds = JSON.parse(fs.readFileSync(keyFile, 'utf8'))
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
  const sheets = google.sheets({ version: 'v4', auth })

  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: requireEnv(spreadsheetId, 'GOOGLE_SHEETS_SPREADSHEET_ID') })
  const existing = new Map((spreadsheet.data.sheets || []).map((sheet) => [sheet.properties.title, sheet.properties.sheetId]))
  const addSheetRequests = SHEETS.filter((sheet) => !existing.has(sheet.name)).map((sheet) => ({
    addSheet: {
      properties: {
        title: sheet.name,
        gridProperties: {
          rowCount: 1000,
          columnCount: Math.max(sheet.headers.length, 10),
          frozenRowCount: 1,
        },
      },
    },
  }))

  if (addSheetRequests.length) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: addSheetRequests },
    })
  }

  const ranges = SHEETS.map((sheet) => `${sheet.name}!A1:Z`)
  const valuesResponse = await sheets.spreadsheets.values.batchGet({ spreadsheetId, ranges })
  const writeRequests = []

  SHEETS.forEach((sheet, index) => {
    const values = valuesResponse.data.valueRanges?.[index]?.values || []
    const [existingHeaders = [], ...bodyRows] = values
    const remappedRows = remapRows(existingHeaders, sheet.headers, bodyRows)
    const nextValues = [sheet.headers, ...remappedRows]

    writeRequests.push({
      range: `${sheet.name}!A1:${String.fromCharCode(64 + sheet.headers.length)}${nextValues.length}`,
      values: nextValues,
    })
  })

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: writeRequests,
    },
  })

  console.log(`Migrated ${SHEETS.length} sheets in ${spreadsheetId}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
