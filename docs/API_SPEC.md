# Đặc tả REST API

## 1. Authentication và bảo mật

### 1.1. Session cookie

Đăng nhập thành công tạo cookie `ctv_session` với `HttpOnly; Secure; SameSite=Lax; Path=/`. Server chỉ lưu hash token trong `SESSION`; không trả token/session ID trong JSON. Đổi/reset mật khẩu, vô hiệu hóa hoặc soft delete account phải thu hồi session theo policy.

### 1.2. CSRF

- `GET /auth/csrf-token` trả token cho session hiện tại.
- Mutation đã đăng nhập gửi token qua `X-CSRF-Token`.
- Login và đăng ký là public, không yêu cầu CSRF token nhưng phải kiểm tra `Origin`, giới hạn media type và rate limit.

### 1.3. Authorization

| Nhóm | Quyền |
|---|---|
| Public | Đăng nhập và đăng ký. |
| CTV/Admin | Session hiện tại, hồ sơ của mình, đổi mật khẩu, thông báo. |
| CTV | Đăng ký/cập nhật/hủy lịch cá nhân. |
| Admin | Tài khoản, duyệt hồ sơ, khóa/xóa/reset mật khẩu, lịch tổng hợp và hồ sơ CTV. |

Frontend chỉ ẩn/hiện giao diện. Service backend luôn kiểm tra actor và quyền trên resource.

### 1.4. Rate limit tối thiểu

- Login: theo IP + email.
- Đăng ký: theo IP + email.
- Upload/download file: theo actor và dung lượng.

Vượt giới hạn trả `429 RATE_LIMITED` và `Retry-After` khi xác định được.

## 2. Endpoint xác thực

| Nghiệp vụ | Endpoint | Quyền | Thành công |
|---|---|---|---|
| Đăng nhập bằng mật khẩu | `POST /auth/sessions` | Public | `201` + cookie |
| Lấy session hiện tại | `GET /auth/sessions/current` | Đã đăng nhập | `200` |
| Đăng xuất | `DELETE /auth/sessions/current` | Đã đăng nhập | `204` |
| Lấy CSRF token | `GET /auth/csrf-token` | Đã đăng nhập | `200` |

```json
{
  "email": "ctv@example.vn",
  "password": "string"
}
```

Response `201`:

```json
{
  "data": {
    "user": {
      "id": "acc_123",
      "displayName": "Nguyễn Văn A",
      "role": "CTV",
      "status": "ACTIVE",
      "mustChangePassword": false
    },
    "expiresAt": "2026-08-25T10:00:00Z"
  }
}
```

Sai email hoặc mật khẩu dùng chung `401 INVALID_CREDENTIALS`; tài khoản bị vô hiệu hóa trả `403 ACCOUNT_DISABLED`.

## 3. Endpoint đăng ký và duyệt hồ sơ

| Nghiệp vụ | Endpoint | Quyền | Thành công |
|---|---|---|---|
| Gửi yêu cầu đăng ký | `POST /registration-requests` | Public | `201` |
| Danh sách yêu cầu | `GET /registration-requests` | Admin | `200` |
| Chi tiết yêu cầu | `GET /registration-requests/{requestId}` | Admin | `200` |
| Duyệt hoặc từ chối | `PATCH /registration-requests/{requestId}` | Admin | `200` |

### 3.1. Gửi yêu cầu đăng ký

Request dùng `multipart/form-data` và `Idempotency-Key`:

| Part | Kiểu | Bắt buộc |
|---|---|---|
| `profile` | JSON string | Có |
| `cccdFront` | Image file | Không |
| `cccdBack` | Image file | Không |
| `cv` | PDF/DOC/DOCX | Không |

`profile`:

```json
{
  "displayName": "Nguyễn Văn A",
  "email": "ctv@example.vn",
  "phone": "0900000000",
  "dateOfBirth": "2000-01-01",
  "gender": "MALE",
  "address": "Hà Nội",
  "password": "string"
}
```

`confirmPassword` chỉ dùng ở frontend, không gửi. Backend hash mật khẩu ngay và không ghi log. File được kiểm tra dung lượng, extension, MIME/magic bytes và lưu staging theo [DATABASE.md](DATABASE.md).

Response `201`:

```json
{
  "data": {
    "id": "reg_123",
    "status": "PENDING",
    "submittedAt": "2026-08-24T10:00:00Z"
  }
}
```

### 3.2. Danh sách và quyết định

Danh sách nhận `status`, `q`, `page`, `pageSize`; `q` tìm display name, email và phone. Response danh sách không chứa CCCD/CV, password hash hoặc `storageKey`.

Decision request:

```json
{
  "decision": "APPROVED",
  "expectedStatus": "PENDING"
}
```

`decision` nhận `APPROVED` hoặc `REJECTED`. UI hiện tại không bắt nhập lý do; `rejectionReason` chỉ là field tùy chọn nếu nghiệp vụ bổ sung sau này. Request đã xử lý trả `409 REGISTRATION_ALREADY_REVIEWED`.

## 4. Endpoint tài khoản và hồ sơ

| Nghiệp vụ | Endpoint | Quyền | Thành công |
|---|---|---|---|
| Danh sách tài khoản | `GET /accounts` | Admin | `200` |
| Chi tiết tài khoản | `GET /accounts/{accountId}` | Admin | `200` |
| Cập nhật hồ sơ CTV | `PATCH /accounts/{accountId}` | Admin | `200` |
| Kích hoạt/vô hiệu hóa | `PATCH /accounts/{accountId}/status` | Admin | `200` |
| Soft delete tài khoản | `DELETE /accounts/{accountId}` | Admin | `204` |
| Cập nhật ghi chú | `PATCH /accounts/{accountId}/notes` | Admin | `200` |
| Hồ sơ của tôi | `GET /users/me` | Đã đăng nhập | `200` |
| Cập nhật hồ sơ của tôi | `PATCH /users/me` | Đã đăng nhập | `200` |
| Đổi mật khẩu | `POST /users/me/password-changes` | Đã đăng nhập | `200` |
| Admin đặt lại mật khẩu | `POST /accounts/{accountId}/password-resets` | Admin | `200` |

### 4.1. Danh sách tài khoản

Query hỗ trợ `q`, `status`, `page`, `pageSize`. Response row chỉ gồm thông tin cần cho bảng; dữ liệu nhạy cảm chỉ trả ở endpoint chi tiết sau khi kiểm tra quyền.

### 4.2. Trạng thái và xóa tài khoản

Status request:

```json
{
  "status": "DISABLED",
  "version": 3
}
```

Vô hiệu hóa phải revoke session và hủy assignments tương lai trong cùng transaction. `DELETE` là soft delete idempotent; lịch sử và audit được giữ.

### 4.3. Đổi và đặt lại mật khẩu

Người dùng đổi mật khẩu gửi `{ "currentPassword": "string", "newPassword": "string" }`.

Admin reset, bắt buộc `Idempotency-Key`:

```json
{
  "newPassword": "string",
  "requireChangeOnLogin": true
}
```

Response không echo mật khẩu:

```json
{
  "data": {
    "accountId": "acc_123",
    "mustChangePassword": true,
    "changedAt": "2026-08-24T10:00:00Z",
    "revokedSessionCount": 2
  }
}
```

## 5. Endpoint file hồ sơ

| Nghiệp vụ | Endpoint | Quyền | Thành công |
|---|---|---|---|
| Xem/tải file | `GET /files/{fileId}/content` | Chủ sở hữu/Admin | `200` |
| Thay file của tôi | `PUT /users/me/files/{category}` | Chủ sở hữu | `200` |
| Xóa file của tôi | `DELETE /users/me/files/{category}` | Chủ sở hữu | `204` |
| Admin thay file CTV | `PUT /accounts/{accountId}/files/{category}` | Admin | `200` |
| Admin xóa file CTV | `DELETE /accounts/{accountId}/files/{category}` | Admin | `204` |

`category` nhận `avatar`, `cccd-front`, `cccd-back`, `cv`. Upload chỉ có một part `file`. Server không dùng `express.static`; download đặt `Content-Type`, `Content-Disposition` an toàn và không trả `storageKey`.

Ảnh nhận JPG, PNG, WebP; CV nhận PDF, DOC, DOCX. Giới hạn byte lấy từ cấu hình server. Vượt giới hạn trả `413 FILE_TOO_LARGE`; loại không hợp lệ trả `415 UNSUPPORTED_FILE_TYPE`.

## 6. Endpoint lịch làm việc

| Nghiệp vụ | Endpoint | Quyền | Thành công |
|---|---|---|---|
| Mẫu đăng ký hiện tại | `GET /users/me/schedule-registration` | CTV | `200` |
| Tạo/cập nhật mẫu | `PUT /users/me/schedule-registration` | CTV | `200` |
| Lịch cá nhân | `GET /users/me/shifts` | CTV | `200` |
| Chi tiết ca | `GET /shifts/{shiftId}` | CTV thuộc ca/Admin | `200` |
| Hủy đúng một ca | `DELETE /users/me/shift-assignments/{assignmentId}` | CTV sở hữu | `200` |
| Hủy chuỗi từ một ngày | `DELETE /users/me/schedule-registrations/{registrationId}/assignments` | CTV sở hữu | `200` |
| Lịch tổng hợp | `GET /schedule-summary?month=YYYY-MM` | Admin | `200` |

### 6.1. Tạo hoặc cập nhật mẫu lịch

Room options là cấu hình cố định ở frontend/backend, không đọc từ bảng phòng. Request:

```json
{
  "startDate": "2026-08-24",
  "endDate": "2026-10-24",
  "timeZone": "Asia/Bangkok",
  "roomCode": "ROOM_1",
  "workContent": "Hỗ trợ xử lý dữ liệu",
  "slots": [
    { "weekday": 1, "period": "MORNING" },
    { "weekday": 3, "period": "AFTERNOON" }
  ],
  "version": 2
}
```

`weekday` từ `1` đến `5`; `period` chỉ nhận `MORNING`, `AFTERNOON`; `roomCode` chỉ nhận `ROOM_1` đến `ROOM_4`. Tạo mới gửi `version: null`; update gửi version hiện tại.

### 6.2. Lịch cá nhân và chi tiết ca

`GET /users/me/shifts` nhận `from=YYYY-MM-DD&to=YYYY-MM-DD` hoặc `month=YYYY-MM`. Chi tiết ca trả assignment của actor, `canCancel`, `cancelScopes` và danh sách đồng nghiệp tối thiểu; không trả hồ sơ nhạy cảm.

### 6.3. Hủy ca

Hủy một assignment không cần query bổ sung. Hủy chuỗi yêu cầu `weekday`, `period`, `fromDate`, ví dụ:

```text
?weekday=1&period=MORNING&fromDate=2026-08-24
```

Cả hai endpoint trả `200`:

```json
{
  "data": {
    "scope": "SERIES",
    "fromDate": "2026-08-24",
    "affectedCount": 8
  }
}
```

Gửi lặp sau khi đã hủy trả `200` với `affectedCount: 0`.

### 6.4. Lịch tổng hợp

`month` là query bắt buộc. Response:

```json
{
  "data": {
    "month": "2026-08",
    "today": [
      {
        "shiftId": "shift_123",
        "accountId": "acc_123",
        "displayName": "Nguyễn Văn A",
        "period": "MORNING",
        "roomCode": "ROOM_1"
      }
    ],
    "days": [
      {
        "date": "2026-08-24",
        "slots": [
          { "shiftId": "shift_123", "period": "MORNING", "count": 3 },
          { "shiftId": "shift_124", "period": "AFTERNOON", "count": 2 }
        ]
      }
    ]
  }
}
```

Mỗi ô lịch tháng đại diện một `SHIFT` dùng chung theo `date + period`. `roomCode` thuộc từng assignment và được trả trong chi tiết ca, không phải khóa nhóm của ô lịch.

## 7. Endpoint thông báo

| Nghiệp vụ | Endpoint | Quyền | Thành công |
|---|---|---|---|
| Danh sách thông báo | `GET /notifications` | Đã đăng nhập | `200` |
| Đánh dấu đã đọc/chưa đọc | `PATCH /notifications/{notificationId}` | Chủ sở hữu | `200` |

Danh sách nhận `read`, `page`, `pageSize`. Patch body: `{ "read": true }`.

## 8. Status code

| Code | Khi sử dụng |
|---|---|
| `200` | Đọc/cập nhật/xóa có response body thành công. |
| `201` | Tạo resource hoặc session thành công. |
| `202` | Đã tiếp nhận request nhưng cố ý không tiết lộ kết quả nội bộ. |
| `204` | Thành công, không có response body. |
| `400` | JSON/query/header sai cú pháp. |
| `401` | Chưa xác thực, credential/mã không hợp lệ hoặc session hết hạn. |
| `403` | Không có quyền hoặc account bị vô hiệu hóa. |
| `404` | Resource không tồn tại hoặc actor không được phép biết resource tồn tại. |
| `409` | Xung đột version/trạng thái/idempotency. |
| `413` | File hoặc request quá lớn. |
| `415` | Media/file type không hỗ trợ. |
| `422` | Vi phạm validation/business rule. |
| `429` | Vượt rate limit. |
| `500` | Lỗi nội bộ; không trả stack trace. |

## 9. Response format

Resource đơn:

```json
{ "data": { "id": "resource_123" } }
```

Danh sách:

```json
{
  "data": [],
  "meta": { "page": 1, "pageSize": 20, "total": 0 }
}
```

Lỗi:

```json
{
  "error": {
    "code": "VERSION_CONFLICT",
    "message": "Dữ liệu đã được cập nhật bởi yêu cầu khác",
    "details": {},
    "requestId": "req_123"
  }
}
```

Frontend điều khiển hành vi bằng `error.code`. `details` không chứa stack trace, Prisma error, đường dẫn file, password/hash, session token hoặc dữ liệu nhạy cảm không cần thiết.

## 10. Error code

| Code | HTTP |
|---|---:|
| `INVALID_CREDENTIALS` | `401` |
| `CURRENT_PASSWORD_INVALID` | `400` |
| `ACCOUNT_DISABLED` | `403` |
| `CSRF_INVALID` | `403` |
| `RESOURCE_NOT_FOUND` | `404` |
| `EMAIL_ALREADY_EXISTS` | `409` |
| `REGISTRATION_ALREADY_REVIEWED` | `409` |
| `VERSION_CONFLICT` | `409` |
| `IDEMPOTENCY_KEY_REUSED` | `409` |
| `FILE_TOO_LARGE` | `413` |
| `UNSUPPORTED_FILE_TYPE` | `415` |
| `VALIDATION_FAILED` | `422` |
| `RATE_LIMITED` | `429` |
