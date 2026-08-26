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
        C->>S: createRequest(profile, password, files)
        S->>S: Chuẩn hóa email, hash Argon2id và sinh các ID
        S->>FS: Ghi tệp vào vùng staging riêng tư
        FS-->>S: storageKey và metadata đã xác minh
        S->>DB: Transaction kiểm tra email và tạo request/file STAGED
        alt Email đã có account hoặc request PENDING
            DB-->>S: Unique conflict
            S->>FS: Xóa các tệp staging
            S-->>C: EMAIL_ALREADY_EXISTS
        else Đã ghi metadata
            S->>FS: Di chuyển nguyên tử sang storageKey chính thức
            alt Hoàn tất file thất bại
                S->>DB: Transaction bù và quarantine metadata
                S-->>C: FILE_STORAGE_FAILED
            else Hoàn tất
                S->>DB: Đặt FILE_ASSET.state = ACTIVE
                S-->>C: RegistrationRequest DTO
            end
        end
        C-->>API: 201 hoặc lỗi chuẩn hóa
        alt Đã tạo request
            API-->>H: requestId và status=PENDING
            H-->>UI: Xóa dữ liệu nhạy cảm khỏi biểu mẫu
            UI-->>U: Thông báo đã gửi hồ sơ
        else Tạo request thất bại
            API-->>H: Error DTO
            H-->>UI: Giữ form và hiển thị lỗi phù hợp
        end
    end
```

## Chú thích

- Request là `multipart/form-data`; phần profile gồm `email`, `displayName`, `phone`, `dateOfBirth`, `gender`, `address` và `password`. `confirmPassword` chỉ được kiểm tra ở Frontend.
- Transaction tạo `REGISTRATION_REQUEST(status=PENDING, passwordHash)`, `FILE_ASSET(state=STAGED)` và `REGISTRATION_REQUEST_FILE`. Unique index chỉ cho phép một request `PENDING` trên mỗi email; Service đồng thời kiểm tra `ACCOUNT.email`.
- Tệp không nằm trong thư mục public. API chỉ lưu đường dẫn tương đối và metadata trong SQLite.
- Transaction bù xóa liên kết và request chưa hoàn tất, đặt metadata file thành `QUARANTINED`, rồi cố gắng dọn staging. API không bao giờ trả một hồ sơ trỏ tới tệp chưa tồn tại.
