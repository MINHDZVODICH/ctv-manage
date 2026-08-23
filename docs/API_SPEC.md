# Đặc tả API

**Trạng thái:** Accepted  
**Base URL:** `/api/v1`  
**Kiến trúc liên quan:** [ARCHITECTURE.md](ARCHITECTURE.md)  
**Mô hình dữ liệu:** [DATABASE.md](DATABASE.md)

## 1. Quy ước chung

- URL biểu diễn **resource**, dùng danh từ tiếng Anh, số nhiều và `kebab-case`; không đặt tên theo màn hình hoặc tên hàm.
- Dữ liệu trao đổi bằng JSON UTF-8, trừ endpoint upload/download file.
- Authentication dùng session cookie. Mọi request thay đổi dữ liệu phải qua CSRF protection.
- OpenAPI là contract chính thức giữa Frontend và Backend. Typed API client được sinh hoặc kiểm tra theo contract này.

## 2. HTTP method

| Method | Ý nghĩa | Kết quả thông thường |
|---|---|---|
| `GET` | Đọc resource, không làm thay đổi dữ liệu | `200 OK` |
| `POST` | Tạo resource mới | `201 Created` và header `Location` |
| `PUT` | Thay thế resource hoặc cập nhật idempotent | `200 OK` hoặc `204 No Content` |
| `PATCH` | Cập nhật một phần resource | `200 OK` |
| `DELETE` | Xóa hoặc hủy resource | `204 No Content` |

`GET`, `PUT` và `DELETE` phải idempotent. Với `POST` quan trọng có nguy cơ gửi lặp, backend hỗ trợ `Idempotency-Key`.

## 3. Endpoint chính

| Nghiệp vụ | Endpoint |
|---|---|
| Đăng nhập | `POST /api/v1/auth/sessions` |
| Đăng xuất | `DELETE /api/v1/auth/sessions/current` |
| Lấy session hiện tại | `GET /api/v1/auth/sessions/current` |
| Gửi yêu cầu đăng ký | `POST /api/v1/registration-requests` |
| Danh sách yêu cầu chờ duyệt | `GET /api/v1/registration-requests?status=PENDING` |
| Duyệt hoặc từ chối yêu cầu | `PATCH /api/v1/registration-requests/{id}` |
| Lấy lịch của người dùng hiện tại | `GET /api/v1/users/me/shifts` |
| Lấy chi tiết một ca | `GET /api/v1/shifts/{id}` |
| Lấy mẫu đăng ký lịch hiện tại | `GET /api/v1/users/me/schedule-registration` |
| Tạo/cập nhật mẫu đăng ký lịch | `PUT /api/v1/users/me/schedule-registration` |
| Hủy một ca hoặc chuỗi ca | `DELETE /api/v1/shift-registrations/{id}?scope={scope}&fromDate=YYYY-MM-DD` |
| Xem lịch tổng hợp | `GET /api/v1/schedule-summary?month=YYYY-MM` |
| Đổi mật khẩu của chính mình | `PUT /api/v1/users/me/password` |
| Admin đặt lại mật khẩu tài khoản | `PUT /api/v1/accounts/{id}/password` |
| Tải nội dung file | `GET /api/v1/files/{id}/content` |

`scope` nhận `single` khi chỉ hủy ca được chọn hoặc `series` khi hủy chuỗi ca kể từ `fromDate`.

## 4. Status code

| Code | Khi sử dụng |
|---|---|
| `200` | Đọc/cập nhật thành công và có response body. |
| `201` | Tạo resource thành công. |
| `204` | Thành công nhưng không có response body. |
| `400` | Request sai cú pháp hoặc query parameter không hợp lệ. |
| `401` | Chưa đăng nhập hoặc session hết hạn. |
| `403` | Đã đăng nhập nhưng không có quyền. |
| `404` | Không tồn tại resource hoặc không được phép biết resource tồn tại. |
| `409` | Xung đột trạng thái, dữ liệu đã được xử lý hoặc thay đổi trước đó. |
| `422` | Dữ liệu đúng cú pháp nhưng vi phạm validation hoặc business rule. |
| `429` | Vượt rate limit. |
| `500` | Lỗi nội bộ không dự kiến; không trả stack trace cho client. |

## 5. Response format

Resource đơn được trả trực tiếp trong `data`:

```json
{
  "data": {
    "id": "shift_123",
    "status": "REGISTERED"
  }
}
```

Danh sách có `data` và metadata phân trang:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 0
  }
}
```

Lỗi dùng một cấu trúc thống nhất:

```json
{
  "error": {
    "code": "SCHEDULE_CONFLICT",
    "message": "Lịch làm việc đã thay đổi",
    "details": {},
    "requestId": "req_123"
  }
}
```

API không trả Prisma model, đường dẫn file trên ổ cứng, mật khẩu, session ID hoặc thông tin nội bộ trong response.
