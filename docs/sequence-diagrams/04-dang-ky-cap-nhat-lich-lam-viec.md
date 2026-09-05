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
        participant DB as PostgreSQL qua Prisma
    end

    U->>UI: Mở biểu mẫu lịch
    UI->>UI: Tạo bản nháp 10 ô rỗng và focus bộ chọn buồng
    UI->>API: apiGet(schedule-registration)
    API->>C: GET /api/v1/users/me/schedule-registration
    C->>S: getRegistration(currentUserId)
    S->>DB: Đọc SCHEDULE_REGISTRATION ACTIVE và SCHEDULE_PATTERN_SLOT
    DB-->>S: Registration hiện hành hoặc null
    S-->>C: ScheduleRegistration DTO
    C-->>API: 200 + data
    API-->>UI: Giữ roomCode, version và mẫu hiện hành
    Note over UI: Không điền patternSlots cũ vào bản nháp.<br/>Mỗi lần mở biểu mẫu, toàn bộ ô đều rỗng.

    UI-->>U: Hiển thị ngày bắt đầu, quy tắc lặp vô hạn<br/>và cảnh báo lưu sẽ thay toàn bộ mẫu hiện tại
    U->>UI: Chọn Buồng 1-4 và các ca trong tuần
    UI->>UI: Kiểm tra roomCode và ít nhất một slot
    UI->>API: apiPut(schedule-registration, payload)
    API->>C: PUT /api/v1/users/me/schedule-registration
    C->>C: Validate roomCode và slots
    C->>S: upsertRegistration(currentUserId, payload)
    S->>S: syncWorkHistory(todayInBangkok)
    S->>DB: Chốt assignment ACTIVE đã qua vào WORK_HISTORY
    S->>S: Tính startDate và cửa sổ materialization ban đầu
    S->>DB: Transaction lấy advisory lock theo accountId
    S->>DB: So khớp expectedVersion; đồng bộ registration,<br/>slots, SHIFT và assignment

    alt Version đã thay đổi
        DB-->>S: Xung đột phiên bản
        S-->>C: VERSION_CONFLICT
        C-->>API: 409 VERSION_CONFLICT
        API-->>UI: Reject VERSION_CONFLICT; giữ cửa sổ mở
        UI->>API: GET /api/v1/users/me/schedule-registration
        API->>C: GET registration hiện hành
        C->>S: getRegistration(currentUserId)
        S->>DB: Đọc registration ACTIVE mới nhất
        DB-->>S: Registration DTO
        S-->>C: Registration DTO
        C-->>API: 200 + data
        API-->>UI: Cập nhật version và metadata mới nhất
        UI-->>U: Cảnh báo kiểm tra rồi đăng ký lại
    else Lưu thành công
        DB-->>S: Registration, version mới và assignments
        S-->>C: ScheduleRegistration DTO
        C-->>API: 200 + data
        API-->>UI: Mẫu lịch cố định đã lưu
        par Tải metadata mới nhất
            UI->>API: GET /api/v1/users/me/schedule-registration
            API->>C: GET registration
            C->>S: getRegistration(currentUserId)
            S->>DB: Đọc registration ACTIVE
            DB-->>S: Registration DTO
            S-->>C: Registration DTO
            C-->>API: 200 + data
            API-->>UI: Metadata mới nhất
        and Tải ca thực tế
            UI->>API: GET /api/v1/users/me/shifts
            API->>C: GET shifts
            C->>S: listMyShifts(currentUserId, filters)
            S->>DB: Join SHIFT_ASSIGNMENT ACTIVE và SHIFT
            DB-->>S: Danh sách ca
            S-->>C: Shift DTOs
            C-->>API: 200 + data
            API-->>UI: Assignment hiện hành
        end
        UI-->>U: Đóng biểu mẫu, hiển thị mẫu Thứ 2-Thứ 6 và thông báo thành công
    end
```

## Chú thích

- `roomCode` chỉ nhận `ROOM_1` đến `ROOM_4`; không có API hay bảng quản trị phòng.
- `period` chỉ nhận `MORNING` hoặc `AFTERNOON`; ngày truyền theo `YYYY-MM-DD`.
- Payload từ Frontend gồm `roomCode`, `slots[{weekday, period}]` và `expectedVersion`; khi tạo mới, trường `expectedVersion` được bỏ qua. Nếu registration `ACTIVE` đã tồn tại thì `expectedVersion` là bắt buộc. Service tự tính `startDate` là thứ Hai kế tiếp (hoặc hôm nay nếu đang là thứ Hai) và lưu `timeZone=Asia/Bangkok`.
- Biểu mẫu là thao tác **thay thế toàn bộ**: draft luôn rỗng khi mở, chỉ các ô được chọn trong lần lưu hiện tại trở thành mẫu mới. UI nêu rõ mẫu lặp lại hằng tuần cho đến khi CTV cập nhật.
- Trước khi lưu mẫu mới, Service chốt assignment `ACTIVE` đã qua vào `WORK_HISTORY`. Transaction chỉ duy trì một registration `ACTIVE` trên mỗi `accountId`, thay toàn bộ `SCHEDULE_PATTERN_SLOT`, upsert assignment trong cửa sổ ban đầu và chuyển assignment tương lai không còn thuộc mẫu sang `CANCELLED`.
- Registration không tự chuyển `EXPIRED` theo `endDate`. `endDate` là watermark nội bộ; `extendRecurringSchedules` bồi thêm assignment khi đồng bộ lịch sử hoặc phục vụ truy vấn lịch, nhờ đó mẫu tiếp tục áp dụng mà không sinh vô hạn bản ghi ngay lúc lưu.
- Khi cập nhật, transaction lấy advisory lock theo `accountId`; điều kiện `id + version + status=ACTIVE` phải khớp và `version` tăng một. Frontend tải registration mới nhất thay vì ghi đè khi nhận `409 VERSION_CONFLICT`.
- Sau khi lưu, Lịch tuần hiển thị một mẫu Thứ 2-Thứ 6 cố định, không có khoảng ngày hoặc điều hướng tuần. Assignment thực tế là fallback khi metadata registration không tải được.
