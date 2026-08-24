# Sequence diagram - Đăng ký

Nguồn nghiệp vụ: Use case 1.3 trong [USE-CASE.md](../USE-CASE.md).

```mermaid
sequenceDiagram
    actor U as Ứng viên CTV
    box LỚP FRONTEND
        participant UI as Trang đăng ký
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

    U->>UI: Nhập thông tin, mật khẩu và chọn tệp
    UI->>H: submitRegistration(form)
    H->>H: Kiểm tra trường bắt buộc và confirmPassword
    H->>API: createRegistrationRequest(FormData)
    API->>C: POST /api/v1/registration-requests
    C->>C: Parse multipart, giới hạn kích thước và magic bytes

    alt Payload hoặc tệp không hợp lệ
        C-->>API: 400, 413 hoặc 415 + error
        API-->>H: Lỗi chuẩn hóa
        H-->>UI: Hiển thị lỗi tại trường liên quan
    else Dữ liệu hợp lệ
        C->>S: createRequest(profile, password, files, idempotencyKey)
        S->>DB: Kiểm tra email và Idempotency-Key
        alt Yêu cầu đã được xử lý
            DB-->>S: Kết quả trước đó
            S-->>C: RegistrationRequest DTO
        else Yêu cầu mới
            S->>S: Hash mật khẩu ngay trong bộ nhớ
            S->>FS: Ghi tệp vào vùng staging
            FS-->>S: stagedPath và metadata
            S->>DB: Transaction tạo request và file metadata
            DB-->>S: requestId
            S->>FS: Chuyển tệp sang thư mục của request
            alt Hoàn tất file thất bại
                S->>DB: Đánh dấu file cần dọn dẹp/quarantine
                S-->>C: Lỗi lưu trữ
            else Hoàn tất
                S-->>C: RegistrationRequest DTO
            end
        end
        C-->>API: 201 hoặc kết quả idempotent
        API-->>H: Mã hồ sơ và trạng thái PENDING
        H-->>UI: Xóa dữ liệu nhạy cảm khỏi biểu mẫu
        UI-->>U: Thông báo đã gửi hồ sơ
    end
```

## Chú thích

- `profile` chứa thông tin cá nhân và `password`; `confirmPassword` chỉ được kiểm tra ở Frontend.
- Tệp không nằm trong thư mục public. API chỉ lưu đường dẫn tương đối và metadata trong SQLite.
- Nếu transaction hoặc bước hoàn tất file thất bại, Service phải dọn staging hoặc ghi nhận tác vụ dọn dẹp; không để hồ sơ trỏ tới tệp chưa tồn tại.
