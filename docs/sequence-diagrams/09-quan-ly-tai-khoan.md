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
    S->>DB: Truy vấn tài khoản chưa soft delete
    DB-->>S: Rows và total
    S-->>C: AccountRow DTOs
    C-->>API: 200 + data + meta
    API-->>H: Danh sách phân trang
    H-->>UI: Render bảng

    alt Admin kích hoạt hoặc vô hiệu hóa
        A->>UI: Xác nhận trạng thái đích
        UI->>H: changeStatus(accountId, status, version)
        H->>API: updateAccountStatus(...)
        API->>C: PATCH /api/v1/accounts/{accountId}/status
        C->>S: changeStatus(accountId, status, version)
        S->>DB: Transaction kiểm tra version và cập nhật trạng thái
        opt Chuyển sang DISABLED
            S->>DB: Thu hồi session và hủy assignment tương lai
        end
        S->>DB: Ghi audit log
        DB-->>S: Account DTO mới
        S-->>C: Kết quả
        C-->>API: 200 + data
    else Admin xóa tài khoản
        A->>UI: Xác nhận xóa
        UI->>H: deleteAccount(accountId)
        H->>API: deleteAccount(accountId)
        API->>C: DELETE /api/v1/accounts/{accountId}
        C->>S: softDelete(accountId)
        S->>DB: Transaction đặt deletedAt, revoke session và giữ lịch sử
        S->>DB: Ghi audit log
        DB-->>S: Hoàn tất
        S-->>C: Thành công
        C-->>API: 204 No Content
    end

    API-->>H: Kết quả hoặc lỗi chuẩn hóa
    H->>API: listAccounts(currentFilters)
    API->>C: GET /api/v1/accounts
    C->>S: listAccounts(currentFilters)
    S->>DB: Đọc trang hiện tại
    DB-->>S: Rows và total mới
    S-->>C: AccountRow DTOs
    C-->>API: 200 + data + meta
    API-->>H: Danh sách mới
    H-->>UI: Cập nhật bảng và tổng số
```

## Chú thích

- Frontend giữ nguyên từ khóa, bộ lọc và trang khi làm mới danh sách; query thực tế chỉ gửi các tham số có giá trị.
- Xóa là soft delete idempotent để giữ lịch sử lịch làm việc và audit.
- Nếu `version` không còn khớp, API trả `409 VERSION_CONFLICT`; UI phải tải lại dòng dữ liệu.
