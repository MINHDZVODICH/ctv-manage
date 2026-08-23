# Sequence diagram - Đăng nhập

```mermaid
sequenceDiagram
    title ĐĂNG NHẬP

    actor U as Người dùng

    box LỚP FRONTEND
        participant UI as Trang đăng nhập
        participant API as API Client
    end

    box LỚP BACKEND
        participant C as Auth Controller
        participant S as Auth Service
    end

    box LỚP DỮ LIỆU
        participant DB as Database
    end

    U->>UI: Nhập email, mật khẩu và chọn Đăng nhập
    UI->>UI: Kiểm tra trường bắt buộc

    alt Dữ liệu không hợp lệ
        UI-->>U: Hiển thị lỗi nhập liệu
    else Dữ liệu hợp lệ
        UI->>UI: Hiển thị trạng thái Đang xử lý
        UI->>API: Gửi thông tin đăng nhập
        API->>C: POST /api/v1/auth/sessions
        activate C
        C->>S: Xác thực tài khoản
        activate S
        S->>DB: Tìm tài khoản theo email
        activate DB
        DB-->>S: Thông tin tài khoản
        deactivate DB

        alt Không tìm thấy hoặc sai mật khẩu
            S-->>C: Xác thực thất bại
            C-->>API: 401 Unauthorized
            API-->>UI: Thông tin đăng nhập không hợp lệ
            UI-->>U: Hiển thị thông báo lỗi
        else Tài khoản bị vô hiệu hóa
            S-->>C: Tài khoản không được phép truy cập
            C-->>API: 403 Forbidden
            API-->>UI: Tài khoản bị vô hiệu hóa
            UI-->>U: Hiển thị thông báo
        else Xác thực thành công
            S->>DB: Ghi nhận lần đăng nhập
            DB-->>S: Đã cập nhật
            S-->>C: Phiên đăng nhập và thông tin vai trò
            C-->>API: 200 OK
            API-->>UI: Kết quả đăng nhập
            UI-->>U: Mở giao diện theo vai trò
        end

        deactivate S
        deactivate C
    end
```

## Làm rõ các mũi tên còn mơ hồ

- **`Auth Controller → Auth Service — Xác thực tài khoản`:** Express + Zod chuyển request thành `AuthenticateCommand { email, password, ip, userAgent, requestId }`; Service chuẩn hóa email, kiểm tra trạng thái và dùng `argon2.verify` để đối chiếu hash Argon2id.
- **`Database → Auth Service — Thông tin tài khoản`:** Prisma chỉ trả `{ id, passwordHash, role, status }` hoặc `null`; `passwordHash` chỉ tồn tại trong Backend và không đưa vào response.
- **`Auth Service → Database — Ghi nhận lần đăng nhập`:** Prisma transaction cập nhật `lastLoginAt` và tạo server-side session `{ idHash, accountId, expiresAt, createdAt }`; session ID được xoay để chống session fixation.
- **`Auth Service → Auth Controller — Phiên đăng nhập và thông tin vai trò`:** Service trả `{ sessionToken, expiresAt, user:{ id, displayName, role } }`; Controller tách `sessionToken` để đặt secure cookie, không cho vào JSON.
- **`API Client → Trang đăng nhập — Kết quả đăng nhập`:** response JSON có `{ data:{ user:{ id, displayName, role }, expiresAt } }`; `fetch` dùng `credentials:'include'`, còn TanStack Query chỉ cache DTO user.
