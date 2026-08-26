# Sequence diagram - Xem lịch tuần tổng hợp và lịch sử tổng hợp (Admin)

Nguồn nghiệp vụ: Use case 2.4 trong [USE-CASE.md](../USE-CASE.md).

## Tổng quan

Admin xem lịch tổng hợp gồm 2 tab giống giao diện CTV:
- **Lịch tuần tổng hợp**: lưới T2-T6 của tuần hiện tại, mỗi ca hiển thị số CTV đi làm, bấm vào xem danh sách chi tiết.
- **Lịch sử tổng hợp**: lưới tháng Mon-Fri, chỉ hiển thị dữ liệu quá khứ (`workDate < today`), tương lai để trống.

Khác CTV duy nhất: mỗi cell/ca bấm được để xem danh sách CTV đi làm hôm đó.

## Luồng xem lịch tuần tổng hợp

```mermaid
sequenceDiagram
    actor A as Admin
    box LỚP FRONTEND
        participant UI as SummaryScheduleScreen
        participant API as Shared API Client
    end
    box LỚP BACKEND
        participant C as Schedule Controller
        participant S as Schedule Service
    end
    box LỚP DỮ LIỆU
        participant DB as SQLite qua Prisma
    end

    A->>UI: Mở tab Lịch làm việc tổng hợp (mặc định: Lịch tuần tổng hợp)
    UI->>UI: Tính tuần hiện tại (Mon-Fri)
    UI->>API: GET /api/v1/schedule-summary?month={tháng chứa tuần}
    API->>C: Xác thực ADMIN + parse query
    C->>S: getScheduleSummary({month})
    S->>DB: Join SHIFT + ACTIVE SHIFT_ASSIGNMENT + ACCOUNT trong tháng
    DB-->>S: Rows
    S-->>C: {month, cells}
    C-->>API: 200 + data
    API-->>UI: Render lưới tuần, mỗi ô hiển thị N CTV
    UI-->>A: Hiển thị 5 ngày T2-T6 với badge ca Sáng/Chiều + số CTV

    A->>UI: Bấm vào ca có CTV
    UI->>UI: Mở modal Chi tiết ca làm việc (bảng Họ tên, SĐT, Phòng)
    A->>UI: Bấm tên CTV trong modal
    UI->>UI: Mở Hồ sơ & Lịch trình tài khoản CTV đó
```

## Luồng xem lịch sử tổng hợp

```mermaid
sequenceDiagram
    actor A as Admin
    box LỚP FRONTEND
        participant UI as SummaryScheduleScreen
        participant API as Shared API Client
    end
    box LỚP BACKEND
        participant C as Schedule Controller
        participant S as Schedule Service
    end
    box LỚP DỮ LIỆU
        participant DB as SQLite qua Prisma
    end

    A->>UI: Chuyển sang tab Lịch sử tổng hợp
    UI->>API: GET /api/v1/schedule-summary?month={tháng hiện tại}
    API->>C: Xác thực ADMIN + parse query
    C->>S: getScheduleSummary({month})
    S->>DB: Join SHIFT + ACTIVE SHIFT_ASSIGNMENT + ACCOUNT trong tháng
    DB-->>S: Rows
    S-->>C: {month, cells}
    C-->>API: 200 + data
    API-->>UI: Render lưới tháng
    UI->>UI: Lọc: chỉ render cell quá khứ (dateISO < todayISO)
    UI-->>A: Hiển thị lưới tháng, ngày quá khứ có số CTV, tương lai để trống

    A->>UI: Bấm chuyển tháng (chevron trái/phải)
    UI->>API: GET /api/v1/schedule-summary?month={tháng mới}
    API->>C: Xác thực + parse
    C->>S: getScheduleSummary({month mới})
    S->>DB: Truy vấn lại theo tháng mới
    DB-->>S: Rows
    S-->>C: DTO
    C-->>API: 200 + data
    API-->>UI: Cập nhật lưới
    UI-->>A: Hiển thị dữ liệu tháng mới (chỉ quá khứ)
```

## Luồng bấm xem chi tiết ca (dùng chung cả 2 tab)

```mermaid
sequenceDiagram
    actor A as Admin
    participant UI as SummaryScheduleScreen
    participant Modal as Chi tiết ca làm việc

    A->>UI: Bấm badge ca Sáng/Chiều có CTV
    UI->>Modal: Mở modal với ctvList (tên, SĐT, phòng)
    Modal-->>A: Bảng danh sách CTV + tổng số
    A->>Modal: Bấm tên một CTV
    Modal->>UI: onViewAccountDetail(ctv)
    UI-->>A: Mở Hồ sơ & Lịch trình tài khoản
```

## Chú thích

- `GET /api/v1/schedule-summary` hỗ trợ 2 dạng query: `?month=YYYY-MM` hoặc `?from=YYYY-MM-DD&to=YYYY-MM-DD` (XOR, không dùng chung). Backend trả về cùng cấu trúc `{cells}`.
- Truy vấn lọc `SHIFT.workDate` trong khoảng và `SHIFT_ASSIGNMENT.status=ACTIVE`; `roomCode` lấy từ từng assignment, không lấy từ `SHIFT`.
- Mỗi cell nhóm theo `workDate + period` và chứa `shiftId`; Admin dùng mã này để mở luồng chi tiết ca ở sơ đồ 12.
- Tab Lịch sử tổng hợp chỉ render quá khứ (`dateISO < todayISO` theo giờ `Asia/Bangkok`), tương lai để trống, giống logic CTV.
- Lịch tổng hợp và lịch cá nhân đọc cùng bảng assignment nên không cần một bản sao dữ liệu riêng.
