# Sequence diagram - Duyệt hồ sơ

Nguồn nghiệp vụ: Use case 1.10 trong [USE-CASE.md](../USE-CASE.md).

```mermaid
sequenceDiagram
    actor A as Admin
    box LỚP FRONTEND
        participant UI as Màn hình yêu cầu đăng ký
        participant H as App registration actions
        participant API as Shared API Client
    end
    box LỚP BACKEND
        participant C as Registration Controller
        participant S as Registration Service
    end
    box LỚP DỮ LIỆU
        participant DB as SQLite qua Prisma
        participant FS as Private File Storage
    end

    A->>UI: Mở danh sách chờ duyệt
    UI->>H: loadPendingRequests()
    H->>API: listRegistrationRequests(PENDING)
    API->>C: GET /api/v1/registration-requests?status=PENDING
    C->>S: listPending(page, pageSize)
    S->>DB: SELECT REGISTRATION_REQUEST WHERE status=PENDING
    DB-->>S: Danh sách phân trang
    S-->>C: RegistrationRequest DTOs
    C-->>API: 200 + data + meta
    API-->>H: Danh sách hồ sơ
    H-->>UI: Render danh sách

    A->>UI: Chọn APPROVED hoặc REJECTED
    UI->>H: decide(id, decision, reason)
    H->>API: updateRegistrationDecision(...)
    API->>C: PATCH /api/v1/registration-requests/{requestId}
    C->>C: Xác thực ADMIN và validate decision
    C->>S: decide(requestId, expectedStatus=PENDING, decision)
    S->>DB: Đọc request, file metadata và trạng thái hiện tại

    alt Hồ sơ không còn PENDING
        DB-->>S: Trạng thái hiện tại
        S-->>C: REGISTRATION_ALREADY_REVIEWED
        C-->>API: 409 + error
    else Từ chối
        S->>DB: Conditional UPDATE request thành REJECTED
        DB-->>S: Hồ sơ đã cập nhật
        S-->>C: Kết quả từ chối
        C-->>API: 200 + RegistrationRequest DTO
    else Phê duyệt
        S->>FS: Kiểm tra mọi FILE_ASSET còn khả dụng
        alt Có file bị thiếu hoặc không còn ACTIVE
            FS-->>S: File không khả dụng
            S-->>C: REGISTRATION_FILE_UNAVAILABLE
            C-->>API: 409 + error
        else File hợp lệ
            FS-->>S: Tất cả file khả dụng
            S->>DB: Transaction duyệt hồ sơ và tạo ACCOUNT
            DB-->>S: accountId và hồ sơ đã duyệt
            S-->>C: Kết quả phê duyệt
            C-->>API: 200 + RegistrationRequest DTO
        end
    end

    API-->>H: Kết quả hoặc lỗi chuẩn hóa
    H-->>UI: Làm mới danh sách chờ duyệt
    UI-->>A: Hiển thị trạng thái mới
```

## Chú thích

- Body quyết định là `{decision: APPROVED|REJECTED, expectedStatus: PENDING, rejectionReason?}`; `rejectionReason` không bắt buộc theo use case hiện tại.
- Nhánh từ chối cập nhật có điều kiện `status = PENDING`, ghi `status=REJECTED`, `reviewedById`, `reviewedAt`, `rejectionReason` và đặt `passwordHash=NULL`.
- Nhánh phê duyệt kiểm tra file trước, sau đó trong một transaction: tạo `ACCOUNT(role=CTV, status=ACTIVE, version=1, mustChangePassword=false, ctvCode, joinedAt)`, tạo `ACCOUNT_FILE` từ các file đang gắn, đặt `FILE_ASSET.state=ACTIVE`, cập nhật `approvedAccountId`, `reviewedById`, `reviewedAt`, `status=APPROVED` và `passwordHash=NULL`.
- Service dùng conditional update với `expectedStatus=PENDING`; hai Admin xử lý cùng hồ sơ thì chỉ một yêu cầu thành công. Xung đột `ACCOUNT.email` cũng trả `409`.
- Thông báo thành công/thất bại là kết quả HTTP và toast tạm thời ở Frontend, không ghi bảng `NOTIFICATION`.
- API không trả `passwordHash` hoặc đường dẫn vật lý của file.
