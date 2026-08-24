# Sequence diagram - Duyệt hồ sơ

Nguồn nghiệp vụ: Use case 1.10 trong [USE-CASE.md](../USE-CASE.md).

```mermaid
sequenceDiagram
    actor A as Admin
    box LỚP FRONTEND
        participant UI as Màn hình yêu cầu đăng ký
        participant H as Registration Feature Hook
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
    S->>DB: Truy vấn hồ sơ PENDING
    DB-->>S: Danh sách phân trang
    S-->>C: RegistrationRequest DTOs
    C-->>API: 200 + data + meta
    API-->>H: Danh sách hồ sơ
    H-->>UI: Render danh sách

    A->>UI: Chọn APPROVED hoặc REJECTED
    UI->>H: decide(id, decision, reason)
    H->>API: updateRegistrationDecision(...)
    API->>C: PATCH /api/v1/registration-requests/{requestId}
    C->>S: decide(requestId, expectedStatus=PENDING, decision)
    S->>DB: Transaction khóa logic và đọc hồ sơ

    alt Hồ sơ không còn PENDING
        DB-->>S: Trạng thái hiện tại
        S-->>C: REGISTRATION_ALREADY_REVIEWED
        C-->>API: 409 + error
    else Từ chối
        S->>DB: Cập nhật REJECTED, lý do, reviewer và audit log
        DB-->>S: Hồ sơ đã cập nhật
        S-->>C: Kết quả từ chối
        C-->>API: 200 + RegistrationRequest DTO
    else Phê duyệt
        S->>DB: Tạo account từ hồ sơ và passwordHash
        S->>DB: Liên kết file, xóa passwordHash khỏi request
        S->>DB: Cập nhật APPROVED, notification và audit log
        DB-->>S: accountId và hồ sơ đã duyệt
        S->>FS: Kiểm tra file đính kèm còn khả dụng
        S-->>C: Kết quả phê duyệt
        C-->>API: 200 + RegistrationRequest DTO
    end

    API-->>H: Kết quả hoặc lỗi chuẩn hóa
    H-->>UI: Làm mới danh sách chờ duyệt
    UI-->>A: Hiển thị trạng thái mới
```

## Chú thích

- Toàn bộ cập nhật khi phê duyệt nằm trong một transaction để không tạo tài khoản nửa chừng.
- Service kiểm tra `expectedStatus=PENDING`; hai Admin xử lý cùng hồ sơ thì chỉ một yêu cầu thành công.
- API không trả `passwordHash`, đường dẫn vật lý của file hoặc dữ liệu nhạy cảm trong audit log.
