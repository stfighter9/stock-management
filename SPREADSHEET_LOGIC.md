# Spreadsheet Logic: Quản lý tồn kho Shopee

## 1. Mục tiêu

Tài liệu này chi tiết hóa các `Processor` trong class diagram thành cách xử lý cụ thể trên Google Sheets.

Nguyên tắc:

- Dữ liệu gốc nằm ở các sheet master/input/transaction.
- Báo cáo và trạng thái được tính từ dữ liệu gốc.
- Không nhập tay tồn kho hiện tại.
- Không sửa/xóa transaction `OUT` đã tạo; nếu sai thì tạo transaction đảo.

## 2. Sheet dữ liệu chính

Các công thức dưới đây giả định dùng đúng tên sheet:

- `Products`
- `Shopee_Catalog`
- `Shopee_Mapping`
- `Shopee_Mapping_Components`
- `Mix_Color_Options`
- `Manual_Order_Input`
- `Order_Output`
- `Return_Input`
- `Return_Output`
- `Inventory_Transactions`
- `Inventory_Report`
- `Daily_Inbound_Report`
- `Daily_Outbound_Report`

Nên dùng **Named ranges** hoặc Google Sheets table/range ổn định cho từng sheet. Nếu chưa dùng named ranges, có thể dùng trực tiếp range của từng sheet.

## 3. OrderConversionProcessor

Mục tiêu: từ danh sách dòng Shopee cần xuất, tìm mapping và tính số lượng cần xuất cho từng dòng.

Input:

- `Manual_Order_Input.input_id`
- `Manual_Order_Input.order_batch_id`
- `Manual_Order_Input.input_shopee_sku`
- `Manual_Order_Input.shopee_product_name`
- `Manual_Order_Input.order_qty`
- `Shopee_Mapping`
- `Shopee_Mapping_Components`

Output:

- `Order_Output`

Một lần xử lý xuất kho có thể gồm nhiều dòng cùng `order_batch_id`. Processor chạy từng dòng theo `input_id`, sau đó người dùng xác nhận xuất cả danh sách hoặc từng dòng.

## 3.1. ShopeeSkuSearchProcessor

Mục tiêu: hỗ trợ người dùng chọn mã Shopee từ danh mục export Shopee, search được theo SKU, tên sản phẩm và tên variation.

Nguồn:

- `Shopee_Catalog.sku`
- `Shopee_Catalog.product_name`
- `Shopee_Catalog.variation_name`
- `Shopee_Mapping` để biết mapping status, mapping type và conversion qty.

Trong Google Sheets, có thể tạo sheet/view phụ `Shopee_SKU_Search` để lọc theo keyword ở một ô, ví dụ `B1`.

```gs
=FILTER(
  Shopee_Catalog!A:D,
  Shopee_Catalog!A:A <> "",
  REGEXMATCH(
    LOWER(Shopee_Catalog!A:A & " " & Shopee_Catalog!B:B & " " & Shopee_Catalog!C:C),
    LOWER($B$1)
  )
)
```

Trong web app, combobox/search box nên hiển thị:

```text
sku - product_name - variation_name
mapping_type từ Shopee_Mapping
conversion_qty từ Shopee_Mapping
stock từ Shopee_Catalog
```

Khi người dùng chọn một option trên màn hình xuất kho:

```text
input_shopee_sku = selected.sku
shopee_product_name = selected.product_name + " - " + selected.variation_name
```

Khi người dùng chọn một option trên màn hình nhập hoàn:

```text
return_shopee_sku = selected.sku
shopee_product_name = selected.product_name + " - " + selected.variation_name
```

## 3.2. ShopeeStockProcessor

Mục tiêu: tính cột `stock` trong `Shopee_Catalog` từ tồn Odoo/Sheets sau mapping.

Nguồn:

- `Shopee_Catalog.sku`
- `Shopee_Mapping`
- `Shopee_Mapping_Components`
- `Inventory_Report.current_qty`
- `Mix_Color_Options`

Nguyên tắc:

- Không dùng trực tiếp cột `Stock` export từ Shopee.
- Nếu chưa có mapping, `stock` để trống hoặc hiển thị `Thiếu mapping` ở cột trạng thái phụ nếu có.
- Nếu `FIXED_SKU`, stock Shopee bằng tồn Odoo/Sheets chia hệ số quy đổi.
- Nếu `MIX_COLOR`, stock Shopee bằng tổng tồn các mã Odoo active trong nhóm mix chia hệ số quy đổi.
- Nếu `COMBO_SKU`, stock Shopee bằng số bộ tối đa có thể tạo từ tất cả component, tức là min theo từng component.

Logic:

```text
IF mapping_type = FIXED_SKU:
  stock = FLOOR(Inventory_Report.current_qty of mapped odoo_product_key / conversion_qty)

IF mapping_type = MIX_COLOR:
  stock = FLOOR(SUM(Inventory_Report.current_qty of active Mix_Color_Options in mix_group_id) / conversion_qty)

IF mapping_type = COMBO_SKU:
  stock = MIN(FLOOR(Inventory_Report.current_qty of component odoo_product_key / component_qty))
```

Gợi ý công thức cho từng dòng `Shopee_Catalog`, giả sử:

- `A2` = `sku`
- `Shopee_Mapping!A:A` = `shopee_sku`
- `Shopee_Mapping!B:B` = `mapping_type`
- `Shopee_Mapping!C:C` = `odoo_product_key`
- `Shopee_Mapping!D:D` = `mix_group_id`
- `Shopee_Mapping!E:E` = `conversion_qty`

```gs
=IFERROR(
  LET(
    mapping_type, XLOOKUP(A2, Shopee_Mapping!A:A, Shopee_Mapping!B:B),
    conversion_qty, XLOOKUP(A2, Shopee_Mapping!A:A, Shopee_Mapping!E:E),
    IF(
      mapping_type = "FIXED_SKU",
      FLOOR(
        XLOOKUP(
          XLOOKUP(A2, Shopee_Mapping!A:A, Shopee_Mapping!C:C),
          Inventory_Report!A:A,
          Inventory_Report!C:C,
          0
        ) / conversion_qty
      ),
      ""
    )
  ),
  ""
)
```

Với `MIX_COLOR` và `COMBO_SKU`, nên xử lý bằng Apps Script hoặc helper table vì cần cộng/min nhiều mã Odoo. File khởi tạo Apps Script đã có hàm `refreshShopeeCatalogStock()` để tính stock cho cả `FIXED_SKU`, `MIX_COLOR` và `COMBO_SKU`.

### Lookup mapping type

Với mỗi dòng `Manual_Order_Input`, tìm `mapping_type`:

```gs
=XLOOKUP(input_shopee_sku, Shopee_Mapping!shopee_sku, Shopee_Mapping!mapping_type, "Thiếu mapping")
```

Nếu không dùng named columns, dùng `INDEX/MATCH`:

```gs
=IFERROR(INDEX(Shopee_Mapping!B:B, MATCH(C2, Shopee_Mapping!A:A, 0)), "Thiếu mapping")
```

Trong ví dụ trên:

- `C2` là `Manual_Order_Input.input_shopee_sku`.
- `Shopee_Mapping!A:A` là `shopee_sku`.
- `Shopee_Mapping!B:B` là `mapping_type`.

### Lookup conversion quantity

```gs
=XLOOKUP(input_shopee_sku, Shopee_Mapping!shopee_sku, Shopee_Mapping!conversion_qty, "")
```

### Tính required quantity

```gs
=order_qty * conversion_qty
```

Ví dụ:

```text
order_qty = 2
conversion_qty = 6
required_qty = 12
```

### Với FIXED_SKU

Hệ thống lấy mã Odoo trực tiếp từ `Shopee_Mapping.odoo_product_key`.

```gs
=XLOOKUP(input_shopee_sku, Shopee_Mapping!shopee_sku, Shopee_Mapping!odoo_product_key, "")
```

Sau đó tạo một dòng trong `Order_Output`:

```text
input_id
order_batch_id
order_id
input_shopee_sku
mapping_type = FIXED_SKU
odoo_product_key = mapped odoo_product_key
required_qty = order_qty * conversion_qty
selected_qty = required_qty
```

### Với MIX_COLOR

Hệ thống không tự chọn `odoo_product_key`.

Tạo dòng yêu cầu trong `Order_Output`:

```text
input_id
order_batch_id
order_id
input_shopee_sku
mapping_type = MIX_COLOR
odoo_product_key = blank cho tới khi người dùng chọn
required_qty = order_qty * conversion_qty
selected_qty = blank hoặc 0
confirm_status = Chưa xác nhận
```

Người dùng sẽ thêm một hoặc nhiều dòng `Order_Output` cho cùng `input_id`, mỗi dòng là một mã Odoo được chọn và số lượng tương ứng.

### Với COMBO_SKU

Hệ thống đọc các dòng active trong `Shopee_Mapping_Components` theo `input_shopee_sku`.

Với mỗi component, tạo một dòng trong `Order_Output`:

```text
input_id
order_batch_id
order_id
input_shopee_sku
mapping_type = COMBO_SKU
odoo_product_key = component odoo_product_key
required_qty = order_qty * component_qty
selected_qty = required_qty
confirm_status = Chưa xác nhận
```

Ví dụ:

```text
input_shopee_sku = PEN-REFILL-BUNDLE
order_qty = 3
```

| odoo_product_key | component_qty | required_qty |
| --- | ---: | ---: |
| `BUT-BI-XANH` | 2 | 6 |
| `NGOI-BUT` | 2 | 6 |

Với danh sách nhiều dòng, rule tổng thể:

```text
process all Manual_Order_Input rows where order_batch_id = current_order_batch_id
each input_id creates one or more Order_Output rows
confirm status is tracked per input_id
```

## 4. MixColorSelectionProcessor

Mục tiêu: kiểm tra người dùng chọn mã Odoo và số lượng đúng cho mã mix màu.

Input:

- `Order_Output`
- `Mix_Color_Options`
- `Shopee_Mapping`

### Danh sách mã Odoo được phép chọn

Trước tiên lookup `mix_group_id` từ `Shopee_Mapping`:

```gs
=XLOOKUP(input_shopee_sku, Shopee_Mapping!shopee_sku, Shopee_Mapping!mix_group_id, "")
```

Danh sách mã Odoo được phép chọn:

```gs
=FILTER(Mix_Color_Options!odoo_product_key, Mix_Color_Options!mix_group_id = mix_group_id, Mix_Color_Options!active = TRUE)
```

Trong Google Sheets, nên dùng Data validation cho `Order_Output.odoo_product_key`:

- Criteria: dropdown from range.
- Range: danh sách `odoo_product_key` active theo `mix_group_id`.

Nếu dropdown động theo từng dòng khó làm trong MVP, có thể dùng một vùng phụ:

```text
Mix_Selectable_View
```

lọc ra các SKU hợp lệ theo `input_id` đang xử lý.

### Kiểm tra mã Odoo chọn đúng nhóm

```gs
=IF(
  COUNTIFS(Mix_Color_Options!mix_group_id, mix_group_id, Mix_Color_Options!odoo_product_key, selected_odoo_product_key, Mix_Color_Options!active, TRUE) > 0,
  "OK",
  "Sai nhóm Odoo"
)
```

### Kiểm tra tổng số lượng đã chọn

```gs
=SUMIF(Order_Output!input_id, current_input_id, Order_Output!selected_qty)
```

So với `required_qty`:

```gs
=IF(selected_total_qty = required_qty, "Đã chọn đủ", IF(selected_total_qty < required_qty, "Chọn thiếu", "Chọn dư"))
```

Rule bắt buộc:

```text
SUM(selected_qty by input_id) = required_qty
```

## 5. ReturnConversionProcessor

Mục tiêu: từ danh sách dòng hàng hoàn theo mã Shopee, quy đổi ra mã Odoo và số lượng cần nhập lại cho từng dòng.

Input:

- `Return_Input.return_input_id`
- `Return_Input.return_batch_id`
- `Return_Input.return_shopee_sku`
- `Return_Input.shopee_product_name`
- `Return_Input.return_qty`
- `Shopee_Mapping`
- `Shopee_Mapping_Components`

Output:

- `Return_Output`

Ghi chú: `return_qty` là số lượng Shopee thực tế nhận trả. Nếu khách trả toàn bộ, có thể lấy mặc định bằng số lượng Shopee khách đã đặt; nếu trả một phần thì người dùng chỉnh lại.

Một lần nhập hoàn có thể gồm nhiều dòng cùng `return_batch_id`. Processor chạy từng dòng theo `return_input_id`, sau đó người dùng xác nhận nhập hoàn cả danh sách hoặc từng dòng.

### Lookup mapping cho hàng hoàn

Với mỗi dòng `Return_Input`, tìm `mapping_type`:

```gs
=XLOOKUP(return_shopee_sku, Shopee_Mapping!shopee_sku, Shopee_Mapping!mapping_type, "Thiếu mapping")
```

Nếu không dùng named columns:

```gs
=IFERROR(INDEX(Shopee_Mapping!B:B, MATCH(C2, Shopee_Mapping!A:A, 0)), "Thiếu mapping")
```

Trong ví dụ trên:

- `C2` là `Return_Input.return_shopee_sku`.
- `Shopee_Mapping!A:A` là `shopee_sku`.
- `Shopee_Mapping!B:B` là `mapping_type`.

### Tính số lượng Odoo cần nhập lại

```text
return_required_qty = return_qty * conversion_qty
```

### Hàng hoàn `FIXED_SKU`

Với `FIXED_SKU`, hệ thống tự điền trong `Return_Output`:

```text
return_input_id = Return_Input.return_input_id
return_batch_id = Return_Input.return_batch_id
order_id = Return_Input.order_id
return_shopee_sku = Return_Input.return_shopee_sku
mapping_type = FIXED_SKU
odoo_product_key = Shopee_Mapping.odoo_product_key
return_required_qty = Return_Input.return_qty * Shopee_Mapping.conversion_qty
selected_qty = return_required_qty
confirm_status = Chưa xác nhận
```

### Hàng hoàn `MIX_COLOR`

Với `MIX_COLOR`, hệ thống chỉ tính tổng số lượng cần nhập lại:

```text
return_required_qty = Return_Input.return_qty * Shopee_Mapping.conversion_qty
```

Người dùng kiểm hàng thực tế rồi nhập các dòng `Return_Output`:

```text
return_input_id
return_batch_id
return_shopee_sku
mapping_type = MIX_COLOR
odoo_product_key = mã Odoo thực tế nhận về
selected_qty = số lượng thực tế nhận về của mã Odoo đó
```

Rule kiểm tra:

```gs
=SUMIF(Return_Output!B:B, return_input_id, Return_Output!I:I)
```

Kết quả phải bằng `return_required_qty`.

Ngoài ra, `odoo_product_key` được chọn phải nằm trong `Mix_Color_Options` của `mix_group_id` tương ứng.

### Hàng hoàn `COMBO_SKU`

Hệ thống đọc các dòng active trong `Shopee_Mapping_Components` theo `return_shopee_sku`.

Với mỗi component, tạo một dòng trong `Return_Output`:

```text
return_input_id
return_batch_id
order_id
return_shopee_sku
mapping_type = COMBO_SKU
odoo_product_key = component odoo_product_key
return_required_qty = return_qty * component_qty
selected_qty = return_required_qty
confirm_status = Chưa xác nhận
```

Ví dụ:

```text
return_shopee_sku = PEN-REFILL-BUNDLE
return_qty = 1
```

| odoo_product_key | component_qty | return_required_qty |
| --- | ---: | ---: |
| `BUT-BI-XANH` | 2 | 2 |
| `NGOI-BUT` | 2 | 2 |

Với danh sách nhiều dòng, rule tổng thể:

```text
process all Return_Input rows where return_batch_id = current_return_batch_id
each return_input_id creates one or more Return_Output rows
confirm status is tracked per return_input_id
```

## 6. StockProcessor

Mục tiêu: tính tồn hiện tại, kiểm tra đủ tồn, tạo transaction nhập/xuất.

### Tồn hiện tại theo mã Odoo

Không nhập tay tồn hiện tại. Tồn hiện tại được tính từ `Inventory_Transactions.qty`.

```gs
=SUMIF(Inventory_Transactions!odoo_product_key, current_odoo_product_key, Inventory_Transactions!qty)
```

Nếu chưa dùng named columns:

```gs
=SUMIF(Inventory_Transactions!D:D, A2, Inventory_Transactions!E:E)
```

Trong ví dụ:

- `Inventory_Transactions!D:D` là `odoo_product_key`.
- `Inventory_Transactions!E:E` là `qty`.
- `A2` là mã Odoo trong `Inventory_Report`.

### Kiểm tra đủ tồn

```gs
=IF(current_qty >= required_or_selected_qty, "Đủ hàng", "Thiếu hàng")
```

Với `FIXED_SKU`:

```text
required_or_selected_qty = required_qty
```

Với `MIX_COLOR`:

```text
required_or_selected_qty = selected_qty của từng mã Odoo người dùng chọn
```

### Tạo transaction IN từ kho tổng

Khi nhập kho từ kho tổng, người dùng nhập trực tiếp mã Odoo và số lượng:

```text
type = IN
qty = số lượng nhập, số dương
reference_type = TRANSFER_FROM_MAIN
odoo_status = Chờ ghi nhận Odoo
```

Ví dụ:

| type | odoo_product_key | qty | reference_type |
| --- | --- | ---: | --- |
| `IN` | `BUT-DO` | 100 | `TRANSFER_FROM_MAIN` |

### Tạo transaction IN từ hàng hoàn

Khi bấm `Xác nhận nhập hoàn`, hệ thống tạo transaction `IN` từ `Return_Output`.

Với `FIXED_SKU`:

```text
type = IN
odoo_product_key = Return_Output.odoo_product_key
qty = return_required_qty
reference_type = RETURN_FROM_CUSTOMER
reference_id = order_id
source_input_id = return_input_id
source_shopee_sku = return_shopee_sku
source_mapping_type = FIXED_SKU
odoo_status = Chờ ghi nhận Odoo
```

Với `MIX_COLOR`, tạo nhiều dòng `IN`, mỗi dòng theo mã Odoo người dùng chọn:

```text
type = IN
odoo_product_key = selected odoo_product_key
qty = selected_qty
reference_type = RETURN_FROM_CUSTOMER
reference_id = order_id
source_input_id = return_input_id
source_shopee_sku = return_shopee_sku
source_mapping_type = MIX_COLOR
odoo_status = Chờ ghi nhận Odoo
```

Với `COMBO_SKU`, tạo nhiều dòng `IN`, mỗi dòng theo component:

```text
type = IN
odoo_product_key = component odoo_product_key
qty = return_qty * component_qty
reference_type = RETURN_FROM_CUSTOMER
reference_id = order_id
source_input_id = return_input_id
source_shopee_sku = return_shopee_sku
source_mapping_type = COMBO_SKU
odoo_status = Chờ ghi nhận Odoo
```

Ví dụ:

| type | odoo_product_key | qty | reference_type |
| --- | --- | ---: | --- |
| `IN` | `BUT-DO` | 2 | `RETURN_FROM_CUSTOMER` |
| `IN` | `BUT-XANH` | 4 | `RETURN_FROM_CUSTOMER` |

Ý nghĩa:

| reference_type | Trường hợp |
| --- | --- |
| `TRANSFER_FROM_MAIN` | Nhập từ kho tổng |
| `RETURN_FROM_CUSTOMER` | Nhập do khách trả/hoàn |

### Chặn xác nhận nhập hoàn trùng

Trước khi tạo `IN` cho hàng hoàn, kiểm tra `source_input_id` đã từng có transaction `IN` với `reference_type = RETURN_FROM_CUSTOMER` chưa:

```gs
=COUNTIFS(
  Inventory_Transactions!source_input_id, return_input_id,
  Inventory_Transactions!type, "IN",
  Inventory_Transactions!reference_type, "RETURN_FROM_CUSTOMER"
)
```

Nếu kết quả lớn hơn 0:

```text
Không cho xác nhận nhập hoàn lại
```

### Tạo transaction OUT

Khi bấm `Xác nhận xuất kho`, hệ thống tạo transaction `OUT`.

Với `FIXED_SKU`:

```text
type = OUT
odoo_product_key = Order_Output.odoo_product_key
qty = -required_qty
reference_type = SHOPEE_ORDER
reference_id = order_id
source_input_id = input_id
source_shopee_sku = input_shopee_sku
source_mapping_type = FIXED_SKU
```

Với `MIX_COLOR`, tạo nhiều dòng `OUT`, mỗi dòng theo mã Odoo người dùng chọn:

```text
type = OUT
odoo_product_key = selected odoo_product_key
qty = -selected_qty
reference_type = SHOPEE_ORDER
reference_id = order_id
source_input_id = input_id
source_shopee_sku = input_shopee_sku
source_mapping_type = MIX_COLOR
```

Với `COMBO_SKU`, tạo nhiều dòng `OUT`, mỗi dòng theo component:

```text
type = OUT
odoo_product_key = component odoo_product_key
qty = -(order_qty * component_qty)
reference_type = SHOPEE_ORDER
reference_id = order_id
source_input_id = input_id
source_shopee_sku = input_shopee_sku
source_mapping_type = COMBO_SKU
```

### Chặn xác nhận trùng

Trước khi tạo `OUT`, kiểm tra `source_input_id` đã từng có transaction `OUT` chưa:

```gs
=COUNTIFS(Inventory_Transactions!source_input_id, input_id, Inventory_Transactions!type, "OUT")
```

Nếu kết quả lớn hơn 0:

```text
Không cho xác nhận lại
```

### Tạo transaction đảo

Nếu đơn bị hủy/sai sau khi đã xuất:

```text
type = CANCEL_REVERSAL
qty = số dương
reference_type = SHOPEE_ORDER
reference_id = order_id gốc
```

Không xóa transaction `OUT` cũ.

## 7. ReportProcessor

Mục tiêu: tạo 3 báo cáo chính.

## 7.1. Inventory_Report

Báo cáo tồn kho hiện tại.

Nguồn:

- `Products`
- `Inventory_Transactions`

### Công thức current_qty

```gs
=SUMIF(Inventory_Transactions!odoo_product_key, Products!odoo_product_key, Inventory_Transactions!qty)
```

Nếu dùng từng dòng:

```gs
=SUMIF(Inventory_Transactions!D:D, A2, Inventory_Transactions!E:E)
```

### Công thức difference_qty

```gs
=current_qty - odoo_quantity_on_hand
```

### Công thức status

```gs
=IF(current_qty<0, "Âm tồn", IF(difference_qty<>0, "Lệch Odoo", "OK"))
```

## 7.2. Daily_Inbound_Report

Báo cáo tổng hợp nhập kho theo ngày.

```gs
=QUERY(
  Inventory_Transactions!A:N,
  "select B, F, D, sum(E), count(A)
   where C = 'IN'
   group by B, F, D
   label sum(E) 'total_in_qty', count(A) 'source_count'",
  1
)
```

Gợi ý cột:

- `B` = `transaction_date`
- `C` = `type`
- `D` = `odoo_product_key`
- `E` = `qty`
- `F` = `reference_type`
- `A` = `transaction_id`

## 7.3. Daily_Outbound_Report

Báo cáo tổng hợp xuất kho theo ngày.

```gs
=QUERY(
  Inventory_Transactions!A:N,
  "select B, D, sum(E), count(H)
   where C = 'OUT'
   group by B, D
   label sum(E) 'total_out_qty', count(H) 'source_order_count'",
  1
)
```

Vì `OUT.qty` là số âm, cột hiển thị nên dùng trị tuyệt đối:

```gs
=ABS(total_out_qty)
```

## 8. Gợi ý triển khai trên Sheets

### MVP chỉ dùng công thức

Có thể bắt đầu bằng:

- `XLOOKUP` để tìm mapping.
- `SUMIF` để tính tồn.
- `COUNTIFS` để chống xuất trùng.
- `QUERY` để làm báo cáo ngày.
- Data validation để giới hạn enum/status.

### Khi cần nút bấm

Dùng Apps Script cho các thao tác:

- `Xác nhận xuất kho`: append dòng vào `Inventory_Transactions`.

### Không nên làm

- Không sửa trực tiếp `Inventory_Report.current_qty`.
- Không xóa transaction `OUT`.
- Không cho mã `MIX_COLOR` xuất nếu tổng `selected_qty` chưa bằng `required_qty`.
- Không cho xác nhận lại một `input_id` đã có transaction `OUT`.
