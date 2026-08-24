# ARCHITECTURE

## 1. Kiến trúc tổng thể

```mermaid
flowchart LR
    User[Admin / CTV]

    subgraph Frontend[FRONTEND]
        App[App Shell]
        Features[Feature Modules]
        Client[Shared API Client]

        App --> Features
        Features --> Client
    end

    subgraph Backend[BACKEND]
        Middleware[Middleware]
        Controller[Feature Controllers]
        Service[Feature Services]
        Data[Prisma và File Storage]

        Middleware --> Controller --> Service --> Data
    end

    User --> App
    Client -->|REST JSON + session cookie| Middleware
    Data --> DB[(SQLite)]
    Data --> Files[(Private Local File Storage)]
```

Luồng xử lý bắt buộc:

```text
User
  -> React Screen/Modal
  -> feature hook
  -> shared API Client
  -> Express middleware
  -> route/controller
  -> feature service
  -> Prisma hoặc file storage
  -> SQLite hoặc local filesystem
```

## 2. Kiến trúc Frontend

```mermaid
flowchart TB
    Main[main.tsx]
    Settings[SystemSettingsProvider]
    App[App.tsx<br/>App Shell]
    Sidebar[Sidebar]
    Navigation[ViewTab Navigation]
    Overlay[Global Overlays]
    Screen[Feature Screen hoặc Modal]
    Hook[Feature Hook]
    APIClient[shared/api/client.ts]
    Shared[Shared UI và Utilities]
    ScheduleStorage[scheduleStorage<br/>chỉ dùng khi chuyển tiếp]
    LocalStorage[(Browser localStorage)]

    Main --> Settings --> App
    App --> Sidebar
    App --> Navigation --> Screen
    App --> Overlay
    Screen --> Hook --> APIClient
    Screen --> Shared
    Hook -. riêng feature lịch .-> ScheduleStorage --> LocalStorage
    APIClient -->|HTTPS / JSON| REST[Express REST API]
```

### Các feature

| Feature | Giao diện hiển thị |
|---|---|
| `auth` | Đăng nhập, đăng xuất, session, đổi mật khẩu và RBAC. |
| `accounts` | Tài khoản và trạng thái. |
| `registration-requests` | Đăng ký, duyệt/từ chối. |
| `schedules` | Mẫu lịch, chọn phòng, cập nhật và hủy ca. |
| `profile` | Hồ sơ cá nhân. |
| `notifications` | Thông báo được sinh từ nghiệp vụ nguồn. |

### Cấu trúc thư mục Frontend

```text
app/frontend/src/
  main.tsx
  app/
    App.tsx
    Sidebar.tsx
  features/
    auth/
    accounts/
    registration-requests/
    schedules/
    profile/
    notifications/
  shared/
    api/
      client.ts
      contracts.ts
      errors.ts
    context/
      SystemSettingsContext.tsx
    ui/
    utils/
      formatters.ts
      scheduleSelectors.ts
    types.ts
```

## 3. Kiến trúc Backend

```mermaid
flowchart TB
    Request[HTTPS Request]

    Middleware[Security, Session, Rate Limit, Request ID]
    Controller[Feature Route + Controller + Zod Schema]
    Service[Feature Service<br/>Business Rules + Authorization + Transaction]
    Prisma[Shared Prisma Client]
    Storage[Shared File Storage]
    Audit[Pino Audit Log]
    ErrorHandler[Central Error Handler]

    Request --> Middleware --> Controller --> Service
    Service --> Prisma --> DB[(SQLite)]
    Service --> Storage --> Files[(Private Upload Directory)]
    Service --> Audit
    Controller --> Response[JSON Response]
    Service -. throws typed error .-> Controller
    Controller -. next error .-> ErrorHandler --> Response
```

### Các module

| Module | Dữ liệu và nghiệp vụ sở hữu |
|---|---|
| `auth` | Đăng nhập, đăng xuất, session, đổi mật khẩu và RBAC. |
| `accounts` | Tài khoản, hồ sơ CTV, vai trò và trạng thái. |
| `registration-requests` | Đăng ký, duyệt/từ chối và tệp CCCD/CV. |
| `schedules` | Mẫu lịch, chọn phòng, cập nhật và hủy ca. |
| `notifications` | Thông báo được sinh từ nghiệp vụ nguồn. |

### Cấu trúc một module

```text
app/backend/src/
  server.ts
  app.ts
  middleware/
    auth.middleware.ts
    csrf.middleware.ts
    request-id.middleware.ts
  shared/
    prisma.ts
    session.ts
    file-storage.ts
    logger.ts
    api-error.ts
  modules/
    schedules/
      schedule.routes.ts
      schedule.controller.ts
      schedule.schemas.ts
      schedule.service.ts
      schedule.dto.ts
      schedule.repository.ts    # Chỉ thêm khi truy vấn đủ phức tạp
      index.ts
```

## 4. Tech stack

| Khu vực | Công nghệ được chọn |
|---|---|
| Language | TypeScript strict |
| Frontend | React 19, Vite 6; App Shell mỏng, tổ chức theo feature và giữ điều hướng `ViewTab` trong giai đoạn tương thích prototype |
| Styling | Tailwind CSS 4 |
| State Frontend | Feature hooks với React `useState`, `useEffect`; `SystemSettingsContext` chỉ giữ thiết lập giao diện |
| Form và validation | Controlled form state; Zod |
| Backend | Node.js 22 LTS, Express 4 |
| Database | SQLite, Prisma ORM |
| File storage | Private local filesystem; database lưu metadata và `storageKey` tương đối |
| Authentication | Server-side session và secure cookie |
| Password hashing | Argon2id |
| API | RESTful API |
| Logging | Pino structured JSON |
| Deployment | Docker và CI pipeline |
