/**
 * Google Sheets initializer for Shopee/Odoo stock management.
 *
 * Cách dùng:
 * 1. Tạo Google Sheet trống.
 * 2. Extensions > Apps Script.
 * 3. Dán toàn bộ file này vào Code.gs.
 * 4. Chạy initializeStockManagementTemplate().
 */

const SHEET_DEFINITIONS = [
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
    report: true,
  },
  {
    name: 'Daily_Inbound_Report',
    headers: ['report_date', 'reference_type', 'odoo_product_key', 'display_name', 'total_in_qty', 'source_count', 'odoo_status'],
    report: true,
  },
  {
    name: 'Daily_Outbound_Report',
    headers: ['report_date', 'odoo_product_key', 'display_name', 'total_out_qty', 'source_order_count'],
    report: true,
  },
];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Stock Management')
    .addItem('Initialize template', 'initializeStockManagementTemplate')
    .addItem('Refresh Shopee stock', 'refreshShopeeCatalogStock')
    .addItem('Reset known sheets', 'resetStockManagementTemplate')
    .addToUi();
}

function initializeStockManagementTemplate() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  SHEET_DEFINITIONS.forEach((definition) => {
    const sheet = ensureSheet_(ss, definition.name);
    ensureCapacity_(sheet, definition.headers.length, 1000);
    writeHeader_(sheet, definition.headers);
    formatSheet_(sheet, definition.headers.length);
  });

  applyValidations_(ss);
  applyReportFormulas_(ss);
  createNamedRanges_(ss);

  SpreadsheetApp.getUi().alert('Initialized stock management template.');
}

function resetStockManagementTemplate() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'Reset stock management template?',
    'This clears all known stock-management sheets and recreates headers/formulas.',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) {
    return;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  SHEET_DEFINITIONS.forEach((definition) => {
    const sheet = ensureSheet_(ss, definition.name);
    sheet.clear();
  });

  initializeStockManagementTemplate();
}

function ensureSheet_(ss, sheetName) {
  return ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
}

function ensureCapacity_(sheet, minColumns, minRows) {
  if (sheet.getMaxColumns() < minColumns) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), minColumns - sheet.getMaxColumns());
  }
  if (sheet.getMaxRows() < minRows) {
    sheet.insertRowsAfter(sheet.getMaxRows(), minRows - sheet.getMaxRows());
  }
}

function writeHeader_(sheet, headers) {
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
}

function formatSheet_(sheet, columnCount) {
  sheet.setFrozenRows(1);
  const headerRange = sheet.getRange(1, 1, 1, columnCount);
  headerRange
    .setFontWeight('bold')
    .setBackground('#e8f0fe')
    .setWrap(true);

  sheet.autoResizeColumns(1, columnCount);
  if (!sheet.getFilter()) {
    sheet.getRange(1, 1, Math.max(sheet.getMaxRows(), 2), columnCount).createFilter();
  }
}

function applyValidations_(ss) {
  setListValidation_(ss, 'Shopee_Mapping', 2, ['FIXED_SKU', 'MIX_COLOR', 'COMBO_SKU']);
  setListValidation_(ss, 'Shopee_Mapping', 6, ['TRUE', 'FALSE']);
  setListValidation_(ss, 'Shopee_Mapping_Components', 5, ['TRUE', 'FALSE']);
  setListValidation_(ss, 'Mix_Color_Options', 4, ['TRUE', 'FALSE']);

  setListValidation_(ss, 'Manual_Order_Input', 7, ['Mới', 'Đã quy đổi', 'Thiếu mapping', 'Thiếu tồn', 'Chưa chọn mã Odoo', 'Đã xuất kho']);
  setListValidation_(ss, 'Order_Output', 6, ['FIXED_SKU', 'MIX_COLOR', 'COMBO_SKU']);
  setListValidation_(ss, 'Order_Output', 11, ['Đủ hàng', 'Thiếu hàng']);
  setListValidation_(ss, 'Order_Output', 12, ['Chưa xác nhận', 'Đã xuất kho', 'Lỗi']);

  setListValidation_(ss, 'Return_Input', 7, ['Mới', 'Đã quy đổi', 'Thiếu mapping', 'Chưa chọn mã Odoo', 'Đã nhập kho']);
  setListValidation_(ss, 'Return_Output', 6, ['FIXED_SKU', 'MIX_COLOR', 'COMBO_SKU']);
  setListValidation_(ss, 'Return_Output', 11, ['Chưa xác nhận', 'Đã nhập kho', 'Lỗi']);

  setListValidation_(ss, 'Inventory_Transactions', 3, ['IN', 'OUT', 'ADJUST', 'CANCEL_REVERSAL']);
  setListValidation_(ss, 'Inventory_Transactions', 6, ['TRANSFER_FROM_MAIN', 'RETURN_FROM_CUSTOMER', 'SHOPEE_ORDER', 'STOCKTAKE']);
  setListValidation_(ss, 'Inventory_Transactions', 10, ['FIXED_SKU', 'MIX_COLOR', 'COMBO_SKU']);
  setListValidation_(ss, 'Inventory_Transactions', 11, ['Chờ ghi nhận Odoo', 'Đã ghi nhận Odoo', 'Không cần ghi nhận']);
}

function refreshShopeeCatalogStock() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const catalogSheet = ss.getSheetByName('Shopee_Catalog');
  const mappingSheet = ss.getSheetByName('Shopee_Mapping');
  const componentSheet = ss.getSheetByName('Shopee_Mapping_Components');
  const mixOptionSheet = ss.getSheetByName('Mix_Color_Options');
  const inventoryReportSheet = ss.getSheetByName('Inventory_Report');

  if (!catalogSheet || !mappingSheet || !componentSheet || !mixOptionSheet || !inventoryReportSheet) {
    SpreadsheetApp.getUi().alert('Missing required sheets.');
    return;
  }

  const catalogLastRow = catalogSheet.getLastRow();
  if (catalogLastRow < 2) {
    return;
  }

  const mappings = buildMappingIndex_(mappingSheet);
  const componentsBySku = buildComponentIndex_(componentSheet);
  const mixOptionsByGroup = buildMixOptionIndex_(mixOptionSheet);
  const currentQtyByProduct = buildInventoryIndex_(inventoryReportSheet);

  const skuValues = catalogSheet.getRange(2, 1, catalogLastRow - 1, 1).getValues();
  const stockValues = skuValues.map(([sku]) => {
    if (!sku) {
      return [''];
    }

    const mapping = mappings.get(String(sku));
    if (!mapping || !mapping.active) {
      return [''];
    }

    if (mapping.mappingType === 'FIXED_SKU') {
      if (!mapping.conversionQty) {
        return [''];
      }
      const currentQty = currentQtyByProduct.get(mapping.odooProductKey) || 0;
      return [Math.floor(currentQty / mapping.conversionQty)];
    }

    if (mapping.mappingType === 'MIX_COLOR') {
      if (!mapping.conversionQty) {
        return [''];
      }
      const options = mixOptionsByGroup.get(mapping.mixGroupId) || [];
      const totalQty = options.reduce((sum, option) => sum + (currentQtyByProduct.get(option) || 0), 0);
      return [Math.floor(totalQty / mapping.conversionQty)];
    }

    if (mapping.mappingType === 'COMBO_SKU') {
      const components = componentsBySku.get(String(sku)) || [];
      if (!components.length) {
        return [''];
      }
      const componentStocks = components.map((component) => {
        const currentQty = currentQtyByProduct.get(component.odooProductKey) || 0;
        return Math.floor(currentQty / component.componentQty);
      });
      return [Math.min(...componentStocks)];
    }

    return [''];
  });

  catalogSheet.getRange(2, 4, stockValues.length, 1).setValues(stockValues);
  SpreadsheetApp.getUi().alert('Shopee catalog stock refreshed.');
}

function buildComponentIndex_(sheet) {
  const lastRow = sheet.getLastRow();
  const map = new Map();
  if (lastRow < 2) {
    return map;
  }

  const values = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
  values.forEach((row) => {
    const [shopeeSku, , odooProductKey, componentQty, active] = row;
    if (!shopeeSku || !odooProductKey || !(active === true || String(active).toUpperCase() === 'TRUE')) {
      return;
    }
    const qty = Number(componentQty || 0);
    if (qty <= 0) {
      return;
    }
    const key = String(shopeeSku);
    const current = map.get(key) || [];
    current.push({
      odooProductKey: String(odooProductKey),
      componentQty: qty,
    });
    map.set(key, current);
  });
  return map;
}

function buildMappingIndex_(sheet) {
  const lastRow = sheet.getLastRow();
  const map = new Map();
  if (lastRow < 2) {
    return map;
  }

  const values = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
  values.forEach((row) => {
    const [shopeeSku, mappingType, odooProductKey, mixGroupId, conversionQty, active] = row;
    if (!shopeeSku) {
      return;
    }
    map.set(String(shopeeSku), {
      mappingType: String(mappingType),
      odooProductKey: String(odooProductKey || ''),
      mixGroupId: String(mixGroupId || ''),
      conversionQty: Number(conversionQty || 0),
      active: active === true || String(active).toUpperCase() === 'TRUE',
    });
  });
  return map;
}

function buildMixOptionIndex_(sheet) {
  const lastRow = sheet.getLastRow();
  const map = new Map();
  if (lastRow < 2) {
    return map;
  }

  const values = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
  values.forEach((row) => {
    const [mixGroupId, odooProductKey, , active] = row;
    if (!mixGroupId || !odooProductKey || !(active === true || String(active).toUpperCase() === 'TRUE')) {
      return;
    }
    const key = String(mixGroupId);
    const current = map.get(key) || [];
    current.push(String(odooProductKey));
    map.set(key, current);
  });
  return map;
}

function buildInventoryIndex_(sheet) {
  const lastRow = sheet.getLastRow();
  const map = new Map();
  if (lastRow < 2) {
    return map;
  }

  const values = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
  values.forEach((row) => {
    const [odooProductKey, , currentQty] = row;
    if (!odooProductKey) {
      return;
    }
    map.set(String(odooProductKey), Number(currentQty || 0));
  });
  return map;
}

function setListValidation_(ss, sheetName, column, values) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    return;
  }

  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(values, true)
    .setAllowInvalid(false)
    .build();

  sheet.getRange(2, column, sheet.getMaxRows() - 1, 1).setDataValidation(rule);
}

function applyReportFormulas_(ss) {
  const inventoryReport = ss.getSheetByName('Inventory_Report');
  clearBody_(inventoryReport);
  inventoryReport.getRange('A2').setFormula('=IFERROR(FILTER(Products!A2:A,Products!A2:A<>""),"")');
  inventoryReport.getRange('B2').setFormula('=ARRAYFORMULA(IF(A2:A="",,XLOOKUP(A2:A,Products!A:A,Products!B:B,"")))');
  inventoryReport.getRange('C2').setFormula('=ARRAYFORMULA(IF(A2:A="",,SUMIF(Inventory_Transactions!D:D,A2:A,Inventory_Transactions!E:E)))');
  inventoryReport.getRange('D2').setFormula('=ARRAYFORMULA(IF(A2:A="",,XLOOKUP(A2:A,Products!A:A,Products!C:C,0)))');
  inventoryReport.getRange('E2').setFormula('=ARRAYFORMULA(IF(A2:A="",,C2:C-D2:D))');
  inventoryReport.getRange('F2').setFormula('=ARRAYFORMULA(IF(A2:A="",,IF(C2:C<0,"Âm tồn",IF(E2:E<>0,"Lệch Odoo","OK"))))');
  inventoryReport.hideColumns(4, 3);

  const dailyInboundReport = ss.getSheetByName('Daily_Inbound_Report');
  clearBody_(dailyInboundReport);
  dailyInboundReport.getRange('A2').setFormula(
    '=IFNA(QUERY(FILTER({ARRAYFORMULA(IF(Inventory_Transactions!B2:B="",,IFERROR(TEXT(Inventory_Transactions!B2:B,"yyyy-mm-dd"),Inventory_Transactions!B2:B))),Inventory_Transactions!F2:F,Inventory_Transactions!D2:D,ARRAYFORMULA(IFNA(VLOOKUP(Inventory_Transactions!D2:D,Products!A:B,2,FALSE),"")),Inventory_Transactions!E2:E,Inventory_Transactions!A2:A,Inventory_Transactions!K2:K},Inventory_Transactions!C2:C="IN"),"select Col1, Col2, Col3, Col4, sum(Col5), count(Col6), Col7 group by Col1, Col2, Col3, Col4, Col7 label sum(Col5) \'\', count(Col6) \'\'",0),{"","","","","","",""})'
  );

  const dailyOutboundReport = ss.getSheetByName('Daily_Outbound_Report');
  clearBody_(dailyOutboundReport);
  dailyOutboundReport.getRange('A2').setFormula(
    '=IFNA(QUERY(FILTER({ARRAYFORMULA(IF(Inventory_Transactions!B2:B="",,IFERROR(TEXT(Inventory_Transactions!B2:B,"yyyy-mm-dd"),Inventory_Transactions!B2:B))),Inventory_Transactions!D2:D,ARRAYFORMULA(IFNA(VLOOKUP(Inventory_Transactions!D2:D,Products!A:B,2,FALSE),"")),ARRAYFORMULA(-Inventory_Transactions!E2:E),Inventory_Transactions!H2:H},Inventory_Transactions!C2:C="OUT"),"select Col1, Col2, Col3, sum(Col4), count(Col5) group by Col1, Col2, Col3 label sum(Col4) \'\', count(Col5) \'\'",0),{"","","","",""})'
  );
}

function clearBody_(sheet) {
  if (!sheet) {
    return;
  }
  const rowCount = sheet.getMaxRows() - 1;
  const columnCount = sheet.getMaxColumns();
  if (rowCount > 0) {
    sheet.getRange(2, 1, rowCount, columnCount).clearContent();
  }
}

function createNamedRanges_(ss) {
  SHEET_DEFINITIONS.forEach((definition) => {
    const sheet = ss.getSheetByName(definition.name);
    if (!sheet) {
      return;
    }
    definition.headers.forEach((header, index) => {
      setNamedRange_(ss, `${definition.name}_${header}`, sheet.getRange(2, index + 1, sheet.getMaxRows() - 1, 1));
    });
  });
}

function setNamedRange_(ss, name, range) {
  ss.getNamedRanges()
    .filter((namedRange) => namedRange.getName() === name)
    .forEach((namedRange) => namedRange.remove());
  ss.setNamedRange(name, range);
}
