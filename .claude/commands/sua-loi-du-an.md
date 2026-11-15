---
description: Sửa lỗi dự án Coffee Shop (lỗi bạn mô tả, mã việc trong danh sách tồn đọng, hoặc rà soát tìm lỗi mới) theo quy trình tái hiện → sửa → kiểm chứng → PR
argument-hint: "[mô tả lỗi | mã việc, vd: S1 | S1,S3 | ra-soat | tat-ca]"
---

# Sửa lỗi dự án — Coffee Shop

Phạm vi lần này: **$ARGUMENTS**

- **Mô tả lỗi** (vd: "khách quét QR bị trắng trang"): sửa đúng lỗi đó.
- **Mã việc** (`S1`, `S1,S3`): làm các mục tương ứng trong `.claude/commands/sua-loi-con-lai.md`.
- `ra-soat`: rà toàn hệ thống tìm lỗi mới, **chỉ báo cáo**, chưa sửa. Thêm lỗi tìm được vào `.claude/commands/sua-loi-con-lai.md` với mã tiếp theo, rồi hỏi tôi làm mục nào.
- `tat-ca`: làm lần lượt mọi mục chưa xong. **Dừng báo cáo sau mỗi mục.**
- **Để trống:** hỏi tôi muốn làm gì, kèm gợi ý mục nên làm trước.

## Hiện trạng (2026-11-15)

- `main` ở `40d3648`, đã có PR #2 → #15 (đợt rà soát bảo mật 2026-11-15 đã sửa xong). CI gồm 24 job (lint/test/build, quét 10 image, E2E dựng cả hệ thống) và DevSecOps; tất cả đều xanh.
- Chạy trên máy Windows của tôi bằng `docker compose`, 13 container. Link công khai qua Cloudflare quick tunnel.
- **Chưa lên VPS.** Tôi sửa xong và thêm tính năng rồi mới deploy. Các việc VPS (đổi `JWT_SECRET`, mật khẩu Postgres, domain cố định) để đến lúc đó, **đừng tự làm**.
- **Phiên bản:**
  - Node 22 (6 service NestJS 11 + frontend React 18/Vite 7/react-router 7.18.4).
  - Spring Boot 3.5.16 / Java 17 (user-, table-service).
  - FastAPI (ai-service).
  - Prisma 5.22, Postgres 15.

Đo lại trước khi làm. Mục nào đã hết thì ghi "đã hết" và bỏ qua.

## Quy tắc bắt buộc

1. **Tái hiện trước → sửa → kiểm chứng lại.** Báo cả kết quả trước và sau. Không tái hiện được thì nói rõ, đừng sửa mò.
2. **Không phá dữ liệu thật.**
   - Thử ghi bằng dữ liệu tiền tố `TEST`, xóa sạch sau khi thử.
   - Trước khi động vào database: `pg_dumpall | gzip` vào scratchpad, báo đường dẫn.
   - Phép thử nào ghi nhiều hoặc khó dọn thì chạy trên **bộ hệ thống tách riêng** (xem *Lưu ý môi trường*), không chạy trên database thật.
3. **Không đọc/in giá trị bí mật** (`.env`, khóa, mật khẩu, token).
   - Việc ghi khóa vào `.env` bị chặn tự động: soạn lệnh để **tôi tự chạy**, rồi kiểm chứng bằng mã băm.
   - Đổi JWT secret, mật khẩu Postgres hay mật khẩu tài khoản **phải hỏi trước**.
4. **Nâng major** (NestJS, Prisma, React, Vite, Spring Boot, Postgres): liệt kê lý do và rủi ro rồi **hỏi**. Nâng minor/patch thì được tự làm.
5. **Không commit, không push khi tôi chưa đồng ý.** Hỏi bằng câu hỏi lựa chọn. Làm trên **nhánh mới tách từ `main`**, không commit thẳng lên `main`.
6. Nạp skill phù hợp trước khi sửa: `nestjs-expert`, `prisma-expert`, `java-pro`, `fastapi-pro`, `react-best-practices`, `docker-expert`, `api-security-best-practices`, `api-integration-specialist`.
7. Sửa gọn, đúng chỗ. Gặp lỗi khác ngoài phạm vi thì **ghi vào danh sách**, không sửa lan man. Ngoại lệ: lỗi bảo mật nghiêm trọng thì báo ngay.

## Quy trình cho mỗi lỗi

1. **Tái hiện:** bằng request, test hoặc trình duyệt. Ghi lại kết quả *trước*.
2. **Tìm nguyên nhân gốc:** đọc code liên quan, kể cả thư viện nếu cần.
3. **Sửa**, và **thêm test chặn lỗi quay lại**. Sau đó thử cố ý làm hỏng logic vừa sửa (trên bản sao) để chắc test báo đỏ, rồi khôi phục.
4. **Chạy test của service bị sửa:**
   - Node: `npm ci && npm run lint && npm run build && npm test` trong container `node:22-bookworm-slim`, trên **bản sao** (lint chạy `eslint --fix`).
   - Java: `gradle test bootJar` trong `gradle:8-jdk17-alpine`, gắn volume `gradle-cache`.
   - Python: `pytest`, `ruff`, `mypy` trong `python:3.11-slim`.
5. **Build lại chỉ service bị sửa**, `docker compose up -d --no-deps <svc>`, chờ `healthy`, xem log không có lỗi.
6. **Quét image vừa build** bằng Trivy 0.70.0 (cùng bản CI dùng) với `--ignore-unfixed --severity CRITICAL,HIGH --ignorefile .trivyignore`. Kết quả phải là 0.
7. **Chạy lại luồng chính bị ảnh hưởng:** menu QR khách, đặt đơn TEST, thanh toán SePay, webhook có/không key, đăng nhập, báo cáo...
8. **Hỏi commit/push.** Nếu tôi đồng ý: commit (message tiếng Anh, có dòng `Co-Authored-By`), push nhánh, soạn mô tả PR tiếng Việt vào scratchpad, rồi mở sẵn trang tạo PR bằng link điền sẵn (`Start-Process`).
9. **Sau khi tôi merge:** `git checkout main && git pull`, build lại service liên quan từ `main`, xác nhận CI trên `main` xanh.

## Lưu ý môi trường (đã vấp, đừng lặp lại)

- **Ổ C gần đầy** (chỉ còn khoảng 4–5 GB). Docker lưu toàn bộ vào `docker_data.vhdx` trên ổ C; hết chỗ là **Docker treo**: build đứng im, lệnh `docker` không phản hồi.
  - Trước khi build nhiều: xem `df -h /c` và `docker system df`.
  - Dọn được an toàn: `docker builder prune -af`, `docker image prune -f`, `npm cache clean --force`, thư mục cũ trong scratchpad.
  - **Không** prune volume.
  - Docker treo: dừng tiến trình build, `wsl --shutdown`, mở lại Docker Desktop, chờ `docker version` phản hồi.
- **RAM máy thấp** (khoảng 1–3 GB trống). Build **từng service một**, không build song song cả hệ thống.
- **Maven Central hay ngắt TLS** ("Remote host terminated the handshake"). Build Java phải tự thử lại 3–4 lần; đây không phải lỗi code.
- **Lockfile npm:** tạo bằng **npm đi kèm `node:22-bookworm-slim` (10.9.x)**, không dùng npm 11. npm 11 bỏ bớt mục phụ thuộc tùy chọn khiến `npm ci` của npm 10.9 (Dockerfile, CI) từ chối. Kiểm tra lại bằng `npm ci --dry-run`.
- **Image Node:** `prisma` nằm trong `dependencies` vì lúc khởi động chạy `npx prisma migrate deploy`. Builder chạy `npm prune --omit=dev` trước khi chép `node_modules` sang runner. Thêm gói dùng lúc chạy thì phải để trong `dependencies`.
- **File `.sh` phải là LF** (`.gitattributes`). File CRLF làm `init-db.sh` hỏng, khiến cài mới không có database.
- **Bộ hệ thống tách riêng để thử:**
  - Tag image `coffe-shop-*` thành `coffe-e2e-*`, rồi chạy `docker compose -p coffe-e2e --env-file <scratchpad>/e2e.env up -d --no-build --scale db-backup=0 --wait`.
  - File env đổi cổng: `API_GATEWAY_HOST_PORT=18080`, `FRONTEND_MENU_HOST_PORT=18088`, `POSTGRES_HOST_PORT=15432`, `REDIS_HOST_PORT=16379`, `CHAT_SERVICE_HOST_PORT=13007`. Khóa sinh bằng `openssl rand`; đặt `SEED_TEST_ACCOUNTS=true` khi cần tài khoản demo.
  - Dọn bằng `down -v` **với `-p coffe-e2e`**, không bao giờ với project thật.
- **Trình duyệt không giao diện:** `mcr.microsoft.com/playwright:v1.49.1-noble`, volume `pw-nm`, thêm `--add-host=host.docker.internal:host-gateway` (sau khi Docker khởi động lại, tên này không tự phân giải).
- **Windows/Git Bash:**
  - Dùng `MSYS_NO_PATHCONV=1` khi truyền đường dẫn cho `docker`.
  - Python đọc JSON từ `curl` bằng `sys.stdin.buffer.read().decode('utf-8')`.
  - Script có `\b`, `\1` thì viết ra **file**.
  - Xóa thư mục `node_modules` sâu bằng `cmd /c rd /s /q "\\?\<đường dẫn>"`.
- **GitHub:** chưa có `gh`. Đọc PR, CI, job, annotations qua `https://api.github.com/repos/ThuThao2724/Coffee-Shop/...` (công khai; API hay trả 504, nên thử lại). Log đầy đủ cần đăng nhập: nhờ tôi chụp màn hình.
- **CI:**
  - Trivy fail khi có lỗ hổng CRITICAL/HIGH đã có bản vá.
  - Chấp nhận rủi ro thì ghi vào `.trivyignore`, **kèm lý do và `exp:` ngày hết hạn**.
  - Gitleaks báo nhầm trên khóa giả trong test: thêm `// gitleaks:allow` và fingerprint vào `.gitleaksignore`.
- **Bẫy trong code (đã vấp ở PR #8 → #14):**
  - Các service NestJS định tuyến **không phân biệt hoa thường** và bỏ qua `//`, `/` cuối. Luật phân quyền ở gateway phải dùng `decisionPath(req)` (đường dẫn đã chuẩn hóa, viết thường), không dùng `req.path` trực tiếp.
  - `http-proxy-middleware` v2 chuyển tiếp theo `req.originalUrl`, không theo `req.url`.
  - Trong gateway, `staffRoles` **có cả CUSTOMER**; muốn biết có phải nhân viên thì dùng `activeStaffRoles` / `isStaffCaller(req)`.
  - Service phía sau không được chỉ dựa vào gateway: endpoint ghi hoặc quản trị phải tự kiểm tra `x-actor-role` (role trống ≠ ADMIN).
  - Bảng do Prisma tạo dùng `@default(cuid())` sinh ở phía ứng dụng: ghi bằng SQL thô thì phải tự truyền `id`.
  - Đếm dữ liệu bằng vòng lặp `while read` trên kết quả `psql` có thể bỏ sót dòng; đếm lại theo từng ID trước khi kết luận.

## Danh sách lỗi còn mở

Danh sách lỗi đã biết (mã S2–S11 và các việc trước khi lên VPS), kèm bằng chứng và cách kiểm chứng, nằm ở **`.claude/commands/sua-loi-con-lai.md`**. Khi làm theo mã việc, đọc mục tương ứng trong file đó.

## Báo cáo sau mỗi mục

| Mã | Việc | Trạng thái (đã xong / đã hết từ trước / bỏ qua / cần quyết định / tôi phải tự làm) | File đã sửa | Kiểm chứng trước → sau |
|---|---|---|---|---|

Sau bảng, ghi ngắn gọn bằng tiếng Việt:
- Service đã build lại và trạng thái của chúng.
- Kết quả test, quét Trivy, luồng chính.
- Lệnh tôi cần tự chạy (nếu có).
- **Câu hỏi cho bước tiếp theo.**

Cập nhật `.claude/commands/sua-loi-con-lai.md`: ghi "đã xong (PR #…)" cho mục đã merge, thêm lỗi mới phát hiện với mã tiếp theo.
