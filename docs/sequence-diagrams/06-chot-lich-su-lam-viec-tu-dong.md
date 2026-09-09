# Chốt và ghi bù lịch sử làm việc

Quy tắc hiện hành: [Ghi bù theo mốc tiến độ](../WORK-HISTORY-RECOVERY.md).

```mermaid
sequenceDiagram
    participant Job as Khởi động / bộ hẹn giờ 60 giây
    participant S as SnapshotCoordinatorService
    participant DB as PostgreSQL
    Job->>S: reconcilePass()
    S->>DB: Đọc WorkHistoryProgress và giờ database
    loop Từng ngày từ lastProcessedDate + 1 đã qua giờ chốt
        alt Cuối tuần
            S->>DB: Tiến mốc, không tạo ca
        else Ngày làm việc
            S->>DB: Tạo hoặc đọc SnapshotRun, claim lease
            S->>DB: BEGIN và khóa mốc tiến độ
            S->>DB: Đọc phiên bản lịch tại 17:30 ngày cần ghi
            S->>DB: Ghi History, SUCCEEDED và lastProcessedDate
            alt Thành công
                S->>DB: COMMIT
            else Có lỗi
                S->>DB: ROLLBACK, lưu FAILED và giờ thử lại
                Note over S,DB: Dừng lượt, không vượt qua ngày lỗi
            end
        end
    end
```

Ngày không có ca vẫn hoàn tất với số dòng ghi bằng 0. Phạm vi tự động bắt đầu từ ranh giới triển khai được lưu trong database, không quét các ngày trước đó. Các lần thử lại dùng phiên bản lịch tại giờ chốt, không dùng lịch hiện tại để suy ngược.
