# Sequence diagram - Đăng ký

## CTV gửi yêu cầu đăng ký

```mermaid
sequenceDiagram
    title ĐĂNG KÝ TÀI KHOẢN CTV

    actor U as Người đăng ký

    box LỚP FRONTEND
        participant UI as Trang đăng ký
        participant API as API Client
    end

    box LỚP BACKEND
        participant C as Registration Controller
        participant S as Registration Service
    end

    box LỚP DỮ LIỆU
        participant DB as Database
        participant FS as Kho tệp
    end

    U->>UI: Nhập thông tin và chọn tệp CCCD/CV
    UI->>UI: Kiểm tra dữ liệu, định dạng và dung lượng tệp

    alt Dữ liệu không hợp lệ
        UI-->>U: Hiển thị lỗi tại trường tương ứng
    else Dữ liệu hợp lệ
        UI->>API: Gửi yêu cầu đăng ký
        API->>C: POST /api/v1/registration-requests
        activate C
        C->>S: Tạo yêu cầu đăng ký
        activate S
        S->>DB: Kiểm tra email đã tồn tại
        DB-->>S: Kết quả kiểm tra

        alt Email đã được sử dụng
            S-->>C: Từ chối yêu cầu
            C-->>API: 409 Conflict
            API-->>UI: Email đã tồn tại
            UI-->>U: Hiển thị thông báo lỗi
        else Có thể đăng ký
            opt Có tệp CCCD hoặc CV
                S->>FS: Lưu tệp hồ sơ
                FS-->>S: Mã tham chiếu tệp
            end
            S->>DB: Lưu yêu cầu ở trạng thái Chờ duyệt
            DB-->>S: Mã yêu cầu
            S-->>C: Tạo yêu cầu thành công
            C-->>API: 201 Created
            API-->>UI: Yêu cầu đang chờ duyệt
            UI-->>U: Hiển thị thông báo và quay về Đăng nhập
        end

        deactivate S
        deactivate C
    end
```

## Làm rõ các mũi tên còn mơ hồ

- **`Trang đăng ký → API Client — Gửi yêu cầu đăng ký`:** TanStack Query tạo `FormData`; key `profile` chứa JSON `{ fullName, email, phone, dateOfBirth, address }`, còn `cccdFiles[]`/`cvFile` chứa binary và request có `Idempotency-Key`.
- **`Registration Controller → Registration Service — Tạo yêu cầu đăng ký`:** Express + Zod tạo `CreateRegistrationCommand { fullName, email, phone, dateOfBirth, address, files, idempotencyKey, requestId }` rồi gọi Service bằng hàm TypeScript nội bộ.
- **`Registration Service → Kho tệp — Lưu tệp hồ sơ`:** Multer nhận multipart; adapter dùng `file-type` kiểm tra magic bytes, sinh UUID làm tên và ghi stream vào private filesystem.
- **`Kho tệp → Registration Service — Mã tham chiếu tệp`:** adapter trả `{ fileId, storageKey, originalName, mimeType, size, sha256 }`; `storageKey` là đường dẫn tương đối và không trả ra Frontend.
- **`Registration Service → Database — Lưu yêu cầu ở trạng thái Chờ duyệt`:** Prisma transaction tạo yêu cầu `{ id, profileFields, status:'PENDING', createdAt }` cùng metadata các tệp `{ fileId, category, storageKey, mimeType, size, sha256 }`.
- **`Registration Service → Registration Controller — Tạo yêu cầu thành công`:** Service trả DTO tối thiểu `{ id, status:'PENDING', submittedAt }`, loại bỏ `storageKey`, hash tệp và model Prisma.
