# Dữ liệu đơn hàng mẫu cho báo cáo và AI

Sinh khoảng 6 tháng đơn hàng và thanh toán **mô phỏng một quán cà phê thật**, để báo cáo doanh thu và các chức năng AI (dự báo doanh thu, hồ sơ theo giờ, món bán chạy theo khung giờ, ảnh hưởng thời tiết, dự báo nguyên liệu) có số liệu để phân tích.

Mọi bản ghi có id bắt đầu bằng `demo_`. Có thể xóa toàn bộ bằng một lệnh, và **đơn thật không bị đụng tới**.

## Dữ liệu được sinh

- **Giờ:** cao điểm sáng, trưa, chiều, tối, khác nhau theo chi nhánh.
  - Trung Tâm (khu văn phòng): đông buổi sáng.
  - Riverside: đông chiều và tối.
  - Chi nhánh khác dùng hồ sơ mặc định.
- **Ngày:** cuối tuần đông hơn, có xu hướng tăng dần, ngày lễ (2/9, Trung thu, 20/10...) đông hơn.
- **Ngày mưa:** theo mùa mưa, ít khách hơn và bán nhiều đồ nóng hơn.
- **Món:** đổi theo khung giờ. Mỗi món có size, đá và đường; giá lưu gồm cả phụ thu size, giống order-service.
- **Thanh toán:** tiền mặt và SePay, tỷ lệ SePay tăng dần. Khoảng 2% đơn bị hủy.
- **Giờ lưu:** theo UTC, giống các service.
- **Lặp lại được:** hạt giống ngẫu nhiên cố định, nên chạy lại vẫn ra đúng bộ dữ liệu đó.

## Cách dùng

Chạy từ thư mục gốc của repo, khi hệ thống `docker compose` đang chạy.

```bash
# 0. Sao lưu trước
docker exec coffe-shop-postgres-1 sh -c 'pg_dump -U "$POSTGRES_USER" -d orderdb' | gzip > orderdb.sql.gz
docker exec coffe-shop-postgres-1 sh -c 'pg_dump -U "$POSTGRES_USER" -d paymentdb' | gzip > paymentdb.sql.gz

# 1. Lấy bàn và thực đơn thật của từng chi nhánh
bash ops/scripts/demo-orders/run.sh export /tmp/demo-orders

# 2. Sinh dữ liệu (mặc định 181 ngày, kết thúc hôm qua)
python ops/scripts/demo-orders/generate.py /tmp/demo-orders
#    tùy chọn: --days 90   --end 2026-11-17

# 3. Nạp vào database. Bản ghi demo_ cũ được thay thế, trong một transaction cho mỗi database.
bash ops/scripts/demo-orders/run.sh load /tmp/demo-orders

# 4. Tổng hợp lại báo cáo ngay (nếu không, report-service tự làm trong vòng 24 giờ)
docker compose restart report-service
```

Sau đó, trong trang **Báo cáo**, bấm **Dự báo lại** ở khung "Phân tích doanh thu bằng AI".

**Xóa toàn bộ dữ liệu mẫu:**

```bash
bash ops/scripts/demo-orders/run.sh remove
docker compose restart report-service
```

## Lưu ý

- Chỉ dùng cho **môi trường demo**. Trên hệ thống bán thật, dữ liệu mẫu sẽ trộn vào doanh thu thật.
- Script **không trừ kho** và **không tạo hóa đơn** cho đơn mẫu.
- Chi nhánh phải có ít nhất một bàn và một món đang bán thì mới được sinh dữ liệu.
