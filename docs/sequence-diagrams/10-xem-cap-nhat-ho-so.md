# Sequence diagram - Xem và cập nhật hồ sơ

Nguồn nghiệp vụ: Use case 1.7 và 1.8 trong [USE-CASE.md](../USE-CASE.md).

```mermaid
sequenceDiagram
    actor U as CTV hoặc Admin
    box LỚP FRONTEND
        participant UI as Màn hình hồ sơ
        participant H as Account Feature Hook
        participant API as Shared API Client
    end
    box LỚP BACKEND
        participant C as Account Controller
        participant S as Account Service
        participant FC as File Controller
    end
    box LỚP DỮ LIỆU
        participant DB as SQLite qua Prisma
        participant FS as Private File Storage
    end

    U->>UI: Mở hồ sơ
    alt CTV xem hồ sơ của mình
        UI->>H: loadMyProfile()
        H->>API: getMyProfile()
        API->>C: GET /api/v1/users/me
        C->>S: getProfile(currentUserId)
    else Admin xem một tài khoản
        UI->>H: loadAccount(accountId)
        H->>API: getAccount(accountId)
        API->>C: GET /api/v1/accounts/{accountId}
        C->>S: getAccountForAdmin(accountId)
    end
    S->>DB: Đọc profile, file metadata và lịch trình cần hiển thị
    DB-->>S: AccountDetail DTO
    S-->>C: Dữ liệu đã lọc theo quyền
    C-->>API: 200 + data
    API-->>H: Hồ sơ
    H-->>UI: Render thông tin và liên kết file

    opt Người dùng xem hoặc tải file
        U->>UI: Chọn Xem/Tải
        UI->>H: openFile(fileId)
        H->>API: getFileContent(fileId)
        API->>FC: GET /api/v1/files/{fileId}/content
        FC->>S: authorizeFile(currentActor, fileId)
        S->>DB: Kiểm tra owner và metadata
        DB-->>S: storageKey và media metadata
        S->>FS: Mở stream theo storageKey
        FS-->>S: File stream
        S-->>FC: Stream được ủy quyền
        FC-->>API: 200 + Content-Type/Disposition
        API-->>H: Blob
        H-->>UI: Hiển thị hoặc tải file
    end

    opt Cập nhật thông tin
        U->>UI: Sửa trường được phép và lưu
        UI->>H: saveProfile(payload)
        alt CTV cập nhật hồ sơ của mình
            H->>API: updateMyProfile(payload)
            API->>C: PATCH /api/v1/users/me
            C->>S: updateProfile(currentUserId, payload)
        else Admin cập nhật CTV
            H->>API: updateAccount(accountId, payload)
            API->>C: PATCH /api/v1/accounts/{accountId}
            C->>S: updateAccountForAdmin(accountId, payload)
        end
        S->>DB: Transaction cập nhật profile
        DB-->>S: Account DTO mới
        S-->>C: Kết quả
        C-->>API: 200 + data
        API-->>H: Hồ sơ mới
        H-->>UI: Cập nhật màn hình
    end
```

## Chú thích

- CTV cập nhật file qua `PUT /api/v1/users/me/files/{category}` hoặc `DELETE /api/v1/users/me/files/{category}`; Admin dùng endpoint tương ứng dưới `/accounts/{accountId}/files`. Sau đó hook tải lại hồ sơ.
- API chỉ trả `fileId` và metadata an toàn, không trả `storageKey` hay đường dẫn vật lý.
- Các trường được sửa phụ thuộc vai trò; Controller không tin vào việc ẩn/hiện trường ở Frontend.
