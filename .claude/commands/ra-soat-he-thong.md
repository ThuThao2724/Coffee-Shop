---
description: Rà soát toàn bộ hệ thống Coffee Shop (bảo mật, phân quyền theo chi nhánh, thanh toán SePay, dữ liệu, frontend, hạ tầng) bằng các skill đã cài
argument-hint: "[phạm vi, vd: bao-mat | thanh-toan | frontend | toan-bo]"
---

# Rà soát hệ thống Coffee Shop

Phạm vi lần này: **$ARGUMENTS** (nếu để trống → rà **toàn bộ**, theo thứ tự ưu tiên bên dưới).

## Bối cảnh hệ thống

Monorepo POS quán cà phê nhiều chi nhánh, chạy bằng `docker-compose.yml` (13 service):

| Phần | Công nghệ | Thư mục |
|---|---|---|
| Frontend (khách quét QR + nhân viên) | React + Vite + TypeScript, Zustand | `apps/frontend` |
| API Gateway (xác thực JWT, phân quyền, proxy) | NestJS | `apps/backend/api-gateway` |
| order / payment / report / chat / inventory | NestJS + Prisma + PostgreSQL, Kafka, Redis | `apps/backend/*-service` |
| user-service, table-service | Spring Boot (Java) | `apps/backend/user-service`, `table-service` |
| ai-service (dự báo doanh thu, chat báo cáo, Gemini) | FastAPI (Python) | `apps/backend/ai-service` |
| Thanh toán | SePay: QR chuyển khoản + webhook IPN (API key) | `payment-service` |

Vai trò: `ADMIN`, `MANAGER`, `WAITER`, `BARISTA`, `STAFF`, `CUSTOMER`. Mọi vai trò trừ ADMIN **chỉ được làm việc trong chi nhánh của mình**. Gateway giải mã JWT rồi gắn header `x-actor-role`, `x-actor-branch-id`, `x-actor-user-id` cho service phía sau; các service **tin** các header này.

## Skill phải dùng

Nạp skill tương ứng **trước khi** rà phần đó:

- Gateway, các service NestJS → `nestjs-expert`
- Schema/migration Prisma → `prisma-expert`
- user-service, table-service → `java-pro`
- ai-service → `fastapi-pro`
- Frontend → `react-best-practices`
- `docker-compose.yml`, Dockerfile → `docker-expert`
- Xác thực, phân quyền, webhook, dữ liệu vào → `api-security-best-practices`
- SePay, gọi API giữa các service → `api-integration-specialist`

## Cách làm (bắt buộc)

1. **Chỉ đọc và kiểm chứng, KHÔNG sửa code** cho tới khi tôi duyệt danh sách lỗi.
2. Mỗi lỗi phải có **bằng chứng**: `file:dòng`, và nếu kiểm chứng được thì kèm request/lệnh đã chạy cùng kết quả (mã HTTP, output). Ghi rõ lỗi nào **đã kiểm chứng** và lỗi nào **chỉ suy ra từ code**.
3. Được gọi API ở `http://localhost:8088` để kiểm chứng, nhưng **chỉ dùng request đọc** (GET) hoặc request chắc chắn bị từ chối. **Không** tạo/sửa/xóa dữ liệu thật, không gọi webhook làm đổi trạng thái đơn thật, không đổi `.env`.
4. Không đọc hay in giá trị bí mật trong `.env` (JWT secret, API key, mật khẩu DB); chỉ được nói là "đã đặt" hay "đang trống".
5. Phần nào cần nhiều thời gian, chia nhỏ theo service và báo tiến độ ngắn gọn sau mỗi phần.

## Danh sách kiểm tra (theo thứ tự ưu tiên)

### 1. Bảo mật & phân quyền (`api-security-best-practices`, `nestjs-expert`, `java-pro`)
- [ ] **Giả mạo header `x-actor-*`**: request **không token** nhưng tự gắn `x-actor-role: ADMIN` có lọt qua gateway tới service không? (Đã phát hiện: `GET /api/orders/branches/:id/orders` trả 200 với header giả.) Liệt kê **mọi** endpoint bị ảnh hưởng, đặc biệt endpoint ghi dữ liệu. Kiểm tra gateway có xóa header do client gửi trước khi gắn header thật không.
- [ ] Đối chiếu danh sách vai trò được phép giữa **gateway** (`proxy.controller.ts` → `authorizeRequest`) và **từng service** (`assertRoleAllowed`, `requireManagerOrAdmin`...). Tìm chỗ lệch nhau (từng gặp: gateway cho STAFF nhưng order-service chặn).
- [ ] Phạm vi chi nhánh: mỗi endpoint đọc/ghi đơn, bàn, menu, nhân viên, hóa đơn, thanh toán, kho có kiểm tra `branchId` của người gọi không? Có endpoint nào cho nhân viên chi nhánh A đọc/sửa dữ liệu chi nhánh B?
- [ ] Endpoint công khai (khách quét QR, hóa đơn công khai, gọi nhân viên): có lộ dữ liệu khách khác không (vd. `GET /api/orders?tableId=` trả đơn của khách trước)?
- [ ] Token nội bộ giữa các service (`INTERNAL_SERVICE_TOKEN`): giá trị mặc định có yếu/giống nhau không, có endpoint nội bộ nào lọt ra qua gateway không.
- [ ] JWT: thời hạn, thuật toán, secret mặc định trong code/compose, refresh token.
- [ ] CORS (`ALLOWED_ORIGINS`), rate limit cho đăng nhập/OTP, thông báo lỗi có lộ thông tin nội bộ không.

### 2. Thanh toán SePay (`api-integration-specialist`, `api-security-best-practices`)
- [ ] Webhook `payment.service.ts` → `handleWebhook`: xác thực API key, chống gửi lại (idempotency theo mã giao dịch), kiểm tra **số tiền** (đã sửa: chuyển thiếu thì giữ chờ và cộng dồn), khớp đơn theo nội dung chuyển khoản (có thể khớp nhầm đơn khác không?), xử lý giao dịch tiền ra.
- [ ] Luồng relay (`SEPAY_RELAY_*`) và `canBypassSepayAuth`: có cách nào bỏ qua xác thực không.
- [ ] Thanh toán hết hạn, đổi phương thức tiền mặt ↔ SePay, hóa đơn tự sinh sau khi PAID.
- [ ] Frontend còn gọi `/payments/online/init` (endpoint không tồn tại) trong `CustomerMenu.tsx`.

### 3. Dữ liệu & database (`prisma-expert`, `java-pro`)
- [ ] Schema Prisma của order/payment: index, ràng buộc, kiểu tiền (`Decimal`), quan hệ giữa các service (ID chéo service không có khóa ngoại).
- [ ] Chi nhánh không có `branch_menu_items` → `getBranchMenu` hiện menu dự phòng mà khách **không đặt được** (`order.service.ts`). Đề xuất cách xử lý đúng.
- [ ] Tên chi nhánh lưu không dấu, lỗi mã hóa tiếng Việt (mojibake) trong dữ liệu và code.
- [ ] Migration: có chạy tự động khi khởi động không, có nguy cơ mất dữ liệu không.

### 4. Frontend (`react-best-practices`)
- [ ] 35 lỗi TypeScript hiện có (`npx tsc --noEmit -p apps/frontend/tsconfig.json`), tập trung `Orders.tsx` (thiếu kiểu `CustomizationGroup`, `CustomCartLine`, `StaffSelectedOptions`).
- [ ] Các trang rất lớn (`CustomerMenu.tsx` ~3.500 dòng, `Orders.tsx` ~1.800 dòng): re-render thừa, gọi API tuần tự thay vì song song, polling, rò rỉ interval/socket.
- [ ] State lưu `localStorage` vs `sessionStorage` (chi nhánh, giỏ hàng, phiên khách) có gây dùng nhầm dữ liệu giữa các phiên/tab không.
- [ ] Trải nghiệm theo vai trò: nhân viên phục vụ, pha chế, quản lý, khách — nút lỗi, thông báo lỗi khó hiểu, thiếu tên chi nhánh.

### 5. Hạ tầng (`docker-expert`)
- [ ] `docker-compose.yml`: secret mặc định, port mở ra ngoài, healthcheck, thứ tự phụ thuộc, image không cố định phiên bản, chạy bằng root.
- [ ] Các Dockerfile: multi-stage, kích thước image, cache build.
- [ ] Tunnel Cloudflare (`scripts/start-tunnel.ps1`) và đường dẫn công khai: phần nào của hệ thống đang lộ ra internet.

### 6. ai-service (`fastapi-pro`)
- [ ] `apps/backend/ai-service/app/main.py`: xác thực endpoint, xử lý lỗi khi gọi Gemini, dữ liệu gửi cho Gemini có chứa thông tin nhạy cảm không, timeout.

### 7. Vệ sinh repo
- [ ] Hàng loạt file rác chưa commit: `*.bak*`, `*_hex_output.txt`, `dump_*.ps1`, `fix_*.py`, `patch_*.py`, `orders_seed.json`... Liệt kê file nào an toàn để xóa (không tự xóa).

## Định dạng báo cáo

Kết thúc bằng **một bảng lỗi**, sắp theo mức độ nghiêm trọng:

| # | Mức độ | Phần | Lỗi (1 câu) | Vị trí | Bằng chứng | Đã kiểm chứng? | Cách sửa đề xuất |
|---|---|---|---|---|---|---|---|

Mức độ: **Nghiêm trọng** (lộ/sửa dữ liệu không cần đăng nhập, mất tiền) → **Cao** → **Trung bình** → **Thấp**.

Sau bảng, đưa ra **thứ tự sửa đề xuất** (gộp các lỗi sửa chung được), rồi **dừng lại hỏi tôi** muốn sửa những mục nào. Viết báo cáo bằng tiếng Việt, ngắn gọn.
