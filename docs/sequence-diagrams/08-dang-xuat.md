# Sequence diagram - Đăng xuất

Nguồn nghiệp vụ: Use case 1.2 trong [USE-CASE.md](../USE-CASE.md).

```mermaid
sequenceDiagram
    actor U as Người dùng
    box LỚP FRONTEND
        participant UI as App Shell
        participant H as AuthContext
        participant API as Shared API Client
    end
    box LỚP BACKEND
        participant C as Auth Controller
        participant S as Auth Service
    end
    box LỚP DỮ LIỆU
        participant DB as PostgreSQL qua Prisma
    end

    U->>UI: Chọn Đăng xuất
    UI->>H: logout()
    H->>API: deleteCurrentSession()
    API->>C: DELETE /api/v1/auth/sessions/current
    C->>S: revokeCurrentSession(cookieToken)
    S->>S: Hash token bằng cùng thuật toán khi đăng nhập
    S->>DB: UPDATE SESSION.revokedAt theo tokenHash
    DB-->>S: affectedCount, có thể bằng 0
    S-->>C: Thành công
    C-->>API: 204 + xóa cookie ctv_session
    API-->>H: Thành công
    H->>H: Xóa user state và dữ liệu nhạy cảm
    H-->>UI: Chuyển về trạng thái chưa đăng nhập
    UI-->>U: Hiển thị trang đăng nhập
```

## Chú thích

- Endpoint đăng xuất có tính idempotent; session không còn tồn tại vẫn trả `204`.
- Database giữ bản ghi session và đặt `revokedAt`; tác vụ dọn dẹp có thể xóa các session đã thu hồi hoặc hết hạn sau này.
- Controller luôn gửi cookie `ctv_session` hết hạn về client, kể cả khi token không có hoặc không còn khớp bản ghi nào.
- App Shell chỉ điều hướng sau khi `AuthContext` đã xóa trạng thái người dùng cục bộ.
