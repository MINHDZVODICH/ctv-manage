# Sequence diagram

Thư mục này mô tả luồng runtime của các use case trong [USE-CASE.md](../USE-CASE.md). Ranh giới lớp lấy từ [ARCHITECTURE.md](../ARCHITECTURE.md); trạng thái bền vững và tên trường lấy từ [DATABASE.md](../DATABASE.md). Method, path, payload và mã lỗi HTTP được mô tả trực tiếp trên mũi tên hoặc trong chú thích của từng sơ đồ.

## Quy ước chung

- Frontend gọi `Shared API Client` trực tiếp từ các màn hình, modal hoặc context.
- Backend đi theo kiến trúc phân lớp `Controller → Service → Prisma/File Storage`; Controller không gọi Prisma trực tiếp.
- Shared API Client tự động gửi cookie session (`ctv_session`) và CSRF header cho các request thay đổi dữ liệu (POST, PUT, PATCH, DELETE).
- PostgreSQL là nguồn dữ liệu lịch dùng chung:
  - Lịch tuần cố định lưu trong `Schedule` (1:1 với `Account`) và `Shift` (các ca trong tuần từ Thứ 2 đến Thứ 6).
  - Lịch sử đã qua được chốt bất biến trong `History` vào mốc 17:30 Bangkok hằng ngày để không bị thay đổi khi CTV cập nhật mẫu tuần.
- Buồng là cấu hình cố định `ROOM_1`–`ROOM_4`; ca làm việc gồm `MORNING` và `AFTERNOON`.
- Mũi tên HTTP ghi rõ method và path; mũi tên Service → DB ghi bảng, điều kiện lọc hoặc thay đổi trạng thái chính.
- Payload, transaction hoặc constraint chi tiết được đặt trong phần Chú thích ngay dưới mỗi sơ đồ.
- Tên bảng và trường phải trùng khớp 1:1 với [DATABASE.md](../DATABASE.md).
- “Thông báo” trong use case là toast tạm thời của giao diện; hệ thống không lưu bảng `NOTIFICATION`.

## Danh sách sơ đồ

1. [Đăng nhập](01-dang-nhap.md)
2. [Đăng ký](02-dang-ky.md)
3. [Duyệt hồ sơ](03-duyet-ho-so.md)
4. [Đăng ký hoặc cập nhật lịch làm việc](04-dang-ky-cap-nhat-lich-lam-viec.md)
5. [Đổi và đặt lại mật khẩu](05-doi-va-dat-lai-mat-khau.md)
6. [Chốt lịch sử làm việc tự động vào 17:30](06-chot-lich-su-lam-viec-tu-dong.md)
7. [Xem lịch làm việc tổng hợp](07-xem-lich-lam-viec-tong-hop.md)
8. [Đăng xuất](08-dang-xuat.md)
9. [Quản lý danh sách tài khoản](09-quan-ly-tai-khoan.md)
10. [Xem và cập nhật hồ sơ](10-xem-cap-nhat-ho-so.md)
11. [Xem lịch tuần và lịch sử làm việc](11-xem-lich-tuan-va-lich-su.md)
12. [Xem chi tiết ca và hồ sơ CTV](12-xem-chi-tiet-ca-va-ho-so-ctv.md)

## Truy vết use case

| Use case | Sơ đồ |
|---|---|
| 1.1 Đăng nhập | [01](01-dang-nhap.md) |
| 1.2 Đăng xuất | [08](08-dang-xuat.md) |
| 1.3 Đăng ký tài khoản | [02](02-dang-ky.md) |
| 1.4 Quản lý danh sách tài khoản | [09](09-quan-ly-tai-khoan.md) |
| 1.5 Kích hoạt/vô hiệu hóa tài khoản | [09](09-quan-ly-tai-khoan.md) |
| 1.6 Xóa tài khoản | [09](09-quan-ly-tai-khoan.md) |
| 1.7 Xem thông tin tài khoản | [10](10-xem-cap-nhat-ho-so.md) |
| 1.8 Cập nhật thông tin hồ sơ | [10](10-xem-cap-nhat-ho-so.md) |
| 1.9 Đổi/đặt lại mật khẩu | [05](05-doi-va-dat-lai-mat-khau.md) |
| 1.10 Duyệt yêu cầu đăng ký | [03](03-duyet-ho-so.md) |
| 2.1 Đăng ký/cập nhật lịch | [04](04-dang-ky-cap-nhat-lich-lam-viec.md) |
| 2.2 Xem lịch tuần và lịch sử | [11](11-xem-lich-tuan-va-lich-su.md) |
| 2.3 Chốt lịch sử làm việc tự động vào 17:30 | [06](06-chot-lich-su-lam-viec-tu-dong.md) |
| 2.4 Xem lịch tổng hợp | [07](07-xem-lich-lam-viec-tong-hop.md) |
| 2.5 Xem chi tiết ca và hồ sơ CTV | [12](12-xem-chi-tiet-ca-va-ho-so-ctv.md) |

## Preview

GitHub/GitLab render Mermaid trực tiếp trong Markdown. Trong VS Code, dùng Markdown Preview (`Ctrl+Shift+V`); nếu phiên bản hiện tại chưa hỗ trợ Mermaid thì cài một extension preview Mermaid đáng tin cậy.

Các sơ đồ không dùng màu hoặc directive giao diện tùy chỉnh để giữ khả năng render nhất quán.
