# API Reference — CTV Manage

Tài liệu đặc tả toàn bộ các HTTP endpoints của hệ thống CTV Manage dưới tiền tố `/api/v1`. Tài liệu được đồng bộ chính xác 1:1 với mã nguồn sau Phase 2.

---

## 1. Quy ước chung

### 1.1. Base URL & Giao thức
- **Base URL**: `/api/v1`
- **Định dạng dữ liệu mặc định**: `application/json; charset=utf-8` (ngoại trừ các endpoint upload dùng `multipart/form-data` và endpoint stream tệp trả về luồng nhị phân).
- **Múi giờ hệ thống**: `Asia/Bangkok` (UTC+7). Mọi định dạng ngày tháng tuân theo tiêu chuẩn ISO 8601 hoặc chuỗi `YYYY-MM-DD`, `YYYY-MM`.

### 1.2. Xác thực (Authentication)
- Sử dụng cookie phiên **`ctv_session`**:
  - Cờ bảo mật: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` (trong môi trường Production).
  - Trình duyệt và frontend HTTP client (`fetch`) tự động đính kèm cookie thông qua cấu hình `credentials: 'include'`.
  - Token gốc không bao giờ được trả về trong JSON body hoặc lưu trong cơ sở dữ liệu (chỉ lưu giá trị băm `tokenHash = sha256(token)` trong bảng `Session`).

### 1.3. Phân quyền (Authorization)
Mỗi tài khoản có một vai trò cố định (`role`):
- **`ADMIN`**: Quản trị viên hệ thống — toàn quyền quản lý tài khoản, duyệt hồ sơ, xem lịch tổng hợp toàn viện, xem hồ sơ & ghi chú nội bộ của CTV.
- **`CTV`**: Cộng tác viên — quyền quản lý hồ sơ cá nhân, đăng ký/cập nhật mẫu lịch tuần của mình, xem lịch tuần và lịch sử ca đã chốt của chính mình.

### 1.4. Kiểm soát tương tranh (Optimistic Concurrency Control)
- Các tài nguyên có trạng thái thay đổi (`Account`, `Schedule`) duy trì trường `version` (số nguyên tự tăng).
- Khi client gửi yêu cầu sửa đổi (PUT/PATCH), client gửi kèm trường `expectedVersion`.
- Nếu phiên bản hiện tại trong cơ sở dữ liệu khác với `expectedVersion`, server từ chối thực hiện và trả về mã lỗi **`409 VERSION_CONFLICT`**.
- Đối với nghiệp vụ đăng ký/cập nhật lịch (`PUT /api/v1/users/me/schedule`), ngoài kiểm tra `expectedVersion`, backend còn sử dụng khóa cố vấn cấp transaction của PostgreSQL:
  ```sql
  SELECT pg_advisory_xact_lock(hashtext(accountId))
  ```
  nhằm loại bỏ hoàn toàn hiện tượng race condition khi có nhiều request đồng thời từ cùng một tài khoản.

### 1.5. Cấu trúc phản hồi lỗi chuẩn (Error Response Body)
Mọi lỗi trả về từ API đều tuân thủ cấu trúc thống nhất:
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Thông điệp mô tả lỗi thân thiện",
    "details": [] // Tùy chọn: danh sách chi tiết lỗi validation từ Zod
  }
}
```

### 1.6. Danh mục mã lỗi HTTP thường gặp
| Mã HTTP | Mã lỗi (`code`) | Ý nghĩa & Tình huống xảy ra |
|---|---|---|
| **400** | `VALIDATION_ERROR` | Dữ liệu đầu vào (body, params, query) không thỏa mãn Zod schema |
| **400** | `MALFORMED_JSON` | Body gửi lên không phải JSON hợp lệ |
| **400** | `FILE_UPLOAD_ERROR` | Lỗi trong quá trình upload tệp (Multer) |
| **400** | `INVALID_ROOM_CODE` | `roomCode` không thuộc `ROOM_1` .. `ROOM_4` |
| **400** | `INVALID_SLOTS` | Danh sách ca `slots` không phải mảng hợp lệ |
| **400** | `INVALID_WEEKDAY` | `weekday` không nằm trong khoảng 1 đến 5 (Thứ 2 đến Thứ 6) |
| **400** | `INVALID_PERIOD` | `period` không phải `MORNING` hoặc `AFTERNOON` |
| **400** | `INVALID_MONTH` | Tham số `month` không đúng định dạng `YYYY-MM` |
| **400** | `INVALID_FILE_TYPE` | Định dạng tệp không được hỗ trợ hoặc sai magic bytes |
| **400** | `MISSING_FILE` | Thiếu trường tệp `file` trong multipart form |
| **400** | `CURRENT_PASSWORD_INVALID` | Mật khẩu hiện tại nhập không chính xác |
| **401** | `UNAUTHORIZED` | Phiên đăng nhập không tồn tại, đã hết hạn hoặc bị thu hồi |
| **401** | `INVALID_CREDENTIALS` | Email hoặc mật khẩu không chính xác |
| **403** | `FORBIDDEN` | Tài khoản không có vai trò phù hợp để truy cập tài nguyên |
| **403** | `ACCOUNT_DISABLED` | Tài khoản đã bị vô hiệu hóa bởi Quản trị viên |
| **404** | `NOT_FOUND` | Không tìm thấy bản ghi yêu cầu (hoặc đã bị xóa mềm) |
| **409** | `VERSION_CONFLICT` | Dữ liệu đã bị sửa đổi ở phiên làm việc khác |
| **409** | `EMAIL_ALREADY_EXISTS` | Email đã được sử dụng bởi một tài khoản hoặc yêu cầu chờ duyệt |
| **409** | `REGISTRATION_ALREADY_REVIEWED` | Yêu cầu đăng ký đã được Admin khác xử lý trước đó |
| **409** | `REGISTRATION_FILE_UNAVAILABLE` | Tệp đính kèm của yêu cầu đăng ký không còn khả dụng trên đĩa |
| **413** | `FILE_TOO_LARGE` | Dung lượng tệp vượt quá giới hạn cho phép (5MB) |
| **500** | `INTERNAL_ERROR` | Lỗi xử lý ngoại lệ nội bộ của máy chủ |

---

## 2. Health Check

### `GET /api/v1/health`
Kiểm tra trạng thái sẵn sàng của dịch vụ.

- **Xác thực**: Không yêu cầu (Public)
- **Response 200 OK**:
  ```json
  {
    "status": "ok"
  }
  ```

---

## 3. Module Xác thực (Auth) — `/api/v1/auth/sessions`

### `POST /api/v1/auth/sessions`
Đăng nhập vào hệ thống, thiết lập cookie phiên.

- **Xác thực**: Không yêu cầu (Public)
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "Password123!"
  }
  ```
- **Response 201 Created**:
  - Headers: `Set-Cookie: ctv_session=<token>; Path=/; HttpOnly; SameSite=Lax`
  - Body:
    ```json
    {
      "user": {
        "id": "acc_123",
        "email": "user@example.com",
        "displayName": "Nguyễn Văn A",
        "phone": "0987654321",
        "role": "CTV",
        "status": "ACTIVE",
        "version": 1,
        "mustChangePassword": false,
        "ctvCode": "CTV-0001",
        "dateOfBirth": "2000-01-15T00:00:00.000Z",
        "gender": "MALE",
        "address": "Hà Nội",
        "adminNotes": null,
        "joinedAt": "2026-08-01T08:00:00.000Z",
        "lastLoginAt": "2026-09-05T09:00:00.000Z",
        "createdAt": "2026-08-01T08:00:00.000Z"
      }
    }
    ```
- **Lỗi**:
  - `400 VALIDATION_ERROR`: Sai định dạng email hoặc thiếu mật khẩu.
  - `401 INVALID_CREDENTIALS`: Sai email hoặc mật khẩu.
  - `403 ACCOUNT_DISABLED`: Tài khoản đang ở trạng thái `DISABLED`.

---

### `DELETE /api/v1/auth/sessions/current` (và `DELETE /api/v1/auth/sessions/me`)
Đăng xuất tài khoản, thu hồi phiên làm việc hiện tại và xóa cookie.

- **Xác thực**: Không yêu cầu hoặc phiên hiện tại (Idempotent).
- **Response 204 No Content**:
  - Headers: `Set-Cookie: ctv_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax`

---

### `GET /api/v1/auth/sessions/me`
Lấy thông tin người dùng của phiên hiện tại.

- **Xác thực**: Bắt buộc (`ADMIN` hoặc `CTV`).
- **Response 200 OK**:
  ```json
  {
    "user": {
      "id": "acc_123",
      "email": "user@example.com",
      "displayName": "Nguyễn Văn A",
      "phone": "0987654321",
      "role": "CTV",
      "status": "ACTIVE",
      "version": 1,
      "mustChangePassword": false,
      "ctvCode": "CTV-0001",
      "dateOfBirth": "2000-01-15T00:00:00.000Z",
      "gender": "MALE",
      "address": "Hà Nội",
      "adminNotes": null,
      "joinedAt": "2026-08-01T08:00:00.000Z",
      "lastLoginAt": "2026-09-05T09:00:00.000Z",
      "createdAt": "2026-08-01T08:00:00.000Z"
    }
  }
  ```
- **Lỗi**: `401 UNAUTHORIZED`, `403 ACCOUNT_DISABLED`.

---

## 4. Module Hồ sơ cá nhân (Users/Me) — `/api/v1/users/me`

### `GET /api/v1/users/me`
Lấy thông tin hồ sơ đầy đủ kèm danh sách tệp đính kèm của người dùng đang đăng nhập.

- **Xác thực**: Bắt buộc (`ADMIN` hoặc `CTV`).
- **Response 200 OK**:
  ```json
  {
    "user": {
      "id": "acc_123",
      "email": "user@example.com",
      "displayName": "Nguyễn Văn A",
      "phone": "0987654321",
      "role": "CTV",
      "status": "ACTIVE",
      "version": 1,
      "mustChangePassword": false,
      "ctvCode": "CTV-0001",
      "dateOfBirth": "2000-01-15T00:00:00.000Z",
      "gender": "MALE",
      "address": "Hà Nội",
      "adminNotes": null,
      "joinedAt": "2026-08-01T08:00:00.000Z",
      "lastLoginAt": "2026-09-05T09:00:00.000Z",
      "createdAt": "2026-08-01T08:00:00.000Z",
      "files": [
        {
          "category": "CV",
          "fileId": "file_456",
          "createdAt": "2026-08-01T08:00:00.000Z",
          "file": {
            "id": "file_456",
            "originalName": "CV_NguyenVanA.pdf",
            "mimeType": "application/pdf",
            "sizeBytes": 1048576
          }
        }
      ]
    }
  }
  ```

---

### `PATCH /api/v1/users/me`
Cập nhật thông tin hồ sơ cá nhân.

- **Xác thực**: Bắt buộc (`ADMIN` hoặc `CTV`).
- **Request Body**:
  ```json
  {
    "displayName": "Nguyễn Văn A (Mới)",
    "phone": "0912345678",
    "dateOfBirth": "2000-01-15",
    "gender": "MALE",
    "address": "Quận Cầu Giấy, Hà Nội",
    "expectedVersion": 1
  }
  ```
  *(Các trường đều là tùy chọn; nếu truyền `expectedVersion`, server sẽ đối soát phiên bản).*
- **Response 200 OK**: Trả về `user` DTO sau khi cập nhật (version tăng thêm 1).
- **Lỗi**:
  - `400 VALIDATION_ERROR`: Dữ liệu không hợp lệ.
  - `409 VERSION_CONFLICT`: Phiên bản dữ liệu không khớp.

---

### `POST /api/v1/users/me/password-changes` (và `POST /api/v1/users/me/password`)
Người dùng tự đổi mật khẩu tài khoản.

- **Xác thực**: Bắt buộc (`ADMIN` hoặc `CTV`).
- **Request Body**:
  ```json
  {
    "currentPassword": "OldPassword123!",
    "newPassword": "NewStrongPassword456!"
  }
  ```
  *(Yêu cầu `newPassword` tối thiểu 8 ký tự, tối đa 128 ký tự).*
- **Phản ứng**: Hash mật khẩu mới bằng Argon2id, cập nhật `passwordChangedAt = now`, `mustChangePassword = false`, và thu hồi toàn bộ các phiên khác ngoại trừ phiên hiện tại.
- **Response 204 No Content**.
- **Lỗi**:
  - `400 CURRENT_PASSWORD_INVALID`: Mật khẩu hiện tại không đúng.
  - `400 VALIDATION_ERROR`: Mật khẩu mới không đạt chuẩn.

---

## 5. Module Quản lý tài khoản (Accounts) — `/api/v1/accounts` (Admin Only)

Tất cả các route trong mục này yêu cầu quyền **`ADMIN`**.

### `GET /api/v1/accounts`
Lấy danh sách tài khoản phân trang kèm bộ lọc tìm kiếm và trạng thái.

- **Query Parameters**:
  - `q`: Từ khóa tìm kiếm theo tên, email, sđt hoặc mã CTV (`string`, tùy chọn).
  - `status`: Lọc theo trạng thái (`ACTIVE` hoặc `DISABLED`, tùy chọn).
  - `page`: Số trang (`integer`, min 1, mặc định `1`).
  - `pageSize`: Số bản ghi mỗi trang (`integer`, min 1, max 100, mặc định `5`).
- **Response 200 OK**:
  ```json
  {
    "data": [
      {
        "id": "acc_123",
        "email": "ctv1@example.com",
        "displayName": "Nguyễn Văn A",
        "phone": "0987654321",
        "ctvCode": "CTV-0001",
        "role": "CTV",
        "status": "ACTIVE",
        "version": 1,
        "gender": "MALE",
        "dateOfBirth": "2000-01-15T00:00:00.000Z",
        "address": "Hà Nội",
        "joinedAt": "2026-08-01T08:00:00.000Z",
        "lastLoginAt": "2026-09-05T09:00:00.000Z",
        "createdAt": "2026-08-01T08:00:00.000Z",
        "updatedAt": "2026-08-01T08:00:00.000Z",
        "files": []
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 5
  }
  ```

---

### `GET /api/v1/accounts/:id`
Lấy thông tin chi tiết một tài khoản (kèm ghi chú nội bộ `adminNotes` và danh sách tệp đính kèm).

- **Path Parameters**: `id`: Account ID (`string`).
- **Response 200 OK**:
  ```json
  {
    "data": {
      "id": "acc_123",
      "email": "ctv1@example.com",
      "displayName": "Nguyễn Văn A",
      "phone": "0987654321",
      "ctvCode": "CTV-0001",
      "role": "CTV",
      "status": "ACTIVE",
      "version": 1,
      "mustChangePassword": false,
      "gender": "MALE",
      "dateOfBirth": "2000-01-15T00:00:00.000Z",
      "address": "Hà Nội",
      "adminNotes": "CTV làm việc tích cực",
      "joinedAt": "2026-08-01T08:00:00.000Z",
      "lastLoginAt": "2026-09-05T09:00:00.000Z",
      "passwordChangedAt": null,
      "createdAt": "2026-08-01T08:00:00.000Z",
      "updatedAt": "2026-08-01T08:00:00.000Z",
      "files": []
    }
  }
  ```
- **Lỗi**: `404 NOT_FOUND`.

---

### `GET /api/v1/accounts/:id/schedule`
Lấy mẫu lịch tuần cố định của một tài khoản CTV cụ thể (phục vụ xem hồ sơ & lịch trình).

- **Path Parameters**: `id`: Account ID (`string`).
- **Response 200 OK**:
  ```json
  {
    "data": {
      "id": "sch_123",
      "accountId": "acc_123",
      "roomCode": "ROOM_1",
      "version": 1,
      "createdAt": "2026-09-01T08:00:00.000Z",
      "updatedAt": "2026-09-01T08:00:00.000Z",
      "patternSlots": [
        { "weekday": 1, "period": "MORNING" },
        { "weekday": 3, "period": "AFTERNOON" }
      ],
      "shifts": [
        { "weekday": 1, "period": "MORNING" },
        { "weekday": 3, "period": "AFTERNOON" }
      ]
    }
  }
  ```
  *(Nếu CTV chưa đăng ký lịch, `data` là `null`).*
- **Lỗi**: `404 NOT_FOUND` (nếu tài khoản không tồn tại hoặc đã bị xóa).

---

### `PATCH /api/v1/accounts/:id`
Admin cập nhật thông tin hồ sơ tài khoản.

- **Path Parameters**: `id`: Account ID (`string`).
- **Request Body**:
  ```json
  {
    "displayName": "Nguyễn Văn A",
    "phone": "0987654321",
    "dateOfBirth": "2000-01-15",
    "gender": "MALE",
    "address": "Hà Nội",
    "expectedVersion": 1
  }
  ```
- **Response 200 OK**: `{ "data": AccountDetailDto }`.
- **Lỗi**: `400 VALIDATION_ERROR`, `404 NOT_FOUND`, `409 VERSION_CONFLICT`.

---

### `PATCH /api/v1/accounts/:id/notes`
Admin cập nhật ghi chú nội bộ cho tài khoản.

- **Path Parameters**: `id`: Account ID (`string`).
- **Request Body**:
  ```json
  {
    "adminNotes": "CTV hoàn thành tốt ca trực tuần qua.",
    "expectedVersion": 1
  }
  ```
- **Response 200 OK**: `{ "data": AccountDetailDto }`.
- **Lỗi**: `400 VALIDATION_ERROR`, `404 NOT_FOUND`, `409 VERSION_CONFLICT`.

---

### `PATCH /api/v1/accounts/:id/status`
Kích hoạt hoặc vô hiệu hóa tài khoản.

- **Path Parameters**: `id`: Account ID (`string`).
- **Request Body**:
  ```json
  {
    "status": "DISABLED",
    "expectedVersion": 1
  }
  ```
- **Hành vi**:
  - Cập nhật trạng thái `status`, tăng `version += 1`.
  - Nếu chuyển sang `DISABLED`, đồng thời thu hồi tất cả các phiên làm việc đang hoạt động của tài khoản (`SESSION.revokedAt = now`).
- **Response 200 OK**: `{ "data": AccountDetailDto }`.
- **Lỗi**: `400 VALIDATION_ERROR`, `404 NOT_FOUND`, `409 VERSION_CONFLICT`.

---

### `POST /api/v1/accounts/:id/password-resets`
Admin đặt lại mật khẩu cho tài khoản.

- **Path Parameters**: `id`: Account ID (`string`).
- **Request Body**:
  ```json
  {
    "newPassword": "TempPassword123!",
    "mustChangePassword": true
  }
  ```
- **Response 200 OK**: `{ "data": AccountDetailDto }`.
- **Lỗi**: `400 VALIDATION_ERROR`, `404 NOT_FOUND`.

---

### `DELETE /api/v1/accounts/:id`
Xóa mềm tài khoản (Soft delete idempotent).

- **Path Parameters**: `id`: Account ID (`string`).
- **Hành vi**:
  - Đặt `deletedAt = now`, `status = DISABLED`, tăng `version += 1`.
  - Thu hồi tất cả các session đang hoạt động.
  - Lịch tuần trong `Schedule` và lịch sử trong `History` vẫn được bảo toàn dữ liệu phục vụ đối soát.
- **Response 200 OK**: `{ "data": AccountDetailDto }`.
- **Lỗi**: `404 NOT_FOUND`.

---

## 6. Module Yêu cầu đăng ký (Registration Requests) — `/api/v1/registration-requests`

### `POST /api/v1/registration-requests`
Gửi hồ sơ đăng ký tài khoản CTV mới kèm tệp đính kèm (CCCD, CV).

- **Xác thực**: Không yêu cầu (Public).
- **Content-Type**: `multipart/form-data`.
- **Form Fields**:
  - `email`: Email người đăng ký (`string`, bắt buộc, định dạng email chuẩn).
  - `displayName`: Họ và tên (`string`, bắt buộc, 1-100 ký tự).
  - `phone`: Số điện thoại (`string`, bắt buộc, 10-11 chữ số).
  - `password`: Mật khẩu (`string`, bắt buộc, tối thiểu 6 ký tự).
  - `dateOfBirth`: Ngày sinh (`string`, tùy chọn, định dạng `YYYY-MM-DD`).
  - `gender`: Giới tính (`string`, tùy chọn).
  - `address`: Địa chỉ (`string`, tùy chọn).
- **Files** (Tùy chọn, dung lượng tối đa 5MB mỗi tệp):
  - `cccdFront`: Ảnh CCCD mặt trước (`image/jpeg`, `image/png`, `image/webp`).
  - `cccdBack`: Ảnh CCCD mặt sau (`image/jpeg`, `image/png`, `image/webp`).
  - `cv`: Tệp hồ sơ / CV (`application/pdf`).
- **Kiểm tra an toàn**: Backend kiểm tra cả MIME type khai báo và magic bytes nhị phân thực tế của tệp.
- **Response 201 Created**:
  ```json
  {
    "request": {
      "id": "req_123",
      "email": "candidate@example.com",
      "displayName": "Trần Thị B",
      "phone": "0912345678",
      "dateOfBirth": "2001-05-20T00:00:00.000Z",
      "gender": "FEMALE",
      "address": "Hà Nội",
      "status": "PENDING",
      "rejectionReason": null,
      "reviewedBy": null,
      "reviewedAt": null,
      "createdAt": "2026-09-05T08:00:00.000Z",
      "updatedAt": "2026-09-05T08:00:00.000Z",
      "files": []
    }
  }
  ```
- **Lỗi**:
  - `400 VALIDATION_ERROR`: Dữ liệu biểu mẫu không hợp lệ.
  - `400 INVALID_FILE_TYPE`: Tệp không đúng định dạng hoặc sai magic bytes.
  - `409 EMAIL_ALREADY_EXISTS`: Email đã tồn tại trong bảng Account hoặc đang có yêu cầu PENDING.
  - `413 FILE_TOO_LARGE`: Tệp vượt quá 5MB.

---

### `GET /api/v1/registration-requests`
Admin lấy danh sách yêu cầu đăng ký theo trạng thái.

- **Xác thực**: Bắt buộc (`ADMIN`).
- **Query Parameters**:
  - `status`: Trạng thái (`PENDING`, `APPROVED`, `REJECTED`, mặc định `PENDING`).
  - `q`: Từ khóa tìm kiếm theo tên, email, sđt (`string`, tùy chọn).
  - `page`: Trang hiện tại (`integer`, mặc định 1).
  - `pageSize`: Số bản ghi trên trang (`integer`, max 100, mặc định 20).
- **Response 200 OK**:
  ```json
  {
    "data": [
      {
        "id": "req_123",
        "email": "candidate@example.com",
        "displayName": "Trần Thị B",
        "phone": "0912345678",
        "status": "PENDING",
        "createdAt": "2026-09-05T08:00:00.000Z",
        "files": []
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20
  }
  ```

---

### `PATCH /api/v1/registration-requests/:requestId`
Admin phê duyệt hoặc từ chối yêu cầu đăng ký.

- **Xác thực**: Bắt buộc (`ADMIN`).
- **Path Parameters**: `requestId`: ID yêu cầu đăng ký (`string`).
- **Request Body**:
  ```json
  {
    "decision": "APPROVED",
    "expectedStatus": "PENDING",
    "rejectionReason": null
  }
  ```
  *(Nếu `decision` là `REJECTED`, có thể truyền `rejectionReason` tối đa 500 ký tự).*
- **Hành vi khi APPROVE**:
  - Kiểm tra trạng thái hiện tại là `PENDING`.
  - Xác nhận toàn bộ tệp đính kèm vật lý vẫn tồn tại trên đĩa.
  - Tạo tài khoản mới trong bảng `Account` với vai trò `CTV`, trạng thái `ACTIVE`, mật khẩu đã hash từ bước đăng ký.
  - Chuyển quyền sở hữu tệp đính kèm từ request sang `AccountFile`.
  - Cập nhật request: `status = APPROVED`, `reviewedBy = adminId`, `reviewedAt = now`.
- **Response 200 OK**: `{ "request": RegistrationRequestDto }`.
- **Lỗi**:
  - `400 VALIDATION_ERROR`: Thiếu hoặc sai tham số.
  - `404 NOT_FOUND`: Không tìm thấy yêu cầu đăng ký.
  - `409 REGISTRATION_ALREADY_REVIEWED`: Yêu cầu đã được xử lý trước đó.
  - `409 REGISTRATION_FILE_UNAVAILABLE`: Tệp đính kèm không còn khả dụng trên hệ thống lưu trữ.

---

## 7. Module Lịch làm việc (Schedule)

### `GET /api/v1/users/me/schedule`
Lấy mẫu lịch tuần cố định hiện hành của CTV đang đăng nhập.

- **Xác thực**: Bắt buộc (`CTV`).
- **Response 200 OK**:
  ```json
  {
    "data": {
      "id": "sch_123",
      "accountId": "acc_123",
      "roomCode": "ROOM_1",
      "version": 1,
      "createdAt": "2026-09-01T08:00:00.000Z",
      "updatedAt": "2026-09-01T08:00:00.000Z",
      "patternSlots": [
        { "weekday": 1, "period": "MORNING" },
        { "weekday": 2, "period": "AFTERNOON" }
      ],
      "shifts": [
        { "weekday": 1, "period": "MORNING" },
        { "weekday": 2, "period": "AFTERNOON" }
      ]
    }
  }
  ```
  *(Nếu chưa đăng ký lịch, `data` là `null`).*

---

### `PUT /api/v1/users/me/schedule`
Đăng ký mới hoặc cập nhật toàn bộ mẫu lịch tuần cố định của CTV.

- **Xác thực**: Bắt buộc (`CTV`).
- **Request Body**:
  ```json
  {
    "roomCode": "ROOM_2",
    "slots": [
      { "weekday": 1, "period": "MORNING" },
      { "weekday": 3, "period": "AFTERNOON" },
      { "weekday": 5, "period": "MORNING" }
    ],
    "expectedVersion": 1
  }
  ```
  - `roomCode`: `ROOM_1` .. `ROOM_4`.
  - `slots`: Mảng từ 0 đến 10 ca (`weekday`: 1..5, `period`: `MORNING` | `AFTERNOON`). Có thể gửi mảng rỗng `[]` để xóa toàn bộ ca trực trong tuần.
  - `expectedVersion`: Bắt buộc nếu tài khoản đã từng có `Schedule`.
- **Hành vi xử lý**:
  - Sử dụng transaction có khóa cố vấn PostgreSQL `pg_advisory_xact_lock(hashtext(accountId))`.
  - Kiểm tra `expectedVersion`; nếu không khớp trả về `409 VERSION_CONFLICT`.
  - Cập nhật `Schedule` (tăng `version += 1`, cập nhật `roomCode`).
  - Xóa toàn bộ `Shift` cũ của `scheduleId` và tạo mới lại các `Shift` theo mảng `slots`.
- **Response 200 OK**: `{ "data": ScheduleDto }`.
- **Lỗi**:
  - `400 INVALID_ROOM_CODE`, `INVALID_SLOTS`, `INVALID_WEEKDAY`, `INVALID_PERIOD`.
  - `409 VERSION_CONFLICT`.

---

### `GET /api/v1/schedule/weekly-summary` (và alias `/api/v1/schedule-summary/weekly-summary`)
Admin lấy ma trận lịch tuần tổng hợp của toàn viện (Thứ 2 đến Thứ 6, 10 ô ca).

- **Xác thực**: Bắt buộc (`ADMIN`).
- **Response 200 OK**:
  ```json
  {
    "data": {
      "cells": [
        {
          "shiftId": "weekly-1-MORNING",
          "weekday": 1,
          "period": "MORNING",
          "count": 2,
          "shiftAssignments": [
            {
              "id": "acc_123-1-MORNING",
              "accountId": "acc_123",
              "displayName": "Nguyễn Văn A",
              "phone": "0987654321",
              "roomCode": "ROOM_1",
              "status": "ACTIVE"
            },
            {
              "id": "acc_456-1-MORNING",
              "accountId": "acc_456",
              "displayName": "Trần Thị B",
              "phone": "0912345678",
              "roomCode": "ROOM_2",
              "status": "ACTIVE"
            }
          ]
        }
      ]
    },
    "cells": [ /* same as data.cells */ ]
  }
  ```

---

### `GET /api/v1/schedule-summary`
Endpoint truy vấn lịch tổng hợp linh hoạt theo tháng hoặc khoảng ngày (tương thích ngược).

- **Xác thực**: Bắt buộc (`ADMIN`).
- **Query Parameters**:
  - `month`: Tháng theo định dạng `YYYY-MM`.
  - `from`, `to`: Khoảng ngày `YYYY-MM-DD` (`from <= to`).
  - *(Chỉ chọn `month` HOẶC `from/to`, không gửi đồng thời cả hai).*
- **Response 200 OK**: Trả về cấu trúc `{ data: { cells }, cells }` giống `getWeeklySummary`.

---

### Các route tương thích ngược & Stubs
- `GET /api/v1/users/me/schedule-registration`: Trỏ trực tiếp về `getMySchedule`.
- `PUT /api/v1/users/me/schedule-registration`: Trỏ trực tiếp về `putMySchedule`.
- `GET /api/v1/users/me/shifts`: Trả về danh sách ca mô phỏng từ `Schedule` hiện hành để tương thích với các client cũ.
- `GET /api/v1/shifts/:shiftId`: Trả về thông tin ca theo ID mô phỏng.

---

## 8. Module Lịch sử làm việc (Work History)

### `GET /api/v1/users/me/work-history`
CTV lấy lịch sử các ca làm việc đã hoàn thành của chính mình theo tháng.

- **Xác thực**: Bắt buộc (`CTV`). `accountId` được lấy trực tiếp từ session đã xác thực.
- **Query Parameters**:
  - `month`: Tháng cần truy vấn (`string`, bắt buộc, định dạng `YYYY-MM`).
- **Response 200 OK**:
  ```json
  {
    "data": {
      "month": "2026-09",
      "entries": [
        {
          "id": "his_001",
          "workDate": "2026-09-01",
          "period": "MORNING",
          "roomCode": "ROOM_1"
        },
        {
          "id": "his_002",
          "workDate": "2026-09-03",
          "period": "AFTERNOON",
          "roomCode": "ROOM_1"
        }
      ]
    },
    "month": "2026-09",
    "entries": [ /* same as data.entries */ ]
  }
  ```
- **Lỗi**: `400 INVALID_MONTH`.

---

### `GET /api/v1/work-history`
Admin lấy lịch sử làm việc tổng hợp của toàn viện hoặc của một CTV cụ thể theo tháng.

- **Xác thực**: Bắt buộc (`ADMIN`).
- **Query Parameters**:
  - `month`: Tháng cần truy vấn (`string`, bắt buộc, định dạng `YYYY-MM`).
  - `accountId`: ID tài khoản CTV cần lọc (`string`, tùy chọn).
- **Response 200 OK**:
  ```json
  {
    "data": {
      "month": "2026-09",
      "entries": [
        {
          "id": "his_001",
          "accountId": "acc_123",
          "workDate": "2026-09-01",
          "period": "MORNING",
          "roomCode": "ROOM_1",
          "status": "COMPLETED"
        }
      ],
      "cells": [
        {
          "shiftId": "history-2026-09-01-MORNING",
          "workDate": "2026-09-01",
          "period": "MORNING",
          "count": 1,
          "shiftAssignments": [
            {
              "id": "his_001",
              "accountId": "acc_123",
              "displayName": "Nguyễn Văn A",
              "phone": "0987654321",
              "roomCode": "ROOM_1",
              "status": "COMPLETED"
            }
          ]
        }
      ]
    },
    "month": "2026-09",
    "entries": [ /* same as data.entries */ ],
    "cells": [ /* same as data.cells */ ]
  }
  ```
- **Lỗi**: `400 INVALID_MONTH`.

---

## 9. Module Quản lý tệp (Files)

### `GET /api/v1/files/:fileId/content`
Xem trực tiếp hoặc tải xuống nội dung tệp nhị phân từ vùng lưu trữ an toàn.

- **Xác thực**: Bắt buộc (`ADMIN` hoặc chủ sở hữu tài khoản `CTV`).
- **Path Parameters**: `fileId`: ID của tệp (`string`).
- **Quy tắc phân quyền**:
  - `ADMIN`: Được phép truy cập mọi tệp hồ sơ (CCCD, CV) của bất kỳ tài khoản hay yêu cầu đăng ký nào.
  - `CTV`: Chỉ được phép truy cập tệp thuộc về chính tài khoản của mình. Mọi cố gắng truy cập tệp của người khác đều bị trả về lỗi `403 FORBIDDEN`.
- **Response 200 OK**:
  - Headers:
    - `Content-Type`: MIME type của tệp (ví dụ `application/pdf`, `image/jpeg`).
    - `Content-Length`: Kích thước tệp (bytes).
    - `Content-Disposition`: `inline; filename*=UTF-8''<encodedOriginalName>` (cho phép xem trực tiếp trên trình duyệt hoặc tải về với tên gốc).
  - Body: Luồng nhị phân (Readable Stream) truyền trực tiếp từ đĩa cứng.
- **Lỗi**:
  - `401 UNAUTHORIZED`: Chưa đăng nhập.
  - `403 FORBIDDEN`: Không có quyền truy cập tệp này.
  - `404 NOT_FOUND`: Tệp không tồn tại trong cơ sở dữ liệu hoặc bị mất trên ổ cứng.

---

### `PUT /api/v1/users/me/files/:category`
CTV tự tải lên hoặc thay thế một tệp trong hồ sơ cá nhân.

- **Xác thực**: Bắt buộc (`CTV` hoặc `ADMIN`).
- **Path Parameters**: `category`: `CCCD_FRONT`, `CCCD_BACK`, hoặc `CV`.
- **Content-Type**: `multipart/form-data` (trường `file`, tối đa 5MB).
- **Response 201 Created**:
  ```json
  {
    "file": {
      "id": "file_789",
      "originalName": "CV_Update.pdf",
      "mimeType": "application/pdf",
      "sizeBytes": 524288
    }
  }
  ```
- **Lỗi**: `400 INVALID_CATEGORY`, `400 MISSING_FILE`, `400 INVALID_FILE_TYPE`, `413 FILE_TOO_LARGE`.

---

### `DELETE /api/v1/users/me/files/:category`
CTV tự xóa một tệp khỏi hồ sơ cá nhân (đánh dấu xóa mềm liên kết `AccountFile`).

- **Xác thực**: Bắt buộc (`CTV` hoặc `ADMIN`).
- **Path Parameters**: `category`: `CCCD_FRONT`, `CCCD_BACK`, hoặc `CV`.
- **Response 204 No Content**.
- **Lỗi**: `400 INVALID_CATEGORY`.

---

### `PUT /api/v1/accounts/:accountId/files/:category`
Admin tải lên hoặc thay thế tệp trong hồ sơ của một tài khoản bất kỳ.

- **Xác thực**: Bắt buộc (`ADMIN`).
- **Path Parameters**: `accountId`: ID tài khoản, `category`: Danh mục tệp.
- **Content-Type**: `multipart/form-data` (trường `file`, tối đa 5MB).
- **Response 201 Created**: `{ "file": FileDto }`.

---

### `DELETE /api/v1/accounts/:accountId/files/:category`
Admin xóa một tệp khỏi hồ sơ của một tài khoản bất kỳ.

- **Xác thực**: Bắt buộc (`ADMIN`).
- **Path Parameters**: `accountId`: ID tài khoản, `category`: Danh mục tệp.
- **Response 204 No Content**.

---

## 10. Tác vụ nền (Background Jobs & Startup Recovery)

Các tác vụ này chạy ngầm độc lập ở phía Backend, không phải là HTTP endpoint mở ra ngoài client:

1. **Daily Snapshot lúc 17:30 Asia/Bangkok**:
   - Chạy đúng 17:30 Thứ 2 đến Thứ 6 (UTC+7 / 10:30 UTC).
   - Kiểm tra các CTV `ACTIVE` có `Schedule` và `Shift` khớp với thứ của ngày hôm nay.
   - Chụp lại bản ghi vào bảng `History` với `status = 'COMPLETED'`.
   - Sử dụng `prisma.history.createMany({ skipDuplicates: true })` dựa trên ràng buộc `@@unique([accountId, workDate, period])` để đảm bảo tính lũy tiến, bất biến (Idempotent).
   - Tuyệt đối không quét ngược backfill 14 ngày cũ.

2. **Startup Recovery khi máy chủ khởi động lại**:
   - Khi tiến trình `main.ts` khởi động, tự động gọi `snapshotTodayWorkHistory()` một lần.
   - Nếu thời điểm khởi động là sau 17:30 Bangkok của một ngày làm việc (T2-T6), hệ thống tự động bù đắp snapshot của ngày hôm nay nếu trước đó máy chủ bị tắt ngang.
