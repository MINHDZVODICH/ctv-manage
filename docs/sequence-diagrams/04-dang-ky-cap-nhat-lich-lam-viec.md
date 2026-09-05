# Sequence diagram - Đăng ký hoặc cập nhật lịch làm việc

Nguồn nghiệp vụ: Use case 2.1 trong [USE-CASE.md](../USE-CASE.md).

```mermaid
sequenceDiagram
    actor U as CTV
    box LỚP FRONTEND
        participant UI as CTVScheduleWorkspace (Modal)
        participant API as Shared API Client
    end
    box LỚP BACKEND
        participant C as Schedule Controller
        participant S as Schedule Service
    end
    box LỚP DỮ LIỆU
        participant DB as PostgreSQL qua Prisma
    end

    U->>UI: Mở biểu mẫu đăng ký / cập nhật lịch
    alt Đã có lịch trong state
        UI->>UI: Điền sẵn roomCode, version và danh sách shifts
    else Chưa có dữ liệu lịch
        UI->>API: GET /api/v1/users/me/schedule
        API->>C: getMySchedule()
        C->>S: getMySchedule(currentUserId)
        S->>DB: prisma.schedule.findUnique(accountId, include shifts)
        DB-->>S: Schedule record kèm danh sách Shift hoặc null
        S-->>C: Schedule DTO
        C-->>API: 200 + data
        API-->>UI: Cập nhật roomCode, version và shifts vào form
    end

    UI-->>U: Hiển thị form chọn Buồng (1-4), lưới 10 ca (T2-T6 Sáng/Chiều)<br/>và cảnh báo lưu sẽ thay thế toàn bộ mẫu hiện tại
    U->>UI: Chọn Buồng 1-4 và tích/bỏ tích các ca (0 đến 10 ca)
    U->>UI: Nhấn Lưu (hoặc Đăng ký)
    UI->>UI: Khóa nút bấm, bật loading state

    UI->>API: PUT /api/v1/users/me/schedule (payload)
    API->>C: PUT /api/v1/users/me/schedule
    C->>C: Validate schema qua Zod: roomCode, slots[], expectedVersion
    C->>S: upsertSchedule(currentUserId, parsedBody)
    S->>DB: Bắt đầu transaction
    S->>DB: SELECT pg_advisory_xact_lock(hashtext(accountId))
    S->>DB: SELECT SCHEDULE WHERE accountId = currentUserId
    DB-->>S: Schedule hiện tại hoặc null

    alt Xung đột phiên bản (expectedVersion không khớp hoặc thiếu khi đã có lịch)
        S-->>C: Ném lỗi VERSION_CONFLICT (409)
        C-->>API: 409 VERSION_CONFLICT
        API-->>UI: Nhận lỗi 409
        UI->>API: GET /api/v1/users/me/schedule
        API->>C: getMySchedule()
        C->>S: getMySchedule(currentUserId)
        S->>DB: Đọc Schedule + shifts mới nhất
        DB-->>S: Schedule mới
        S-->>C: Schedule DTO
        C-->>API: 200 + data
        API-->>UI: Cập nhật version và dữ liệu mới nhất vào modal
        UI-->>U: Hiển thị cảnh báo xung đột, yêu cầu kiểm tra và lưu lại
    else Xác thực và version hợp lệ
        alt Schedule đã tồn tại
            S->>DB: UPDATE SCHEDULE (tăng version, cập nhật roomCode)
            S->>DB: DELETE FROM SHIFT WHERE scheduleId = schedule.id
            opt slots có phần tử
                S->>DB: INSERT INTO SHIFT (scheduleId, weekday, period)
            end
        else Schedule chưa tồn tại (tạo mới)
            S->>DB: INSERT INTO SCHEDULE (accountId, roomCode, version=1)
            opt slots có phần tử
                S->>DB: INSERT INTO SHIFT (scheduleId, weekday, period)
            end
        end
        S->>DB: Commit transaction
        DB-->>S: Bản ghi Schedule và Shift đã lưu
        S-->>C: Schedule DTO (id, accountId, roomCode, version, shifts)
        C-->>API: 200 + { data: Schedule DTO }
        API->>UI: Trả về lịch tuần mới
        UI->>UI: Cập nhật state lịch tuần cá nhân, đóng modal
        UI-->>U: Hiển thị thông báo lưu thành công và cập nhật thẻ chỉ đọc trên lưới tuần
    end
```

## Chú thích

- `roomCode` chỉ nhận `ROOM_1` đến `ROOM_4`; không có API hay bảng quản trị phòng riêng.
- `period` nhận `MORNING` hoặc `AFTERNOON`; `weekday` nhận số nguyên `1` đến `5` (Thứ 2 đến Thứ 6).
- Endpoint chuẩn là `PUT /api/v1/users/me/schedule` (có route tương thích ngược `/users/me/schedule-registration`).
- Payload gửi lên: `{ roomCode: string, slots: Array<{ weekday: number, period: string }>, expectedVersion?: number }`.
- Nếu tài khoản đã có `Schedule`, trường `expectedVersion` là bắt buộc. Nếu `existing.version !== input.expectedVersion`, hệ thống trả về lỗi `409 VERSION_CONFLICT`.
- Thao tác cập nhật mang tính **thay thế nguyên tử (atomic replacement)**: transaction sử dụng khóa cố vấn PostgreSQL `pg_advisory_xact_lock(hashtext(accountId))` để chống race condition. Khi lưu, toàn bộ bản ghi `Shift` cũ của `scheduleId` bị xóa và các bản ghi `Shift` mới được tạo lại theo mảng `slots` đã chọn.
- Cho phép lưu mảng `slots` rỗng (0 ca) nếu CTV muốn tạm nghỉ toàn bộ các ca trong tuần.
- Lịch tuần trên giao diện hiển thị dưới dạng huy hiệu chỉ đọc (`ShiftBadge`), không cho phép xóa hay bấm sửa ca đơn lẻ trực tiếp trên ô lịch. Mọi thay đổi đều thực hiện qua modal biểu mẫu này.
- Lịch sử đã chốt trong bảng `History` hoàn toàn độc lập và không bị ảnh hưởng bởi việc CTV thay đổi mẫu lịch tuần.
