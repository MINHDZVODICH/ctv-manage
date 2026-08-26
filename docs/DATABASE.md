# Thiết kế cơ sở dữ liệu

## 1. Tài khoản, đăng ký và tệp

```mermaid
erDiagram
    ACCOUNT ||--o{ SESSION : "có"
    ACCOUNT ||--o{ ACCOUNT_FILE : "sở hữu"
    FILE_ASSET ||--o{ ACCOUNT_FILE : "được gắn"
    REGISTRATION_REQUEST ||--o{ REGISTRATION_REQUEST_FILE : "đính kèm"
    FILE_ASSET ||--o{ REGISTRATION_REQUEST_FILE : "được gắn"
    REGISTRATION_REQUEST o|--o| ACCOUNT : "tạo khi duyệt"

    ACCOUNT {
        string id PK
        string email UK
        string passwordHash
        string role
        string status
        int version
        boolean mustChangePassword
        string displayName
        string phone
        string ctvCode UK
        date dateOfBirth
        string gender
        string address
        string adminNotes
        datetime joinedAt
        datetime lastLoginAt
        datetime passwordChangedAt
        datetime createdAt
        datetime updatedAt
        datetime deletedAt
    }

    SESSION {
        string id PK
        string accountId FK
        string tokenHash UK
        datetime expiresAt
        datetime revokedAt
        string ipAddress
        string userAgent
        datetime createdAt
    }

    REGISTRATION_REQUEST {
        string id PK
        string email
        string passwordHash
        string displayName
        string phone
        date dateOfBirth
        string gender
        string address
        string status
        string rejectionReason
        string reviewedById FK
        string approvedAccountId FK
        datetime submittedAt
        datetime reviewedAt
        datetime updatedAt
    }

    FILE_ASSET {
        string id PK
        string storageKey UK
        string originalName
        string mimeType
        int sizeBytes
        string sha256
        string state
        datetime createdAt
        datetime deletedAt
    }

    REGISTRATION_REQUEST_FILE {
        string requestId PK,FK
        string fileId PK,FK
        string category
    }

    ACCOUNT_FILE {
        string accountId PK,FK
        string fileId PK,FK
        string category
        datetime createdAt
        datetime deletedAt
    }
```

### Mã giá trị

| Trường | Giá trị hợp lệ |
|---|---|
| `ACCOUNT.email`, `REGISTRATION_REQUEST.email` | Chuẩn hóa trim và lowercase trước khi lưu |
| `ACCOUNT.role` | `ADMIN`, `CTV` |
| `ACCOUNT.status` | `ACTIVE`, `DISABLED` |
| `ACCOUNT.version` | Bắt đầu từ `1`, tăng sau mỗi lần cập nhật có kiểm soát đồng thời |
| `REGISTRATION_REQUEST.status` | `PENDING`, `APPROVED`, `REJECTED` |
| `REGISTRATION_REQUEST.passwordHash` | Bắt buộc khi `PENDING`; đặt `NULL` ngay khi hồ sơ được duyệt hoặc từ chối |
| `FILE_ASSET.state` | `STAGED`, `ACTIVE`, `QUARANTINED`, `DELETED` |
| File category | `AVATAR`, `CCCD_FRONT`, `CCCD_BACK`, `CV` |

## 2. Lịch làm việc

```mermaid
erDiagram
    ACCOUNT ||--o{ SCHEDULE_REGISTRATION : "đăng ký mẫu"
    SCHEDULE_REGISTRATION ||--|{ SCHEDULE_PATTERN_SLOT : "gồm"
    SCHEDULE_REGISTRATION ||--o{ SHIFT_ASSIGNMENT : "sinh phân công"
    ACCOUNT ||--o{ SHIFT_ASSIGNMENT : "được phân công"
    SHIFT ||--o{ SHIFT_ASSIGNMENT : "có CTV"

    SCHEDULE_REGISTRATION {
        string id PK
        string accountId FK
        date startDate
        date endDate
        string timeZone
        string roomCode
        int version
        string status
        datetime createdAt
        datetime updatedAt
        datetime cancelledAt
    }

    SCHEDULE_PATTERN_SLOT {
        string registrationId PK,FK
        int weekday PK
        string period PK
    }

    SHIFT {
        string id PK
        date workDate
        string period
        datetime createdAt
        datetime updatedAt
    }

    SHIFT_ASSIGNMENT {
        string id PK
        string shiftId FK
        string accountId FK
        string registrationId FK
        string roomCode
        string status
        datetime assignedAt
        datetime cancelledAt
        string cancellationReason
        datetime updatedAt
    }
```

### Mã giá trị và constraint

| Trường | Giá trị hoặc constraint |
|---|---|
| `period` | `MORNING`, `AFTERNOON` |
| `weekday` | `1` đến `5`, tương ứng Thứ 2 đến Thứ 6 |
| `roomCode` | `ROOM_1`, `ROOM_2`, `ROOM_3`, `ROOM_4` |
| `timeZone` | IANA time zone; phiên bản hiện tại dùng `Asia/Bangkok` |
| `SCHEDULE_REGISTRATION.status` | `ACTIVE`, `CANCELLED`, `EXPIRED` |
| `SHIFT_ASSIGNMENT.status` | `ACTIVE`, `CANCELLED` |
| `SCHEDULE_REGISTRATION` | `endDate >= startDate`, `version >= 1` |
| `SCHEDULE_REGISTRATION` | Tối đa một bản ghi `ACTIVE` cho mỗi `accountId` |
| `SCHEDULE_PATTERN_SLOT` | unique `(registrationId, weekday, period)` |
| `SHIFT` | unique `(workDate, period)` |
| `SHIFT_ASSIGNMENT` | unique `(shiftId, accountId)` và `(registrationId, shiftId)` |

## 3. Index

| Bảng | Index |
|---|---|
| `ACCOUNT` | unique `email`; unique nullable `ctvCode`; `(status, deletedAt)` |
| `SESSION` | unique `tokenHash`; `(accountId, revokedAt, expiresAt)`; `expiresAt` |
| `REGISTRATION_REQUEST` | unique `(email)` khi `status = PENDING`; `(status, submittedAt DESC)`; `email`; `(reviewedById, reviewedAt)` |
| `REGISTRATION_REQUEST_FILE` | unique `(requestId, category)` |
| `FILE_ASSET` | unique `storageKey`; `(state, createdAt)`; `sha256` |
| `ACCOUNT_FILE` | unique `(accountId, category)` khi `deletedAt IS NULL`; `(accountId, category, deletedAt)` |
| `SCHEDULE_REGISTRATION` | unique `(accountId)` khi `status = ACTIVE`; `(accountId, status, startDate, endDate)` |
| `SHIFT` | unique `(workDate, period)` |
| `SHIFT_ASSIGNMENT` | unique `(shiftId, accountId)`; unique `(registrationId, shiftId)`; `(accountId, status)`; `(registrationId, status)` |
