# Sơ đồ kiến trúc và sequence diagram bằng Mermaid

Các sơ đồ được xây dựng từ `docs/Use-Case_V5.docx` theo kiến trúc ba lớp:

```text
Người dùng -> Frontend -> Backend -> Database
```

## Phân loại

- `policy.md`: quyết định kiến trúc, tech stack và các quy tắc triển khai bắt buộc.
- `00-kien-truc-3-lop.md`: sơ đồ kiến trúc tổng thể, thuộc HLD.
- Các file từ `01` đến `06`: sequence diagram chi tiết, thuộc LLD.

## Danh sách sơ đồ

1. [Policy kiến trúc và công nghệ](policy.md)
2. [Kiến trúc ba lớp](00-kien-truc-3-lop.md)
3. [Đăng nhập](01-dang-nhap.md)
4. [Đăng ký hồ sơ](02-dang-ky-ho-so.md)
5. [Duyệt hồ sơ](02-duyet-ho-so.md)
6. [Đăng ký hoặc cập nhật lịch làm việc](03-dang-ky-cap-nhat-lich-lam-viec.md)
7. [Hủy ca làm việc](04-huy-ca-lam-viec.md)
8. [Đổi và đặt lại mật khẩu](05-doi-va-dat-lai-mat-khau.md)
9. [Xem lịch làm việc tổng hợp](06-xem-lich-lam-viec-tong-hop.md)

## Quan hệ dữ liệu lịch

- Đăng ký hoặc cập nhật lịch của CTV làm thay đổi dữ liệu hiển thị trong Lịch làm việc tổng hợp của Admin.
- Hủy một ca hoặc chuỗi ca làm giảm danh sách và số lượng CTV tương ứng trong lịch tổng hợp.
- Lịch cá nhân CTV và lịch tổng hợp Admin sử dụng cùng dữ liệu ca; Admin nhận dữ liệu mới nhất khi mở hoặc tải lại màn hình.

## Preview trong VS Code

Mở file Markdown rồi nhấn `Ctrl+Shift+V` hoặc chọn **Markdown: Open Preview**.

Các sơ đồ không khai báo màu nền hoặc `rgb(...)`; giao diện hiển thị sử dụng theme mặc định của trình preview.
