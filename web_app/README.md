# Web App

Web app vận hành kho Shopee, publish trên Vercel và đọc/ghi dữ liệu qua Google Sheets API.

## Kiến trúc

- `src/`: React frontend
- `api/`: Vercel Serverless Functions
- `google_sheets_init/Code.gs`: chỉ dùng để khởi tạo template spreadsheet, không làm runtime API

Runtime flow:

1. Frontend gọi `/api/bootstrap`
2. Serverless function dùng service account đọc Google Spreadsheet trung tâm
3. Khi user xác nhận `Pick`, `Hàng hoàn`, `Nhập kho`, frontend gọi mutation API
4. Backend ghi vào các sheet nghiệp vụ và cập nhật lại `Shopee_Catalog.stock`

## Local development

```bash
npm install
npm run dev
```

Lưu ý:
- local dev vẫn chạy được UI
- `npm run dev` chỉ chạy Vite frontend
- để test cả frontend và `/api/*` với Google Sheets thật, build rồi chạy local server:

```bash
npm run build
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id \
GOOGLE_SERVICE_ACCOUNT_KEY_FILE=../smart-sandbox-424309-n5-c615a9ae9610.json \
npm run serve:local -- --port 4174
```

Mở `http://localhost:4174`.

## Environment variables

Tạo env từ [.env.example](./.env.example):

- `GOOGLE_SHEETS_SPREADSHEET_ID`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
- `APP_SHARED_TOKEN`
- `VITE_APP_SHARED_TOKEN`

Nếu bật token validation, `APP_SHARED_TOKEN` và `VITE_APP_SHARED_TOKEN` phải cùng giá trị.

## Google setup

1. Tạo Google Spreadsheet trung tâm.
2. Chạy `google_sheets_init/Code.gs` để khởi tạo template.
3. Bật Google Sheets API ở Google Cloud project chứa service account.
4. Share spreadsheet cho `GOOGLE_SERVICE_ACCOUNT_EMAIL` với quyền `Editor`.

Nếu spreadsheet đã tồn tại nhưng thiếu tab/header theo schema mới, chạy migration:

```bash
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id npm run migrate:sheets
```

## Deploy lên Vercel

1. Tạo Vercel project với root directory là `web_app`
2. Build command:
   - `npm run build`
3. Output directory:
   - `dist`
4. Khai báo toàn bộ env vars ở Vercel project
5. Redeploy

`vercel.json` đã có sẵn cấu hình function runtime cơ bản.

## API endpoints

- `GET /api/bootstrap`
- `POST /api/pick-batch-confirm`
- `POST /api/return-batch-confirm`
- `POST /api/inbound-confirm`

Response chuẩn:

```json
{
  "success": true,
  "message": "ok",
  "data": {}
}
```
