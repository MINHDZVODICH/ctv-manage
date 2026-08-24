# Sequence diagram - Đăng ký hoặc cập nhật lịch làm việc

Nguồn nghiệp vụ: Use case 2.1 trong [USE-CASE.md](../USE-CASE.md).

```mermaid
sequenceDiagram
    actor U as CTV
    box LỚP FRONTEND
        participant UI as Màn hình lịch làm việc
        participant H as Schedule Feature Hook
        participant API as Shared API Client
    end
    box LỚP BACKEND
        participant C as Schedule Controller
        participant S as Schedule Service
    end
    box LỚP DỮ LIỆU
        participant DB as SQLite qua Prisma
    end

    U->>UI: Mở biểu mẫu lịch
    UI->>H: loadScheduleRegistration()
    H->>API: getMyScheduleRegistration()
    API->>C: GET /api/v1/users/me/schedule-registration
    C->>S: getRegistration(currentUserId)
    S->>DB: Đọc mẫu lịch và version
    DB-->>S: Registration hoặc không có
    S-->>C: ScheduleRegistration DTO
    C-->>API: 200 + data
    API-->>H: Dữ liệu biểu mẫu
    H-->>UI: Render roomCode và các slot

    U->>UI: Chọn Buồng 1-4, thời gian và ca
    UI->>H: saveScheduleRegistration(form)
    H->>H: Kiểm tra ngày và ít nhất một slot
    H->>API: putMyScheduleRegistration(payload)
    API->>C: PUT /api/v1/users/me/schedule-registration
    C->>S: upsertRegistration(currentUserId, payload)
    S->>S: Kiểm tra roomCode cố định và period hợp lệ
    S->>S: Sinh danh sách ngày-ca từ mẫu tuần
    S->>DB: Transaction kiểm tra version và upsert assignments

    alt Version đã thay đổi
        DB-->>S: Xung đột phiên bản
        S-->>C: VERSION_CONFLICT
        C-->>API: 409 + currentVersion
        API-->>H: Yêu cầu tải lại dữ liệu
        H-->>UI: Cảnh báo dữ liệu đã thay đổi
    else Lưu thành công
        DB-->>S: Registration, version mới và shifts
        S-->>C: ScheduleRegistration DTO
        C-->>API: 200 + data
        API-->>H: Mẫu lịch đã lưu
        H->>API: getMyShifts(filters)
        API->>C: GET /api/v1/users/me/shifts
        C->>S: listMyShifts(currentUserId, filters)
        S->>DB: Đọc assignments đang hoạt động
        DB-->>S: Danh sách ca
        S-->>C: Shift DTOs
        C-->>API: 200 + data
        API-->>H: Lịch cá nhân mới
        H-->>UI: Cập nhật lịch
        UI-->>U: Thông báo lưu thành công
    end
```

## Chú thích

- `roomCode` chỉ nhận `ROOM_1` đến `ROOM_4`; không có API hay bảng quản trị phòng.
- `period` chỉ nhận `MORNING` hoặc `AFTERNOON`; ngày truyền theo `YYYY-MM-DD`.
- `version` bảo vệ cập nhật đồng thời. Frontend phải tải lại thay vì tự ghi đè khi nhận `409`.
