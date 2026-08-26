# Sequence diagram - Xem lịch tuần và lịch sử làm việc

Nguồn nghiệp vụ: Use case 2.2 trong [USE-CASE.md](../USE-CASE.md).

```mermaid
sequenceDiagram
    actor U as CTV
    box LỚP FRONTEND
        participant UI as Lịch làm việc của tôi
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

    U->>UI: Mở lịch cá nhân
    UI->>H: loadWeek(weekStart)
    H->>H: Tính from/to theo Asia/Bangkok
    H->>API: getMyShifts(from, to)
    API->>C: GET /api/v1/users/me/shifts?from={from}&to={to}
    C->>S: listMyShifts(currentUserId, range)
    S->>DB: Join ACTIVE assignment và SHIFT trong [from, to]
    DB-->>S: Shift DTOs
    S-->>C: Danh sách ca
    C-->>API: 200 + data
    API-->>H: Lịch tuần
    H-->>UI: Render Thứ 2 đến Thứ 6

    alt CTV chuyển tuần
        U->>UI: Chọn tuần trước hoặc sau
        UI->>H: loadWeek(newWeekStart)
        H->>API: getMyShifts(newFrom, newTo)
        API->>C: GET /api/v1/users/me/shifts?from={from}&to={to}
    else CTV mở lịch sử theo tháng
        U->>UI: Chọn Lịch sử và tháng
        UI->>H: loadMonth(month)
        H->>API: getMyShifts(month)
        API->>C: GET /api/v1/users/me/shifts?month={month}
    end
    C->>S: listMyShifts(currentUserId, filters)
    S->>DB: Chạy cùng truy vấn với range mới
    DB-->>S: Shift DTOs
    S-->>C: Danh sách ca
    C-->>API: 200 + data
    API-->>H: Dữ liệu giai đoạn mới
    H-->>UI: Cập nhật tiêu đề và lưới
    UI-->>U: Hiển thị lịch đã chọn
```

## Chú thích

- Chế độ tuần và lịch sử tháng chỉ là hai cách lọc cùng endpoint và cùng dữ liệu assignment.
- Truy vấn lọc `SHIFT_ASSIGNMENT.accountId=currentUserId`, `SHIFT_ASSIGNMENT.status=ACTIVE` và `SHIFT.workDate` trong khoảng; kết quả sắp theo `workDate, period`.
- API dùng ngày `YYYY-MM-DD`, tháng `YYYY-MM`; Feature Hook chịu trách nhiệm tính khoảng ngày theo múi giờ cấu hình.
