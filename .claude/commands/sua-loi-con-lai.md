---
description: Sửa các lỗi còn lại sau PR #2–#15 (cờ test, chất lượng code/CI, nâng cấp và dữ liệu cần quyết định, việc trước khi lên VPS)
argument-hint: "[đợt hoặc mã việc, vd: dot-a | dot-b | S1 | S1,S3 | tat-ca]"
---

# Sửa các lỗi còn lại — Coffee Shop

Phạm vi lần này: **$ARGUMENTS**

- **Để trống:** chỉ làm **Đợt A**.
- `tat-ca`: làm lần lượt Đợt A → C, **dừng báo cáo sau mỗi đợt**.
- **Đợt D** (trước khi lên VPS): chỉ làm khi tôi gọi đích danh `dot-d`.

## Bối cảnh

- Danh sách cũ R1–R15 đã xử lý xong qua PR #2 → #7 (`c62094a`, 2026-11-14):
  - Vá lỗ hổng npm và cả 10 image (Node 22, Spring Boot 3.5.16); NestJS 11, react-router 7.
  - nginx chạy không phải root; thêm unit test cho payment, report, inventory.
  - Tắt việc tự tạo tài khoản demo mật khẩu công khai mỗi lần khởi động; bước E2E chạy trên mọi PR.
- Đợt rà soát 2026-11-15 (`/ra-soat-he-thong`) đã sửa qua PR #8 → #15, tất cả đã merge vào `main` (`40d3648`):
  - #8 vượt quyền bằng chữ hoa / dấu `/` trong đường dẫn; #9 ai-service không lưu được dữ liệu;
  - #10 SePay relay không xác thực, webhook không key; #11 CORS trả 500;
  - #12 lộ danh sách bàn mọi chi nhánh và lương đồng nghiệp; #13 khóa bí mật mặc định công khai (S1);
  - #14 ai-service tự kiểm tra quyền; #15 xóa bộ khung NestJS cũ trong 2 service Java;
  - dữ liệu mồ côi đã sửa trực tiếp trong database (bàn 1 gán về Trung Tâm, 6 đơn treo → CANCELLED, xóa bàn 56).
  - Không sửa: log lỗi kết nối Postgres khi Docker khởi động lại (service tự khởi động lại; nhánh dự phòng của migrate chỉ chạy với `P3005`).
- CI trên `main`: 24/24 job xanh, có E2E.
- Các mục dưới đây **kiểm chứng ngày 2026-11-15**. Đo lại trước khi làm. Mục nào đã hết thì ghi "đã hết" và bỏ qua.
- Tách nhánh mới từ `main` cho mỗi đợt. Không commit thẳng lên `main`.

## Quy tắc bắt buộc

1. **Kiểm chứng trước → sửa → kiểm chứng lại**, báo cả hai kết quả. Logic có sửa thì phải có test, và thử cố ý làm hỏng (trên bản sao) để chắc test báo đỏ.
2. **Không phá dữ liệu thật.**
   - Dữ liệu thử dùng tiền tố `TEST`, xóa sạch sau khi thử.
   - Trước khi động vào database: `pg_dumpall | gzip` vào scratchpad, báo đường dẫn.
   - Phép thử khó dọn thì chạy trên bộ hệ thống tách riêng `-p coffe-e2e`.
3. **Không đọc/in giá trị bí mật.**
   - Việc ghi khóa vào `.env` bị chặn tự động: soạn lệnh để **tôi tự chạy**, rồi kiểm chứng bằng mã băm.
   - Đổi JWT secret, mật khẩu Postgres hay mật khẩu tài khoản **phải hỏi trước**.
4. **Nâng major** (NestJS, Prisma, React, Vite, Spring Boot, Postgres): liệt kê lý do và rủi ro rồi **hỏi**.
5. **Không commit, không push khi tôi chưa đồng ý.** Khi tôi đồng ý: push nhánh, rồi mở sẵn trang tạo PR với mô tả tiếng Việt điền sẵn.
6. Nạp skill phù hợp trước khi sửa: `java-pro`, `nestjs-expert`, `docker-expert`, `api-security-best-practices`, `react-best-practices`.
7. **Quy trình build/test/quét và lưu ý môi trường:** đọc và làm theo `.claude/commands/sua-loi-du-an.md`, mục *Quy trình cho mỗi lỗi* và *Lưu ý môi trường*. Điểm chính:
   - Ổ C gần đầy làm Docker treo.
   - Build từng service một.
   - Maven hay ngắt mạng, nên thử lại.
   - Lockfile tạo bằng npm 10.9 của `node:22-bookworm-slim`.
   - File `.sh` phải là LF.

---

## Đợt A — Gia cố cấu hình (đã xong)

S1 (khóa bí mật mặc định công khai): **đã xong**, PR #13.

### S2 + S11. Khách phải quét QR mới xem được menu: **đã xong** (nhánh `fix/qr-menu-requires-scan`)

- Compose mặc định cờ test về `false`; `check-deploy-env.sh` báo FAIL nếu cờ bật.
- Gateway kiểm tra bàn cho **cả** `/api/orders/menu` và `/api/orders/branches/:id/menu` (đường thứ hai trước đây không bị kiểm tra), dùng `isStaffCaller` để token khách không được coi là nhân viên, và chặn QR bàn chi nhánh A mở menu chi nhánh B.

### S4. `CoffeeTable.status` thiếu `@Builder.Default`: **đã xong** (nhánh `fix/table-number-per-branch`, kèm số bàn theo chi nhánh)

---

## Đợt B — Chất lượng code và CI (S3, S7)

### S3. Checkstyle có sẵn vi phạm, và CI không chạy checkstyle

- **Bằng chứng:** `gradle checkstyleMain` báo lỗi: table-service 7 (thiếu `{}` sau `if` trong `TableAuthFilter.java`), user-service 47 (`HrManagementService.java`, `HrRealtimeHub.java`, import thừa trong `HrManagementController.java`, `CustomerAccountController.java`...). CI chỉ chạy `./gradlew clean assemble`.
- **Việc:**
  1. Sửa vi phạm, **chỉ đổi định dạng**, không đổi logic.
  2. Thêm `checkstyleMain` vào job Java của CI (`.github/workflows/deno.yml`).
  3. Làm thành **PR riêng**, vì thay đổi định dạng hàng loạt.
- **Kiểm chứng:** `checkstyleMain` báo 0 lỗi (đo lại số vi phạm trước khi sửa, PR #13 đã đổi `TableAuthFilter`); `gradle test` qua (table 24, user 24 test); diff không có thay đổi ngoài định dạng (`git diff -w` gọn); CI xanh.

### S7. Gói dev đã ngừng hỗ trợ

- **Bằng chứng:** `npm ci` báo deprecated `supertest@6.3.4`, `rimraf@3.0.2` ở các service NestJS. Chỉ dùng lúc dev/test, không vào image (đã `npm prune --omit=dev`).
- **Việc:** nâng `supertest` lên 7.x (đọc release notes), tìm gói nào kéo `rimraf@3`. Không nâng major NestJS, Jest.
- **Kiểm chứng:** `npm ci` hết cảnh báo 2 gói này; lint, build, test của từng service qua; `npm audit` vẫn 0/0/0.

---

## Đợt C — Cần quyết định và theo dõi (S5, S6, S9, S10)

### S5. Spring Boot 4 (hạn 2027-03-01)

- **Bằng chứng:** CVE-2026-47884 và CVE-2026-47890 ở `spring-webmvc` 6.2.19 chỉ vá trong Spring Framework 7, tức là **Spring Boot 4 (major)**. Code không bị ảnh hưởng (không dùng `XsltView` hay SSE view fragments). `.trivyignore` chấp nhận tới **2027-03-01**, sau đó bước quét image của CI sẽ đỏ.
- **Việc:** **không tự nâng.** Liệt kê những gì Spring Boot 4 thay đổi với 2 service (Jakarta EE 11, Jackson 3, Spring Security 7, các API bị bỏ đang dùng), ước lượng công sức, rồi hỏi tôi: nâng, hay gia hạn `.trivyignore` kèm lý do. Nếu nâng: bỏ các dòng `ext[...]` ghim phiên bản trong `build.gradle`.
- **Kiểm chứng (nếu nâng):** test 2 service qua; Trivy 0 lỗi **không cần** `.trivyignore`; E2E và smoke test (đăng nhập, bàn, nhân sự SSE) qua.

### S6. `postgres:15-alpine` còn lỗi Go stdlib trong `gosu`

- **Bằng chứng:** Trivy báo 26 lỗi `stdlib` (gobinary) trong `gosu`, công cụ chỉ chạy lúc khởi động để hạ quyền. Image lấy từ Docker Hub, chưa có bản vá.
- **Việc:** `docker pull postgres:15-alpine`, quét lại. Còn lỗi thì ghi "chưa có bản vá" và bỏ qua. **Không** nâng major Postgres khi chưa hỏi, vì phải chuyển dữ liệu.

### S9. Bộ đếm đăng nhập sai nằm trong bộ nhớ, trong khi k8s có tự tăng số bản gateway

- **Bằng chứng:** `login-rate-limiter.ts` giữ bộ đếm trong bộ nhớ (R10 cũ ghi "không cần" vì compose chỉ chạy 1 bản). Nhưng `ops/k8s/hpa-api-gateway.yaml` tự tăng số bản gateway, mà mỗi bản có bộ đếm riêng, nên giới hạn đăng nhập sai bị chia nhỏ.
- **Việc:** hỏi tôi có định deploy bằng k8s không.
  - **Không:** ghi chú trong `ops/k8s/README.md` rằng k8s chưa dùng, và cần chuyển bộ đếm sang Redis trước khi dùng.
  - **Có:** chuyển bộ đếm sang Redis (đã có trong compose).
- **Kiểm chứng (nếu chuyển sang Redis):** 8 lần đăng nhập sai bằng email không tồn tại → từ lần thứ 6 trả `429`; khởi động lại gateway mà bộ đếm vẫn giữ; 2 bản gateway dùng chung bộ đếm.

### S10. Bàn 99 chưa thuộc chi nhánh nào

- **Bằng chứng:** `tabledb.tables` có bàn số 99 (`1c699387-2028-474c-901f-5461ae477d52`) với `branch_id` rỗng, tạo ngày 2026-05-29. 5 đơn thử trên bàn này đã chuyển sang `CANCELLED` ngày 2026-11-15. Bàn không thuộc chi nhánh nào thì không hiện trong danh sách bàn của manager.
- **Việc:** hỏi tôi gán bàn này cho chi nhánh nào, hay xóa (5 đơn đã hủy vẫn giữ, chỉ mất liên kết tới bàn). Sao lưu trước khi sửa.
- **Kiểm chứng:** manager chi nhánh được gán thấy bàn 99; doanh thu đơn `COMPLETED` không đổi.

---

## Đợt D — Trước khi lên VPS (chỉ làm khi tôi gọi `dot-d`)

Tôi sẽ sửa xong và thêm tính năng rồi mới deploy. Đến lúc đó làm theo thứ tự:

| Mã | Việc | Ghi chú |
|---|---|---|
| R3 | Đổi `JWT_SECRET` | Mọi người bị đăng xuất: đề xuất thời điểm (quán đóng cửa), soạn lệnh để tôi chạy, kiểm chứng token cũ bị từ chối và đăng nhập lại được |
| R4 | Đổi mật khẩu Postgres (`POSTGRES_PASSWORD`, `USER_DB_PASSWORD`, `TABLE_DB_PASSWORD`) | `ALTER USER` + cập nhật **mọi** `*_DATABASE_URL` / `SPRING_DATASOURCE_PASSWORD` / `REPORT_*` cùng lúc, khởi động lại theo thứ tự |
| S8 | Mật khẩu tài khoản demo | `admin.test`, `manager.central`, `manager.riverside@coffeeshop.local` đang dùng thật nhưng mật khẩu công khai trên GitHub: tôi tự đổi trong ứng dụng. 4 tài khoản demo còn lại (`waiter.test`, `barista.test`, `staff.test`, `customer.test`): hỏi tôi khóa hay giữ |
| R2 | Domain cố định | Cần tên miền: cấu hình `APP_BASE_URL`, `ALLOWED_ORIGINS`, webhook SePay, tạo lại QR bàn |
| — | Kiểm tra cuối | `bash scripts/check-deploy-env.sh` phải qua; thêm 4 secret `DEPLOY_*` vào GitHub để job Deploy chạy thật |

---

## Báo cáo sau mỗi đợt

| Mã | Việc | Trạng thái (đã xong / đã hết từ trước / bỏ qua / cần quyết định / tôi phải tự làm) | File đã sửa | Kiểm chứng trước → sau |
|---|---|---|---|---|

Sau bảng, ghi ngắn gọn bằng tiếng Việt:
- Service đã build lại và trạng thái của chúng.
- Kết quả test, quét Trivy, tái hiện CI (nếu đụng CI).
- Lệnh tôi cần tự chạy (nếu có).
- **Câu hỏi cho đợt tiếp theo.**
