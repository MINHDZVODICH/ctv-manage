# Sequence diagram - Chốt lịch sử làm việc tự động vào 17:30

Nguồn nghiệp vụ: Use case 2.3 trong [USE-CASE.md](../USE-CASE.md).

```mermaid
sequenceDiagram
    actor Cron as Bộ hẹn giờ hệ thống / Startup Recovery
    box LỚP BACKEND
        participant M as Main / Background Runner
        participant S as Schedule Service
    end
    box LỚP DỮ LIỆU
        participant DB as PostgreSQL qua Prisma
    end

    alt Đến mốc 17:30 Asia/Bangkok hằng ngày (T2 - T6)
        Cron->>M: Kích hoạt tác vụ định kỳ 17:30 (UTC+7 / 10:30 UTC)
    else Máy chủ khởi động lại (Startup Recovery)
        Cron->>M: Khởi chạy tiến trình main.ts
    end

    M->>S: snapshotTodayWorkHistory(now)
    S->>S: Chuyển đổi mốc thời gian sang Asia/Bangkok (UTC+7)
    S->>S: Kiểm tra giờ và thứ trong tuần (jsDay)

    alt Trước mốc 17:30 Bangkok (hours < 17 hoặc (hours == 17 và minutes < 30))
        S-->>M: { processedCount: 0, skipped: true, reason: 'BEFORE_CUTOFF' }
    else Ngày cuối tuần (Thứ 7 hoặc Chủ Nhật)
        S-->>M: { processedCount: 0, skipped: true, reason: 'WEEKEND' }
    else Thứ 2 đến Thứ 6 và sau mốc 17:30 Bangkok
        S->>S: Xác định todayUtc = parseYmdToUtcDate(YYYY-MM-DD)
        S->>DB: prisma.account.findMany(role: CTV, status: ACTIVE, deletedAt: null,<br/>schedule: isNot null, include: { schedule: { include: shifts } })
        DB-->>S: Danh sách tài khoản CTV ACTIVE kèm lịch và ca
        S->>S: Lọc các ca làm việc có shift.weekday == jsDay hôm nay
        S->>S: Tạo mảng historyEntries: [{ accountId, workDate: todayUtc,<br/>period, roomCode, status: 'COMPLETED' }]

        alt Không có ca nào khớp với ngày hôm nay
            S-->>M: { processedCount: 0 }
        else Có ca làm việc cần chốt
            S->>DB: prisma.history.createMany({ data: historyEntries, skipDuplicates: true })
            DB-->>S: { count: processedCount }
            S-->>M: { processedCount }
        end
    end
```

## Chú thích

- Snapshot chạy hoàn toàn độc lập ở tầng Backend, không phụ thuộc vào bất kỳ request nào từ giao diện người dùng (không chạy ngầm trong API GET lịch).
- Mốc chốt ca cố định là **17:30 Asia/Bangkok** (tức 10:30 UTC), áp dụng cho các ngày làm việc trong tuần (Thứ 2 đến Thứ 6).
- Nếu hàm được gọi trước 17:30, hệ thống bỏ qua và trả về lý do `BEFORE_CUTOFF`. Nếu ngày là Thứ 7 hoặc Chủ Nhật, hệ thống bỏ qua với lý do `WEEKEND`.
- Khi máy chủ khởi động lại sau 17:30, tiến trình `main.ts` tự động kích hoạt `snapshotTodayWorkHistory()` một lần (Startup Recovery) để đảm bảo không bị bỏ sót ca của ngày hôm nay nếu xảy ra sự cố sập nguồn trước đó.
- Tính lũy tiến và bất biến (Idempotent): Sử dụng `prisma.history.createMany({ skipDuplicates: true })` kết hợp với ràng buộc duy nhất `@@unique([accountId, workDate, period])` trong bảng `History`. Chạy lại nhiều lần trong cùng ngày không sinh ra bản ghi trùng lặp và không ghi đè dữ liệu lịch sử đã chốt.
- Tuyệt đối **không backfill**: Hệ thống chỉ snapshot duy nhất ca của ngày hôm nay (`todayUtc`), loại bỏ hoàn toàn việc quét lùi 14 ngày cũ.
- Dữ liệu trong bảng `History` là bất biến (immutable), phản ánh chính xác các ca thực tế đã diễn ra. Việc CTV cập nhật mẫu lịch tuần sau 17:30 hoàn toàn không ảnh hưởng đến các bản ghi lịch sử đã chốt.
