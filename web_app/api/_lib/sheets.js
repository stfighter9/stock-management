import { google } from 'googleapis'
import { getServerConfig } from './env.js'

export const SHEET_HEADERS = {
  Products: ['odoo_product_key', 'display_name', 'quantity_on_hand', 'unit'],
  Shopee_Catalog: ['sku', 'product_name', 'variation_name', 'stock'],
  Shopee_Mapping: ['shopee_sku', 'mapping_type', 'odoo_product_key', 'mix_group_id', 'conversion_qty', 'active', 'note'],
  Shopee_Mapping_Components: ['shopee_sku', 'component_no', 'odoo_product_key', 'component_qty', 'active', 'note'],
  Mix_Color_Options: ['mix_group_id', 'odoo_product_key', 'display_name', 'active'],
  Manual_Order_Input: ['input_id', 'order_batch_id', 'order_id', 'input_shopee_sku', 'shopee_product_name', 'order_qty', 'input_status', 'created_by', 'note'],
  Order_Output: ['output_id', 'input_id', 'order_batch_id', 'order_id', 'input_shopee_sku', 'mapping_type', 'odoo_product_key', 'display_name', 'required_qty', 'selected_qty', 'stock_status', 'confirm_status'],
  Return_Input: ['return_input_id', 'return_batch_id', 'order_id', 'return_shopee_sku', 'shopee_product_name', 'return_qty', 'return_status', 'created_by', 'note'],
  Return_Output: ['return_output_id', 'return_input_id', 'return_batch_id', 'order_id', 'return_shopee_sku', 'mapping_type', 'odoo_product_key', 'display_name', 'return_required_qty', 'selected_qty', 'confirm_status'],
  Inventory_Transactions: ['transaction_id', 'transaction_date', 'type', 'odoo_product_key', 'qty', 'reference_type', 'reference_id', 'source_input_id', 'source_shopee_sku', 'source_mapping_type', 'odoo_status', 'created_by', 'note'],
  Inventory_Report: ['odoo_product_key', 'display_name', 'current_qty', 'odoo_quantity_on_hand', 'difference_qty', 'status'],
  Daily_Inbound_Report: ['report_date', 'reference_type', 'odoo_product_key', 'display_name', 'total_in_qty', 'source_count', 'odoo_status'],
  Daily_Outbound_Report: ['report_date', 'odoo_product_key', 'display_name', 'total_out_qty', 'source_order_count'],
}

let sheetsClientPromise

async function getSheetsClient() {
  if (!sheetsClientPromise) {
    const config = getServerConfig()
    const auth = new google.auth.JWT({
      email: config.clientEmail,
      key: config.privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })

    sheetsClientPromise = auth.authorize().then(() => google.sheets({ version: 'v4', auth }))
  }

  return sheetsClientPromise
}

function trimTrailingEmpty(values) {
  return values.filter((row) => row.some((cell) => String(cell ?? '').trim() !== ''))
}

function rowsToObjects(headers, rows) {
  return rows.map((row) => {
    const record = {}
    headers.forEach((header, index) => {
      record[header] = row[index] ?? ''
    })
    return record
  })
}

export async function readSheetRecords(sheetName) {
  const config = getServerConfig()
  const sheets = await getSheetsClient()
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.spreadsheetId,
    range: `${sheetName}!A1:Z`,
  })

  const values = response.data.values || []
  if (values.length === 0) {
    return []
  }

  const [headerRow, ...bodyRows] = values
  const headers = headerRow.map((value) => String(value))
  return rowsToObjects(headers, trimTrailingEmpty(bodyRows))
}

export async function batchReadSheetRecords(sheetNames) {
  const config = getServerConfig()
  const sheets = await getSheetsClient()
  const response = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: config.spreadsheetId,
    ranges: sheetNames.map((sheetName) => `${sheetName}!A1:Z`),
  })

  const valueRanges = response.data.valueRanges || []
  const output = {}

  sheetNames.forEach((sheetName, index) => {
    const values = valueRanges[index]?.values || []
    if (values.length === 0) {
      output[sheetName] = []
      return
    }

    const [headerRow, ...bodyRows] = values
    const headers = headerRow.map((value) => String(value))
    output[sheetName] = rowsToObjects(headers, trimTrailingEmpty(bodyRows))
  })

  return output
}

export async function appendObjects(sheetName, rows) {
  if (!rows.length) {
    return
  }

  const headers = SHEET_HEADERS[sheetName]
  if (!headers) {
    throw new Error(`Unsupported sheet for append: ${sheetName}`)
  }

  const config = getServerConfig()
  const sheets = await getSheetsClient()
  const values = rows.map((row) => headers.map((header) => row[header] ?? ''))

  await sheets.spreadsheets.values.append({
    spreadsheetId: config.spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  })
}

export async function updateCatalogStockColumn(stockValues) {
  if (!stockValues.length) {
    return
  }

  const config = getServerConfig()
  const sheets = await getSheetsClient()

  await sheets.spreadsheets.values.update({
    spreadsheetId: config.spreadsheetId,
    range: `Shopee_Catalog!D2:D${stockValues.length + 1}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: stockValues.map((value) => [value]),
    },
  })
}
