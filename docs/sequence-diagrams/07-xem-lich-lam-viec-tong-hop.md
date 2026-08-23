# Sequence diagram - Xem lịch làm việc tổng hợp

```mermaid
sequenceDiagram
    title XEM LỊCH LÀM VIỆC TỔNG HỢP

    actor A as Quản trị viên

    box LỚP FRONTEND
        participant UI as Lịch tổng hợp Admin
        participant API as API Client
    end

    box LỚP BACKEND
        participant C as Schedule Controller
        participant S as Schedule Service
    end

    box LỚP DỮ LIỆU
        participant DB as Database
    end

    A->>UI: Mở Lịch làm việc tổng hợp
    UI->>API: Yêu cầu dữ liệu tháng hiện tại
    API->>C: GET /api/v1/schedule-summary?month={month}
    activate C
    C->>S: Lấy dữ liệu lịch tổng hợp
    activate S
    S->>DB: Truy vấn dữ liệu ca dùng chung với lịch cá nhân CTV
    DB-->>S: Danh sách CTV và các ca hôm nay
    S->>DB: Đếm CTV theo ngày và ca trong tháng
    DB-->>S: Số lượng CTV theo từng ca

    alt Không có ca trong giai đoạn được chọn
        S-->>C: Dữ liệu tổng hợp rỗng
        C-->>API: 200 OK
        API-->>UI: Danh sách rỗng
        UI-->>A: Hiển thị trạng thái chưa có lịch
    else Có dữ liệu ca
        S-->>C: Danh sách hôm nay và số lượng theo ca
        C-->>API: 200 OK
        API-->>UI: Dữ liệu lịch tổng hợp
        UI-->>A: Hiển thị CTV hôm nay và lịch tháng
    end

    deactivate S
    deactivate C

    opt CTV đăng ký, cập nhật hoặc hủy ca rồi Admin tải lại
        A->>UI: Tải lại lịch tổng hợp
        UI->>API: Yêu cầu dữ liệu mới nhất
        API->>C: GET /api/v1/schedule-summary?month={month}
        C->>S: Tổng hợp lại lịch
        S->>DB: Đọc dữ liệu ca hiện tại
        DB-->>S: Dữ liệu sau thay đổi của CTV
        S-->>C: Kết quả tổng hợp mới
        C-->>API: 200 OK
        API-->>UI: Dữ liệu mới
        UI-->>A: Cập nhật danh sách và số lượng CTV
    end
```

## Làm rõ các mũi tên còn mơ hồ

- **`Schedule Service → Database — Truy vấn dữ liệu ca dùng chung với lịch cá nhân CTV`:** Prisma đọc active shift assignments theo khoảng đầu/cuối tháng và lấy `{ shiftId, date, period, roomId, userId, displayName }`.
- **`Database → Schedule Service — Danh sách CTV và các ca hôm nay`:** SQLite trả `[{ shiftId, date, period, room, user:{ id, displayName } }]`, không chứa CCCD/CV hoặc thông tin xác thực.
- **`Schedule Service → Database — Đếm CTV theo ngày và ca trong tháng`:** Prisma `groupBy` hoặc SQL parameterized nhóm theo `{ date, period }` và dùng `COUNT(DISTINCT userId)` để tránh đếm trùng.
- **`Database → Schedule Service — Số lượng CTV theo từng ca`:** kết quả có dạng `[{ date:'YYYY-MM-DD', period:'MORNING|AFTERNOON|EVENING', count:N }]`.
- **`Schedule Service → Schedule Controller — Danh sách hôm nay và số lượng theo ca`:** Service ghép thành `{ month, today:[{ shiftId, userId, displayName, period, room }], days:[{ date, slots:[{ period, count }] }] }`.
- **`Schedule Service → Database — Đọc dữ liệu ca hiện tại`:** khi Admin tải lại, Prisma chạy truy vấn mới trên shared shift assignments đã commit; không dùng snapshot cũ của Frontend.
- **`Database → Schedule Service — Dữ liệu sau thay đổi của CTV`:** SQLite trả rows/count mới sau đăng ký, cập nhật hoặc hủy; đây là refresh theo request, không phải WebSocket/realtime.
