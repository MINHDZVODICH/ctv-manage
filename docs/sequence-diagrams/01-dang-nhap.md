# Sequence diagram - Đăng nhập

Nguồn nghiệp vụ: Use case 1.1 trong [USE-CASE.md](../USE-CASE.md).

```mermaid
sequenceDiagram
    actor U as Người dùng
    box LỚP FRONTEND
        participant UI as Trang đăng nhập
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

    U->>UI: Nhập email và mật khẩu
    UI->>H: submit(credentials)
    H->>H: Kiểm tra dữ liệu biểu mẫu
    H->>API: createSession(credentials)
    API->>C: POST /api/v1/auth/sessions {email, password}
    C->>C: Parse JSON và validate schema
    C->>S: authenticate(email, password)
    S->>DB: SELECT ACCOUNT theo email chuẩn hóa
    DB-->>S: Account hoặc null

    alt Sai thông tin hoặc tài khoản không hoạt động
        S-->>C: INVALID_CREDENTIALS hoặc ACCOUNT_DISABLED
        C-->>API: 401 hoặc 403 + error
        API-->>H: Ném lỗi chuẩn hóa
        H-->>UI: Hiển thị thông báo
    else Xác thực thành công
        S->>S: Verify Argon2id, sinh token ngẫu nhiên và tokenHash
        S->>DB: Transaction cập nhật login và tạo SESSION
        DB-->>S: Session {id, expiresAt}
        S-->>C: User DTO và thời hạn session
        C-->>API: 201 + Set-Cookie ctv_session
        API-->>H: User DTO
        H-->>UI: Cập nhật trạng thái đăng nhập
        UI-->>U: Điều hướng theo vai trò
    end
```

## Chú thích

- Cookie phiên là `HttpOnly`, `Secure`, `SameSite=Lax`; Frontend không đọc token.
- Truy vấn tài khoản dùng email đã chuẩn hóa và điều kiện `ACCOUNT.deletedAt IS NULL`; chỉ `ACCOUNT.status = ACTIVE` được đăng nhập.
- Transaction thành công cập nhật `ACCOUNT.lastLoginAt` và tạo `SESSION(accountId, tokenHash, expiresAt, ipAddress, userAgent)`. Database không lưu token gốc.
- Thông báo sai email và sai mật khẩu dùng cùng một lỗi để tránh tiết lộ tài khoản tồn tại.
