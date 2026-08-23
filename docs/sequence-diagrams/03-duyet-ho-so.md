# Sequence diagram - Duyệt hồ sơ

## Admin phê duyệt hoặc từ chối hồ sơ

```mermaid
sequenceDiagram
    title DUYỆT YÊU CẦU ĐĂNG KÝ

    actor A as Quản trị viên

    box LỚP FRONTEND
        participant UI as Màn hình yêu cầu đăng ký
        participant API as API Client
    end

    box LỚP BACKEND
        participant C as Registration Controller
        participant S as Registration Service
    end

    box LỚP DỮ LIỆU
        participant DB as Database
    end

    A->>UI: Mở danh sách yêu cầu chờ duyệt
    UI->>API: Yêu cầu danh sách
    API->>C: GET /api/v1/registration-requests?status=PENDING
    C->>S: Lấy yêu cầu chờ duyệt
    S->>DB: Truy vấn yêu cầu
    DB-->>S: Danh sách yêu cầu
    S-->>C: Kết quả
    C-->>API: 200 OK
    API-->>UI: Hiển thị danh sách

    A->>UI: Mở hồ sơ và chọn xử lý
    UI->>API: Gửi quyết định duyệt hoặc từ chối
    API->>C: PATCH /api/v1/registration-requests/{id}
    activate C
    C->>S: Xử lý yêu cầu
    activate S
    S->>DB: Khóa và đọc yêu cầu hiện tại
    DB-->>S: Yêu cầu và trạng thái

    alt Yêu cầu không còn ở trạng thái Chờ duyệt
        S-->>C: Không thể xử lý
        C-->>API: 409 Conflict
        API-->>UI: Yêu cầu đã được xử lý trước đó
        UI-->>A: Hiển thị thông báo và tải lại danh sách
    else Admin từ chối
        S->>DB: Cập nhật trạng thái Từ chối và ghi nhật ký
        DB-->>S: Đã cập nhật
        S-->>C: Từ chối thành công
        C-->>API: 200 OK
        API-->>UI: Kết quả xử lý
        UI-->>A: Loại yêu cầu khỏi danh sách chờ
    else Admin phê duyệt
        S->>DB: Tạo tài khoản CTV ở trạng thái Kích hoạt
        S->>DB: Cập nhật yêu cầu thành Đã duyệt và ghi nhật ký
        DB-->>S: Hoàn tất giao dịch
        S-->>C: Phê duyệt thành công
        C-->>API: 200 OK
        API-->>UI: Kết quả xử lý
        UI-->>A: Cập nhật số yêu cầu chờ
    end

    deactivate S
    deactivate C
```

## Làm rõ các mũi tên còn mơ hồ

- **`Database → Registration Service — Danh sách yêu cầu`:** Prisma trả `{ rows:[{ id, fullName, email, submittedAt, status, fileIds }], total }`, không trả đường dẫn tệp; Controller map thành JSON `{ data, meta:{ page, pageSize, total } }`.
- **`Màn hình yêu cầu đăng ký → API Client — Gửi quyết định duyệt hoặc từ chối`:** TanStack Query gửi JSON `{ decision:'APPROVED'|'REJECTED', rejectionReason?:string, expectedStatus:'PENDING' }` cùng cookie session và CSRF token.
- **`Registration Service → Database — Khóa và đọc yêu cầu hiện tại`:** Prisma `$transaction` dùng cập nhật có điều kiện `where:{ id, status:'PENDING' }` để chỉ một Admin có thể xử lý thành công.
- **`Registration Service → Database — Cập nhật trạng thái Từ chối và ghi nhật ký`:** cùng transaction cập nhật `{ status:'REJECTED', rejectionReason, reviewedBy, reviewedAt }` và tạo audit `{ action:'REGISTRATION_REJECTED', actorId, targetId, requestId }`.
- **`Registration Service → Database — Tạo tài khoản CTV ở trạng thái Kích hoạt`:** Prisma tạo account `{ email, role:'CTV', status:'ACTIVE', profileId, mustChangePassword }`; unique index trên email ngăn tạo trùng.
- **`Registration Service → Database — Cập nhật yêu cầu thành Đã duyệt và ghi nhật ký`:** cùng transaction cập nhật `{ status:'APPROVED', accountId, reviewedBy, reviewedAt }` và audit `REGISTRATION_APPROVED`.
- **`Database → Registration Service — Hoàn tất giao dịch`:** SQLite commit nguyên tử và trả `{ requestId, accountId, status, reviewedAt }`; lỗi bất kỳ rollback account, request và audit.
- **`API Client → Màn hình yêu cầu đăng ký — Kết quả xử lý`:** response là `{ data:{ id, status, accountId?, reviewedAt } }`; TanStack Query invalidate danh sách `PENDING`, badge và account list liên quan.
