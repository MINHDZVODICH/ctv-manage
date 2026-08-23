# Sequence diagram - Hủy ca làm việc

```mermaid
sequenceDiagram
    title HỦY CA LÀM VIỆC

    actor U as CTV
    actor A as Quản trị viên

    box LỚP FRONTEND
        participant UI as Lịch cá nhân
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

    U->>UI: Chọn một ca đã đăng ký
    UI->>API: Yêu cầu chi tiết ca
    API->>C: GET /api/v1/shifts/{shiftId}
    C->>S: Lấy chi tiết ca của CTV
    S->>DB: Truy vấn ca và danh sách CTV làm cùng
    DB-->>S: Chi tiết ca
    S-->>C: Dữ liệu chi tiết
    C-->>API: 200 OK
    API-->>UI: Hiển thị cửa sổ chi tiết

    alt Ca đã qua
        UI-->>U: Chỉ hiển thị chi tiết, không cho phép hủy
    else Ca hiện tại hoặc tương lai
        U->>UI: Chọn phạm vi hủy
        UI->>API: Gửi yêu cầu hủy ca
        API->>C: DELETE /api/v1/shift-registrations/{shiftId}?scope={scope}&fromDate={date}
        activate C
        C->>S: Hủy ca theo phạm vi
        activate S
        S->>DB: Khóa và kiểm tra quyền sở hữu ca
        DB-->>S: Ca và đăng ký liên quan

        alt Ca không thuộc CTV hoặc đã bị hủy
            S-->>C: Không thể thực hiện
            C-->>API: 404 hoặc 409
            API-->>UI: Ca không còn khả dụng
            UI-->>U: Hiển thị thông báo lỗi
        else Chỉ hủy ca này
            S->>DB: Xóa CTV khỏi đúng shiftId đã chọn
            DB-->>S: Đã cập nhật
            S-->>C: Hủy một ca thành công
            C-->>API: 200 OK
            API-->>UI: Kết quả hủy ca
            UI-->>U: Đóng chi tiết và cập nhật hai chế độ lịch
        else Hủy ca định kỳ
            S->>DB: Xóa các ca cùng thứ và buổi kể từ ngày đã chọn
            DB-->>S: Số ca đã cập nhật
            S-->>C: Hủy chuỗi ca thành công
            C-->>API: 200 OK
            API-->>UI: Số ca đã hủy
            UI-->>U: Đóng chi tiết và cập nhật hai chế độ lịch
        end

        deactivate S
        deactivate C
    end

    opt Sau khi hủy thành công, Admin mở hoặc tải lại lịch tổng hợp
        A->>AUI: Xem Lịch làm việc tổng hợp
        AUI->>API: Yêu cầu lịch tổng hợp
        API->>C: GET /api/v1/schedule-summary
        C->>S: Lấy lịch tổng hợp
        S->>DB: Tổng hợp lại CTV hôm nay và số lượng theo từng ca
        DB-->>S: Dữ liệu không còn các phân công đã hủy
        S-->>C: Danh sách và số lượng CTV theo ca
        C-->>API: 200 OK
        API-->>AUI: Dữ liệu lịch tổng hợp mới
        AUI-->>A: Hiển thị số lượng CTV đã giảm tương ứng
    end
```

## Làm rõ các mũi tên còn mơ hồ

- **`Database → Schedule Service — Chi tiết ca`:** Prisma trả `{ id, date, period, room, status, registrationId, coworkers }`; Service bổ sung `canCancel` và `cancelScopes` trước khi trả DTO.
- **`Lịch cá nhân → API Client — Gửi yêu cầu hủy ca`:** TanStack Query gửi DELETE với path `shiftId`, query `{ scope:'single'|'series', fromDate:'YYYY-MM-DD' }`, cookie session và CSRF token; body rỗng.
- **`Schedule Service → Database — Khóa và kiểm tra quyền sở hữu ca`:** Prisma transaction đọc assignment theo `{ shiftId, userId:actorId }`, kiểm tra ngày/trạng thái và dùng conditional update chống hai request hủy đồng thời.
- **`Schedule Service → Database — Xóa CTV khỏi đúng shiftId đã chọn`:** với `single`, Prisma chỉ xóa/update assignment có unique key `{ shiftId, userId }`, không xóa ca dùng chung của người khác.
- **`Schedule Service → Database — Xóa các ca cùng thứ và buổi kể từ ngày đã chọn`:** với `series`, Prisma lọc `{ userId, registrationId, weekday, period, date:{ gte:fromDate } }`, nên không chạm chuỗi khác.
- **`Database → Schedule Service — Số ca đã cập nhật`:** transaction trả `{ affectedCount, shiftIds }`; response cho Frontend là `{ scope, fromDate, affectedCount, shiftIds }`.
- **`Schedule Service → Database — Tổng hợp lại CTV hôm nay và số lượng theo từng ca`:** Prisma đọc shared shift assignments sau transaction hủy và nhóm theo `{ date, period }`.
- **`Database → Schedule Service — Dữ liệu không còn các phân công đã hủy`:** SQLite trả `{ todayAssignments, countsByDateAndPeriod }`; dữ liệu chỉ thay đổi trên màn hình Admin khi mở hoặc tải lại, không phải realtime push.
