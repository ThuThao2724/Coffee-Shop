---
description: Xử lý các việc còn tồn đọng sau PR #2 (deploy an toàn, lỗ hổng thư viện, bảo trì CI, gia cố còn thiếu, dọn dữ liệu)
argument-hint: "[đợt hoặc mã việc, vd: dot-a | dot-b | R3 | R5,R6 | tat-ca]"
---

# Xử lý việc còn tồn đọng — Coffee Shop

Phạm vi lần này: **$ARGUMENTS**. Để trống → chỉ làm **Đợt A**. `tat-ca` → làm lần lượt Đợt A → E, **dừng báo cáo sau mỗi đợt**.

## Bối cảnh

Đợt sửa lớn trước (`/sua-loi-he-thong`, Đợt 1–6 + L22, L23) đã nằm trong **PR #2** (`feature/top-products-by-session` → `main`, 11 commit, CI 32/32 xanh). Các việc dưới đây là phần **còn lại**: những gì lần trước chỉ đề xuất, chưa kiểm chứng được, hoặc phát hiện thêm khi sửa CI. Số liệu đo ngày 2026-11-07 — **đo lại trước khi làm**, có thể đã thay đổi; việc nào đã hết thì ghi "đã hết" và bỏ qua.

Nếu PR #2 **chưa merge**: làm trên nhánh mới tách từ `feature/top-products-by-session`. Nếu **đã merge**: tách nhánh mới từ `main`. Không commit thẳng lên `main`.

## Quy tắc bắt buộc

1. **Kiểm chứng trước → sửa → kiểm chứng lại**, báo cả hai kết quả.
2. **Không phá dữ liệu thật.** Thử ghi bằng mã giả hoặc dữ liệu tiền tố `TEST`, xóa sạch sau khi thử. Trước khi động vào database: `pg_dump` toàn bộ vào thư mục scratchpad và báo đường dẫn.
3. **Không đọc/in giá trị bí mật** (`.env`, khóa, mật khẩu). Việc **ghi khóa bí mật vào `.env`** sẽ bị chặn tự động → soạn lệnh để **tôi tự chạy**, rồi kiểm chứng bằng cách so mã băm (không in giá trị). Đổi JWT secret hoặc mật khẩu Postgres **phải hỏi trước**.
4. Nạp skill phù hợp trước khi sửa: `nestjs-expert`, `prisma-expert`, `java-pro`, `fastapi-pro`, `react-best-practices`, `docker-expert`, `api-security-best-practices`, `api-integration-specialist`.
5. Sửa gọn, đúng chỗ. **Không commit/push** trừ khi tôi yêu cầu.
6. Sau mỗi đợt: build lại **chỉ** service bị sửa, kiểm tra `docker compose ps`, chạy lại mục *Kiểm chứng*; nếu đụng CI thì **tái hiện job CI trên bản checkout sạch** (container `node:20.19-bookworm-slim` / `python:3.11-slim`) trước khi push.

## Lưu ý môi trường (đã vấp, đừng lặp lại)

- Chạy `docker compose` từ **gốc repo**. Service Java build lâu → chạy nền.
- Chuyển container sang user không phải root từng làm **order-service sập**: thư viện log ghi vào `./logs`. Trước khi đổi quyền, tìm cả chỗ **thư viện** ghi file, không chỉ code của mình; đổi **từng service một** và có kế hoạch quay lại.
- Python trên Windows đọc stdin bằng cp1252 → khi đọc JSON từ `curl`, dùng `sys.stdin.buffer.read().decode('utf-8')`. Viết script có `\b`, `\1` ra **file** thay vì lồng trong `bash -c`/`printf` (đã từng biến thành ký tự điều khiển).
- Máy chưa có `gh`; git push dùng Git Credential Manager. Đọc trạng thái PR/CI qua `https://api.github.com/repos/ThuThao2724/Coffee-Shop/...` (công khai, không cần token); log đầy đủ cần đăng nhập — dùng annotations của check-run.
- Lint của CI chạy `eslint --fix`: khi tái hiện, chạy trên **bản sao** để không định dạng lại hàng loạt file trong repo.

---

## Đợt A — Deploy an toàn (R1–R4)

### R1. `.env` trên VPS trước khi merge PR #2
- Job **Deploy (main only)** tự chạy khi merge (nếu có secret `DEPLOY_*`) và chạy `docker compose up -d --build` trên VPS. Compose giờ **bắt buộc** `JWT_SECRET` và `INTERNAL_SERVICE_TOKEN` (`${VAR:?...}`).
- **Việc:** soạn checklist + lệnh để tôi chạy trên VPS: kiểm tra 2 biến có mặt (không in giá trị), tạo `INTERNAL_SERVICE_TOKEN` bằng `openssl rand -hex 32` nếu đang là `dev-internal-token`, chạy `docker compose config -q`.
- **Kiểm chứng:** `docker compose config -q` trên VPS thoát 0. Sau deploy: 13 container healthy; log Prisma có `No pending migrations` hoặc `baselining 0_init` (lần đầu, đã có cơ chế tự xử lý P3005).

### R2. Đường dẫn công khai ổn định cho webhook SePay và QR bàn
- Hiện dùng Cloudflare **quick tunnel** (`scripts/start-tunnel.ps1`): đổi URL mỗi lần máy ngủ/đổi mạng → phải sửa webhook SePay và in lại QR.
- **Việc:** đề xuất và (nếu tôi đồng ý, có domain) cấu hình **named tunnel** hoặc domain VPS: `APP_BASE_URL`, `ALLOWED_ORIGINS`, URL webhook SePay, tạo lại QR bàn. Không làm khi tôi chưa có domain.
- **Kiểm chứng:** khởi động lại máy/tunnel, URL giữ nguyên; `POST /api/v1/payments/webhook` qua domain có key → `200`.

### R3. Đổi JWT secret (chỉ khi tôi đồng ý)
- `JWT_SECRET` hiện 37 ký tự. Đổi → **mọi người bị đăng xuất**. Đề xuất thời điểm (quán đóng cửa), soạn lệnh để tôi chạy, kiểm chứng token cũ bị từ chối, đăng nhập lại được.

### R4. Mật khẩu Postgres mặc định (chỉ khi tôi đồng ý)
- `POSTGRES_PASSWORD`, `USER_DB_PASSWORD`, `TABLE_DB_PASSWORD` đang là giá trị mặc định yếu; cổng DB chỉ mở `127.0.0.1` nên rủi ro thấp ở máy dev, **cao hơn trên VPS**.
- **Việc:** kế hoạch đổi: `ALTER USER` trong Postgres + cập nhật **mọi** `*_DATABASE_URL`/`SPRING_DATASOURCE_PASSWORD`/`REPORT_*` cùng lúc, khởi động lại theo thứ tự. Trình bày, hỏi, rồi soạn lệnh cho tôi chạy.

---

## Đợt B — Lỗ hổng thư viện npm (R5)

### R5. `npm audit` báo critical/high ở mọi service
- Đo ngày 2026-11-07 (lockfile hiện tại):

  | Service | critical | high | moderate |
  |---|---|---|---|
  | api-gateway | 2 | 23 | 10 |
  | order-service | 2 | 23 | 14 |
  | chat-service | 2 | 26 | 9 |
  | inventory-service | 2 | 25 | 16 |
  | payment-service | 2 | 24 | 16 |
  | report-service | 2 | 22 | 17 |
  | frontend | 0 | 12 | 13 |

- CI vẫn xanh vì bước audit chỉ báo cáo (`|| true`).
- **Việc:**
  1. Liệt kê các gói gây lỗi **critical** trước (thường chung cho mọi service NestJS), kèm đường dẫn phụ thuộc (`npm audit --json`, `npm ls <gói>`), và gói đó dùng lúc **chạy** hay chỉ lúc **build/dev**.
  2. Sửa theo thứ tự an toàn: `npm audit fix` (không `--force`) → nâng phiên bản trong cùng major → `overrides` có chủ đích. **Không** nâng major của NestJS/Prisma/React/Vite trong đợt này — nếu cần, liệt kê và hỏi.
  3. Cập nhật lockfile bằng **node 20.19** (khớp CI).
- **Kiểm chứng:** số critical = 0; high giảm (báo trước/sau từng service); mỗi service vẫn `npm ci` + lint + build + test qua; container build và healthy; luồng chính (menu khách, đặt đơn TEST, webhook SePay có key, đăng nhập) vẫn chạy.

---

## Đợt C — Bảo trì CI (R6–R8)

### R6. Action GitHub dùng Node 20 (bị ép chạy Node 24, sắp ngừng hỗ trợ)
- Đang dùng: `actions/checkout@v4` (11 chỗ), `actions/setup-node@v4` (4), `actions/setup-java@v4`, `actions/setup-python@v5`, `actions/upload-artifact@v4`.
- **Việc:** kiểm tra trên GitHub (API tags/releases) phiên bản mới nhất **hỗ trợ Node 24** của từng action, nâng cấp, đọc release notes xem có thay đổi input không.
- **Kiểm chứng:** CI chạy xanh, annotations không còn cảnh báo "Node.js 20 is deprecated".

### R7. Phiên bản công cụ không cố định
- `aquasecurity/trivy-action@v0.24.0` cũ (mới nhất v0.36.0); `ruff`, `mypy`, `pytest` cài không ghim phiên bản (lần trước ruff mới tự bật thêm luật làm CI đỏ).
- **Việc:** ghim phiên bản cụ thể cho công cụ Python trong workflow; cân nhắc nâng trivy-action (kiểm tra input `scan-type`, `exit-code`, `format` còn tương thích).
- **Kiểm chứng:** CI xanh; chạy lại 2 lần ra cùng kết quả.

### R8. `ubuntu-latest` sắp chuyển sang Ubuntu 26
- Annotation báo `ubuntu-latest` chuyển sang Ubuntu 26 từ 2026-10-19. **Việc:** quyết định ghim `ubuntu-24.04` hay để mặc định; nếu để mặc định, xác nhận CI vẫn xanh trên runner mới.

---

## Đợt D — Gia cố còn thiếu (R9–R12)

### R9. Container frontend (nginx) vẫn chạy root
- `frontend` uid=0 (các service khác đã chuyển). **Việc:** chuyển sang `nginxinc/nginx-unprivileged` (cổng 8080), cập nhật `nginx.conf` `listen`, mapping cổng trong compose (giữ cổng ngoài 8088), healthcheck, `scripts/start-tunnel.ps1` nếu dùng cổng trong.
- **Kiểm chứng:** uid ≠ 0; trang khách, `/api`, `/socket.io` qua nginx vẫn chạy; header bảo mật vẫn còn.

### R10. Bộ giới hạn đăng nhập sai nằm trong bộ nhớ gateway
- `login-rate-limiter.ts` mất bộ đếm khi gateway khởi động lại và không dùng chung nếu chạy nhiều gateway. **Việc:** chỉ làm nếu sắp chạy nhiều bản gateway — chuyển sang Redis (đã có trong compose). Nếu không, ghi "không cần" và bỏ qua.

### R11. Thiếu test cho phần đã sửa
- payment-, report-, inventory-service **không có unit test** nào. **Việc:** thêm test tối thiểu cho logic vừa sửa: `resolveOrderAmount` (lấy tổng tiền từ order, từ chối đơn hủy / order-service lỗi), xử lý webhook chuyển thiếu/cộng dồn/gửi lại, `resolveBranchScope` (report), `scopeBranch`/`assertIngredientsInScope` (inventory). Test phải chạy được trong CI (`npm test`).
- **Kiểm chứng:** test mới qua; cố ý làm hỏng logic (tạm) → test đỏ; khôi phục.

### R12. Luồng Gemini của report-chat chưa được chạy thử đầu-cuối
- Đã kiểm chứng ở mức database (role `ai_report_reader` chặn `pg_shadow`, `pg_read_file`...) và unit test, nhưng **chưa kích hoạt được** nhánh `sqlSource: gemini` bằng câu hỏi thật (câu thử đều khớp rule).
- **Việc:** đọc `is_generic_fallback_question` để tìm câu hỏi đi vào nhánh Gemini; gọi 1–2 lần với vai trò ADMIN (tốn quota Gemini — báo trước). Thử thêm 1 câu cố ý "prompt injection" đòi đọc `pg_shadow`.
- **Kiểm chứng:** câu hợp lệ trả `sqlSource: gemini` và có dữ liệu; câu injection bị `validate_generated_sql` loại hoặc bị role chặn, không lộ dữ liệu.

---

## Đợt E — Dọn dữ liệu và việc nhỏ (R13–R15)

### R13. 6 phiếu nhập kho giả "Seed top-up" (từ tháng 9)
- Do lỗi seed cũ (đã sửa) tạo ra; làm lệch lịch sử nhập kho, **không** ảnh hưởng số tồn hiện tại. **Việc:** liệt kê 6 phiếu (nguyên liệu, số lượng, ngày) và **hỏi tôi** giữ hay xóa. Nếu xóa: sao lưu bảng trước, xóa đúng 6 `id`, kiểm chứng tồn kho không đổi.

### R14. Trang khách gọi `GET /api/orders?tableId=` luôn bị 403
- `CustomerMenu.tsx` (`loadLatestOrder`) gọi rồi bỏ qua lỗi; mở quyền thì lộ đơn của khách trước cùng bàn. **Việc:** bỏ lời gọi này (đơn của khách đã lưu trong `localStorage` theo bàn) hoặc thay bằng cơ chế an toàn; không mở quyền endpoint.
- **Kiểm chứng:** Console trang khách không còn 403; đặt đơn TEST rồi tải lại trang vẫn thấy đơn của mình.

### R15. 18 file sao lưu bị `.gitignore` (`Reports.tsx.backup_*`, `*.bak`…)
- **Việc:** liệt kê đường dẫn + ngày, **hỏi tôi** trước khi chuyển vào thư mục sao lưu (không xóa hẳn).

---

## Báo cáo sau mỗi đợt

| Mã | Việc | Trạng thái (đã xong / đã hết từ trước / bỏ qua / cần quyết định / tôi phải tự làm) | File đã sửa | Kiểm chứng trước → sau |
|---|---|---|---|---|

Sau bảng: service đã build lại + trạng thái, kết quả tái hiện CI (nếu đụng CI), lệnh tôi cần tự chạy (nếu có), và **câu hỏi cho đợt tiếp theo**. Viết tiếng Việt, ngắn gọn.
