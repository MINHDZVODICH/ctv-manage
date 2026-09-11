# Ghi bù lịch sử làm việc

Backend chạy đối soát tự động theo cơ chế điều phối sự kiện (Event-Driven Scheduler):
- **Khởi động**: Chạy ngay một lượt đối soát (`reconcilePass()`) để ghi bù ngay lập tức mọi ngày làm việc bị lỡ trong thời gian backend ngừng hoạt động.
- **Hẹn giờ thông minh**: Sau khi hoàn thành lượt đối soát, hệ thống tự động tính toán thời điểm thức tiếp theo (`getNextWakeDelay`):
  - Nếu có lượt chạy thất bại cần thử lại: hẹn giờ chính xác vào thời điểm thử lại gần nhất (`nextAttemptAt`).
  - Nếu không có lượt lỗi: hẹn giờ chính xác vào mốc chốt ca **17:30 Asia/Bangkok** (10:30 UTC) của ngày kế tiếp.
  - Loại bỏ hoàn toàn vòng lặp busy polling 60 giây liên tục, loại bỏ lãng phí tài nguyên CPU và truy vấn cơ sở dữ liệu khi nhàn rỗi.
- **Môi trường hosting ngủ (Render Free Tier)**: Workflow GitHub Actions pings định kỳ trước và sau 17:30 các ngày trong tuần để đánh thức server nếu rơi vào trạng thái ngủ.

## Vòng đời và chuyển trạng thái SnapshotRun

```text
[Không tồn tại]
       │
       ▼
   PENDING ────(claimRun: leaseToken, leaseExpiresAt)────► RUNNING
                                                             │
                                   ┌─────────────────────────┴─────────────────────────┐
                                   ▼                                                   ▼
                               SUCCEEDED                                             FAILED
                    (Atomic tx: History + Cursor)                   (Record errorCode + nextAttemptAt)
                                                                                       │
                                                                   (Hẹn giờ thử lại: 1, 5, 15, 30 phút)
                                                                                       │
                                                                                       ▼
                                                                           PENDING / Thử lại claimRun
```

- `PENDING`: Ca của ngày làm việc đã đến hạn (từ 17:30) hoặc ngày quá khứ bị lỡ, sẵn sàng để worker nhận quyền xử lý.
- `RUNNING`: Worker nhận quyền (`claimRun`) thành công với `leaseToken` ngẫu nhiên và thời gian hết hạn hợp đồng thuê `leaseExpiresAt` (120 giây). Nếu worker bị sập, worker khác có thể nhận lại sau khi lease hết hạn.
- `SUCCEEDED`: Giao dịch xử lý thành công, tạo các bản ghi `History`, tịnh tiến mốc tiến độ `WorkHistoryProgress.lastProcessedDate`, và chuyển trạng thái sang `SUCCEEDED` trong cùng một database transaction.
- `FAILED`: Gặp lỗi trong quá trình thực thi. Worker ghi nhận mã lỗi chuẩn hóa (`errorCode`), tính toán thời điểm thử lại (`nextAttemptAt`) theo thuật toán backoff lũy tiến (1m, 5m, 15m, 30m) và trả lease.
- `MISSED`: Trạng thái kế thừa của các ngày trước ranh giới theo dõi hoặc không thể khôi phục an toàn.

## Mốc tiến độ


Bảng `WorkHistoryProgress` có một dòng `id = 'default'`:

- `trackingStartDate`: ngày đầu tiên được phép xử lý tự động.
- `lastProcessedDate`: đã xử lý liên tục đến hết ngày này. Ngày không có ca và ngày cuối tuần cũng được xử lý để mốc không bị kẹt.
- `updatedAt`: thời điểm mốc tiến độ được cập nhật gần nhất; không dùng trường này để xác định ngày cần ghi bù.

Mỗi lượt bắt đầu từ `lastProcessedDate + 1`. Trước 17:30, chỉ xử lý đến hôm qua; từ 17:30, được xử lý cả hôm nay. Thứ Bảy và Chủ nhật không tạo ca lịch sử. Tối đa 31 ngày lịch mỗi lượt; nếu còn tồn đọng, lượt sau tiếp tục.

Ví dụ: đã xử lý hết thứ Hai, backend tắt thứ Ba và thứ Tư, bật lại 08:00 thứ Năm → ghi bù thứ Ba và thứ Tư. Thứ Năm chờ đến giờ chốt. Backend bật lại vào cuối tuần vẫn ghi bù được các ngày làm việc trước đó.

## Ghi thành công và thử lại

Ghi `History`, chuyển `SnapshotRun` sang `SUCCEEDED` và cập nhật mốc nằm trong cùng transaction. Nếu một bước thất bại, cả ba bước được rollback. Mốc không vượt qua ngày lỗi. Thời gian thử lại lần lượt là 1, 5, 15 rồi 30 phút, tiếp tục qua nửa đêm.

Lease, khóa database và ràng buộc duy nhất `(accountId, workDate, period)` bảo vệ khi có nhiều backend hoặc chạy lại sau sự cố. Các ngày `SUCCEEDED` đã tồn tại được giữ nguyên. `MISSED` cũ chỉ được thử lại nếu nằm trong phạm vi theo dõi; các ngày trước ranh giới không bị động đến.

## Dữ liệu lịch tại giờ chốt

Migration tạo bảng `WorkHistorySource` và các deferred trigger trên `Account`, `Schedule`, `Shift`. Trigger lưu trạng thái cuối cùng của transaction, gồm điều kiện CTV hoạt động, buồng và các ca. Thay đổi bị rollback không tạo phiên bản lịch. Chỉnh thông tin không ảnh hưởng điều kiện làm việc như số điện thoại không tạo phiên bản mới.

Khi ghi bù, backend chọn phiên bản mới nhất có `effectiveAt <= 17:30` của ngày cần ghi. Vì vậy, sửa lịch hoặc vô hiệu hóa CTV hôm sau không làm thay đổi ca của hôm trước. `COMPLETED` vẫn có nghĩa là ca suy ra từ lịch đăng ký, không phải dữ liệu chấm công.

## Triển khai lần đầu

Chạy từ thư mục gốc dự án:

```powershell
npm run prisma:deploy
npm run prisma:generate
```

Dừng backend trong lúc cập nhật migration và Prisma Client rồi khởi động lại. Migration giữ nguyên lịch sử và các lần chốt cũ, tạo phiên bản nền của lịch hiện tại và thiết lập ranh giới:

- Migration hoàn tất trước 17:30: theo dõi từ hôm nay.
- Migration hoàn tất từ 17:30 trở đi: theo dõi từ ngày mai, vì không còn biết chắc lịch tại giờ chốt đã qua.

Không tự suy ra lịch sử trước ngày triển khai. Các khoảng thiếu cũ cần đối soát riêng. Mốc đã lưu là nguồn quyết định; thay đổi `SNAPSHOT_TRACKING_START_DATE` không tua lại mốc. Trong trường hợp chưa có dòng tiến độ, backend khởi tạo từ hôm nay hoặc ngày cấu hình trong tương lai, không từ một ngày cũ.

## Kiểm tra vận hành

```sql
SELECT "trackingStartDate", "lastProcessedDate", "updatedAt"
FROM "WorkHistoryProgress" WHERE "id" = 'default';

SELECT "workDate", "status", "attemptCount", "nextAttemptAt", "errorCode"
FROM "SnapshotRun" ORDER BY "workDate" DESC LIMIT 30;
```

Admin vẫn xem các lần chạy qua `GET /api/v1/operations/snapshot-runs`. Khi xử lý lỗi, giữ nguyên mốc tiến độ để lần chạy tiếp theo tự tiếp tục từ đúng ngày còn thiếu.
