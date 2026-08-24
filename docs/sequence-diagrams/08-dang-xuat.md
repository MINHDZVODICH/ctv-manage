# Sequence diagram - Đăng xuất

Nguồn nghiệp vụ: Use case 1.2 trong [USE-CASE.md](../USE-CASE.md).

```mermaid
sequenceDiagram
    actor U as Người dùng
    box LỚP FRONTEND
        participant UI as App Shell
        participant H as Auth Feature Hook
        participant API as Shared API Client
    end
    box LỚP BACKEND
        participant C as Auth Controller
        participant S as Auth Service
    end
    box LỚP DỮ LIỆU
        participant DB as SQLite qua Prisma
    end

    U->>UI: Chọn Đăng xuất
    UI->>H: logout()
    H->>API: deleteCurrentSession()
    API->>C: DELETE /api/v1/auth/sessions/current
    C->>S: revokeCurrentSession(sessionToken)
    S->>DB: Xóa hoặc thu hồi session theo token hash
    DB-->>S: Hoàn tất kể cả khi session đã hết hạn
    S-->>C: Thành công
    C-->>API: 204 + xóa cookie ctv_session
    API-->>H: Thành công
    H->>H: Xóa user state và dữ liệu nhạy cảm
    H-->>UI: Chuyển về trạng thái chưa đăng nhập
    UI-->>U: Hiển thị trang đăng nhập
```

## Chú thích

- Endpoint đăng xuất có tính idempotent; session không còn tồn tại vẫn trả `204`.
- App Shell chỉ điều hướng sau khi Auth Feature Hook đã xóa trạng thái người dùng cục bộ.
