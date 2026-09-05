# Sequence diagram - Xem chi tiết và hủy ca làm việc

Nguồn nghiệp vụ: Use case 2.3 trong [USE-CASE.md](../USE-CASE.md).

```mermaid
sequenceDiagram
    actor U as CTV
    box LỚP FRONTEND
        participant UI as CTVScheduleWorkspace
        participant API as Shared API Client
    end
    box LỚP BACKEND
        participant C as Schedule Controller
        participant S as Schedule Service
    end
    box LỚP DỮ LIỆU
        participant DB as PostgreSQL qua Prisma
    end

    U->>UI: Chọn một ca từ state lịch đã tải
    UI->>UI: Hiển thị hộp thoại chi tiết ca

    U->>UI: Xác nhận phạm vi hủy
    alt Chỉ hủy ca đang chọn
        UI->>API: GET /api/v1/users/me/shifts
        API->>C: getMyShifts()
        C->>S: listMyShifts(currentUserId, {})
        S->>DB: Tìm assignmentId khớp ca đang chọn
        DB-->>S: Danh sách assignment ACTIVE
        S-->>C: Shift DTOs
        C-->>API: 200 + data
        UI->>API: DELETE assignmentId
        API->>C: DELETE /api/v1/users/me/shift-assignments/{assignmentId}
        C->>S: cancelOne(currentUserId, assignmentId)
    else Hủy chuỗi từ ngày đã chọn
        UI->>API: GET /api/v1/users/me/schedule-registration
        API->>C: getMyRegistration()
        C->>S: getMyRegistration(currentUserId)
        S->>DB: Đọc registration ACTIVE
        DB-->>S: registrationId
        UI->>API: DELETE chuỗi với query filters
        API->>C: DELETE .../{registrationId}/assignments với query filters
        C->>S: cancelSeries(currentUserId, filters)
    end

    S->>DB: Conditional UPDATE SHIFT_ASSIGNMENT còn ACTIVE và chưa qua
    DB-->>S: affectedCount
    S-->>C: Kết quả hủy idempotent
    C-->>API: 200 + affectedCount
    API-->>UI: Kết quả hủy
    UI->>API: GET /api/v1/users/me/shifts
    API->>C: GET /api/v1/users/me/shifts
    C->>S: listMyShifts(currentUserId, currentFilters)
    S->>DB: Join SHIFT_ASSIGNMENT ACTIVE và SHIFT theo filters
    DB-->>S: Shift DTOs
    S-->>C: Danh sách mới
    C-->>API: 200 + data
    API-->>UI: Cập nhật lịch và đóng hộp thoại
    UI-->>U: Hiển thị số ca đã hủy
```

## Chú thích

- Hủy một ca dùng `assignmentId`; hủy chuỗi gọi `DELETE /api/v1/users/me/schedule-registrations/{registrationId}/assignments` với query `weekday`, `period`, `fromDate`, không dùng một `shiftId` cho hai ý nghĩa.
- `fromDate` là ngày của ca được chọn theo `YYYY-MM-DD`; Backend tự xác định ngày hiện tại theo `Asia/Bangkok` và không tin cờ `canCancel` từ Frontend.
- Hủy một ca lọc theo `SHIFT_ASSIGNMENT.id`, `accountId`, `status=ACTIVE` và ngày chưa qua. Hủy chuỗi join `SHIFT`, rồi lọc thêm `registrationId`, `weekday`, `period` và `workDate >= fromDate`.
- Bản ghi không bị xóa: Service đặt `SHIFT_ASSIGNMENT.status=CANCELLED`, `cancelledAt`, `cancellationReason` và `updatedAt` trong một transaction.
- Gọi lặp lại cùng yêu cầu trả `200` với `affectedCount=0`; trạng thái cuối không đổi.
- Lịch tổng hợp của Admin đọc cùng dữ liệu assignment hiện hành và cập nhật ở lần tải/làm mới tiếp theo; lịch sử đã chốt trong `WORK_HISTORY` không bị thao tác hủy tương lai thay đổi.
