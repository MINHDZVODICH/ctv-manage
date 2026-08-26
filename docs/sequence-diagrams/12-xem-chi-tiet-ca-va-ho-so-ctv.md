# Sequence diagram - Xem chi tiết ca và hồ sơ CTV

Nguồn nghiệp vụ: Use case 2.5 trong [USE-CASE.md](../USE-CASE.md).

```mermaid
sequenceDiagram
    actor A as Admin
    box LỚP FRONTEND
        participant UI as SummaryScheduleScreen + ViewAccountDetailModal
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
    UI->>UI: Mở chi tiết từ ctvList trong cell tổng hợp đã tải

    A->>UI: Chọn một CTV
    UI->>UI: Ghép accountId với danh sách ACCOUNT trong App state
    UI->>API: GET /api/v1/schedule-summary?from={monday}&to={friday}&accountId={id}
    API->>SC: Xác thực ADMIN + parse query
    SC->>S: getScheduleSummary({from,to,accountId})
    S->>DB: Đọc ACTIVE assignment của đúng CTV trong tuần
    DB-->>S: Cells lịch tuần
    S-->>SC: {cells}
    SC-->>API: 200 + data
    API-->>UI: Mở hồ sơ với lịch tuần mới nhất

    opt Admin chọn Lịch sử làm việc
        UI->>API: GET /api/v1/work-history?month={month}&accountId={id}
        API->>SC: Xác thực ADMIN + parse query
        SC->>S: getWorkHistory({month,accountId})
        S->>DB: Đọc WORK_HISTORY của đúng CTV
        DB-->>S: Cells lịch sử
        S-->>SC: {cells}
        SC-->>API: 200 + data
        API-->>UI: Render lịch sử tháng
    end

    alt Admin lưu ghi chú
        A->>UI: Nhập ghi chú và chọn Lưu
        UI->>API: GET /api/v1/accounts/{accountId}
        API->>AC: Lấy version mới nhất
        AC->>S: getAccountForAdmin(accountId)
        S->>DB: Đọc ACCOUNT
        DB-->>S: Account detail
        UI->>API: PATCH notes với expectedVersion
        API->>AC: PATCH /api/v1/accounts/{accountId}/notes
        AC->>S: updateNotes(accountId, adminNotes, expectedVersion)
        S->>DB: Conditional UPDATE adminNotes và tăng version
        DB-->>S: Notes DTO
        S-->>AC: Kết quả
        AC-->>API: 200 + data
        API-->>UI: Hiển thị Đã lưu
    else Admin xem hoặc tải CV
        A->>UI: Chọn Xem/Tải CV
        UI->>API: Mở fileUrl(fileId)
        API->>FC: GET /api/v1/files/{fileId}/content
        FC->>S: authorizeFile(adminId, fileId)
        S->>DB: Đọc active ACCOUNT_FILE và FILE_ASSET
        DB-->>S: storageKey và media metadata
        S->>FS: Mở stream
        FS-->>S: File stream
        S-->>FC: Stream
        FC-->>API: 200 + file content
        API-->>UI: Hiển thị hoặc tải nội dung file
    end
```

## Chú thích

- `SummaryScheduleScreen` không gọi lại `GET /shifts/{shiftId}` khi mở modal ca; danh sách CTV đã có trong cell từ API lịch tuần hoặc lịch sử. Endpoint chi tiết ca vẫn tồn tại cho luồng khác và vẫn kiểm tra quyền.
- Lịch tuần trong hồ sơ đọc `/schedule-summary` với `accountId`; lịch sử đọc `/work-history` với cùng `accountId`. Hai nguồn không dùng chung state.
- `AccountDetail DTO` có `version`; sau khi lưu ghi chú thành công, response trả version mới để Frontend cập nhật state.
- Body lưu ghi chú là `{adminNotes, expectedVersion}`. Update chỉ thành công khi account chưa bị soft delete và version khớp; nếu không, API trả `409 VERSION_CONFLICT`.
- Hồ sơ nhạy cảm chỉ được tải sau một request Admin riêng và kiểm tra quyền ở Backend.
- Khi đóng hồ sơ, Frontend trở lại lịch tổng hợp đã có trong state; chỉ tải lại khi người dùng yêu cầu hoặc dữ liệu đã stale.
