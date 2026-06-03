# PRD: Quản lý tồn kho Shopee bằng Google Sheets

## 1. Mục tiêu

Xây hệ thống Google Sheets để hỗ trợ kho xử lý đơn Shopee đúng mã Odoo và đúng số lượng trong bối cảnh:

- Odoo quản lý tồn kho theo mã sản phẩm và đơn vị nhỏ nhất.
- Shopee bán theo variation/bundle như 1 cái, 3 cái, 6 cái, 1 hộp.
- Một số mã Shopee là mã mix màu/random màu; tới lúc xuất mới biết chính xác mã Odoo màu nào được lấy.
- Nhập kho thực tế được ghi nhận trên Google Sheets trước, Odoo ghi nhận sau.
- Sau khi người dùng xác nhận xử lý đơn, hệ thống tạo giao dịch xuất kho ngay.
- Cuối ngày xem báo cáo xuất kho trong ngày để lấy số liệu xuất hóa đơn thủ công.

MVP ưu tiên xuất đúng, không ưu tiên xuất nhanh hoặc tự động hóa phức tạp.

## 2. Phạm vi MVP

### Làm

1. Quản lý danh mục SKU Odoo.
2. Quản lý danh mục sản phẩm/variation export từ Shopee.
3. Quản lý mapping SKU/variation Shopee sang SKU Odoo.
4. Hỗ trợ mapping bundle theo hệ số quy đổi.
5. Hỗ trợ mã Shopee mix màu để người dùng tự chọn mã Odoo và số lượng khi xuất.
6. Ghi nhận nhập kho thực tế trên Google Sheets.
7. Ghi nhận hàng hoàn theo mã Shopee và số lượng khách đã đặt/trả.
8. Người dùng nhập hoặc paste danh sách mã variation/SKU Shopee và số lượng khách đặt.
9. Hệ thống hiển thị mã Odoo cần xuất và số lượng tương ứng.
10. Người dùng bấm `Xác nhận xuất kho` để tạo giao dịch `OUT` ngay.
11. Có báo cáo xuất kho trong ngày để lấy số liệu xuất hóa đơn thủ công.
12. Đối soát tồn Sheets với tồn Odoo nhập/import thủ công.
13. Có báo cáo tồn kho hiện tại.
14. Có báo cáo tổng hợp nhập kho theo ngày.
15. Có báo cáo tổng hợp xuất kho theo ngày.

### Tạm bỏ qua

- Shopee API.
- Odoo API.
- Đồng bộ tồn tự động lên Shopee.
- Quét mã vạch.
- Batch pick tối ưu tốc độ.
- Web app riêng ngoài Google Sheets.

## 3. Khái niệm chính

### Odoo Product Key

Odoo export hiện không có cột SKU riêng. Hệ thống dùng `odoo_product_key` làm khóa nội bộ để mapping và tính tồn.

Mặc định:

```text
odoo_product_key = Display Name
```

Nếu sau này thống nhất quy tắc parse mã đầu chuỗi như `C-B009/XK`, vẫn lưu kết quả parse vào `odoo_product_key`.

Ví dụ:

| odoo_product_key | display_name | quantity_on_hand | unit |
| --- | --- | ---: | --- |
| `C-B009/XK Board Set pack 1/40` | `C-B009/XK Board Set pack 1/40` | 40 | `Pcs` |
| `C-B05/PH Board Set pack 1/50` | `C-B05/PH Board Set pack 1/50` | 0 | `Pcs` |
| `C-E02 Student Eraser box 30s/1200` | `C-E02 Student Eraser box 30s/1200` | 1200 | `Pcs` |

### Mapping Shopee

Một mã Shopee có 3 kiểu mapping:

| Kiểu | Ý nghĩa |
| --- | --- |
| `FIXED_SKU` | Mã Shopee map trực tiếp sang một mã Odoo cố định |
| `MIX_COLOR` | Mã Shopee chỉ xác định tổng số lượng cần xuất; người dùng chọn mã Odoo cụ thể khi xuất |
| `COMBO_SKU` | Mã Shopee gồm nhiều mã Odoo cố định, mỗi mã có số lượng thành phần riêng |

Ví dụ `FIXED_SKU`:

| Shopee SKU | Odoo Product Key | Hệ số |
| --- | --- | ---: |
| `BOARD-XK-1` | `C-B009/XK Board Set pack 1/40` | 1 |
| `BOARD-XK-6` | `C-B009/XK Board Set pack 1/40` | 6 |

Ví dụ `MIX_COLOR`:

| Shopee SKU | Nhóm mã Odoo | Hệ số |
| --- | --- | ---: |
| `BUT-MIX-6` | `BUT_MAU` | 6 |

Nếu khách mua `BUT-MIX-6` số lượng 2, tổng cần xuất là 12 cây. Khi xuất, người dùng tự chọn:

| Odoo SKU | Số lượng |
| --- | ---: |
| `BUT-DO` | 4 |
| `BUT-XANH` | 5 |
| `BUT-DEN` | 3 |

Tổng số lượng Odoo người dùng chọn phải bằng 12.

Ví dụ `COMBO_SKU`:

| Shopee SKU | Thành phần Odoo | Số lượng thành phần |
| --- | --- | ---: |
| `PEN-REFILL-BUNDLE` | `BUT-BI-XANH` | 2 |
| `PEN-REFILL-BUNDLE` | `NGOI-BUT` | 2 |

Nếu khách mua `PEN-REFILL-BUNDLE` số lượng 3, hệ thống cần xuất:

| Odoo SKU | Số lượng cần xuất |
| --- | ---: |
| `BUT-BI-XANH` | 6 |
| `NGOI-BUT` | 6 |

## 4. Cấu trúc Google Sheets

### `Products`

Danh mục sản phẩm import từ Odoo export.

| Cột | Mô tả |
| --- | --- |
| `odoo_product_key` | Khóa nội bộ, mặc định bằng `display_name` |
| `display_name` | `Display Name` từ Odoo |
| `quantity_on_hand` | `Quantity On Hand` từ Odoo |
| `unit` | `Unit` từ Odoo |

Các cột tồn khác trong Odoo export như `Free To Use Quantity`, `Incoming`, `Outgoing` không dùng trong MVP. Số tồn Odoo để đối soát chỉ là `Quantity On Hand`.

### `Shopee_Catalog`

Danh mục sản phẩm/variation export từ Shopee. Các cột khác trong file Shopee export như `Product ID`, `Variation ID`, `Parent SKU`, `Price`, `GTIN` không dùng trong MVP.

| Cột | Mô tả |
| --- | --- |
| `sku` | Cột `SKU` trong Shopee export; là khóa để xử lý đơn, hàng hoàn và mapping |
| `product_name` | Cột `Product Name` trong Shopee export |
| `variation_name` | Cột `Variation Name` trong Shopee export |
| `stock` | Tồn có thể bán trên Shopee, được tính từ tồn Odoo/Sheets sau khi mapping; không lấy trực tiếp từ stock export của Shopee |

Nếu dòng Shopee export không có `SKU`, hệ thống chưa dùng được dòng đó để xử lý đơn hoặc mapping cho tới khi người dùng bổ sung SKU.

### `Shopee_Mapping`

Mapping mã Shopee sang Odoo. Sheet này không lưu lại tên sản phẩm Shopee; tên dùng để search/lựa chọn lấy từ `Shopee_Catalog`.

| Cột | Mô tả |
| --- | --- |
| `shopee_sku` | Mã variation/SKU Shopee, tham chiếu `Shopee_Catalog.sku` |
| `mapping_type` | `FIXED_SKU`, `MIX_COLOR` hoặc `COMBO_SKU` |
| `odoo_product_key` | Mã Odoo, bắt buộc nếu `FIXED_SKU` |
| `mix_group_id` | Nhóm mã Odoo, bắt buộc nếu `MIX_COLOR` |
| `conversion_qty` | Hệ số quy đổi; dùng cho `FIXED_SKU` và `MIX_COLOR` |
| `active` | Còn bán hay không |
| `note` | Ghi chú |

### `Shopee_Mapping_Components`

Danh sách thành phần Odoo của mã Shopee `COMBO_SKU`.

| Cột | Mô tả |
| --- | --- |
| `shopee_sku` | Mã Shopee, tham chiếu `Shopee_Mapping.shopee_sku` |
| `component_no` | Số thứ tự thành phần |
| `odoo_product_key` | Mã Odoo thành phần |
| `component_qty` | Số lượng Odoo cần cho 1 đơn vị Shopee SKU |
| `active` | Thành phần còn dùng hay không |
| `note` | Ghi chú |

Ví dụ: combo “2 bút bi xanh + 2 ngòi bút” có 2 dòng component:

| shopee_sku | component_no | odoo_product_key | component_qty |
| --- | ---: | --- | ---: |
| `PEN-REFILL-BUNDLE` | 1 | `BUT-BI-XANH` | 2 |
| `PEN-REFILL-BUNDLE` | 2 | `NGOI-BUT` | 2 |

### `Mix_Color_Options`

Danh sách mã Odoo được phép chọn cho mã mix màu.

| Cột | Mô tả |
| --- | --- |
| `mix_group_id` | Nhóm mix màu |
| `odoo_product_key` | Mã Odoo được phép chọn |
| `display_name` | Display Name từ Odoo |
| `active` | Còn được chọn hay không |

### `Inventory_Transactions`

Nhật ký nhập/xuất/điều chỉnh tồn.

| Cột | Mô tả |
| --- | --- |
| `transaction_id` | Mã giao dịch |
| `transaction_date` | Ngày phát sinh |
| `type` | `IN`, `OUT`, `ADJUST`, `CANCEL_REVERSAL` |
| `odoo_product_key` | Mã Odoo |
| `qty` | Số lượng; nhập là dương, xuất là âm |
| `reference_type` | `TRANSFER_FROM_MAIN`, `RETURN_FROM_CUSTOMER`, `SHOPEE_ORDER`, `STOCKTAKE` |
| `reference_id` | Mã chứng từ hoặc mã đơn Shopee |
| `source_input_id` | Mã dòng nguồn: `input_id` nếu xuất đơn, hoặc `return_input_id` nếu nhập hoàn |
| `source_shopee_sku` | Mã Shopee gốc nếu giao dịch phát sinh từ Shopee |
| `source_mapping_type` | `FIXED_SKU`, `MIX_COLOR` hoặc `COMBO_SKU` |
| `odoo_status` | `Chờ ghi nhận Odoo`, `Đã ghi nhận Odoo`, `Không cần ghi nhận` |
| `created_by` | Người tạo |
| `note` | Ghi chú |

### `Manual_Order_Input`

Bảng người dùng nhập danh sách dòng hàng Shopee cần xuất. Một lần xử lý có thể có nhiều dòng Shopee SKU.

| Cột | Mô tả |
| --- | --- |
| `input_id` | Mã dòng nhập, dùng để chống xác nhận trùng |
| `order_batch_id` | Mã phiên/danh sách xử lý xuất kho |
| `order_id` | Mã đơn Shopee |
| `input_shopee_sku` | Mã variation/SKU Shopee, chọn từ danh sách có hỗ trợ search theo mã và tên variation |
| `shopee_product_name` | Tên sản phẩm/variation Shopee tại thời điểm nhập |
| `order_qty` | Số lượng khách đặt |
| `input_status` | `Mới`, `Đã quy đổi`, `Thiếu mapping`, `Thiếu tồn`, `Chưa chọn mã Odoo`, `Đã xuất kho` |
| `created_by` | Người nhập |
| `note` | Ghi chú |

### `Order_Output`

Bảng kết quả cần xuất.

| Cột | Mô tả |
| --- | --- |
| `output_id` | Mã dòng kết quả xuất |
| `input_id` | Mã dòng nhập đơn gốc |
| `order_batch_id` | Mã phiên/danh sách xử lý xuất kho |
| `order_id` | Mã đơn Shopee |
| `input_shopee_sku` | Mã Shopee |
| `mapping_type` | `FIXED_SKU`, `MIX_COLOR` hoặc `COMBO_SKU` |
| `odoo_product_key` | Mã Odoo cần xuất; với mix màu là mã người dùng chọn, với combo là mã component |
| `display_name` | Tên sản phẩm |
| `required_qty` | Tổng số lượng cần xuất |
| `selected_qty` | Số lượng người dùng chọn cho từng mã Odoo |
| `stock_status` | `Đủ hàng` hoặc `Thiếu hàng` |
| `confirm_status` | `Chưa xác nhận`, `Đã xuất kho`, `Lỗi` |

### `Return_Input`

Bảng người dùng nhập danh sách dòng hàng hoàn/trả theo thông tin Shopee. Một lần xử lý có thể có nhiều dòng Shopee SKU.

| Cột | Mô tả |
| --- | --- |
| `return_input_id` | Mã dòng hàng hoàn, dùng để chống nhập hoàn trùng |
| `return_batch_id` | Mã phiên/danh sách xử lý nhập hoàn |
| `order_id` | Mã đơn Shopee gốc |
| `return_shopee_sku` | Mã variation/SKU Shopee khách đã đặt/trả, chọn từ danh sách có hỗ trợ search theo mã và tên variation |
| `shopee_product_name` | Tên sản phẩm/variation Shopee tại thời điểm nhập hoàn |
| `return_qty` | Số lượng Shopee khách trả; có thể mặc định bằng số lượng khách đặt nếu trả toàn bộ |
| `return_status` | `Mới`, `Đã quy đổi`, `Thiếu mapping`, `Chưa chọn mã Odoo`, `Đã nhập kho` |
| `created_by` | Người nhập |
| `note` | Ghi chú |

### `Return_Output`

Bảng kết quả quy đổi hàng hoàn về mã Odoo để nhập lại tồn.

| Cột | Mô tả |
| --- | --- |
| `return_output_id` | Mã dòng kết quả hàng hoàn |
| `return_input_id` | Mã dòng hàng hoàn gốc |
| `return_batch_id` | Mã phiên/danh sách xử lý nhập hoàn |
| `order_id` | Mã đơn Shopee gốc |
| `return_shopee_sku` | Mã Shopee khách trả |
| `mapping_type` | `FIXED_SKU`, `MIX_COLOR` hoặc `COMBO_SKU` |
| `odoo_product_key` | Mã Odoo nhập lại; với mix màu là mã người dùng chọn, với combo là mã component |
| `display_name` | Tên sản phẩm |
| `return_required_qty` | Tổng số lượng Odoo cần nhập lại sau quy đổi |
| `selected_qty` | Số lượng thực tế nhập lại cho từng mã Odoo |
| `confirm_status` | `Chưa xác nhận`, `Đã nhập kho`, `Lỗi` |

### `Inventory_Report`

Báo cáo tồn kho hiện tại theo mã Odoo.

| Cột | Mô tả |
| --- | --- |
| `odoo_product_key` | Mã Odoo |
| `display_name` | Display Name từ Odoo |
| `current_qty` | Tồn kho hiện tại trên Sheets |
| `odoo_quantity_on_hand` | `Quantity On Hand` từ Odoo |
| `difference_qty` | Chênh lệch `current_qty - odoo_quantity_on_hand` |
| `status` | `OK`, `Âm tồn`, `Lệch Odoo`, `Sắp hết` |

### `Daily_Inbound_Report`

Báo cáo tổng hợp nhập kho theo ngày.

| Cột | Mô tả |
| --- | --- |
| `report_date` | Ngày nhập kho |
| `reference_type` | Nguồn nhập: `TRANSFER_FROM_MAIN` hoặc `RETURN_FROM_CUSTOMER` |
| `odoo_product_key` | Mã Odoo |
| `display_name` | Tên sản phẩm |
| `total_in_qty` | Tổng số lượng nhập trong ngày |
| `source_count` | Số chứng từ/dòng nhập liên quan |
| `odoo_status` | Trạng thái ghi nhận Odoo nếu cần đối soát |

### `Daily_Outbound_Report`

Báo cáo tổng hợp xuất kho theo ngày.

| Cột | Mô tả |
| --- | --- |
| `report_date` | Ngày xuất kho |
| `odoo_product_key` | Mã Odoo |
| `display_name` | Tên sản phẩm |
| `total_out_qty` | Tổng số lượng xuất trong ngày |
| `source_order_count` | Số đơn Shopee liên quan |

## 5. Luồng nghiệp vụ

### 5.1. Nhập kho từ kho tổng

1. Người dùng chọn nguồn nhập `TRANSFER_FROM_MAIN`.
2. Người dùng nhập trực tiếp mã Odoo và số lượng nhập.
3. Hệ thống tạo transaction `IN`.
4. Tồn thực tế trên Sheets tăng ngay.
5. Dòng nhập có `odoo_status = Chờ ghi nhận Odoo`.

### 5.2. Nhập kho do khách trả/hoàn

1. Người dùng mở một phiên nhập hoàn `return_batch_id`.
2. Người dùng nhập hoặc paste danh sách dòng hàng Shopee khách trả.
3. Mỗi dòng chọn `return_shopee_sku` từ danh sách `Shopee_Catalog`, có hỗ trợ search theo `sku`, `product_name` và `variation_name`.
4. Người dùng nhập `return_qty`; nếu khách trả một phần thì chỉnh theo số thực nhận.
5. Hệ thống tìm mapping trong `Shopee_Mapping` cho từng dòng.
6. Nếu `FIXED_SKU`, hệ thống tự quy đổi:

```text
return_required_qty = return_qty * conversion_qty
```

7. Nếu `COMBO_SKU`, hệ thống tạo nhiều dòng nhập lại theo `Shopee_Mapping_Components`.
8. Nếu `MIX_COLOR`, hệ thống hiển thị tổng số lượng Odoo cần nhập lại và yêu cầu người dùng chọn mã Odoo thực tế nhận về.
9. Khi người dùng xác nhận nhập hoàn cho cả danh sách hoặc từng dòng, hệ thống tạo transaction `IN` với `reference_type = RETURN_FROM_CUSTOMER`.
10. Tồn thực tế trên Sheets tăng ngay.

Ví dụ `FIXED_SKU`:

```text
return_shopee_sku = BOARD-XK-6
return_qty = 1
conversion_qty = 6
return_required_qty = 6
```

Hệ thống tạo:

| type | odoo_product_key | qty | reference_type |
| --- | --- | ---: | --- |
| `IN` | `C-B009/XK Board Set pack 1/40` | 6 | `RETURN_FROM_CUSTOMER` |

Ví dụ `MIX_COLOR`:

```text
return_shopee_sku = BUT-MIX-6
return_qty = 1
conversion_qty = 6
return_required_qty = 6
```

Người dùng kiểm hàng thực tế và chọn:

| Odoo SKU | Số lượng nhập lại |
| --- | ---: |
| `BUT-DO` | 2 |
| `BUT-XANH` | 4 |

Hệ thống tạo 2 transaction `IN`.

Ví dụ `COMBO_SKU`:

```text
return_shopee_sku = PEN-REFILL-BUNDLE
return_qty = 1
```

Thành phần:

| Odoo SKU | component_qty |
| --- | ---: |
| `BUT-BI-XANH` | 2 |
| `NGOI-BUT` | 2 |

Hệ thống tạo:

| type | odoo_product_key | qty | reference_type |
| --- | --- | ---: | --- |
| `IN` | `BUT-BI-XANH` | 2 | `RETURN_FROM_CUSTOMER` |
| `IN` | `NGOI-BUT` | 2 | `RETURN_FROM_CUSTOMER` |

Các nguồn nhập trong MVP:

| reference_type | Ý nghĩa |
| --- | --- |
| `TRANSFER_FROM_MAIN` | Nhập hàng từ kho tổng về kho xử lý Shopee |
| `RETURN_FROM_CUSTOMER` | Nhập lại hàng do khách trả/hoàn |

### 5.3. Nhập đơn Shopee

1. Người dùng mở một phiên xử lý xuất kho `order_batch_id`.
2. Người dùng nhập hoặc paste danh sách dòng hàng Shopee khách đặt.
3. Mỗi dòng chọn `input_shopee_sku` từ danh sách `Shopee_Catalog`, có hỗ trợ search theo `sku`, `product_name` và `variation_name`.
4. Người dùng nhập `order_qty` cho từng dòng.
5. Hệ thống tìm mapping trong `Shopee_Mapping` cho từng dòng.
6. Nếu thiếu mapping, báo `Thiếu mapping`.
7. Nếu `FIXED_SKU`, hệ thống tính:

```text
required_qty = order_qty * conversion_qty
```

8. Nếu `COMBO_SKU`, hệ thống tính số lượng cần xuất cho từng dòng component.
9. Nếu `MIX_COLOR`, hệ thống chỉ tính tổng số lượng cần xuất và yêu cầu người dùng chọn mã Odoo khi xuất.

### 5.4. Xử lý mã `FIXED_SKU`

1. Hệ thống hiển thị mã Odoo, tên sản phẩm và số lượng cần xuất.
2. Hệ thống kiểm tra tồn khả dụng.
3. Nếu đủ tồn, người dùng có thể bấm `Xác nhận xuất kho`.
4. Khi xác nhận, hệ thống tạo transaction `OUT` theo mã Odoo đã mapping.

### 5.5. Xử lý mã `MIX_COLOR`

1. Hệ thống hiển thị tổng số lượng cần xuất.
2. Hệ thống hiển thị danh sách mã Odoo được phép chọn trong `Mix_Color_Options`.
3. Người dùng tự chọn mã Odoo thực tế và nhập số lượng tương ứng.
4. Hệ thống kiểm tra:
   - tổng số lượng đã chọn bằng `order_qty * conversion_qty`,
   - từng mã Odoo được chọn thuộc đúng nhóm mix,
   - từng mã Odoo được chọn đủ tồn.
5. Nếu hợp lệ, người dùng có thể bấm `Xác nhận xuất kho`.
6. Khi xác nhận, hệ thống tạo nhiều transaction `OUT`, mỗi mã Odoo một dòng.

Ví dụ:

```text
Shopee SKU: BUT-MIX-6
order_qty: 2
conversion_qty: 6
required_qty: 12
```

Người dùng chọn:

| Odoo SKU | Số lượng |
| --- | ---: |
| `BUT-DO` | 4 |
| `BUT-XANH` | 5 |
| `BUT-DEN` | 3 |

Hệ thống tạo:

| type | odoo_product_key | qty |
| --- | --- | ---: |
| `OUT` | `BUT-DO` | -4 |
| `OUT` | `BUT-XANH` | -5 |
| `OUT` | `BUT-DEN` | -3 |

### 5.6. Xử lý mã `COMBO_SKU`

1. Hệ thống đọc danh sách thành phần trong `Shopee_Mapping_Components`.
2. Với từng thành phần, hệ thống tính:

```text
required_qty = order_qty * component_qty
```

3. Hệ thống kiểm tra tồn từng mã Odoo thành phần.
4. Nếu tất cả thành phần đủ tồn, người dùng có thể bấm `Xác nhận xuất kho`.
5. Khi xác nhận, hệ thống tạo nhiều transaction `OUT`, mỗi thành phần một dòng.

Ví dụ:

```text
Shopee SKU: PEN-REFILL-BUNDLE
order_qty: 3
```

| Odoo SKU | component_qty | required_qty |
| --- | ---: | ---: |
| `BUT-BI-XANH` | 2 | 6 |
| `NGOI-BUT` | 2 | 6 |

Hệ thống tạo:

| type | odoo_product_key | qty |
| --- | --- | ---: |
| `OUT` | `BUT-BI-XANH` | -6 |
| `OUT` | `NGOI-BUT` | -6 |

### 5.7. Xác nhận xuất kho

Khi người dùng bấm `Xác nhận xuất kho`:

1. Hệ thống kiểm tra lại mapping, số lượng và tồn tại thời điểm xác nhận.
2. Nếu hợp lệ, hệ thống tạo transaction `OUT`.
3. Tồn thực tế trên Sheets giảm ngay.
4. Không cho xác nhận lại cùng một dòng đơn nếu đã tạo `OUT`.

### 5.8. Hủy hoặc sửa sau khi đã xuất

Không xóa transaction `OUT` đã tạo.

Nếu cần hoàn lại tồn, tạo transaction đảo:

```text
type = CANCEL_REVERSAL
qty = số lượng dương
reference_id = mã đơn Shopee gốc
```

### 5.9. Xem báo cáo xuất kho trong ngày

1. Người dùng mở sheet `Daily_Outbound_Report`.
2. Người dùng chọn hoặc lọc ngày cần xem.
3. Hệ thống hiển thị tổng số lượng xuất trong ngày theo từng mã Odoo.
4. Người dùng lấy số liệu này để xuất hóa đơn thủ công.

### 5.10. Xem tồn kho hiện tại

1. Người dùng mở sheet `Inventory_Report`.
2. Hệ thống hiển thị tồn hiện tại theo từng mã Odoo.
3. Người dùng có thể lọc/tìm theo `odoo_product_key` hoặc `display_name`.
4. `current_qty` được tính từ tổng tất cả transaction của mã Odoo đó.
5. Nếu có import tồn Odoo, hệ thống hiển thị thêm `quantity_on_hand` và `difference_qty`.

Mục đích:

- Biết ngay mỗi mã Odoo hiện còn bao nhiêu trên Sheets.
- Hỗ trợ kiểm tra đủ hàng trước khi xử lý đơn Shopee.
- Phát hiện mã âm tồn hoặc lệch với Odoo.

## 6. Quy tắc nghiệp vụ

1. `conversion_qty` phải lớn hơn 0.
2. Mapping `FIXED_SKU` bắt buộc có `odoo_product_key`.
3. Mapping `MIX_COLOR` bắt buộc có `mix_group_id`.
4. Mapping `COMBO_SKU` bắt buộc có ít nhất 1 dòng active trong `Shopee_Mapping_Components`.
5. Với `COMBO_SKU`, mỗi component phải có `odoo_product_key` và `component_qty > 0`.
6. Với `MIX_COLOR`, hệ thống không tự chọn mã Odoo; người dùng tự chọn khi xuất hoặc khi nhập hàng hoàn.
7. Với `MIX_COLOR`, tổng số lượng các mã Odoo được chọn phải bằng `order_qty * conversion_qty` khi xuất hoặc `return_qty * conversion_qty` khi nhập hoàn.
8. Người dùng chỉ được chọn mã Odoo nằm trong `Mix_Color_Options` của nhóm mix.
9. Không tạo `OUT` nếu thiếu mapping, thiếu số lượng, hoặc thiếu tồn.
10. Mỗi dòng đơn chỉ được xác nhận xuất kho một lần.
11. Mỗi dòng hàng hoàn chỉ được xác nhận nhập kho một lần.
12. Mọi thay đổi tồn phải đi qua `Inventory_Transactions`.

## 7. Công thức chính

### Tồn thực tế

```text
actual_qty = SUM(Inventory_Transactions.qty WHERE odoo_product_key = current_sku)
```

### Báo cáo tồn kho hiện tại

```text
current_qty = SUM(Inventory_Transactions.qty WHERE odoo_product_key = current_product_key)
difference_qty = current_qty - odoo_quantity_on_hand
```

### Số lượng cần xuất

```text
required_qty = order_qty * conversion_qty
```

Với `COMBO_SKU`:

```text
required_qty per component = order_qty * component_qty
```

### Số lượng cần nhập lại từ hàng hoàn

```text
return_required_qty = return_qty * conversion_qty
```

Với `COMBO_SKU`:

```text
return_required_qty per component = return_qty * component_qty
```

### Kiểm tra mã mix màu

```text
selected_total_qty = SUM(Order_Output.selected_qty WHERE order_id = current_order AND input_shopee_sku = current_sku)
is_valid_mix = selected_total_qty = required_qty
```

### Báo cáo tổng hợp nhập kho theo ngày

```text
daily_in_qty = SUM(Inventory_Transactions.qty WHERE type = "IN" AND transaction_date = report_date GROUP BY reference_type, odoo_product_key)
```

### Báo cáo tổng hợp xuất kho theo ngày

```text
daily_out_qty = ABS(SUM(Inventory_Transactions.qty WHERE type = "OUT" AND transaction_date = report_date GROUP BY odoo_product_key))
```

### Stock hiển thị trên danh mục Shopee

```text
IF mapping_type = FIXED_SKU:
  shopee_stock = FLOOR(current_qty of mapped odoo_product_key / conversion_qty)

IF mapping_type = MIX_COLOR:
  shopee_stock = FLOOR(SUM(current_qty of active Mix_Color_Options in mix_group_id) / conversion_qty)

IF mapping_type = COMBO_SKU:
  shopee_stock = MIN(FLOOR(current_qty of component odoo_product_key / component_qty) for all active components)
```

`shopee_stock` dùng để điền/cập nhật cột `stock` trong `Shopee_Catalog`. Cột này không lấy từ tồn Shopee export vì tồn Shopee phải phụ thuộc tồn Odoo/Sheets sau quy đổi.

## 8. Báo lỗi cần có

- Thiếu mapping Shopee.
- Số lượng khách đặt không hợp lệ.
- Mã mix màu chưa chọn mã Odoo.
- Mã mix màu chọn sai nhóm Odoo.
- Tổng số lượng mix màu thiếu hoặc dư.
- Tồn Sheets không đủ.
- Đơn đã xác nhận xuất kho trước đó.
- Hàng hoàn đã xác nhận nhập kho trước đó.

## 9. Tiêu chí hoàn thành MVP

1. Nhập kho thực tế làm tăng tồn Sheets.
2. Nhập danh sách mã Shopee và số lượng khách đặt ra đúng số lượng cần xuất cho từng dòng.
3. Bundle `FIXED_SKU` quy đổi đúng theo hệ số.
4. Mã `COMBO_SKU` tạo đúng nhiều dòng Odoo component theo `component_qty`.
5. Mã `MIX_COLOR` cho phép người dùng tự chọn mã Odoo và số lượng khi xuất.
6. Hệ thống chặn xác nhận nếu mã mix màu chọn thiếu/dư số lượng.
7. Bấm xác nhận tạo transaction `OUT` ngay.
8. Báo cáo tồn kho hiển thị đúng tồn hiện tại theo mã Odoo.
9. Hàng hoàn theo mã Shopee quy đổi đúng về mã Odoo để nhập lại tồn.
10. Báo cáo nhập kho theo ngày gom đúng các transaction `IN`.
11. Báo cáo xuất kho theo ngày gom đúng các transaction `OUT` để lấy số liệu xuất hóa đơn thủ công.
