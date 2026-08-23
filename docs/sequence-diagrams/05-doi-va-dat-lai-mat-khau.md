# Sequence diagram - Đổi và đặt lại mật khẩu

## Người dùng tự đổi mật khẩu

```mermaid
sequenceDiagram
    title ĐỔI MẬT KHẨU

    actor U as Người dùng

    box LỚP FRONTEND
        participant UI as Hộp thoại đổi mật khẩu
        participant API as API Client
    end

    box LỚP BACKEND
        participant C as Account Controller
        participant S as Account Service
    end

    box LỚP DỮ LIỆU
        participant DB as Database
    end

    U->>UI: Nhập mật khẩu hiện tại và mật khẩu mới
    UI->>UI: Kiểm tra độ dài và xác nhận mật khẩu

    alt Dữ liệu không hợp lệ
        UI-->>U: Hiển thị lỗi tại trường tương ứng
    else Dữ liệu hợp lệ
        UI->>API: Gửi yêu cầu đổi mật khẩu
        API->>C: PUT /api/v1/users/me/password
        activate C
        C->>S: Đổi mật khẩu người dùng hiện tại
        activate S
        S->>DB: Đọc thông tin xác thực của tài khoản
        DB-->>S: Mật khẩu đã mã hóa

        alt Mật khẩu hiện tại không đúng
            S-->>C: Xác thực thất bại
            C-->>API: 400 Bad Request
            API-->>UI: Mật khẩu hiện tại không đúng
            UI-->>U: Hiển thị lỗi
        else Mật khẩu hợp lệ
            S->>S: Mã hóa mật khẩu mới
            S->>DB: Cập nhật mật khẩu và thu hồi phiên cũ
            DB-->>S: Đã cập nhật
            S-->>C: Đổi mật khẩu thành công
            C-->>API: 200 OK
            API-->>UI: Kết quả thành công
            UI-->>U: Đóng hộp thoại và hiển thị thông báo
        end

        deactivate S
        deactivate C
    end
```

### Làm rõ các mũi tên còn mơ hồ - Người dùng đổi mật khẩu

- **`Hộp thoại đổi mật khẩu → API Client — Gửi yêu cầu đổi mật khẩu`:** TanStack Query gửi JSON `{ currentPassword, newPassword }`; `confirmPassword` chỉ dùng cho Zod validation tại Frontend và không cần gửi.
- **`Database → Account Service — Mật khẩu đã mã hóa`:** Prisma chỉ lấy `{ id, passwordHash, status, passwordChangedAt }`; `passwordHash` là chuỗi PHC Argon2id và không rời Backend.
- **`Account Service → Account Service — Mã hóa mật khẩu mới`:** `argon2.hash(newPassword,{ type:argon2id })` sinh salt ngẫu nhiên; password rõ không được ghi log.
- **`Account Service → Database — Cập nhật mật khẩu và thu hồi phiên cũ`:** Prisma transaction update `{ passwordHash, passwordChangedAt }` và revoke các session cũ của account.
- **`Account Service → Account Controller — Đổi mật khẩu thành công`:** Service trả `{ changedAt, revokedSessionCount }`; response không chứa password, hash hoặc session ID.
## Admin đặt lại mật khẩu cho CTV

```mermaid
sequenceDiagram
    title ADMIN ĐẶT LẠI MẬT KHẨU CTV

    actor A as Quản trị viên

    box LỚP FRONTEND
        participant UI as Hộp thoại đặt lại mật khẩu
        participant API as API Client
    end

    box LỚP BACKEND
        participant C as Account Controller
        participant S as Account Service
    end

    box LỚP DỮ LIỆU
        participant DB as Database
    end

    A->>UI: Nhập mật khẩu mặc định mới và chọn Xác nhận
    UI->>UI: Kiểm tra mật khẩu có nội dung

    alt Dữ liệu không hợp lệ
        UI-->>A: Hiển thị lỗi
    else Dữ liệu hợp lệ
        UI->>API: Gửi yêu cầu đặt lại mật khẩu
        API->>C: PUT /api/v1/accounts/{accountId}/password
        activate C
        C->>S: Đặt lại mật khẩu CTV
        activate S
        S->>S: Kiểm tra quyền Admin và mã hóa mật khẩu
        S->>DB: Khóa và kiểm tra tài khoản đích
        DB-->>S: Trạng thái tài khoản

        alt Không tìm thấy tài khoản CTV
            S-->>C: Không thể đặt lại mật khẩu
            C-->>API: 404 Not Found
            API-->>UI: Tài khoản không tồn tại
            UI-->>A: Hiển thị thông báo lỗi
        else Tài khoản hợp lệ
            S->>DB: Cập nhật mật khẩu
            S->>DB: Đánh dấu phải đổi mật khẩu khi đăng nhập
            S->>DB: Ghi nhật ký thao tác
            DB-->>S: Hoàn tất giao dịch
            S-->>C: Đặt lại mật khẩu thành công
            C-->>API: 200 OK
            API-->>UI: Mật khẩu mặc định mới
            UI-->>A: Đóng hộp thoại và hiển thị kết quả
        end

        deactivate S
        deactivate C
    end
```

### Làm rõ các mũi tên còn mơ hồ - Admin đặt lại mật khẩu

- **`Hộp thoại đặt lại mật khẩu → API Client — Gửi yêu cầu đặt lại mật khẩu`:** TanStack Query gửi `PUT /accounts/{accountId}/password` với JSON `{ newPassword }`, cookie Admin và CSRF token.
- **`Account Service → Account Service — Kiểm tra quyền Admin và mã hóa mật khẩu`:** authorization policy kiểm tra role `ADMIN`; `argon2.hash` chỉ chạy sau khi target account và password policy hợp lệ.
- **`Account Service → Database — Khóa và kiểm tra tài khoản đích`:** Prisma transaction đọc/update có điều kiện `{ id:accountId, role:'CTV' }` và lấy `{ id, status, role, version }`.
- **`Account Service → Database — Đánh dấu phải đổi mật khẩu khi đăng nhập`:** cùng transaction đặt `mustChangePassword:true` và middleware bắt buộc CTV đổi mật khẩu trước khi dùng nghiệp vụ khác.
- **`Account Service → Database — Ghi nhật ký thao tác`:** audit lưu `{ action:'ADMIN_PASSWORD_RESET', actorId, targetAccountId, createdAt, requestId }`, không lưu password/hash.
- **`Database → Account Service — Hoàn tất giao dịch`:** SQLite commit update hash, cờ bắt buộc đổi, revoke session và audit như một đơn vị; trả `{ accountId, changedAt, revokedSessionCount }`.
- **`API Client → Hộp thoại đặt lại mật khẩu — Mật khẩu mặc định mới`:** nhãn này chỉ là xác nhận thành công; response thực tế là `{ data:{ accountId, mustChangePassword:true, changedAt } }`, không echo mật khẩu rõ.
