# Sequence diagram - Xem chi tiết và hủy ca làm việc

Nguồn nghiệp vụ: Use case 2.3 trong [USE-CASE.md](../USE-CASE.md).

```mermaid
sequenceDiagram
    actor U as CTV
    box LỚP FRONTEND
        participant UI as Lịch cá nhân
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

    U->>UI: Chọn một ca
    UI->>H: loadShiftDetail(shiftId)
    H->>API: getShift(shiftId)
    API->>C: GET /api/v1/shifts/{shiftId}
    C->>S: getShiftForUser(shiftId, currentUserId)
    S->>DB: Đọc ca và assignment của CTV
    DB-->>S: ShiftDetail DTO
    S-->>C: Chi tiết và quyền hủy
    C-->>API: 200 + data
    API-->>H: Chi tiết ca
    H-->>UI: Hiển thị hộp thoại

    U->>UI: Xác nhận phạm vi hủy
    alt Chỉ hủy ca đang chọn
        UI->>H: cancelOne(assignmentId)
        H->>API: cancelAssignment(assignmentId)
        API->>C: DELETE /api/v1/users/me/shift-assignments/{assignmentId}
        C->>S: cancelOne(currentUserId, assignmentId)
    else Hủy chuỗi từ ngày đã chọn
        UI->>H: cancelSeries(registrationId, weekday, period, fromDate)
        H->>API: cancelSeries(...)
        API->>C: DELETE /api/v1/users/me/schedule-registrations/{registrationId}/assignments?weekday={weekday}&period={period}&fromDate={date}
        C->>S: cancelSeries(currentUserId, filters)
    end

    S->>DB: Transaction hủy assignment phù hợp
    DB-->>S: affectedCount
    S-->>C: Kết quả hủy
    C-->>API: 200 + affectedCount
    API-->>H: Kết quả idempotent
    H->>API: getMyShifts(currentFilters)
    API->>C: GET /api/v1/users/me/shifts
    C->>S: listMyShifts(currentUserId, currentFilters)
    S->>DB: Đọc danh sách ca còn hoạt động
    DB-->>S: Shift DTOs
    S-->>C: Danh sách mới
    C-->>API: 200 + data
    API-->>H: Lịch đã làm mới
    H-->>UI: Cập nhật lịch và đóng hộp thoại
    UI-->>U: Hiển thị số ca đã hủy
```

## Chú thích

- Hủy một ca dùng `assignmentId`; hủy chuỗi dùng `registrationId` cùng bộ lọc rõ ràng, không dùng một `shiftId` cho hai ý nghĩa.
- Gọi lặp lại cùng yêu cầu trả `200` với `affectedCount=0`; trạng thái cuối không đổi.
- Lịch tổng hợp của Admin đọc cùng dữ liệu assignment. Prototype cập nhật khi màn hình Admin tải hoặc làm mới, không khẳng định realtime.
