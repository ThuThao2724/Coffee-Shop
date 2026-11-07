---
description: Sửa các lỗi đã tìm thấy khi rà soát hệ thống Coffee Shop, theo từng đợt, có kiểm chứng trước và sau khi sửa
argument-hint: "[đợt hoặc mã lỗi, vd: dot-1 | dot-2 | L3 | L4,L5 | tat-ca]"
---

# Sửa lỗi hệ thống Coffee Shop

Phạm vi lần này: **$ARGUMENTS**. Nếu để trống, chỉ làm **Đợt 1**. `tat-ca` nghĩa là làm lần lượt từ Đợt 1 đến Đợt 6, **dừng lại báo cáo sau mỗi đợt** rồi mới làm đợt tiếp theo.

Danh sách lỗi dưới đây có từ lần rà soát ngày 2026-11-06 (`/ra-soat-he-thong`). Code có thể đã đổi từ đó, nên **trước khi sửa mỗi lỗi, hãy kiểm chứng lại là lỗi vẫn còn**. Lỗi nào đã hết thì ghi "đã hết" và bỏ qua.

## Quy tắc bắt buộc

1. **Kiểm chứng trước, sửa sau, kiểm chứng lại.** Mỗi lỗi có mục *Kiểm chứng*: chạy nó trước khi sửa (phải thấy lỗi) và sau khi sửa (phải thấy đã hết). Báo kết quả cả hai lần.
2. **Không phá dữ liệu thật.** Muốn thử ghi dữ liệu thì dùng mã giả không tồn tại (vd. `khong-ton-tai-zzz`). Nếu buộc phải tạo dữ liệu thử thì đặt tiền tố `TEST` và **xóa sạch** sau khi thử. Không chuyển trạng thái đơn hay thanh toán thật.
3. **Trước Đợt 3** (động vào seed hoặc migration), phải **sao lưu tất cả database** bằng `pg_dump` vào thư mục scratchpad và báo đường dẫn file sao lưu.
4. Không đọc hay in giá trị bí mật trong `.env`. Mọi việc đổi khóa hoặc mật khẩu (L11) **phải hỏi trước**, vì đổi JWT secret sẽ đăng xuất mọi người.
5. Nạp skill tương ứng **trước khi** sửa: gateway và service NestJS → `nestjs-expert`; Prisma → `prisma-expert`; user/table-service → `java-pro`; ai-service → `fastapi-pro`; frontend → `react-best-practices`; Docker → `docker-expert`; phân quyền, bảo mật → `api-security-best-practices`; SePay và gọi giữa các service → `api-integration-specialist`.
6. Sửa gọn, đúng chỗ, không tái cấu trúc lan sang phần khác. Code mới viết theo đúng phong cách code xung quanh.
7. **Không commit, không push** trừ khi tôi yêu cầu.
8. Sau mỗi đợt: build lại **chỉ các service bị sửa**, kiểm tra chúng khỏe (`docker compose ps`), rồi chạy lại toàn bộ mục *Kiểm chứng* của đợt đó.

## Lưu ý môi trường (đã gặp, đừng vấp lại)

- Luôn chạy `docker compose` **từ thư mục gốc repo** (`C:\Users\Thao\coffe-shop`). Trong `apps/backend/api-gateway` có một `docker-compose.yml` khác, chạy ở đó sẽ báo `no such service`.
- Build lại một service: `docker compose up -d --build --no-deps <service>`. user-service và table-service (Java, Gradle) build lâu, nên chạy nền. Trong lúc service khởi động lại, đăng nhập sẽ lỗi; đó **không phải** do code.
- Frontend: kiểm tra kiểu bằng `npx tsc --noEmit -p apps/frontend/tsconfig.json`. Hiện có sẵn **35 lỗi cũ**; sửa xong **không được làm tăng** con số này (trừ khi đang ở L20).
- Shell là Windows (Git Bash và PowerShell 5.1). Gateway ở `http://localhost:8088`. Mã chi nhánh: Trung Tâm `5771ec7d-56ec-4c1b-aa94-ea30a14e0528`, Riverside `104aeb39-4582-4b88-bbce-6fc17ee3b414`.
- payment-service gọi thẳng order-service bên trong mạng Docker kèm header `x-actor-role: ADMIN` (`payment.service.ts`, khoảng dòng 910). Lời gọi nội bộ này không đi qua gateway; sửa gateway **không được** làm hỏng nó.

---

## Đợt 1: Nghiêm trọng, đang lộ ra internet (L1, L2, L9)

### L2: Gateway để lọt header `x-actor-*` giả
- **Vị trí:** `apps/backend/api-gateway/src/proxy/proxy.controller.ts`, hàm `attachActorContextHeaders` (khoảng dòng 561). Hàm này chỉ ghi đè header khi có token nhân viên hợp lệ. Request không token hoặc dùng token `CUSTOMER` thì header do client tự gửi được chuyển thẳng xuống service.
- **Sửa:** ở đầu luồng xử lý request (trước `authorizeRequest`), **luôn xóa** mọi header `x-actor-*` cùng các bí danh mà service đang đọc: `x-user-role`, `x-user-id`, `x-branch-id`. Sau đó mới gắn header thật lấy từ token.
- **Kiểm chứng:**
  ```
  curl -s -o /dev/null -w '%{http_code}\n' -H 'x-actor-role: ADMIN' http://localhost:8088/api/orders/branches/104aeb39-4582-4b88-bbce-6fc17ee3b414/orders
  ```
  Trước khi sửa: `200`. Sau khi sửa: **phải là 401 hoặc 403**.

### L1: Ghi menu chi nhánh không cần đăng nhập
- **Vị trí:** `POST|PUT|DELETE /api/orders/branches/:branchId/menu/items/:itemId` (`order.controller.ts`, dẫn tới `activateBranchMenuItem`, `updateBranchMenuItem`, `removeBranchMenuItem`). Hàm `assertManagerCanManageBranch` (`order.service.ts`, khoảng dòng 2665) chỉ chặn khi vai trò là `MANAGER`, nên vai trò rỗng đi qua. Gateway cũng không có quy tắc nào cho đường dẫn này.
- **Sửa (hai lớp):**
  1. Gateway: thêm quy tắc bắt `ADMIN` hoặc `MANAGER` cho `^/api/orders/branches/[^/]+/menu/items(/|$)` khi method khác `GET`.
  2. order-service: ở 3 endpoint trên, gọi `assertRoleAllowed(actorRole, ['ADMIN','MANAGER'])` trước khi gọi service. Giữ nguyên `assertManagerCanManageBranch` cho phần kiểm tra chi nhánh.
- **Kiểm chứng:** với mã món giả, cả 3 method **không header** và **header giả ADMIN** trước khi sửa đều trả `404`; sau khi sửa **phải là 401 hoặc 403**:
  ```
  for m in POST PUT DELETE; do curl -s -o /dev/null -w "$m %{http_code}\n" -X $m -H 'Content-Type: application/json' -d '{}' http://localhost:8088/api/orders/branches/104aeb39-4582-4b88-bbce-6fc17ee3b414/menu/items/khong-ton-tai-zzz; done
  ```
  Lời gọi nội bộ thẳng tới `http://order-service:3001` kèm `x-actor-role: ADMIN` (chạy từ trong container `api-gateway`) với mã giả **vẫn phải trả 404**, chứng tỏ không làm hỏng luồng nội bộ.

### L9: Khách sửa được món trong đơn của người khác
- **Vị trí:** `PATCH /api/orders/:id/customer-items` (`order.controller.ts`, khoảng dòng 568) không kiểm tra người gọi có phải chủ đơn không.
- **Sửa:** đọc luồng frontend trước (`CustomerMenu.tsx`, tìm `customer-items`) để biết khách đang gửi những gì. Đề xuất cách ràng buộc tối thiểu không cần đổi giao diện, ví dụ bắt buộc `tableId` trong body khớp với `tableId` của đơn và đơn còn ở trạng thái cho phép sửa. **Nêu đề xuất và hỏi tôi** nếu cách sửa cần đổi luồng ở frontend.
- **Kiểm chứng:** gọi với mã đơn thật nhưng sai `tableId` thì phải bị từ chối. Chỉ thử bằng request chắc chắn bị từ chối, không sửa đơn thật.

---

## Đợt 2: Thanh toán (L3, L10, L17, L18)

### L3: Khách tự chọn số tiền thanh toán (nghiêm trọng)
- **Vị trí:** `payment-service/src/modules/payment/payment.service.ts`, hàm `create` (khoảng dòng 1699) lấy `amount` từ client. Với thanh toán SEPAY đang chờ, gửi lại sẽ **ghi đè** số tiền. Phía order-service, `confirmOrderPayment` (`order.service.ts`, khoảng dòng 2985) cũng không đối chiếu.
- **Sửa:** khi tạo hoặc tạo lại thanh toán, payment-service gọi order-service (`GET http://order-service:3001/api/orders/:id`) để lấy `totalAmount` thật và dùng con số đó. `amount` client gửi lên chỉ để đối chiếu: lệch thì ghi log cảnh báo. Không gọi được order-service thì **từ chối** tạo thanh toán, không được lùi về dùng số tiền của client. Kiểm tra cả đơn đã thanh toán hoặc đã hủy.
- **Kiểm chứng:** tạo một đơn thử có tiền tố TEST rồi tạo thanh toán với `amount: 1000`. Số tiền lưu và số tiền trong QR phải bằng tổng tiền thật của đơn. Xóa đơn và thanh toán thử sau khi xong.

### L10: Endpoint verify công khai tin phản hồi không xác thực
- **Vị trí:** `verifyWithProviderApi` (khoảng dòng 704) cùng `resolveProviderStatusFromPayload`. `POST /api/v1/payments/:paymentId/verify` công khai, gọi `pgapi.sepay.vn` không kèm xác thực, rồi coi `success: true` hoặc `SUCCESS` là PAID, với `transactionFound` mặc định là đúng.
- **Sửa:** chỉ cho chuyển sang PAID bằng **webhook đã xác thực**. Endpoint verify chỉ được phép đánh dấu EXPIRED hoặc trả trạng thái hiện tại; hoặc bỏ phần gọi API SePay nếu không cấu hình được API chính thức có xác thực. Giữ nguyên hành vi frontend đang dựa vào (nút "Kiểm tra giao dịch").

### L17: So sánh API key không chống timing attack
- **Vị trí:** `verifySepayWebhookAuth`, `isApiKeyMatch` (khoảng dòng 397) dùng `===`. **Sửa:** dùng hàm `safeCompare` đã có sẵn trong file.
- **Kiểm chứng:** gọi webhook với nội dung không khớp đơn nào: không key → `400`; có key đúng → `200` với `"reason":"payment-not-found"`.

### L18: Frontend gọi endpoint không tồn tại
- **Vị trí:** `apps/frontend/src/pages/CustomerMenu.tsx` (khoảng dòng 2540) gọi `api.post('/payments/online/init')` rồi lùi về `/v1/payments` khi lỗi. **Sửa:** gọi thẳng `/v1/payments`.

---

## Đợt 3: Dữ liệu bị ghi đè mỗi lần khởi động (L4, L5, L6). Sao lưu trước!

### L4: Seed order-service ghi đè menu
- **Vị trí:** `apps/backend/order-service/prisma/seed.js` (bản thật sự chạy, khoảng dòng 219, cùng `seed.ts` tương ứng). Với món đã có, seed gọi `menuItem.update({...item, available: true, image, customizations})`, nên giá, trạng thái ngừng bán và ảnh do quản lý sửa đều bị đặt lại. Seed chạy ở mỗi lần khởi động (`docker-compose.yml`, khoảng dòng 158).
- **Sửa:** seed chỉ **tạo món chưa có**; món đã tồn tại thì bỏ qua. Áp dụng tương tự cho danh mục (khoảng dòng 187), mã khuyến mãi và công thức (`upsert` → chỉ tạo). Sửa cả `seed.ts` lẫn `seed.js` để hai file khớp nhau.
- **Kiểm chứng:** ghi lại giá và `available` của một món, đổi tạm (rồi khôi phục) **chỉ trên dữ liệu đã sao lưu**, hoặc thử trên một món TEST. Khởi động lại order-service, giá trị phải giữ nguyên.

### L5: Seed inventory tự nạp lại tồn kho
- **Vị trí:** `apps/backend/inventory-service/prisma/seed.js` (khoảng dòng 56-70): `nextStock = max(current, seed)`, kèm tạo `stockMovement` và đặt lại `importPrice`, `minStock`, `isActive`.
- **Sửa:** nguyên liệu đã tồn tại thì không động vào. Kiểm chứng tương tự L4: tồn kho trước và sau khi khởi động lại phải bằng nhau, và không sinh thêm phiếu `seed-script` mới.

### L6: `prisma db push --accept-data-loss` khi khởi động, không có migration
- **Vị trí:** `docker-compose.yml` các dòng khoảng 158 (order), 191 (chat), 222 (inventory); payment và report dùng `db push` không có cờ đó. Không service nào có `prisma/migrations`.
- **Sửa:** với từng service Prisma, tạo migration nền từ schema hiện tại (`prisma migrate diff --from-empty --to-schema-datamodel ... --script` vào `prisma/migrations/0_init/migration.sql`), đánh dấu đã áp dụng trên DB đang có (`prisma migrate resolve --applied 0_init`), rồi đổi lệnh khởi động thành `npx prisma migrate deploy`. **Trình bày kế hoạch và hỏi trước** khi đổi lệnh khởi động.
- **Kiểm chứng:** `prisma migrate status` báo "up to date"; khởi động lại không mất dữ liệu (so số dòng các bảng chính trước và sau).

---

## Đợt 4: Phân quyền và giới hạn (L7, L8, L12, L14)

### L7: Không giới hạn số lần đăng nhập sai
- **Sửa:** ở gateway, giới hạn `POST /api/auth/login` (và các đường đăng nhập của khách, OTP, quên mật khẩu) theo **IP + email**, ví dụ 5 lần sai trong 15 phút thì trả `429`. Dùng Redis có sẵn nếu tiện. Hệ thống chạy sau Cloudflare Tunnel, nên lấy IP từ `cf-connecting-ip` khi có, nếu không thì dùng `req.ip`.
- **Kiểm chứng:** 8 lần đăng nhập sai với **email không tồn tại** (`khong-ton-tai-ratelimit@example.invalid`). Trước khi sửa: toàn `401`. Sau khi sửa: từ lần thứ 6 phải là `429`. Không thử bằng tài khoản thật.

### L8: Báo cáo không khóa chi nhánh cho quản lý
- **Vị trí:** `apps/backend/report-service/src/modules/reports/reports.controller.ts`. Mọi endpoint (revenue, top-items, inventory, staff-performance, dashboard, export, realtime/stream) dùng `query.branchId` trực tiếp; dòng khoảng 101 còn có `isAdmin ? branchId : branchId || actorBranchId`.
- **Sửa:** viết một hàm dùng chung. Người không phải ADMIN thì **bắt buộc** dùng `req.user.branchId`; nếu truyền `branchId` khác thì trả `403`. Áp cho mọi endpoint.

### L12: ai-service mặc định cho chạy không cần vai trò
- **Vị trí:** `apps/backend/ai-service/app/main.py` dòng 42-43 (`AI_ENFORCE_RBAC` mặc định false, `AI_ALLOW_LEGACY_NO_AUTH` mặc định true) và `authorize_request` (khoảng dòng 263, còn nhận cả `x-user-role`).
- **Sửa:** trước tiên tìm **mọi chỗ gọi ai-service** (frontend qua gateway, report-service, chat-service...) xem có chỗ nào gọi mà không kèm vai trò. Sau đó đặt `AI_ENFORCE_RBAC=true`, `AI_ALLOW_LEGACY_NO_AUTH=false` trong `docker-compose.yml`, và với MANAGER thì bắt buộc dùng chi nhánh của chính họ khi request không truyền `branch_id`.

### L14: Endpoint `/api/v1/ingredients` cũ không khóa chi nhánh
- **Vị trí:** `apps/backend/inventory-service/src/modules/inventory/inventory.controller.ts` (khoảng dòng 34-68), chỉ có `requireInventoryRole`.
- **Sửa:** kiểm tra frontend còn dùng các endpoint này không. Nếu còn: với MANAGER thì lọc hoặc chặn theo `req.user.branchId`, dùng lại cách của `inventory-spec.controller.ts`. Nếu không: đề xuất bỏ.

---

## Đợt 5: Bí mật và chatbot (L11, L13)

### L11: Khóa bí mật yếu hoặc mặc định
- Hiện tại `INTERNAL_SERVICE_TOKEN` và các mật khẩu DB dùng giá trị mặc định yếu; `docker-compose.yml` có sẵn mặc định `dev...` cho `JWT_SECRET` và `INTERNAL_SERVICE_TOKEN`; JWT sống 24 giờ (`JWT_EXPIRATION=86400000`).
- **Sửa (hỏi trước từng mục):** sinh `INTERNAL_SERVICE_TOKEN` ngẫu nhiên mới (kiểm tra mọi service đọc cùng một biến, gồm cả hai mặc định khác nhau `dev-internal-token` và `internal-service-token` trong order-service). Bỏ giá trị mặc định của các biến bí mật trong compose để thiếu biến thì báo lỗi ngay. Riêng đổi mật khẩu Postgres hoặc JWT secret thì chỉ đề xuất, không tự làm.

### L13: Chatbot trả lời bằng chữ lỗi mã hóa
- **Vị trí:** `apps/backend/ai-service/app/main.py`, khoảng 31 dòng (vd. 1761-1765: `"MÃ¬nh Ä‘Ã£ ghi nháº­n..."`, từ khóa `"Ä‘áº·t"`). Gateway `proxy.controller.ts` có 1 dòng.
- **Sửa:** khôi phục từng chuỗi về tiếng Việt UTF-8 đúng (chuỗi bị đọc nhầm UTF-8 thành cp1252; giải mã ngược `s.encode('cp1252').decode('utf-8')` và kiểm tra từng chuỗi). **Không chạy** các script `fix_mojibake*.py` có sẵn trong repo mà chưa đọc kỹ.
- **Kiểm chứng:** `grep` không còn mẫu `Ã[¡-ÿ]|Ä‘|á»|Æ°` trong 2 file đó; `python -c "import ast; ast.parse(open(...).read())"` không lỗi.

---

## Đợt 6: Hạ tầng, giao diện, repo (L15, L16, L19, L20, L21)

- **L16:** gateway dùng `helmet()` (kiểm tra không chặn trang khách và socket), bỏ `X-Powered-By`.
- **L19:** `getBranchMenu` (`order.service.ts`, khoảng dòng 338): bỏ menu dự phòng; chi nhánh chưa có món thì trả danh sách rỗng, và frontend `CustomerMenu.tsx` hiện "Chi nhánh chưa có món, vui lòng gọi nhân viên".
- **L20:** sửa 35 lỗi TypeScript; ưu tiên `Orders.tsx` (thiếu kiểu `CustomizationGroup`, `CustomCartLine`, `StaffSelectedOptions`; trường `transactionId`, `updatedAt`). Mục tiêu: `tsc` không còn lỗi, giao diện không đổi.
- **L15:** thêm `USER` không phải root vào các Dockerfile và `deploy.resources.limits` trong compose. **Làm từng service một**, kiểm tra quyền ghi (vd. thư mục ảnh menu upload của order-service, thư mục backup) trước khi chuyển service tiếp theo.
- **L21:** **Commit** `apps/frontend/src/components/IngredientForecast.tsx`, vì `Reports.tsx` đang import nó; chỉ commit khi tôi đồng ý. Liệt kê để tôi duyệt rồi mới xóa các file rác chưa commit: `*.bak*`, `*_hex_output.txt`, `dump_*.ps1`, `fix_*.py`, `patch_*.py`, `simplify_*.py`, `insert_gemini_env.py`, `*_section.txt`, `payment-service/orders_seed.json`.

---

## Báo cáo sau mỗi đợt

| Mã | Lỗi | Trạng thái (đã sửa / đã hết từ trước / bỏ qua / cần quyết định) | File đã sửa | Kiểm chứng trước → sau |
|---|---|---|---|---|

Sau bảng: các service đã build lại và trạng thái của chúng, số lỗi `tsc` của frontend, việc tôi cần làm tay (nếu có), và **câu hỏi cho đợt tiếp theo**. Viết bằng tiếng Việt, ngắn gọn.
