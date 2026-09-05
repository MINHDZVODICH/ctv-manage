# Sequence diagram - Xem lịch tuần và lịch sử làm việc của CTV (Chỉ đọc)

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

    U->>UI: Mở tab Lịch làm việc (mặc định tab: Lịch tuần)
    UI->>API: GET /api/v1/users/me/schedule
    API->>C: Xác thực CTV từ cookie session
    C->>S: getMySchedule(currentUserId)
    S->>DB: prisma.schedule.findUnique(accountId = currentUserId, include: { shifts: true })
    DB-->>S: Schedule record kèm mảng Shift hoặc null
    S-->>C: Schedule DTO (id, accountId, roomCode, version, shifts)
    C-->>API: 200 + { data: Schedule DTO }
    API-->>UI: Lưu schedule vào state
    UI-->>U: Hiển thị lưới Thứ 2 - Thứ 6 với các huy hiệu chỉ đọc (ShiftBadge)

    alt CTV chuyển sang tab Lịch sử làm việc
        U->>UI: Bấm chọn tab "Lịch sử làm việc"
        UI->>API: GET /api/v1/users/me/work-history?month={YYYY-MM}
        API->>C: Xác thực CTV; lấy currentUserId từ session
        C->>S: getMyWorkHistory(currentUserId, month)
        S->>DB: prisma.history.findMany(accountId = currentUserId, workDate trong tháng)
        DB-->>S: History rows
        S-->>C: { month, entries: [{ id, workDate, period, roomCode }] }
        C-->>API: 200 + { month, entries }
        API-->>UI: Lưu entries vào state và render lưới tháng
        UI-->>U: Hiển thị danh sách ca đã hoàn thành theo từng ngày trong tháng
    else CTV chuyển tháng lịch sử (Tháng trước / Tháng sau)
        U->>UI: Chọn tháng mới
        UI->>API: GET /api/v1/users/me/work-history?month={tháng mới}
        API->>C: Xác thực CTV
        C->>S: getMyWorkHistory(currentUserId, tháng mới)
        S->>DB: prisma.history.findMany(accountId, workDate trong tháng mới)
        DB-->>S: Rows tháng mới
        S-->>C: { month, entries }
        C-->>API: 200 + data
        API-->>UI: Cập nhật lịch sử tháng mới
        UI-->>U: Hiển thị ca đã chốt của tháng mới
    end

    alt Tải lịch sử thất bại
        API-->>UI: HTTP error
        UI-->>U: Xóa dữ liệu tháng cũ, hiển thị thông báo lỗi và nút Thử lại
        U->>UI: Bấm nút Thử lại
        UI->>API: GET /api/v1/users/me/work-history?month={month}
    else Tháng chưa có dữ liệu hoàn thành
        API-->>UI: 200 + { month, entries: [] }
        UI-->>U: Hiển thị thông báo "Chưa có ca làm việc nào trong tháng này"
    end
```

## Chú thích

- Lịch tuần và Lịch sử làm việc là hai luồng dữ liệu độc lập:
  - Lịch tuần đọc mẫu cấu hình cố định từ bảng `Schedule` và `Shift` qua `GET /api/v1/users/me/schedule`.
  - Lịch sử làm việc đọc các ảnh chụp bất biến trong bảng `History` qua `GET /api/v1/users/me/work-history?month=YYYY-MM`.
- Các thẻ ca trên Lịch tuần được hiển thị dưới dạng huy hiệu chỉ đọc (`ShiftBadge`), bao gồm biểu tượng ca (Sáng/Chiều) và buồng làm việc. Thẻ ca hoàn toàn không thể bấm để sửa hoặc xóa đơn lẻ.
- Lịch sử trả về qua DTO chuyên biệt `{ month, entries: [{ id, workDate, period, roomCode }] }`, chỉ chứa các trường cần thiết của chính CTV đó, không chứa thông tin của CTV khác.
- Endpoint `/users/me/work-history` luôn lấy `accountId` trực tiếp từ session được xác thực ở phía Backend, ngăn chặn triệt để nguy cơ CTV xem trộm lịch sử của tài khoản khác.
- Phía Frontend tự động đăng ký sự kiện `visibilitychange` và `window focus` để tự động làm mới lịch sử nếu CTV quay lại tab trình duyệt sau mốc 17:30 Bangkok.
