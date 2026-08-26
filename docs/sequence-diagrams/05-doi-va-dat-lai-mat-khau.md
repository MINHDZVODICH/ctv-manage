# Sequence diagram - Đổi và đặt lại mật khẩu

Nguồn nghiệp vụ: Use case 1.9 trong [USE-CASE.md](../USE-CASE.md).

## Người dùng tự đổi mật khẩu

```mermaid
sequenceDiagram
    actor U as Người dùng
    box LỚP FRONTEND
        participant UI as Hộp thoại đổi mật khẩu
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

    U->>UI: Nhập mật khẩu hiện tại và mật khẩu mới
    UI->>H: changeMyPassword(form)
    H->>H: Kiểm tra confirmPassword và chính sách mật khẩu
    H->>API: changeMyPassword(payload)
    API->>C: POST /api/v1/users/me/password-changes
    C->>S: changePassword(accountId, sessionId, currentPassword, newPassword)
    S->>DB: SELECT ACCOUNT.passwordHash theo accountId
    DB-->>S: passwordHash

    alt Mật khẩu hiện tại không đúng
        S-->>C: CURRENT_PASSWORD_INVALID
        C-->>API: 400 + error
        API-->>H: Lỗi chuẩn hóa
        H-->>UI: Hiển thị lỗi
    else Hợp lệ
        S->>S: Hash mật khẩu mới
        S->>DB: Transaction cập nhật ACCOUNT và revoke session khác
        DB-->>S: Đã cập nhật
        S-->>C: Thành công
        C-->>API: 200 + changedAt
        API-->>H: Kết quả đổi mật khẩu
        H-->>UI: Đóng hộp thoại
        UI-->>U: Thông báo đổi mật khẩu thành công
    end
```

## Admin đặt lại mật khẩu

```mermaid
sequenceDiagram
    actor A as Admin
    box LỚP FRONTEND
        participant UI as Hộp thoại đặt lại mật khẩu
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

    A->>UI: Nhập và xác nhận mật khẩu mới
    UI->>H: resetAccountPassword(accountId, form)
    H->>API: resetAccountPassword(accountId, payload)
    API->>C: POST /api/v1/accounts/{accountId}/password-resets
    C->>C: Xác thực ADMIN và validate mật khẩu mới
    C->>S: resetPassword(accountId, newPassword, mustChangePassword)
    S->>DB: SELECT ACCOUNT WHERE id và deletedAt IS NULL

    alt Không có tài khoản hoặc không được phép
        DB-->>S: Không hợp lệ
        S-->>C: Lỗi nghiệp vụ
        C-->>API: 403 hoặc 404 + error
        API-->>H: Lỗi chuẩn hóa
        H-->>UI: Hiển thị lỗi
    else Hợp lệ
        S->>S: Hash mật khẩu mới
        S->>DB: Transaction cập nhật ACCOUNT và revoke mọi SESSION
        DB-->>S: Đã cập nhật
        S-->>C: resetAt và sessionsRevoked
        C-->>API: 200 + metadata, không có mật khẩu
        API-->>H: Kết quả đặt lại
        H-->>UI: Đóng hộp thoại và làm mới chi tiết
        UI-->>A: Thông báo thành công
    end
```

## Chú thích

- `confirmPassword` chỉ dùng ở Frontend và không gửi lên API.
- Body tự đổi là `{currentPassword, newPassword}`; body Admin đặt lại là `{newPassword, mustChangePassword}`.
- Cả hai endpoint chỉ nhận mật khẩu mới qua HTTPS, hash ngay trong Service và không ghi mật khẩu vào log.
- Tự đổi mật khẩu cập nhật `passwordHash`, `passwordChangedAt`, `mustChangePassword=false`, tăng `ACCOUNT.version` và đặt `SESSION.revokedAt` cho mọi phiên khác phiên hiện tại.
- Admin đặt lại mật khẩu cập nhật cùng các trường trên theo cờ `mustChangePassword` trong request và thu hồi mọi session của tài khoản đích, kể cả phiên hiện tại.
- Response đặt lại mật khẩu không bao giờ trả mật khẩu rõ; Admin phải truyền giá trị đã thống nhất qua kênh phù hợp.
