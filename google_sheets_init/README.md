# Google Sheets Init

Thư mục này chứa Apps Script để khởi tạo Google Sheet quản lý tồn kho Shopee/Odoo.

Lưu ý: Apps Script này chỉ dùng cho bước **khởi tạo / reset / refresh thủ công**. Runtime thật của web app dùng **Vercel Serverless Functions + Google Sheets API**, không gọi Apps Script làm API.

## Cách chạy

1. Tạo một Google Sheet trống.
2. Vào `Extensions > Apps Script`.
3. Copy nội dung [Code.gs](./Code.gs) vào file `Code.gs`.
4. Save project.
5. Chạy hàm `initializeStockManagementTemplate`.
6. Cho phép quyền truy cập khi Google hỏi.
7. Quay lại Google Sheet, reload trang.

Sau khi chạy, file sẽ có các sheet:

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

## Hàm có sẵn

- `initializeStockManagementTemplate`: tạo sheet/header/dropdown/formula, không xóa dữ liệu input/master.
- `refreshShopeeCatalogStock`: tính lại cột `stock` trong `Shopee_Catalog` từ tồn Odoo/Sheets sau mapping.
- `resetStockManagementTemplate`: xóa dữ liệu trong các sheet hệ thống rồi khởi tạo lại. Chỉ chạy khi muốn reset.

## Sau khi khởi tạo

Nhập dữ liệu ban đầu theo thứ tự:

1. Import sản phẩm Odoo vào `Products`.
2. Import danh mục export Shopee vào `Shopee_Catalog`, chỉ giữ các cột `SKU`, `Product Name`, `Variation Name`; cột `stock` để hệ thống tính.
3. Nhập mapping Shopee vào `Shopee_Mapping`.
4. Nếu có mã `COMBO_SKU`, nhập các mã Odoo thành phần vào `Shopee_Mapping_Components`.
5. Nếu có mã `MIX_COLOR`, nhập danh sách mã màu được phép chọn vào `Mix_Color_Options`.
6. Ghi nhận tồn thực tế ban đầu hoặc nhập kho vào `Inventory_Transactions`.
7. Chạy menu `Stock Management > Refresh Shopee stock` để tính lại `Shopee_Catalog.stock`.

Các báo cáo `Inventory_Report`, `Daily_Inbound_Report`, `Daily_Outbound_Report` sẽ tự tính từ dữ liệu gốc.

## Ghi chú vận hành

- Xuất kho Shopee nhập danh sách nhiều dòng trong `Manual_Order_Input`, gom bằng `order_batch_id`.
- Nhập hoàn/trả nhập danh sách nhiều dòng trong `Return_Input`, gom bằng `return_batch_id`.
- Mã Shopee nên được chọn từ `Shopee_Catalog`; UI/web app cần hỗ trợ search theo `sku`, `product_name` và `variation_name`.
- Trường `shopee_product_name` lưu lại `product_name` + `variation_name` tại thời điểm xử lý để người dùng dễ đối chiếu.
- Không dùng trực tiếp cột `Stock` trong file export Shopee; stock được tính lại từ tồn Odoo/Sheets.
- `COMBO_SKU` dùng khi 1 SKU Shopee gồm nhiều mã Odoo cố định, ví dụ 2 bút bi xanh + 2 ngòi bút.
