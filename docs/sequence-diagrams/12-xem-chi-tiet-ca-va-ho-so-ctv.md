# Sequence diagram - Xem chi tiết ca và hồ sơ CTV

Nguồn nghiệp vụ: Use case 2.5 trong [USE-CASE.md](../USE-CASE.md).

```mermaid
sequenceDiagram
    actor A as Admin
    box LỚP FRONTEND
        participant UI as Lịch tổng hợp và hồ sơ CTV
        participant H as Schedule/Account Feature Hooks
        participant API as Shared API Client
    end
    box LỚP BACKEND
        participant SC as Schedule Controller
        participant AC as Account Controller
        participant S as Services
        participant FC as File Controller
    end
    box LỚP DỮ LIỆU
        participant DB as SQLite qua Prisma
        participant FS as Private File Storage
    end

    A->>UI: Chọn ca có dữ liệu
    UI->>H: loadShiftDetail(shiftId)
    H->>API: getShift(shiftId)
    API->>SC: GET /api/v1/shifts/{shiftId}
    SC->>S: getShiftForAdmin(shiftId)
    S->>DB: Join SHIFT, ACTIVE assignment và ACCOUNT
    DB-->>S: ShiftDetail DTO
    S-->>SC: Chi tiết ca
    SC-->>API: 200 + data
    API-->>H: Danh sách CTV trong ca
    H-->>UI: Mở chi tiết ca

    A->>UI: Chọn một CTV
    UI->>H: loadAccount(accountId)
    H->>API: getAccount(accountId)
    API->>AC: GET /api/v1/accounts/{accountId}
    AC->>S: getAccountForAdmin(accountId)
    S->>DB: Đọc ACCOUNT detail, active files và lịch trình
    DB-->>S: AccountDetail DTO
    S-->>AC: Dữ liệu đã lọc
    AC-->>API: 200 + data
    API-->>H: Hồ sơ CTV
    H-->>UI: Đóng chi tiết ca và mở hồ sơ

    alt Admin lưu ghi chú
        A->>UI: Nhập ghi chú và chọn Lưu
        UI->>H: saveNotes(accountId, notes, expectedVersion)
        H->>API: updateAccountNotes(accountId, payload)
        API->>AC: PATCH /api/v1/accounts/{accountId}/notes
        AC->>S: updateNotes(accountId, notes, expectedVersion)
        S->>DB: Conditional UPDATE adminNotes và tăng version
        DB-->>S: Notes DTO
        S-->>AC: Kết quả
        AC-->>API: 200 + data
        API-->>H: Ghi chú mới
        H-->>UI: Hiển thị Đã lưu
    else Admin xem hoặc tải CV
        A->>UI: Chọn Xem/Tải CV
        UI->>H: openFile(fileId)
        H->>API: getFileContent(fileId)
        API->>FC: GET /api/v1/files/{fileId}/content
        FC->>S: authorizeFile(adminId, fileId)
        S->>DB: Đọc active ACCOUNT_FILE và FILE_ASSET
        DB-->>S: storageKey và media metadata
        S->>FS: Mở stream
        FS-->>S: File stream
        S-->>FC: Stream
        FC-->>API: 200 + file content
        API-->>H: Blob
        H-->>UI: Hiển thị hoặc tải CV
    end
```

## Chú thích

- Endpoint chi tiết ca trả đủ dữ liệu cho danh sách trong ca nhưng không trả CCCD, CV hay ghi chú.
- Truy vấn chi tiết ca lọc theo `SHIFT.id` và chỉ lấy `SHIFT_ASSIGNMENT.status=ACTIVE`; mỗi dòng CTV lấy `roomCode` từ assignment.
- `AccountDetail DTO` có `version`; sau khi lưu ghi chú thành công, response trả version mới để Frontend cập nhật state.
- Body lưu ghi chú là `{notes, expectedVersion}`. Update chỉ thành công khi account chưa bị soft delete và version khớp; nếu không, API trả `409 VERSION_CONFLICT`.
- Hồ sơ nhạy cảm chỉ được tải sau một request Admin riêng và kiểm tra quyền ở Backend.
- Khi đóng hồ sơ, Frontend trở lại lịch tổng hợp đã có trong state; chỉ tải lại khi người dùng yêu cầu hoặc dữ liệu đã stale.
