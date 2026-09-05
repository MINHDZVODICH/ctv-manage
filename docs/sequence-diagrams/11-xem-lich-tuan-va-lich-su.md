# Sequence diagram - Xem lịch tuần và lịch sử làm việc

Nguồn nghiệp vụ: Use case 2.2 trong [USE-CASE.md](../USE-CASE.md).

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
        participant DB as PostgreSQL qua Prisma
    end

    U->>UI: Mở lịch cá nhân
    UI->>API: GET /api/v1/users/me/schedule-registration
    API->>C: Xác thực CTV
    C->>S: getMyRegistration(currentUserId)
    S->>DB: Đọc registration ACTIVE + patternSlots
    DB-->>S: Registration hiện hành hoặc null
    S-->>C: Registration DTO
    C-->>API: 200 + data
    API-->>UI: Lưu mẫu tuần cố định, version và buồng
    UI->>API: GET /api/v1/users/me/shifts
    API->>C: Xác thực CTV
    C->>S: listMyShifts(currentUserId, {})
    S->>DB: Join ACTIVE assignment và SHIFT của CTV
    DB-->>S: Shift DTOs
    S-->>C: Danh sách ca
    C-->>API: 200 + data
    API-->>UI: Lưu assignment fallback và render mẫu Thứ 2 đến Thứ 6

    alt CTV mở lịch sử theo tháng
        U->>UI: Chọn Lịch sử làm việc
        UI->>API: GET /api/v1/users/me/work-history?month={month}
        API->>C: Xác thực CTV; lấy accountId từ session
        C->>S: getWorkHistory({month, accountId: currentUserId})
        S->>S: syncWorkHistory(todayInBangkok)
        S->>DB: Upsert assignment ACTIVE đã qua vào WORK_HISTORY
        S->>DB: Đọc WORK_HISTORY của currentUserId trong tháng
        DB-->>S: History rows
        S-->>C: {month, cells}
        C-->>API: 200 + data
        API-->>UI: Lưu historyShifts và render lưới tháng
    else CTV chuyển tháng lịch sử
        U->>UI: Chọn tháng trước hoặc sau
        UI->>API: GET /api/v1/users/me/work-history?month={tháng mới}
    end
    UI-->>U: Hiển thị lịch đã chọn

    alt Tải lịch sử thất bại
        API-->>UI: HTTP error
        UI-->>U: Xóa dữ liệu tháng cũ, hiển thị lỗi và nút Thử lại
        U->>UI: Chọn Thử lại
        UI->>API: GET /api/v1/users/me/work-history?month={month}
    else Tháng không có dữ liệu
        API-->>UI: 200 + cells rỗng
        UI-->>U: Hiển thị trạng thái chưa có ca hoàn thành trong tháng
    end
```

## Chú thích

- Lịch tuần và lịch sử là hai nguồn riêng: tuần hiển thị mẫu `SCHEDULE_PATTERN_SLOT` cố định; lịch sử đọc ảnh chụp bất biến trong `WORK_HISTORY`.
- Lịch tuần không có khoảng ngày hoặc điều hướng tuần. `SHIFT_ASSIGNMENT.status=ACTIVE` chỉ được dùng làm fallback nếu metadata mẫu tạm thời không tải được.
- Trước các truy vấn ca/lịch sử, service bồi cửa sổ assignment của registration `ACTIVE`; registration không tự hết hạn nếu CTV không thay đổi mẫu.
- Endpoint `/users/me/work-history` luôn lấy `accountId` từ session, nên CTV không thể xem lịch sử của tài khoản khác bằng query string.
- Lưới lịch sử chỉ gắn ca cho ngày quá khứ; hôm nay và tương lai để trống vì chưa được chốt vào `WORK_HISTORY`.
- Ngày hiện tại phía frontend và backend đều được xác định theo `Asia/Bangkok` để tránh lệch ngày ở biên nửa đêm.
- Frontend gọi Shared API Client trực tiếp trong `App` và `CTVScheduleWorkspace`; app hiện không có `Schedule Feature Hook` riêng.
