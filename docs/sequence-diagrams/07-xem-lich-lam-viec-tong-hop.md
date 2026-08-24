# Sequence diagram - Xem lịch làm việc tổng hợp

Nguồn nghiệp vụ: Use case 2.4 trong [USE-CASE.md](../USE-CASE.md).

```mermaid
sequenceDiagram
    actor A as Admin
    box LỚP FRONTEND
        participant UI as Lịch tổng hợp Admin
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

    A->>UI: Chọn tháng cần xem
    UI->>H: loadScheduleSummary(month)
    H->>API: getScheduleSummary(month)
    API->>C: GET /api/v1/schedule-summary?month={month}
    C->>C: Xác thực vai trò ADMIN và month
    C->>S: getMonthlySummary(month)
    S->>S: Tính ngày đầu và cuối tháng
    S->>DB: Đọc active assignments, account và roomCode
    DB-->>S: Các assignment trong tháng
    S->>S: Nhóm theo date và period
    S-->>C: ScheduleSummary DTO
    C-->>API: 200 + data
    API-->>H: Cells và assignments
    H-->>UI: Render lưới tháng
    UI-->>A: Hiển thị số CTV theo từng ô

    opt Admin bấm làm mới
        UI->>H: reload(month)
        H->>API: getScheduleSummary(month)
        API->>C: GET /api/v1/schedule-summary?month={month}
        C->>S: getMonthlySummary(month)
        S->>DB: Đọc dữ liệu hiện tại
        DB-->>S: Assignments mới nhất
        S-->>C: ScheduleSummary DTO
        C-->>API: 200 + data
        API-->>H: Summary mới
        H-->>UI: Cập nhật lưới
    end
```

## Chú thích

- Mỗi ô tháng nhóm theo `date + period` và chứa `shiftId`; Admin dùng mã này để mở luồng chi tiết ca ở sơ đồ 13.
- `roomCode` thuộc từng assignment và hiển thị trong danh sách CTV; period chỉ có `MORNING` và `AFTERNOON`.
- Lịch tổng hợp và lịch cá nhân đọc cùng bảng assignment nên không cần một bản sao dữ liệu riêng.
- Prototype dùng cơ chế mở/tải lại để nhận dữ liệu mới; WebSocket hoặc realtime chưa nằm trong phạm vi.
