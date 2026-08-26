# Sequence diagram - Quản lý danh sách tài khoản

Nguồn nghiệp vụ: Use case 1.4, 1.5 và 1.6 trong [USE-CASE.md](../USE-CASE.md).

```mermaid
sequenceDiagram
    actor A as Admin
    box LỚP FRONTEND
        participant UI as Danh sách tài khoản
        participant H as Account Feature Hook
        participant API as Shared API Client
    end
    box LỚP BACKEND
        participant C as Account Controller
        participant S as Account Service
    end
    box LỚP DỮ LIỆU
        participant DB as SQLite qua Prisma
    end

    A->>UI: Mở danh sách hoặc thay đổi tìm kiếm/trang
    UI->>H: loadAccounts(q, status, page)
    H->>API: listAccounts(filters)
    API->>C: GET /api/v1/accounts?q={q}&status={status}&page={page}&pageSize=5
    C->>S: listAccounts(filters)
    S->>DB: SELECT ACCOUNT CTV theo filters và deletedAt IS NULL
    DB-->>S: Rows và total
    S-->>C: AccountRow DTOs
    C-->>API: 200 + data + meta
    API-->>H: Danh sách phân trang
    H-->>UI: Render bảng

    alt Admin kích hoạt hoặc vô hiệu hóa
        A->>UI: Xác nhận trạng thái đích
        UI->>H: changeStatus(accountId, status, expectedVersion)
        H->>API: updateAccountStatus(...)
        API->>C: PATCH /api/v1/accounts/{accountId}/status
        C->>S: changeStatus(accountId, status, expectedVersion)
        S->>DB: Conditional UPDATE ACCOUNT và tăng version
        opt Chuyển sang DISABLED
            S->>DB: Revoke session, cancel registration và assignment tương lai
        end
        DB-->>S: Account DTO mới
        S-->>C: Kết quả
        C-->>API: 200 + data
    else Admin xóa tài khoản
        A->>UI: Xác nhận xóa
        UI->>H: deleteAccount(accountId)
        H->>API: deleteAccount(accountId)
        API->>C: DELETE /api/v1/accounts/{accountId}
        C->>S: softDelete(accountId)
        S->>DB: Transaction soft delete ACCOUNT và vô hiệu truy cập
        DB-->>S: Hoàn tất
        S-->>C: Thành công
        C-->>API: 204 No Content
    end

    API-->>H: Kết quả hoặc lỗi chuẩn hóa
    H->>API: listAccounts(currentFilters)
    API->>C: GET /api/v1/accounts
    C->>S: listAccounts(currentFilters)
    S->>DB: SELECT ACCOUNT theo currentFilters và deletedAt IS NULL
    DB-->>S: Rows và total mới
    S-->>C: AccountRow DTOs
    C-->>API: 200 + data + meta
    API-->>H: Danh sách mới
    H-->>UI: Cập nhật bảng và tổng số
```

## Chú thích

- Frontend giữ nguyên từ khóa, bộ lọc và trang khi làm mới danh sách; query thực tế chỉ gửi các tham số có giá trị.
- Mỗi `AccountRow DTO` có `version`; Frontend gửi lại giá trị này dưới tên `expectedVersion` khi đổi trạng thái.
- Body đổi trạng thái là `{status: ACTIVE|DISABLED, expectedVersion}`. Update chỉ thành công khi `ACCOUNT.id`, `version` và `deletedAt IS NULL` khớp; sau đó `version` tăng một.
- Khi chuyển sang `DISABLED`, cùng transaction đặt `SESSION.revokedAt` cho các phiên còn hiệu lực, chuyển registration `ACTIVE` thành `CANCELLED` và chuyển assignment tương lai `ACTIVE` thành `CANCELLED` với thời điểm/lý do hủy.
- Xóa là soft delete idempotent: đặt `ACCOUNT.deletedAt`, `status=DISABLED`, tăng `version`, revoke session, cancel registration hiện hành và assignment tương lai. Account cùng assignment quá khứ vẫn được giữ để bảo toàn lịch sử.
- Nếu `expectedVersion` không còn khớp, API trả `409 VERSION_CONFLICT`; UI phải tải lại dòng dữ liệu.
