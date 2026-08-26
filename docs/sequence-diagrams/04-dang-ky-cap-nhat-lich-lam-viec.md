# Sequence diagram - Đăng ký hoặc cập nhật lịch làm việc

Nguồn nghiệp vụ: Use case 2.1 trong [USE-CASE.md](../USE-CASE.md).

```mermaid
sequenceDiagram
    actor U as CTV
    box LỚP FRONTEND
        participant UI as App + CTVScheduleWorkspace
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
    UI->>API: apiGet(schedule-registration)
    API->>C: GET /api/v1/users/me/schedule-registration
    C->>S: getRegistration(currentUserId)
    S->>DB: Đọc SCHEDULE_REGISTRATION ACTIVE và SCHEDULE_PATTERN_SLOT
    DB-->>S: Registration hiện hành hoặc null
    S-->>C: ScheduleRegistration DTO
    C-->>API: 200 + data
    API-->>UI: Render roomCode và các slot

    U->>UI: Chọn Buồng 1-4, thời gian và ca
    UI->>UI: Kiểm tra roomCode và ít nhất một slot
    UI->>API: apiPut(schedule-registration, payload)
    API->>C: PUT /api/v1/users/me/schedule-registration
    C->>C: Validate roomCode, slots và expectedVersion
    C->>S: upsertRegistration(currentUserId, payload)
    S->>S: syncWorkHistory(todayInBangkok)
    S->>DB: Chốt assignment ACTIVE đã qua vào WORK_HISTORY
    S->>S: Tính khoảng áp dụng và sinh danh sách ngày-ca
    S->>DB: Transaction đồng bộ registration, slots, SHIFT và assignment

    alt Version đã thay đổi
        DB-->>S: Xung đột phiên bản
        S-->>C: VERSION_CONFLICT
        C-->>API: 409 + currentVersion
        API-->>UI: Cảnh báo dữ liệu đã thay đổi
    else Lưu thành công
        DB-->>S: Registration, version mới và assignments
        S-->>C: ScheduleRegistration DTO
        C-->>API: 200 + data
        API-->>UI: Mẫu lịch đã lưu
        UI->>API: GET /api/v1/users/me/shifts
        API->>C: GET /api/v1/users/me/shifts
        C->>S: listMyShifts(currentUserId, filters)
        S->>DB: Join SHIFT_ASSIGNMENT ACTIVE và SHIFT theo filters
        DB-->>S: Danh sách ca
        S-->>C: Shift DTOs
        C-->>API: 200 + data
        API-->>UI: Cập nhật lịch
        UI-->>U: Thông báo lưu thành công
    end
```

## Chú thích

- `roomCode` chỉ nhận `ROOM_1` đến `ROOM_4`; không có API hay bảng quản trị phòng.
- `period` chỉ nhận `MORNING` hoặc `AFTERNOON`; ngày truyền theo `YYYY-MM-DD`.
- Payload từ Frontend gồm `roomCode`, `slots[{weekday, period}]` và `expectedVersion`; khi tạo mới, `expectedVersion` là `null`. Service tự tính `startDate`, `endDate` và lưu `timeZone=Asia/Bangkok` theo cấu hình hệ thống.
- Trước khi lưu mẫu mới, Service chốt assignment `ACTIVE` đã qua vào `WORK_HISTORY`, rồi chuyển registration `ACTIVE` hết hạn sang `EXPIRED`. Transaction chỉ duy trì một registration `ACTIVE` trên mỗi `accountId`, thay toàn bộ `SCHEDULE_PATTERN_SLOT`, upsert `SHIFT(workDate, period)`, upsert assignment mong muốn và chuyển assignment từ hôm nay trở đi không còn trong mẫu sang `CANCELLED`.
- Khi cập nhật, điều kiện `id + version + status=ACTIVE` phải khớp và `version` tăng một. Frontend tải lại thay vì ghi đè khi nhận `409 VERSION_CONFLICT`.
