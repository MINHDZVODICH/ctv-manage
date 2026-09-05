**VIỆN KHOA HỌC VÀ CÔNG NGHỆ QUÂN SỰ**

**VIỆN CÔNG NGHỆ THÔNG TIN - ĐIỆN TỬ**

––––––––––––––––––––––

**Use case**

# HỆ THỐNG WEBSITE QUẢN LÝ VÀ ĐIỀU PHỐI LỊCH TRÌNH CỘNG TÁC VIÊN

**Hà Nội, tháng 8 năm 2026**

## MỤC LỤC

- [I. Danh sách tác nhân](#i-danh-sách-tác-nhân)
- [II. Danh sách use case](#ii-danh-sách-use-case)
- [III. Đặc tả chi tiết use case](#iii-đặc-tả-chi-tiết-use-case)
  - [1. Quản lý tài khoản và hồ sơ CTV](#1-quản-lý-tài-khoản-và-hồ-sơ-ctv)
    - [1.1. Đăng nhập](#11-đăng-nhập)
    - [1.2. Đăng xuất](#12-đăng-xuất)
    - [1.3. Đăng ký tài khoản](#13-đăng-ký-tài-khoản)
    - [1.4. Quản lý danh sách tài khoản](#14-quản-lý-danh-sách-tài-khoản)
    - [1.5. Kích hoạt/vô hiệu hóa tài khoản](#15-kích-hoạtvô-hiệu-hóa-tài-khoản)
    - [1.6. Xóa tài khoản](#16-xóa-tài-khoản)
    - [1.7. Xem thông tin tài khoản](#17-xem-thông-tin-tài-khoản)
    - [1.8. Cập nhật thông tin hồ sơ](#18-cập-nhật-thông-tin-hồ-sơ)
    - [1.9. Đổi/đặt lại mật khẩu](#19-đổiđặt-lại-mật-khẩu)
    - [1.10. Duyệt yêu cầu đăng ký tài khoản](#110-duyệt-yêu-cầu-đăng-ký-tài-khoản)
    - [1.11. Cài đặt hệ thống](#111-cài-đặt-hệ-thống)
  - [2. Quản lý lịch trình](#2-quản-lý-lịch-trình)
    - [2.1. Đăng ký/cập nhật lịch làm việc của CTV](#21-đăng-kýcập-nhật-lịch-làm-việc-của-ctv)
    - [2.2. Xem lịch tuần và lịch sử làm việc của CTV (Chỉ đọc)](#22-xem-lịch-tuần-và-lịch-sử-làm-việc-của-ctv-chỉ-đọc)
    - [2.3. Chốt lịch sử làm việc tự động vào 17:30](#23-chốt-lịch-sử-làm-việc-tự-động-vào-1730)
    - [2.4. Xem lịch làm việc tổng hợp](#24-xem-lịch-làm-việc-tổng-hợp)
    - [2.5. Xem chi tiết ca và hồ sơ CTV](#25-xem-chi-tiết-ca-và-hồ-sơ-ctv)

## I. Danh sách tác nhân

Hệ thống gồm 2 tác nhân sử dụng hệ thống sau đăng nhập và 1 tác nhân khởi tạo yêu cầu đăng ký:

| **Mã**   | **Tác nhân**             | **Loại**                  | **Mô tả và quyền hạn chính**                                                                                         |
|----------|--------------------------|---------------------------|----------------------------------------------------------------------------------------------------------------------|
| **AC-1** | Quản trị viên (Admin)    | Người dùng đặc quyền      | Quản lý tài khoản và hồ sơ CTV, duyệt yêu cầu đăng ký, xem lịch làm việc tổng hợp.                                  |
| **AC-2** | Cộng tác viên (CTV)      | Người dùng                | Quản lý hồ sơ cá nhân; đăng ký/cập nhật mẫu lịch; xem lịch tuần cá nhân và lịch sử làm việc theo tháng. |
| **AC-3** | Người đăng ký tài khoản  | Người dùng chưa xác thực  | Nhập thông tin, đính kèm hồ sơ tùy chọn và gửi yêu cầu đăng ký tài khoản CTV để Admin xem xét.                      |

Mỗi tài khoản đã được phê duyệt có đúng một vai trò cố định là Admin hoặc CTV. Giao diện và API phân quyền theo vai trò của phiên đăng nhập; hệ thống không cung cấp chức năng chuyển đổi vai trò.

## II. Danh sách use case

|                                                      |                                   |                                                                                                                        |
|------------------------------------------------------|-----------------------------------|------------------------------------------------------------------------------------------------------------------------|
| **Mã**                                               | **Use Case**                      | **Mô tả**                                                                                                              |
| **Phân hệ 1 – Quản lý tài khoản và hồ sơ CTV**       |                                   |                                                                                                                        |
| **1.1**                                              | Đăng nhập                         | Xác thực người dùng để có thể sử dụng một số tính năng của hệ thống theo quyền hạn                                     |
| **1.2**                                              | Đăng xuất                         | Người dùng kết thúc phiên làm việc trên hệ thống                                                                       |
| **1.3**                                              | Đăng ký tài khoản                 | CTV nhập thông tin, đính kèm CCCD/CV tùy chọn và gửi yêu cầu chờ Admin duyệt.                                          |
| **1.4**                                              | Quản lý danh sách tài khoản       | Hiển thị danh sách CTV, hỗ trợ tìm kiếm, phân trang và các thao tác đặt lại mật khẩu, khóa/mở khóa hoặc xóa tài khoản. |
| **1.5**                                              | Kích hoạt/vô hiệu hóa tài khoản   | Cho phép hoặc chặn người dùng truy cập hệ thống thông qua tài khoản                                                    |
| **1.6**                                              | Xoá tài khoản                     | Admin xóa tài khoản CTV sau bước cảnh báo và xác nhận.                                                                 |
| **1.7**                                              | Xem thông tin tài khoản           | Admin xem hồ sơ đính kèm và lịch trình CTV; người dùng xem hồ sơ cá nhân của mình. Thao tác đặt lại mật khẩu được mở từ danh sách tài khoản.       |
| **1.8**                                              | Cập nhật thông tin hồ sơ          | Admin/CTV cập nhật thông tin cá nhân và tệp hồ sơ của chính mình.                                                       |
| **1.9**                                              | Đổi/đặt lại mật khẩu              | Người dùng đổi mật khẩu cá nhân; Admin đặt lại bằng mật khẩu do hệ thống tự sinh cho CTV.                              |
| **1.10**                                             | Duyệt yêu cầu đăng ký tài khoản   | Admin xem, duyệt hoặc từ chối yêu cầu đăng ký đang chờ.                                                                |
| **1.11**                                             | Cài đặt hệ thống                  | Người dùng mở bảng cài đặt và thay đổi giao diện, độ tương phản, màu điểm nhấn hoặc ngôn ngữ.                         |
| **Phân hệ 2 – Quản lý lịch trình**                   |                                   |                                                                                                                        |
| **2.1**                                              | Đăng ký/cập nhật lịch làm việc của CTV | CTV chọn buồng và mẫu ca cố định Thứ 2–Thứ 6; mẫu lặp lại hằng tuần cho đến khi được cập nhật qua nút Cập nhật. |
| **2.2**                                              | Xem lịch tuần và lịch sử làm việc của CTV (Chỉ đọc) | CTV xem ca cá nhân hiện hành theo tuần hoặc lịch sử làm việc theo tháng hoàn toàn ở chế độ chỉ đọc (Read-only) với huy hiệu ShiftBadge. |
| **2.3**                                              | Chốt lịch sử làm việc tự động vào 17:30 | Hệ thống tự động snapshot lịch làm việc hôm nay vào History lúc 17:30 Asia/Bangkok hằng ngày (không snapshot cuối tuần, không backfill). |
| **2.4**                                              | Xem lịch tuần tổng hợp và lịch sử tổng hợp     | Admin xem CTV làm việc hôm nay và lịch tổng hợp theo tuần/tổng hợp lịch sử theo tháng, giống hệt giao diện CTV nhưng mỗi ca hiển thị số lượng CTV và danh sách chi tiết. |
| **2.5**                                              | Xem chi tiết ca và hồ sơ CTV      | Admin xem danh sách CTV trong ca và mở hồ sơ, CV, lịch trình hoặc ghi chú của từng người.                              |

## III. Đặc tả chi tiết use case

### 1. Quản lý tài khoản và hồ sơ CTV

#### 1.1. Đăng nhập

*a. Tác nhân & Phân quyền*

- Tác nhân: Quản trị viên (AC-1), Cộng tác viên (AC-2)
- Vai trò yêu cầu: Chưa xác thực (Khách vãng lai / Public)
- Sequence diagram: [01-dang-nhap.md](sequence-diagrams/01-dang-nhap.md)
- API endpoint: `POST /api/v1/auth/sessions`

*b. Điều kiện ban đầu*

- Người dùng chưa đăng nhập hoặc đã đăng xuất khỏi hệ thống.

*c. Điều kiện đối với kết quả*

- Người dùng được đưa vào giao diện hệ thống và nhận thông báo đăng nhập thành công. Cookie phiên `token` được trình duyệt lưu trữ an toàn.

*d. Kịch bản thành công chính*

<table>
<colgroup>
<col style="width: 10%" />
<col style="width: 39%" />
<col style="width: 50%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Bước</strong></th>
<th><strong>Thao tác của tác nhân</strong></th>
<th><strong>Phản ứng của hệ thống</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>1</td>
<td>Người dùng truy cập hệ thống</td>
<td></td>
</tr>
<tr class="even">
<td>2</td>
<td></td>
<td><p>Hệ thống hiển thị màn hình Đăng nhập với biểu mẫu ở giữa:</p>
<p>- Nhận diện Viện Khoa học và Công nghệ Quân sự</p>
<p>- Tiêu đề Đăng nhập</p>
<p>- Trường Email</p>
<p>- Trường Mật khẩu và nút hiển thị/che ký tự</p>
<p>- Nút Đăng nhập và Tạo tài khoản mới</p></td>
</tr>
<tr class="odd">
<td>3</td>
<td>Người dùng nhập Email, Mật khẩu và nhấn Đăng nhập</td>
<td></td>
</tr>
<tr class="even">
<td>4</td>
<td></td>
<td>Nút Đăng nhập chuyển sang “Đang xử lý...” và tạm thời bị vô hiệu hóa.</td>
</tr>
<tr class="odd">
<td>5</td>
<td></td>
<td>Hệ thống mở giao diện theo vai trò hiện tại và hiển thị thông báo “Đăng nhập thành công với {email}”.</td>
</tr>
</tbody>
</table>

*e. Các trường hợp khác*

- Tại bước 3, nếu Email hoặc Mật khẩu để trống, hệ thống hiển thị “Vui lòng nhập trường này!” và không thực hiện đăng nhập.

- Thông báo bắt buộc được đặt ngay dưới trường còn thiếu, căn phải và không có nền màu bao quanh.

- Tại bước 3, nếu Email hoặc Mật khẩu không đúng, hệ thống hiển thị “Email hoặc mật khẩu không đúng” ngay dưới tiêu đề Đăng nhập và phía trên biểu mẫu.

- Tại bước 3, nếu tài khoản đã bị vô hiệu hóa, hệ thống hiển thị “Tài khoản đã bị vô hiệu hóa” tại cùng vị trí thông báo đăng nhập thất bại và không tạo phiên đăng nhập.

- Tại bước 3, nếu người dùng nhấn biểu tượng mắt trong trường Mật khẩu, hệ thống chuyển giữa chế độ hiển thị và che ký tự.

- Tại bước 2, nếu người dùng chọn Tạo tài khoản mới, hệ thống chuyển sang luồng đăng ký.

#### 1.2. Đăng xuất

*a. Tác nhân & Phân quyền*

- Tác nhân: Quản trị viên (AC-1), Cộng tác viên (AC-2)
- Vai trò yêu cầu: `ADMIN` hoặc `CTV`
- Sequence diagram: [08-dang-xuat.md](sequence-diagrams/08-dang-xuat.md)
- API endpoint: `DELETE /api/v1/auth/sessions/current` (hoặc `/api/v1/auth/sessions/me`)

*b. Điều kiện ban đầu*

- Người dùng đã đăng nhập thành công vào hệ thống.

*c. Điều kiện đối với kết quả*

- Phiên làm việc trên máy chủ bị thu hồi (`revokedAt = now()`), cookie `token` bị xóa khỏi trình duyệt và màn hình Đăng nhập được hiển thị.

*d. Kịch bản thành công chính*

| **Bước** | **Thao tác của tác nhân**                                        | **Phản ứng của hệ thống**                                                               |
|----------|------------------------------------------------------------------|-----------------------------------------------------------------------------------------|
| 1        | Người dùng nhấn khối thông tin tài khoản ở cuối thanh điều hướng |                                                                                         |
| 2        |                                                                  | Hệ thống mở menu gồm Hồ sơ cá nhân, Cài đặt hệ thống và Đăng xuất.                      |
| 3        | Người dùng nhấn Đăng xuất                                        |                                                                                         |
| 4        |                                                                  | Hệ thống gọi API hủy phiên, xóa cookie, quay về màn hình Đăng nhập và thông báo “Đã đăng xuất khỏi hệ thống”. |

*e. Các trường hợp khác*

- Không có trường hợp khác nên không phát sinh bước thay thế.

#### 1.3. Đăng ký tài khoản

*a. Tác nhân & Phân quyền*

- Tác nhân: Người đăng ký tài khoản chưa có tài khoản hệ thống (AC-3)
- Vai trò yêu cầu: Chưa xác thực (Public)
- Sequence diagram: [02-dang-ky.md](sequence-diagrams/02-dang-ky.md)
- API endpoint: `POST /api/v1/registration-requests` (multipart/form-data)

*b. Điều kiện ban đầu*

- Người dùng đang ở màn hình Đăng nhập và nhấn nút Tạo tài khoản mới.

*c. Điều kiện đối với kết quả*

- Yêu cầu đăng ký cùng các tệp CCCD, CV được lưu trữ an toàn ở trạng thái `PENDING` và giao diện thông báo thành công.

*d. Kịch bản thành công chính*

<table>
<colgroup>
<col style="width: 10%" />
<col style="width: 39%" />
<col style="width: 50%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Bước</strong></th>
<th><strong>Thao tác của tác nhân</strong></th>
<th><strong>Phản ứng của hệ thống</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>1</td>
<td>Người dùng nhấn Tạo tài khoản mới trên màn hình Đăng nhập</td>
<td></td>
</tr>
<tr class="even">
<td>2</td>
<td></td>
<td><p>Hệ thống hiển thị màn hình Đăng ký với biểu mẫu:</p>
<p>- Tiêu đề Đăng ký tài khoản</p>
<p>- Trường Họ và tên</p>
<p>- Ngày sinh bằng ba hộp chọn Ngày/Tháng/Năm</p>
<p>- Trường Email và Số điện thoại</p>
<p>- Vùng tải ảnh CCCD mặt trước/mặt sau (JPG, PNG)</p>
<p>- Vùng tải CV ứng tuyển (PDF)</p>
<p>- Mật khẩu và Nhập lại mật khẩu, có nút hiển thị/che ký tự</p>
<p>- Nút Đăng ký và Đăng nhập</p></td>
</tr>
<tr class="odd">
<td>3</td>
<td>Người dùng nhập đủ thông tin và nhấn Đăng ký</td>
<td></td>
</tr>
<tr class="even">
<td>4</td>
<td></td>
<td>Nút Đăng ký chuyển sang “Đang xử lý...” trong khi hệ thống kiểm tra dữ liệu.</td>
</tr>
<tr class="odd">
<td>5</td>
<td></td>
<td><p>Hiển thị tiêu đề “Gửi yêu cầu đăng ký thành công!”.</p>
<p>Hiển thị nội dung “Hồ sơ ứng tuyển và thông tin của bạn đang được Ban Quản trị xem xét phê duyệt. Vui lòng theo dõi email để nhận thông báo kết quả.”.</p>
<p>Hiển thị dòng đếm ngược tự động chuyển đến trang đăng nhập sau 3 giây.</p></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td>Hệ thống tự động quay về Đăng nhập; người dùng cũng có thể chọn Chuyển sang trang đăng nhập ngay.</td>
</tr>
</tbody>
</table>

*e. Các trường hợp khác*

- Tại bước 3, nếu thiếu Họ và tên, Email, Số điện thoại, Mật khẩu hoặc Nhập lại mật khẩu, trường tương ứng hiển thị lỗi bắt buộc. Nếu Email đã tồn tại hoặc đang có yêu cầu chờ duyệt, hệ thống hiển thị “Email đã tồn tại hoặc đang chờ duyệt”.

- Tại bước 3, nếu hai mật khẩu không khớp, trường Nhập lại mật khẩu hiển thị “Mật khẩu phải trùng khớp!”. Ảnh CCCD và CV là tài liệu đính kèm tùy chọn; ảnh chỉ nhận JPG/PNG và CV chỉ nhận PDF khi được chọn.

#### 1.4. Quản lý danh sách tài khoản

*a. Tác nhân & Phân quyền*

- Tác nhân: Quản trị viên (AC-1)
- Vai trò yêu cầu: `ADMIN`
- Sequence diagram: [09-quan-ly-tai-khoan.md](sequence-diagrams/09-quan-ly-tai-khoan.md)
- API endpoint: `GET /api/v1/accounts?page=&pageSize=&q=&status=&role=`

*b. Điều kiện ban đầu*

- Quản trị viên đã đăng nhập thành công và đang ở giao diện quản trị.

*c. Điều kiện đối với kết quả*

- Danh sách phản ánh từ khóa tìm kiếm, trang hiện tại và kết quả sau thao tác đặt lại mật khẩu, khóa/mở khóa hoặc xóa tài khoản.

*d. Kịch bản thành công chính*

<table>
<colgroup>
<col style="width: 10%" />
<col style="width: 39%" />
<col style="width: 50%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Bước</strong></th>
<th><strong>Thao tác của tác nhân</strong></th>
<th><strong>Phản ứng của hệ thống</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>1</td>
<td>Quản trị viên chọn Quản lý tài khoản trên thanh điều hướng</td>
<td></td>
</tr>
<tr class="even">
<td>2</td>
<td></td>
<td><p>Màn hình Danh sách tài khoản gồm:</p>
<p>- Tiêu đề và tổng số tài khoản CTV</p>
<p>- Ô tìm theo Họ tên, Email hoặc SĐT</p>
<p>- Nút Làm mới</p>
<p>- Bảng STT, Họ và tên, Số điện thoại, Ngày đăng ký, Thao tác</p>
<p>- Vùng Họ tên/ảnh đại diện mở chi tiết tài khoản</p>
<p>- Biểu tượng đặt lại mật khẩu, khóa/mở khóa và xóa, có chú thích khi di chuột</p>
<p>- Tối đa 5 tài khoản trên mỗi trang</p>
<p>- Thanh phân trang ở cuối bảng</p></td>
</tr>
<tr class="odd">
<td>3</td>
<td>Quản trị viên nhập từ khóa hoặc chuyển trang</td>
<td></td>
</tr>
<tr class="even">
<td>4</td>
<td></td>
<td>Hệ thống lọc danh sách tức thời, giữ tối đa 5 dòng mỗi trang và đưa phân trang về trang đầu khi từ khóa thay đổi.</td>
</tr>
<tr class="odd">
<td>5</td>
<td>Quản trị viên dùng Đặt lại, nhấn Họ tên/ảnh đại diện hoặc chọn biểu tượng tại cột Thao tác</td>
<td></td>
</tr>
<tr class="even">
<td>6</td>
<td></td>
<td>Hệ thống thực hiện thao tác tương ứng: đặt lại danh sách, mở chi tiết hồ sơ, mở hộp Đặt lại mật khẩu, đổi trạng thái hoặc bắt đầu luồng xóa tài khoản.</td>
</tr>
</tbody>
</table>

*e. Các trường hợp khác*

- Tại bước 4, khi không có kết quả phù hợp, bảng hiển thị “Không tìm thấy tài khoản phù hợp với điều kiện tìm kiếm.”; nút Làm mới xóa từ khóa và đưa phân trang về trang đầu.

- Tại bước 5, nếu quản trị viên nhấn vùng Họ tên hoặc ảnh đại diện, hệ thống mở cửa sổ Hồ sơ & Lịch trình tài khoản của đúng CTV.

- Tại bước 5, nếu quản trị viên chuyển trang, hệ thống hiển thị tối đa 5 tài khoản trên mỗi trang và giữ nguyên từ khóa tìm kiếm.

#### 1.5. Kích hoạt/vô hiệu hóa tài khoản

*a. Tác nhân & Phân quyền*

- Tác nhân: Quản trị viên (AC-1)
- Vai trò yêu cầu: `ADMIN`
- Sequence diagram: [09-quan-ly-tai-khoan.md](sequence-diagrams/09-quan-ly-tai-khoan.md)
- API endpoint: `PATCH /api/v1/accounts/:id/status` (body: `{ status, expectedVersion }`)

*b. Điều kiện ban đầu*

- Quản trị viên đang ở Danh sách tài khoản.
- Tài khoản cần thao tác đang hiển thị trong bảng Danh sách tài khoản.

*c. Điều kiện đối với kết quả*

- Trạng thái tài khoản được chuyển giữa `ACTIVE` và `DISABLED`. Khi vô hiệu hóa, toàn bộ phiên làm việc của tài khoản bị thu hồi ngay lập tức. Biểu tượng thao tác trên bảng được cập nhật tương ứng.

*d. Kịch bản thành công chính*

<table>
<colgroup>
<col style="width: 10%" />
<col style="width: 39%" />
<col style="width: 50%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Bước</strong></th>
<th><strong>Thao tác của tác nhân</strong></th>
<th><strong>Phản ứng của hệ thống</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>1</td>
<td>Quản trị viên nhấn biểu tượng khóa/mở khóa tại cột Thao tác</td>
<td></td>
</tr>
<tr class="even">
<td>2</td>
<td></td>
<td><p>Hộp thoại xác nhận ở giữa màn hình gồm:</p>
<p>- Biểu tượng cảnh báo</p>
<p>- Tiêu đề Kích hoạt tài khoản? hoặc Vô hiệu hóa tài khoản?</p>
<p>- Họ và tên tài khoản</p>
<p>- Email tài khoản</p>
<p>- Nút Hủy và nút xác nhận theo trạng thái đích</p></td>
</tr>
<tr class="odd">
<td>3</td>
<td>Quản trị viên nhấn Kích hoạt hoặc Vô hiệu hóa</td>
<td></td>
</tr>
<tr class="even">
<td>4</td>
<td></td>
<td>Hệ thống gửi PATCH status, đổi trạng thái tài khoản, thu hồi phiên khi vô hiệu hóa và đóng hộp thoại sau khi xác nhận.</td>
</tr>
<tr class="odd">
<td>5</td>
<td></td>
<td>Hiển thị thông báo đã đổi trạng thái tài khoản sang Kích hoạt hoặc Vô hiệu hóa.</td>
</tr>
<tr class="even">
<td>6</td>
<td></td>
<td>Biểu tượng thao tác trên đúng dòng đổi giữa khóa và mở khóa theo trạng thái mới.</td>
</tr>
</tbody>
</table>

*e. Các trường hợp khác*

- Tại bước 3, nếu quản trị viên chọn Hủy tại hộp thoại xác nhận, hệ thống đóng hộp thoại và giữ nguyên trạng thái tài khoản.

- Thao tác kích hoạt/vô hiệu hóa chỉ được thực hiện tại cột Thao tác của Danh sách tài khoản; cửa sổ Hồ sơ & Lịch trình tài khoản không hiển thị nút này.

#### 1.6. Xóa tài khoản

*a. Tác nhân & Phân quyền*

- Tác nhân: Quản trị viên (AC-1)
- Vai trò yêu cầu: `ADMIN`
- Sequence diagram: [09-quan-ly-tai-khoan.md](sequence-diagrams/09-quan-ly-tai-khoan.md)
- API endpoint: `DELETE /api/v1/accounts/:id`

*b. Điều kiện ban đầu*

- Quản trị viên đang ở màn hình Danh sách tài khoản.
- Tài khoản cần xóa đang được hiển thị trong bảng dữ liệu.

*c. Điều kiện đối với kết quả*

- Tài khoản được đánh dấu xóa mềm (`deletedAt = now()`), toàn bộ phiên bị thu hồi, dòng tài khoản biến mất khỏi bảng và tổng số tài khoản được cập nhật lại.

*d. Kịch bản thành công chính*

<table>
<colgroup>
<col style="width: 10%" />
<col style="width: 39%" />
<col style="width: 50%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Bước</strong></th>
<th><strong>Thao tác của tác nhân</strong></th>
<th><strong>Phản ứng của hệ thống</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>1</td>
<td>Quản trị viên nhấn biểu tượng Xóa tại cột Thao tác</td>
<td></td>
</tr>
<tr class="even">
<td>2</td>
<td></td>
<td><p>Hộp thoại xóa ở giữa màn hình gồm:</p>
<p>- Biểu tượng cảnh báo nguy hiểm</p>
<p>- Tiêu đề Xóa tài khoản?</p>
<p>- Cảnh báo thao tác không thể hoàn tác</p>
<p>- Họ và tên và email tài khoản</p>
<p>- Nút Hủy</p>
<p>- Nút Xóa tài khoản</p></td>
</tr>
<tr class="odd">
<td>3</td>
<td>Quản trị viên nhấn Xóa tài khoản</td>
<td></td>
</tr>
<tr class="even">
<td>4</td>
<td></td>
<td>Hệ thống hiển thị thêm hộp xác nhận của trình duyệt cho đúng tài khoản.</td>
</tr>
<tr class="odd">
<td>5</td>
<td></td>
<td>Sau khi xác nhận, hệ thống gửi DELETE, hộp thoại đóng và hiển thị thông báo “Đã xóa tài khoản {tên}”.</td>
</tr>
<tr class="even">
<td>6</td>
<td></td>
<td>Dòng tài khoản bị loại khỏi bảng; tổng số tài khoản và phân trang được tính lại.</td>
</tr>
</tbody>
</table>

*e. Các trường hợp khác*

- Tại bước 3, nếu quản trị viên chọn Hủy tại hộp thoại “Xóa tài khoản?”, hệ thống đóng hộp thoại và giữ nguyên tài khoản.

- Tại bước 4, nếu quản trị viên hủy hộp xác nhận của trình duyệt, thao tác xóa dừng lại và tài khoản vẫn được giữ nguyên.

#### 1.7. Xem thông tin tài khoản

*a. Tác nhân & Phân quyền*

- Tác nhân: Quản trị viên (AC-1), Cộng tác viên (AC-2)
- Vai trò yêu cầu: `ADMIN` (xem tài khoản CTV), `CTV` (xem thông tin chính mình)
- Sequence diagram: [10-xem-cap-nhat-ho-so.md](sequence-diagrams/10-xem-cap-nhat-ho-so.md)
- API endpoint: `GET /api/v1/accounts/:id`, `GET /api/v1/users/me`

*b. Điều kiện ban đầu*

- Người dùng đã đăng nhập.
- Quản trị viên đang ở Danh sách tài khoản hoặc người dùng mở Hồ sơ cá nhân từ menu tài khoản.

*c. Điều kiện đối với kết quả*

- Thông tin cá nhân, hồ sơ đính kèm, lịch trình và thao tác tài khoản liên quan được hiển thị đúng theo ngữ cảnh người dùng.

*d. Kịch bản thành công chính*

<table>
<colgroup>
<col style="width: 10%" />
<col style="width: 39%" />
<col style="width: 50%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Bước</strong></th>
<th><strong>Thao tác của tác nhân</strong></th>
<th><strong>Phản ứng của hệ thống</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>1</td>
<td>Quản trị viên nhấn vùng Họ tên/ảnh đại diện của một tài khoản; hoặc người dùng chọn Hồ sơ cá nhân</td>
<td></td>
</tr>
<tr class="even">
<td>2</td>
<td></td>
<td><p>Hệ thống mở đúng màn hình chi tiết theo ngữ cảnh.</p>
<p>- Với tài khoản do Admin chọn: hiển thị thông tin cá nhân, ảnh CCCD, CV nếu có, lịch tuần, buồng làm việc, lịch sử và Ghi chú. Cửa sổ này không có nút đặt lại mật khẩu.</p>
<p>- Với hồ sơ cá nhân: hiển thị ảnh đại diện, ảnh CCCD, CV, thông tin cá nhân/tài khoản, nút Đổi mật khẩu và Chỉnh sửa thông tin; CV có nút Xem CV trong tab mới và Thay đổi.</p></td>
</tr>
</tbody>
</table>

*e. Các trường hợp khác*

- Tại bước 2, nếu quản trị viên nhấn biểu tượng X ở góc cửa sổ chi tiết, hệ thống trở về danh sách mà không thay đổi dữ liệu.

- Tại bước 2, từ Hồ sơ cá nhân, người dùng có thể thao tác trực tiếp trên ảnh đại diện, ảnh CCCD và khối CV; hệ thống hiển thị thông báo ngắn sau khi cập nhật.

#### 1.8. Cập nhật thông tin hồ sơ

*a. Tác nhân & Phân quyền*

- Tác nhân: Quản trị viên (AC-1), Cộng tác viên (AC-2)
- Vai trò yêu cầu: `ADMIN` hoặc `CTV` (cập nhật hồ sơ cá nhân của chính mình)
- Sequence diagram: [10-xem-cap-nhat-ho-so.md](sequence-diagrams/10-xem-cap-nhat-ho-so.md)
- API endpoint: `PATCH /api/v1/users/me`, `PUT /api/v1/users/me/files/:category`, `DELETE /api/v1/users/me/files/:category`

*b. Điều kiện ban đầu*

- Người dùng đang ở màn hình Thông tin tài khoản và thông tin hồ sơ hiện tại đã được hiển thị.

*c. Điều kiện đối với kết quả*

- Họ tên, số điện thoại, ngày sinh, giới tính và địa chỉ mới được cập nhật trong cơ sở dữ liệu và hiển thị trên hồ sơ cá nhân; tệp CV, ảnh đại diện và ảnh CCCD phản ánh khi được cập nhật trực tiếp trên các khối tương ứng.

*d. Kịch bản thành công chính*

<table>
<colgroup>
<col style="width: 10%" />
<col style="width: 39%" />
<col style="width: 50%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Bước</strong></th>
<th><strong>Thao tác của tác nhân</strong></th>
<th><strong>Phản ứng của hệ thống</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>1</td>
<td>Người dùng nhấn Chỉnh sửa thông tin</td>
<td></td>
</tr>
<tr class="even">
<td>2</td>
<td></td>
<td><p>Hộp thoại chỉ gồm Họ và tên, Số điện thoại, Ngày sinh, Giới tính và Địa chỉ thường trú, cùng nút Lưu thay đổi và biểu tượng đóng.</p></td>
</tr>
<tr class="odd">
<td>3</td>
<td>Người dùng sửa các trường được phép</td>
<td></td>
</tr>
<tr class="even">
<td>4</td>
<td></td>
<td>Biểu mẫu hiển thị dữ liệu mới; Email, Vai trò và Trạng thái không có trong hộp thoại chỉnh sửa.</td>
</tr>
<tr class="odd">
<td>5</td>
<td>Người dùng nhấn Lưu thay đổi</td>
<td></td>
</tr>
<tr class="even">
<td>6</td>
<td></td>
<td>Hệ thống gửi PATCH /api/v1/users/me, cập nhật dữ liệu hồ sơ và đóng hộp thoại.</td>
</tr>
<tr class="odd">
<td>7</td>
<td></td>
<td>Màn hình hồ sơ hiển thị dữ liệu mới và thông báo “Đã cập nhật thông tin hồ sơ cá nhân.”.</td>
</tr>
</tbody>
</table>

*e. Các trường hợp khác*

- Tại bước 5, nếu người dùng chọn biểu tượng đóng ở góc hộp thoại thay vì Lưu thay đổi, hệ thống đóng hộp thoại và bỏ các thay đổi chưa lưu.

- Tại bước 5, nếu Họ và tên để trống, ràng buộc bắt buộc của trường ngăn gửi biểu mẫu; các trường còn lại không có thông báo kiểm tra định dạng riêng.

- Tại bước 1, nếu người dùng thao tác trực tiếp trên ảnh đại diện, ảnh CCCD hoặc khối CV thay vì mở Chỉnh sửa thông tin, hệ thống cập nhật tệp tương ứng qua `PUT /api/v1/users/me/files/:category` và hiển thị thông báo ngắn. Các thao tác tệp nằm ngoài hộp thoại chỉnh sửa thông tin.

#### 1.9. Đổi/đặt lại mật khẩu

*a. Tác nhân & Phân quyền*

- Tác nhân: Quản trị viên (AC-1), Cộng tác viên (AC-2)
- Vai trò yêu cầu:
  - Tự đổi mật khẩu: `CTV` hoặc `ADMIN` (đổi mật khẩu của chính mình)
  - Đặt lại mật khẩu cho CTV: `ADMIN`
- Sequence diagram: [05-doi-va-dat-lai-mat-khau.md](sequence-diagrams/05-doi-va-dat-lai-mat-khau.md)
- API endpoint:
  - Tự đổi mật khẩu: `POST /api/v1/users/me/password-changes`
  - Admin đặt lại mật khẩu: `POST /api/v1/accounts/:id/password-resets`

*b. Điều kiện ban đầu*

- Người dùng đã đăng nhập và đang ở Thông tin tài khoản; hoặc Admin đang ở Danh sách tài khoản khi cần đặt lại mật khẩu cho CTV.

*c. Điều kiện đối với kết quả*

- Mật khẩu được cập nhật theo đúng ngữ cảnh. Khi tự đổi, các phiên khác bị thu hồi. Khi Admin đặt lại, toàn bộ phiên của CTV bị thu hồi và cờ `mustChangePassword` được bật thành `true`. Hệ thống đóng hộp thoại và hiển thị thông báo thành công.

*d. Kịch bản thành công chính*

<table>
<colgroup>
<col style="width: 10%" />
<col style="width: 39%" />
<col style="width: 50%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Bước</strong></th>
<th><strong>Thao tác của tác nhân</strong></th>
<th><strong>Phản ứng của hệ thống</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>1</td>
<td>Người dùng nhấn Đổi mật khẩu trên Thông tin tài khoản; hoặc Admin nhấn biểu tượng Đặt lại mật khẩu tại đúng dòng CTV trong Danh sách tài khoản</td>
<td></td>
</tr>
<tr class="even">
<td>2</td>
<td></td>
<td><p>Hệ thống mở hộp thoại theo ngữ cảnh:</p>
<p>- Đổi mật khẩu: Mật khẩu hiện tại, Mật khẩu mới, Xác nhận mật khẩu mới, nút Đổi mật khẩu và biểu tượng đóng.</p>
<p>- Đặt lại mật khẩu CTV: thẻ thông tin CTV, mật khẩu mới do hệ thống tự sinh, nút Tạo mật khẩu khác, nút Sao chép mật khẩu, nút Xác nhận và nút Đóng.</p></td>
</tr>
<tr class="odd">
<td>3</td>
<td>Người dùng nhập dữ liệu theo hộp thoại và nhấn Đổi mật khẩu hoặc Xác nhận</td>
<td></td>
</tr>
<tr class="even">
<td>4</td>
<td></td>
<td>Với luồng tự đổi, hệ thống kiểm tra mật khẩu hiện tại không trống, mật khẩu mới tối thiểu 8 ký tự và hai mật khẩu mới khớp nhau. Với luồng Admin đặt lại, hệ thống hiển thị sẵn mật khẩu tự sinh và cho phép tạo lại trước khi xác nhận.</td>
</tr>
<tr class="odd">
<td>5</td>
<td></td>
<td>Nếu hợp lệ, luồng tự đổi hiển thị “Đổi mật khẩu thành công!”. Luồng Admin đặt lại lưu mật khẩu mới và hiển thị thông báo kèm kết quả xử lý.</td>
</tr>
<tr class="even">
<td>6</td>
<td></td>
<td>Hộp thoại đóng; hệ thống giữ nguyên màn hình hồ sơ hoặc danh sách đang mở.</td>
</tr>
</tbody>
</table>

*e. Các trường hợp khác*

- Tại bước 4, nếu Mật khẩu hiện tại để trống, hệ thống hiển thị “Vui lòng nhập mật khẩu hiện tại”.

- Tại bước 4, nếu Mật khẩu mới có dưới 8 ký tự, hệ thống hiển thị “Mật khẩu mới phải có ít nhất 8 ký tự”.

- Tại bước 4, nếu Mật khẩu mới và Xác nhận mật khẩu mới không khớp, hệ thống hiển thị “Mật khẩu xác nhận không khớp”.

- Tại bước 3, nếu người dùng chọn biểu tượng đóng thay vì Đổi mật khẩu, hệ thống đóng hộp thoại và không đổi mật khẩu. Với luồng Admin đặt lại, Admin có thể tạo mật khẩu khác hoặc sao chép mật khẩu trước khi nhấn Xác nhận.

#### 1.10. Duyệt yêu cầu đăng ký tài khoản

*a. Tác nhân & Phân quyền*

- Tác nhân: Quản trị viên (AC-1)
- Vai trò yêu cầu: `ADMIN`
- Sequence diagram: [03-duyet-ho-so.md](sequence-diagrams/03-duyet-ho-so.md)
- API endpoint:
  - Danh sách yêu cầu chờ duyệt: `GET /api/v1/registration-requests?status=PENDING`
  - Phê duyệt / Từ chối yêu cầu: `PATCH /api/v1/registration-requests/:requestId` (body: `{ decision: 'APPROVED' | 'REJECTED', expectedStatus: 'PENDING', rejectionReason?: string }`)

*b. Điều kiện ban đầu*

- Quản trị viên đã đăng nhập và có yêu cầu đăng ký ở trạng thái Chờ duyệt.

*c. Điều kiện đối với kết quả*

- Yêu cầu bị loại khỏi danh sách chờ. Nếu phê duyệt, tài khoản `Account` mới được tạo với trạng thái `ACTIVE`, các tệp đính kèm chuyển thành `AccountFile`. Nếu từ chối, yêu cầu chuyển sang trạng thái `REJECTED` cùng lý do từ chối.

*d. Kịch bản thành công chính*

<table>
<colgroup>
<col style="width: 10%" />
<col style="width: 39%" />
<col style="width: 50%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Bước</strong></th>
<th><strong>Thao tác của tác nhân</strong></th>
<th><strong>Phản ứng của hệ thống</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>1</td>
<td>Quản trị viên chọn Yêu cầu đăng ký trên thanh điều hướng</td>
<td></td>
</tr>
<tr class="even">
<td>2</td>
<td></td>
<td><p>Màn hình Yêu cầu đăng ký gồm:</p>
<p>- Tiêu đề và tổng số yêu cầu trong dữ liệu</p>
<p>- Danh sách chỉ hiển thị yêu cầu Chờ duyệt</p>
<p>- Ô tìm theo Họ tên, Email hoặc SĐT và nút Làm mới</p>
<p>- Bảng STT, Họ và tên, Số điện thoại, Ngày gửi, Thao tác</p>
<p>- Nhấn Họ tên/ảnh đại diện để mở chi tiết hồ sơ</p>
<p>- Biểu tượng Duyệt/Từ chối hồ sơ và thanh phân trang ở cuối bảng</p></td>
</tr>
<tr class="odd">
<td>3</td>
<td>Quản trị viên nhấn Họ tên hoặc ảnh đại diện của một yêu cầu</td>
<td></td>
</tr>
<tr class="even">
<td>4</td>
<td></td>
<td>Hệ thống mở cửa sổ Chi tiết Hồ sơ Đăng ký CTV, gồm thông tin cá nhân, ảnh CCCD, CV với biểu tượng Xem/Tải về; cuối cửa sổ có nút Từ chối hồ sơ và Phê duyệt, góc trên có biểu tượng X.</td>
</tr>
<tr class="odd">
<td>5</td>
<td>Quản trị viên nhấn Phê duyệt trong cửa sổ chi tiết hoặc biểu tượng Duyệt hồ sơ tại đúng dòng</td>
<td></td>
</tr>
<tr class="even">
<td>6</td>
<td></td>
<td>Hệ thống xử lý trực tiếp, đóng cửa sổ chi tiết nếu đang mở, loại yêu cầu khỏi danh sách và tạo tài khoản Cộng tác viên ở trạng thái Kích hoạt.</td>
</tr>
<tr class="odd">
<td>7</td>
<td>Quản trị viên quan sát kết quả xử lý</td>
<td></td>
</tr>
<tr class="even">
<td>8</td>
<td></td>
<td>Hệ thống cập nhật số yêu cầu chờ, hiển thị thông báo đã phê duyệt hồ sơ và giữ màn hình Yêu cầu đăng ký; tài khoản mới xuất hiện khi mở Danh sách tài khoản.</td>
</tr>
</tbody>
</table>

*e. Các trường hợp khác*

- Tại bước 3 hoặc 5, nếu quản trị viên nhấn Từ chối (tại bảng hoặc cửa sổ chi tiết), hệ thống loại yêu cầu khỏi danh sách ngay, đóng cửa sổ chi tiết nếu đang mở, không yêu cầu nhập lý do và không tạo tài khoản CTV.

- Tại bước 4, khi không có yêu cầu phù hợp, bảng hiển thị “Không tìm thấy yêu cầu đăng ký phù hợp với điều kiện tìm kiếm.”.

- Tại bước 3, nếu quản trị viên chọn Làm mới, hệ thống xóa từ khóa tìm kiếm và đưa phân trang về trang đầu.

- Tại bước 3, cửa sổ Chi tiết Hồ sơ Đăng ký CTV cho phép xem thông tin, ảnh CCCD và CV (Xem/Tải về), đồng thời có nút Từ chối hồ sơ, Phê duyệt và biểu tượng X; Duyệt/Từ chối cũng có thể thực hiện bằng biểu tượng tại bảng.

#### 1.11. Cài đặt hệ thống

*a. Tác nhân & Phân quyền*

- Tác nhân: Quản trị viên (AC-1), Cộng tác viên (AC-2)
- Vai trò yêu cầu: `ADMIN` hoặc `CTV`
- Thành phần chịu trách nhiệm: `SystemSettingsContext` (Client Local State)

*b. Điều kiện ban đầu*

- Người dùng đã đăng nhập và mở menu tài khoản ở cuối thanh điều hướng.

*c. Điều kiện đối với kết quả*

- Tùy chọn giao diện được áp dụng ngay cho phiên giao diện hiện tại và được phản ánh trên màn hình đang mở.

*d. Kịch bản thành công chính*

| **Bước** | **Thao tác của tác nhân** | **Phản ứng của hệ thống** |
|---|---|---|
| 1 | Người dùng chọn **Cài đặt hệ thống** trong menu tài khoản | Hệ thống mở bảng **Cài đặt hệ thống**. |
| 2 | Người dùng mở mục **Giao diện** | Hệ thống cho phép chọn **Sáng** hoặc **Tối**. |
| 3 | Người dùng mở mục **Độ tương phản** | Hệ thống cho phép chọn **Thấp**, **Trung bình** hoặc **Cao**. |
| 4 | Người dùng mở mục **Màu điểm nhấn** | Hệ thống cho phép chọn **Trắng**, **Lục**, **Lam**, **Vàng**, **Đỏ**, **Cam** hoặc **Tím**. |
| 5 | Người dùng mở mục **Ngôn ngữ** | Hệ thống cho phép chọn **Tiếng Việt** hoặc **Tiếng Anh**. |
| 6 | Người dùng chọn một giá trị và đóng bảng bằng biểu tượng X | Tùy chọn được áp dụng; hệ thống quay lại màn hình trước đó. |

*e. Các trường hợp khác*

- Người dùng có thể đóng bảng bất kỳ lúc nào bằng biểu tượng X; các thay đổi đã chọn không cần nút Lưu riêng.

### 2. Quản lý lịch trình

#### 2.1. Đăng ký/cập nhật lịch làm việc của CTV

*a. Tác nhân chính*

- Cộng tác viên (AC-2)
- Vai trò yêu cầu: `CTV`
- Sequence diagram: [04-dang-ky-cap-nhat-lich-lam-viec.md](sequence-diagrams/04-dang-ky-cap-nhat-lich-lam-viec.md)
- API endpoint: `GET /api/v1/users/me/schedule`, `PUT /api/v1/users/me/schedule`

*b. Điều kiện ban đầu*

- Cộng tác viên đã đăng nhập thành công với vai trò `CTV` và tài khoản ở trạng thái `ACTIVE`.

*c. Điều kiện đối với kết quả*

- Mẫu lịch tuần cố định được lưu vào cơ sở dữ liệu (`Schedule` và `Shift`), tự động lặp lại cho các tuần tiếp theo cho đến khi CTV thực hiện cập nhật lại hoặc tài khoản bị vô hiệu hóa. CTV có thể đăng ký từ 0 đến 10 ca trong tuần (Thứ 2 đến Thứ 6, mỗi ngày gồm Ca Sáng và Ca Chiều).

*d. Kịch bản thành công chính*

| **Bước** | **Thao tác của tác nhân** | **Phản ứng của hệ thống** |
|---|---|---|
| 1 | CTV chọn **Lịch làm việc** trên thanh điều hướng | Hệ thống gọi `GET /api/v1/users/me/schedule` để tải mẫu lịch tuần hiện hành của CTV. |
| 2 | CTV chọn nút **Đăng ký lịch làm việc** (hoặc **Cập nhật**) | Hệ thống mở modal biểu mẫu đăng ký/cập nhật lịch tuần, điền sẵn buồng làm việc và các ca đã chọn nếu có. |
| 3 | CTV chọn Buồng làm việc (`ROOM_1` .. `ROOM_4`) và tích/bỏ tích các ô ca mong muốn từ Thứ 2 đến Thứ 6 (hỗ trợ lưu từ 0 đến 10 ca) | Hệ thống cập nhật trạng thái bản nháp trên giao diện, hiển thị cảnh báo việc lưu sẽ thay thế toàn bộ mẫu ca hiện tại. |
| 4 | CTV nhấn **Lưu** (hoặc **Đăng ký**) | Hệ thống gửi request `PUT /api/v1/users/me/schedule` kèm `roomCode`, danh sách `slots` và `expectedVersion`. |
| 5 | | Backend thực hiện transaction với khóa cố vấn `pg_advisory_xact_lock(hashtext(accountId))`, kiểm tra xung đột version, cập nhật `Schedule` (tăng version), xóa các bản ghi `Shift` cũ và tạo mới các bản ghi `Shift` được chọn. |
| 6 | | Hệ thống đóng modal, cập nhật lại dữ liệu hiển thị trên **Lịch tuần** và hiển thị thông báo **Đăng ký thành công** (hoặc **Cập nhật lịch thành công**). |

*e. Các trường hợp khác*

- Nếu CTV bỏ chọn tất cả các ca (0 slot), hệ thống vẫn cho phép lưu mẫu tuần rỗng (không có ca nào trong tuần).
- Nếu `version` đã thay đổi ở phiên khác hoặc không khớp, backend trả về lỗi `409 VERSION_CONFLICT`. Frontend thông báo lỗi, tự động tải lại dữ liệu lịch mới nhất và yêu cầu CTV kiểm tra trước khi thực hiện lưu lại.
- Không thể đóng modal bằng cách bấm ra ngoài vùng nền mờ hoặc phím Escape trong lúc request lưu đang gửi lên server.

---

#### 2.2. Xem lịch tuần và lịch sử làm việc của CTV (Chỉ đọc)

*a. Tác nhân chính*

- Cộng tác viên (AC-2)
- Vai trò yêu cầu: `CTV`
- Sequence diagram: [11-xem-lich-tuan-va-lich-su.md](sequence-diagrams/11-xem-lich-tuan-va-lich-su.md)
- API endpoint:
  - Lịch tuần: `GET /api/v1/users/me/schedule`
  - Lịch sử làm việc: `GET /api/v1/users/me/work-history?month=YYYY-MM`

*b. Điều kiện ban đầu*

- Cộng tác viên đã đăng nhập và đang ở màn hình Lịch làm việc cá nhân.

*c. Điều kiện đối với kết quả*

- CTV xem được lịch tuần hiện hành và lịch sử làm việc theo tháng của chính mình hoàn toàn ở chế độ chỉ đọc (Read-only), không có thao tác xóa ca đơn lẻ trực tiếp trên ô lịch.

*d. Kịch bản thành công chính*

| **Bước** | **Thao tác của tác nhân** | **Phản ứng của hệ thống** |
|---|---|---|
| 1 | CTV chọn mục **Lịch làm việc** trên thanh menu | Hệ thống mặc định mở tab **Lịch tuần**, gọi `GET /api/v1/users/me/schedule` và hiển thị lưới Thứ 2 đến Thứ 6. |
| 2 | CTV xem Lịch tuần | Các ca làm việc được hiển thị dưới dạng huy hiệu chỉ đọc (`ShiftBadge`) gồm biểu tượng Ca Sáng (`wb_sunny`) hoặc Ca Chiều (`wb_twilight`) kèm tên buồng. Các thẻ ca hoàn toàn chỉ đọc, không bấm vào để sửa/xóa đơn lẻ được. |
| 3 | CTV chuyển sang tab **Lịch sử làm việc** | Hệ thống gọi `GET /api/v1/users/me/work-history?month=YYYY-MM` cho tháng hiện tại và hiển thị lưới tháng với các ca đã được chốt sau mốc 17:30. Dữ liệu trả về qua DTO chuyên biệt `{ month, entries }` (chỉ gồm `id`, `workDate`, `period`, `roomCode` của chính CTV). |
| 4 | CTV bấm nút chuyển tháng (Tháng trước / Tháng sau) | Hệ thống cập nhật tháng và tải lại danh sách ca đã hoàn thành của tháng đó. |

*e. Các trường hợp khác*

- Trên thiết bị di động hoặc màn hình hẹp, lưới 5 ngày giữ nguyên cấu trúc và hỗ trợ cuộn ngang mượt mà.
- Khi tháng không có ca nào, hiển thị thông báo trạng thái rỗng thân thiện: *"Chưa có ca làm việc nào trong tháng này"*.
- Nếu tải lịch sử thất bại, hệ thống hiển thị thông báo lỗi và nút **Thử lại**; dữ liệu tháng cũ bị xóa để tránh nhầm lẫn.
- Hệ thống tự động lắng nghe sự kiện `focus` của cửa sổ và `visibilitychange` của trình duyệt để tự động tải lại lịch sử mới nhất nếu trang web vừa được mở lại sau mốc 17:30.

---

#### 2.3. Chốt lịch sử làm việc tự động vào 17:30

*a. Tác nhân chính*

- Hệ thống (Background Scheduler & Startup Recovery)
- Vai trò yêu cầu: `SYSTEM` (Tiến trình nền độc lập)
- Sequence diagram: [06-chot-lich-su-lam-viec-tu-dong.md](sequence-diagrams/06-chot-lich-su-lam-viec-tu-dong.md)

*b. Điều kiện ban đầu*

- Máy chủ backend hoạt động và cấu hình múi giờ chuẩn `Asia/Bangkok` (UTC+7).

*c. Điều kiện đối với kết quả*

- Toàn bộ ca làm việc của ngày hôm nay được snapshot bất biến vào bảng `History` trong cơ sở dữ liệu PostgreSQL.

*d. Quy tắc xử lý và kịch bản chính*

| **Bước** | **Thời điểm / Sự kiện** | **Hành vi xử lý của hệ thống** |
|---|---|---|
| 1 | Trước 17:30 Asia/Bangkok hằng ngày | Hàm `snapshotTodayWorkHistory()` kiểm tra thời gian hiện tại: nếu trước 17:30, lập tức bỏ qua và trả về lý do `BEFORE_CUTOFF`. |
| 2 | Ngày cuối tuần (Thứ 7, Chủ Nhật) | Nếu ngày trong tuần là Thứ 7 hoặc Chủ Nhật, hệ thống bỏ qua và trả về lý do `WEEKEND`. |
| 3 | Đúng 17:30 Asia/Bangkok (tức 10:30 UTC) Thứ 2 đến Thứ 6 | Bộ hẹn giờ chính xác kích hoạt snapshot: lấy danh sách các CTV `ACTIVE` có `Schedule` và có `Shift` khớp với thứ của ngày hôm nay, chụp lại vào bảng `History`. |
| 4 | Máy chủ khởi động lại sau 17:30 | Tiến trình khởi động tự động gọi `syncCompletedWork()` một lần (Startup Recovery) để bù đắp ca của ngày hôm nay nếu máy chủ bị tắt trong mốc 17:30. |
| 5 | Ghi nhận an toàn và đảm bảo Idempotent | Thực hiện ghi nhận với `prisma.history.createMany({ skipDuplicates: true })` dựa trên ràng buộc `@@unique([accountId, workDate, period])`. Chạy lại nhiều lần không sinh bản ghi trùng lặp và không ảnh hưởng dữ liệu đã chốt. |
| 6 | Tuyệt đối không backfill lịch sử | Hệ thống chỉ snapshot duy nhất ca của ngày hôm nay (`todayUtc`), loại bỏ hoàn toàn cơ chế quét ngược 14 ngày cũ. |

---

#### 2.4. Xem lịch làm việc tổng hợp (Admin)

*a. Tác nhân chính*

- Quản trị viên (AC-1)
- Vai trò yêu cầu: `ADMIN`
- Sequence diagram: [07-xem-lich-lam-viec-tong-hop.md](sequence-diagrams/07-xem-lich-lam-viec-tong-hop.md)
- API endpoint:
  - Lịch tuần tổng hợp: `GET /api/v1/schedule/weekly-summary` (hoặc `/api/v1/schedule-summary/weekly-summary`)
  - Lịch sử tổng hợp: `GET /api/v1/work-history?month=YYYY-MM`

*b. Điều kiện ban đầu*

- Quản trị viên đã đăng nhập thành công và mở mục **Lịch làm việc tổng hợp**.

*c. Điều kiện đối với kết quả*

- Admin theo dõi được toàn bộ danh sách CTV làm việc hôm nay, lịch tuần tổng hợp của toàn viện và lịch sử làm việc tổng hợp theo tháng; mỗi ô ca cho phép bấm vào để xem danh sách chi tiết các CTV tham gia.

*d. Kịch bản thành công chính*

| **Bước** | **Thao tác của tác nhân** | **Phản ứng của hệ thống** |
|---|---|---|
| 1 | Admin chọn **Lịch làm việc tổng hợp** trên menu | Hệ thống mặc định mở tab **Lịch tuần tổng hợp**, hiển thị khối **Danh sách CTV đăng ký hôm nay** và lưới Thứ 2 - Thứ 6. |
| 2 | Admin xem lưới Lịch tuần | Mỗi ô ca hiển thị số lượng CTV đăng ký (ví dụ: `2 CTV`, `4 CTV`). Cột ngày hôm nay được đánh dấu bằng huy hiệu **Hôm nay**. |
| 3 | Admin bấm vào thẻ số lượng CTV của một ca | Hệ thống mở modal **Chi tiết ca làm việc**, hiển thị thông tin ca (Thứ, Buổi), tổng số CTV và bảng danh sách gồm: Họ và tên CTV, Số điện thoại, Buồng làm việc (`ROOM_1`..`ROOM_4`). |
| 4 | Admin bấm vào tên hoặc ảnh đại diện CTV trong modal | Hệ thống đóng modal Chi tiết ca và mở modal **Hồ sơ & Lịch trình tài khoản** của CTV đó. |
| 5 | Admin chuyển sang tab **Lịch sử tổng hợp** | Hệ thống gọi `GET /api/v1/work-history?month=YYYY-MM`, hiển thị lưới tháng tổng hợp toàn bộ các ca đã chốt của các CTV trong tháng. |
| 6 | Admin bấm chuyển tháng trong tab Lịch sử | Hệ thống tải và hiển thị dữ liệu lịch sử tổng hợp của tháng mới. |

*e. Các trường hợp khác*

- Nếu ca chưa có CTV đăng ký, ô ca hiển thị để trống và khi bấm vào sẽ thông báo *"Chưa có CTV nào đăng ký ca làm việc này"*.
- Nếu hôm nay không có ca làm việc nào, khối hiển thị thông báo *"Chưa có CTV nào đăng ký hôm nay"*.
- Giao diện 2 tab của Admin đồng nhất về trải nghiệm với giao diện của CTV, chỉ bổ sung tính năng xem số lượng và danh sách CTV tham gia từng ca.

---

#### 2.5. Xem chi tiết ca và hồ sơ CTV

*a. Tác nhân chính*

- Quản trị viên (AC-1)
- Vai trò yêu cầu: `ADMIN`
- Sequence diagram: [12-xem-chi-tiet-ca-va-ho-so-ctv.md](sequence-diagrams/12-xem-chi-tiet-ca-va-ho-so-ctv.md)
- API endpoint:
  - Chi tiết tài khoản: `GET /api/v1/accounts/:id`
  - Lịch tuần CTV: `GET /api/v1/accounts/:id/schedule`
  - Lịch sử làm việc CTV: `GET /api/v1/work-history?month=YYYY-MM&accountId=:id`
  - Ghi chú quản trị: `PATCH /api/v1/accounts/:id/notes`
  - Tải tệp hồ sơ/CV: `GET /api/v1/files/:fileId/content`

*b. Điều kiện ban đầu*

- Quản trị viên đã đăng nhập và đang mở modal Chi tiết ca làm việc hoặc danh sách tài khoản.

*c. Điều kiện đối với kết quả*

- Admin xem được hồ sơ chi tiết, lịch tuần hiện hành, lịch sử làm việc cá nhân, xem trước/tải xuống tệp CV, CCCD và lưu ghi chú nội bộ cho CTV.

*d. Kịch bản thành công chính*

| **Bước** | **Thao tác của tác nhân** | **Phản ứng của hệ thống** |
|---|---|---|
| 1 | Admin bấm vào tên hoặc biểu tượng xem hồ sơ của một CTV | Hệ thống mở modal **Hồ sơ & Lịch trình tài khoản** của CTV đó, tự động gọi `GET /api/v1/accounts/:id` để lấy thông tin chi tiết và `GET /api/v1/accounts/:id/schedule` để lấy mẫu lịch tuần. |
| 2 | Admin xem lịch tuần của CTV | Modal hiển thị mẫu lịch tuần hiện hành của CTV với buồng làm việc và các ca cố định. |
| 3 | Admin chuyển sang mục **Lịch sử làm việc** | Hệ thống gọi `GET /api/v1/work-history?month=YYYY-MM&accountId=:id` và hiển thị các ca đã hoàn thành của đúng CTV này trong tháng đã chọn. |
| 4 | Admin bấm biểu tượng xem hoặc tải tệp hồ sơ (CCCD, CV) | Hệ thống gọi `GET /api/v1/files/:fileId/content`, xác thực quyền Admin và truyền trực tiếp luồng nhị phân (stream) tệp về trình duyệt. |
| 5 | Admin nhập nội dung vào ô **Ghi chú quản trị** và nhấn **Lưu** | Hệ thống gửi `PATCH /api/v1/accounts/:id/notes` kèm `adminNotes` và `expectedVersion`. Backend cập nhật ghi chú và tăng version. Nút Lưu chuyển sang trạng thái **Đã lưu**. |
| 6 | Admin bấm biểu tượng X để đóng modal | Hệ thống đóng modal và quay lại màn hình trước đó mà không làm mất trạng thái bộ lọc. |

*e. Các trường hợp khác*

- Nếu tài khoản CTV không tồn tại hoặc đã bị xóa mềm, hệ thống thông báo lỗi `404 NOT_FOUND`.
- Nếu ghi chú bị xung đột phiên bản khi lưu, hệ thống báo `409 VERSION_CONFLICT` và tải lại dữ liệu tài khoản mới nhất.

