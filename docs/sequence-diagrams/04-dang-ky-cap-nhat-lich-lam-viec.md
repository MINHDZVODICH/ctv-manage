# Sequence diagram - Đăng ký hoặc cập nhật lịch làm việc

```mermaid
sequenceDiagram
    title ĐĂNG KÝ HOẶC CẬP NHẬT LỊCH LÀM VIỆC

    actor U as CTV
    actor A as Quản trị viên

    box LỚP FRONTEND
        participant UI as Màn hình lịch làm việc
        participant AUI as Lịch tổng hợp Admin
        participant API as API Client
    end

    box LỚP BACKEND
        participant C as Schedule Controller
        participant S as Schedule Service
    end

    box LỚP DỮ LIỆU
        participant DB as Database
    end

    U->>UI: Chọn Đăng ký lịch làm việc
    UI->>API: Lấy phòng và mẫu đăng ký gần nhất
    API->>C: GET /api/v1/users/me/schedule-registration
    C->>S: Chuẩn bị dữ liệu biểu mẫu
    S->>DB: Truy vấn danh sách phòng và đăng ký gần nhất
    DB-->>S: Dữ liệu biểu mẫu
    S-->>C: Phòng, mẫu tuần
    C-->>API: 200 OK
    API-->>UI: Hiển thị hộp thoại đăng ký

    U->>UI: Chọn phòng, bật/tắt ca và chọn Đăng ký lịch
    UI->>UI: Kiểm tra phòng và ít nhất một ca

    alt Dữ liệu không hợp lệ
        UI-->>U: Hiển thị lỗi nhập liệu
    else Dữ liệu hợp lệ
        UI->>API: Gửi mẫu lịch làm việc
        API->>C: PUT /api/v1/users/me/schedule-registration
        activate C
        C->>S: Lưu hoặc cập nhật lịch
        activate S
        S->>S: Sinh các ca từ mẫu tuần và khoảng áp dụng
        S->>DB: Bắt đầu Transaction
        S->>DB: Lưu đăng ký, các ca và phân công phòng
        DB-->>S: Hoàn tất Transaction
        S-->>C: Lịch đã được cập nhật
        C-->>API: 200 OK
        API-->>UI: Kết quả thành công
        UI->>API: Tải lại lịch tuần và lịch sử
        API->>C: GET /api/v1/users/me/shifts
        C->>S: Lấy lịch cá nhân
        S->>DB: Truy vấn các ca hiện tại
        DB-->>S: Danh sách ca
        S-->>C: Lịch cá nhân
        C-->>API: 200 OK
        API-->>UI: Dữ liệu lịch mới
        UI-->>U: Đóng hộp thoại và hiển thị thông báo

        deactivate S
        deactivate C
    end

    opt Sau khi cập nhật thành công, Admin mở hoặc tải lại lịch tổng hợp
        A->>AUI: Xem Lịch làm việc tổng hợp
        AUI->>API: Yêu cầu lịch tổng hợp
        API->>C: GET /api/v1/schedule-summary
        C->>S: Lấy lịch tổng hợp
        S->>DB: Tổng hợp CTV hôm nay và số lượng theo từng ca
        DB-->>S: Dữ liệu đã bao gồm lịch CTV vừa cập nhật
        S-->>C: Danh sách và số lượng CTV theo ca
        C-->>API: 200 OK
        API-->>AUI: Dữ liệu lịch tổng hợp mới
        AUI-->>A: Hiển thị lịch và số lượng đã cập nhật
    end
```

## Làm rõ các mũi tên còn mơ hồ

- **`Database → Schedule Service — Dữ liệu biểu mẫu`:** Prisma trả `{ rooms:[{ id, name }], registration?:{ id, startDate, endDate, roomId, slots, version } }`; ngày dùng `YYYY-MM-DD`, slot dùng `{ weekday, period, enabled }`.
- **`Màn hình lịch làm việc → API Client — Gửi mẫu lịch làm việc`:** TanStack Query gửi JSON `{ roomId, startDate, endDate, timeZone, slots:[{ weekday, period, enabled }], version }`; `version` dùng phát hiện cập nhật đồng thời.
- **`Schedule Service → Schedule Service — Sinh các ca từ mẫu tuần và khoảng áp dụng`:** hàm TypeScript lặp từng ngày theo múi giờ, tạo `ShiftDraft { date, weekday, period, roomId, registrationId }` cho các slot được bật và loại khóa trùng.
- **`Schedule Service → Database — Lưu đăng ký, các ca và phân công phòng`:** Prisma transaction upsert mẫu, tính diff ca cũ/mới rồi `createMany/update/deleteMany`; unique key `registrationId+date+period` ngăn sinh trùng.
- **`Database → Schedule Service — Hoàn tất Transaction`:** SQLite trả `{ registrationId, version, createdCount, updatedCount, removedCount }`; lỗi bất kỳ rollback toàn bộ mẫu và ca.
- **`Database → Schedule Service — Danh sách ca`:** Prisma trả `[{ id, date, period, room:{ id, name }, registrationId, status }]`, được dùng chung cho lịch tuần, tháng và lịch sử.
- **`Schedule Service → Database — Tổng hợp CTV hôm nay và số lượng theo từng ca`:** Prisma `groupBy` hoặc SQL parameterized đọc shared shift assignments, lọc tháng/ngày và nhóm theo `{ date, period }`.
- **`Schedule Service → Schedule Controller — Danh sách và số lượng CTV theo ca`:** Service trả `{ month, today:[{ shiftId, userId, displayName, period, room }], days:[{ date, slots:[{ period, count }] }] }`; Admin chỉ nhận bản mới khi mở hoặc tải lại.
