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
        participant FC as File Controller
        participant S as Services (Schedule / Accounts / Files)
    end
    box LỚP DỮ LIỆU
        participant DB as PostgreSQL qua Prisma
        participant FS as Private File Storage
    end

    A->>UI: Bấm vào thẻ số lượng CTV của một ca
    UI->>UI: Mở modal Chi tiết ca từ danh sách shiftAssignments đã tải sẵn trong cell

    A->>UI: Bấm chọn một CTV từ danh sách
    UI->>UI: Mở modal "Hồ sơ & Lịch trình tài khoản"
    par Tải chi tiết tài khoản
        UI->>API: GET /api/v1/accounts/{accountId}
        API->>AC: Xác thực ADMIN
        AC->>S: getAccount(accountId)
        S->>DB: prisma.account.findFirst(id, deletedAt: null, include: accountFiles)
        DB-->>S: AccountDetail record
        S-->>AC: AccountDetail DTO (kèm version và files)
        AC-->>API: 200 + { data: AccountDetail DTO }
        API-->>UI: Hiển thị thông tin cá nhân và ghi chú quản trị
    and Tải mẫu lịch tuần của CTV
        UI->>API: GET /api/v1/accounts/{accountId}/schedule
        API->>AC: Xác thực ADMIN
        AC->>S: getAccountSchedule(accountId)
        S->>DB: prisma.schedule.findUnique(accountId, include: { shifts: true })
        DB-->>S: Schedule record kèm shifts hoặc null
        S-->>AC: Schedule DTO (id, accountId, roomCode, version, shifts)
        AC-->>API: 200 + { data: Schedule DTO }
        API-->>UI: Hiển thị lưới lịch tuần cá nhân của CTV
    end

    opt Admin xem Lịch sử làm việc của CTV này
        A->>UI: Chọn mục Lịch sử làm việc trong modal hồ sơ
        UI->>API: GET /api/v1/work-history?month={month}&accountId={accountId}
        API->>SC: Xác thực ADMIN + parse query schema
        SC->>S: getWorkHistory({ month, accountId })
        S->>DB: prisma.history.findMany(accountId, workDate trong tháng)
        DB-->>S: History rows của CTV
        S-->>SC: { month, entries, cells }
        SC-->>API: 200 + data
        API-->>UI: Render lưới lịch sử làm việc theo tháng của CTV
    end

    alt Admin lưu ghi chú quản trị
        A->>UI: Nhập nội dung ghi chú và nhấn Lưu
        UI->>API: PATCH /api/v1/accounts/{accountId}/notes { adminNotes, expectedVersion }
        API->>AC: Xác thực ADMIN + parse payload
        AC->>S: updateNotes(accountId, adminNotes, expectedVersion)
        S->>DB: Kiểm tra version; UPDATE ACCOUNT set adminNotes, version += 1
        DB-->>S: Account record đã cập nhật
        S-->>AC: AccountDetail DTO mới
        AC-->>API: 200 + { data: AccountDetail DTO }
        API-->>UI: Cập nhật version trong state và hiển thị trạng thái "Đã lưu"
    else Admin xem hoặc tải tệp hồ sơ (CCCD, CV)
        A->>UI: Chọn Xem hoặc Tải tệp hồ sơ
        UI->>API: Mở liên kết /api/v1/files/{fileId}/content
        API->>FC: GET /api/v1/files/{fileId}/content
        FC->>S: authorizeAndStreamFile(adminId, fileId)
        S->>DB: Kiểm tra quyền ADMIN và đọc FILE_ASSET ACTIVE
        DB-->>S: storageKey và mimeType
        S->>FS: Mở stream tệp từ kho lưu trữ riêng tư
        FS-->>S: Readable stream
        S-->>FC: Stream + Content-Type + Content-Disposition
        FC-->>API: 200 + File stream binary
        API-->>UI: Trình duyệt mở xem trực tiếp hoặc tải tệp về máy
    end
```

## Chú thích

- Modal "Chi tiết ca làm việc" không cần gửi thêm request lên server vì danh sách CTV (`shiftAssignments`) đã được nạp sẵn trong cell khi tải lịch tổng hợp.
- Khi mở modal "Hồ sơ & Lịch trình tài khoản", Frontend gọi song song hai endpoint chuyên biệt:
  - `GET /api/v1/accounts/:id` lấy hồ sơ, ghi chú quản trị và danh sách tệp đính kèm.
  - `GET /api/v1/accounts/:id/schedule` lấy mẫu lịch tuần cố định (`Schedule` và `Shift`) của đúng CTV đó.
- Lịch sử làm việc của CTV được tải qua `GET /api/v1/work-history?month=YYYY-MM&accountId=:id`, đảm bảo tách biệt hoàn toàn giữa cấu hình lịch hiện hành và dữ liệu ca đã hoàn thành.
- Endpoint cập nhật ghi chú quản trị `PATCH /api/v1/accounts/:id/notes` yêu cầu `expectedVersion`. Nếu phiên bản trong cơ sở dữ liệu không khớp, hệ thống trả về lỗi `409 VERSION_CONFLICT` để ngăn chặn việc ghi đè vô tình.
- Truy cập tệp riêng tư (`/api/v1/files/:fileId/content`) luôn được kiểm tra quyền hạn nghiêm ngặt ở tầng Backend (`ADMIN` hoặc chủ sở hữu tài khoản `CTV`); tuyệt đối không để lộ `storageKey` hay đường dẫn vật lý ra ngoài client.
