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
    API->>C: POST /api/v1/auth/sessions
    C->>C: Parse và validate request
    C->>S: authenticate(email, password)
    S->>DB: Tìm tài khoản theo email
    DB-->>S: Tài khoản và passwordHash

    alt Sai thông tin hoặc tài khoản không hoạt động
        S-->>C: INVALID_CREDENTIALS hoặc ACCOUNT_DISABLED
        C-->>API: 401 hoặc 403 + error
        API-->>H: Ném lỗi chuẩn hóa
        H-->>UI: Hiển thị thông báo
    else Xác thực thành công
        S->>S: So khớp mật khẩu và tạo session token
        S->>DB: Lưu hash token, userId, expiresAt
        DB-->>S: Session đã tạo
        S-->>C: User DTO và thời hạn session
        C-->>API: 201 + Set-Cookie ctv_session
        API-->>H: User DTO
        H-->>UI: Cập nhật trạng thái đăng nhập
        UI-->>U: Điều hướng theo vai trò
    end
```

## Chú thích

- Cookie phiên là `HttpOnly`, `Secure`, `SameSite=Lax`; Frontend không đọc token.
- Thông báo sai email và sai mật khẩu dùng cùng một lỗi để tránh tiết lộ tài khoản tồn tại.
