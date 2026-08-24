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
  - [2. Quản lý lịch trình](#2-quản-lý-lịch-trình)
    - [2.1. Đăng ký/cập nhật lịch làm việc](#21-đăng-kýcập-nhật-lịch-làm-việc)
    - [2.2. Xem lịch tuần và lịch sử làm việc](#22-xem-lịch-tuần-và-lịch-sử-làm-việc)
    - [2.3. Xem chi tiết và hủy ca làm việc](#23-xem-chi-tiết-và-hủy-ca-làm-việc)
    - [2.4. Xem lịch làm việc tổng hợp](#24-xem-lịch-làm-việc-tổng-hợp)
    - [2.5. Xem chi tiết ca và hồ sơ CTV](#25-xem-chi-tiết-ca-và-hồ-sơ-ctv)

## I. Danh sách tác nhân

Hệ thống gồm có 2 tác nhân chính:

|          |                       |                      |                                                                                                                                  |
|----------|-----------------------|----------------------|----------------------------------------------------------------------------------------------------------------------------------|
| **Mã**   | **Tác nhân**          | **Loại**             | **Mô tả và quyền hạn chính**                                                                                                     |
| **AC-1** | Quản trị viên (Admin) | Người dùng đặc quyền | Quản lý tài khoản và hồ sơ CTV, duyệt yêu cầu đăng ký và xem lịch làm việc tổng hợp                                            |
| **AC-2** | Cộng tác viên (CTV)   | Người dùng           | Đăng ký tài khoản và đính kèm hồ sơ, quản lý thông tin cá nhân, đăng ký/cập nhật ca làm việc, xem lịch tuần và lịch sử làm việc. |

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
| **1.7**                                              | Xem thông tin tài khoản           | Admin xem hồ sơ đính kèm, lịch trình CTV và mở thao tác đặt lại mật khẩu; người dùng xem hồ sơ cá nhân của mình.       |
| **1.8**                                              | Cập nhật thông tin hồ sơ          | Admin/CTV cập nhật thông tin cá nhân, ảnh đại diện, ảnh CCCD và hồ sơ ứng tuyển (CV) được phép chỉnh sửa.              |
| **1.9**                                              | Đổi/đặt lại mật khẩu              | Người dùng đổi mật khẩu cá nhân; Admin đặt lại mật khẩu mặc định cho CTV.                                              |
| **1.10**                                             | Duyệt yêu cầu đăng ký tài khoản   | Admin xem, duyệt hoặc từ chối yêu cầu đăng ký đang chờ.                                                                |
| **Phân hệ 2 – Quản lý lịch trình**                   |                                   |                                                                                                                        |
| **2.1**                                              | Đăng ký/cập nhật lịch làm việc    | CTV chọn buồng và mẫu ca Sáng/Chiều theo tuần để đăng ký hoặc cập nhật lịch làm việc.                                  |
| **2.2**                                              | Xem lịch tuần và lịch sử làm việc | CTV xem cùng dữ liệu lịch cá nhân theo tuần hoặc lịch sử theo tháng.                                                   |
| **2.3**                                              | Xem chi tiết và hủy ca làm việc   | CTV xem chi tiết ca, hủy riêng một ca hoặc hủy chuỗi ca định kỳ trong tương lai.                                       |
| **2.4**                                              | Xem lịch làm việc tổng hợp        | Admin xem CTV làm việc hôm nay và số lượng CTV theo từng ca trong lịch tháng.                                          |
| **2.5**                                              | Xem chi tiết ca và hồ sơ CTV      | Admin xem danh sách CTV trong ca và mở hồ sơ, CV, lịch trình hoặc ghi chú của từng người.                              |

## III. Đặc tả chi tiết use case

### 1. Quản lý tài khoản và hồ sơ CTV

#### 1.1. Đăng nhập

*a. Tác nhân chính*

- Quản trị viên

- Cộng tác viên

*b. Điều kiện ban đầu*

- Người dùng chưa đăng nhập hoặc đã đăng xuất

*c. Điều kiện đối với kết quả*

- Người dùng được đưa vào giao diện hệ thống và nhận thông báo đăng nhập thành công

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

- Tại bước 3, nếu người dùng nhấn biểu tượng mắt trong trường Mật khẩu, hệ thống chuyển giữa chế độ hiển thị và che ký tự.

- Tại bước 2, nếu người dùng chọn Tạo tài khoản mới, hệ thống chuyển sang luồng đăng ký.

#### 1.2. Đăng xuất

*a. Tác nhân chính*

- Quản trị viên

- Cộng tác viên

*b. Điều kiện ban đầu*

- Người dùng đã đăng nhập thành công

*c. Điều kiện đối với kết quả*

- Phiên làm việc kết thúc và màn hình Đăng nhập được hiển thị

*d. Kịch bản thành công chính*

| **Bước** | **Thao tác của tác nhân**                                        | **Phản ứng của hệ thống**                                                               |
|----------|------------------------------------------------------------------|-----------------------------------------------------------------------------------------|
| 1        | Người dùng nhấn khối thông tin tài khoản ở cuối thanh điều hướng |                                                                                         |
| 2        |                                                                  | Hệ thống mở menu gồm Đổi vai trò, Hồ sơ cá nhân, Cài đặt hệ thống và Đăng xuất.         |
| 3        | Người dùng nhấn Đăng xuất                                        |                                                                                         |
| 4        |                                                                  | Hệ thống quay về màn hình Đăng nhập và hiển thị thông báo “Đã đăng xuất khỏi hệ thống”. |

*e. Các trường hợp khác*

- Không có trường hợp khác nên không phát sinh bước thay thế.

#### 1.3. Đăng ký tài khoản

*a. Tác nhân chính*

- Cộng tác viên đăng ký mới

- Người dùng chưa có tài khoản hệ thống

*b. Điều kiện ban đầu*

- Người dùng đang ở màn hình Đăng nhập

*c. Điều kiện đối với kết quả*

- Yêu cầu đăng ký được ghi nhận ở trạng thái Chờ duyệt và giao diện quay về Đăng nhập

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
<p>- Vùng tải ảnh CCCD mặt trước/mặt sau (JPG, PNG, WebP)</p>
<p>- Vùng tải CV ứng tuyển (PDF, DOC, DOCX)</p>
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
<td><p>Hiển thị “Đang chờ admin duyệt yêu cầu. Vui lòng cập nhật email để nhận thông báo!”.</p>
<p>Hiển thị dòng đếm ngược tự động chuyển đến trang đăng nhập sau 5 giây.</p></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td>Hệ thống tự động quay về Đăng nhập; người dùng cũng có thể chọn Chuyển sang trang đăng nhập ngay.</td>
</tr>
</tbody>
</table>

*e. Các trường hợp khác*

- Tại bước 3, nếu thiếu Họ và tên, Email, Số điện thoại, Mật khẩu hoặc Nhập lại mật khẩu, trường tương ứng hiển thị lỗi bắt buộc. Nếu Email đã tồn tại, hệ thống hiển thị “Email đã có người sử dụng. Vui lòng chọn email khác!”.

- Tại bước 3, nếu hai mật khẩu không khớp, trường Nhập lại mật khẩu hiển thị “Mật khẩu phải trùng khớp!”. Ảnh CCCD và CV là tài liệu đính kèm tùy chọn nhưng phải đúng định dạng khi được chọn.

#### 1.4. Quản lý danh sách tài khoản

*a. Tác nhân chính*

- Quản trị viên

*b. Điều kiện ban đầu*

- Quản trị viên đã đăng nhập và đang ở giao diện quản trị

*c. Điều kiện đối với kết quả*

- Danh sách phản ánh từ khóa tìm kiếm, trang hiện tại và kết quả sau thao tác đặt lại mật khẩu, khóa/mở khóa hoặc xóa tài khoản

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
<p>- Nút Đặt lại</p>
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

- Tại bước 4, khi không có kết quả phù hợp, bảng hiển thị “Không tìm thấy tài khoản phù hợp với điều kiện tìm kiếm.”; nút Đặt lại xóa từ khóa và đưa phân trang về trang đầu.

- Tại bước 5, nếu quản trị viên nhấn vùng Họ tên hoặc ảnh đại diện, hệ thống mở cửa sổ Hồ sơ & Lịch trình tài khoản của đúng CTV.

- Tại bước 5, nếu quản trị viên chuyển trang, hệ thống hiển thị tối đa 5 tài khoản trên mỗi trang và giữ nguyên từ khóa tìm kiếm.

#### 1.5. Kích hoạt/vô hiệu hóa tài khoản

*a. Tác nhân chính*

- Quản trị viên

*b. Điều kiện ban đầu*

- Quản trị viên đang ở Danh sách tài khoản

- Tài khoản cần thao tác đang hiển thị trong bảng Danh sách tài khoản

*c. Điều kiện đối với kết quả*

- Trạng thái tài khoản được chuyển giữa Kích hoạt và Vô hiệu hóa, đồng thời biểu tượng thao tác trên đúng dòng được cập nhật

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
<td>Hệ thống đổi trạng thái tài khoản, cập nhật dữ liệu phân công liên quan khi vô hiệu hóa và đóng hộp thoại sau khi xác nhận.</td>
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

*a. Tác nhân chính*

- Quản trị viên

*b. Điều kiện ban đầu*

- Quản trị viên đang ở màn hình Danh sách tài khoản

- Tài khoản cần xóa đang được hiển thị trong bảng dữ liệu

*c. Điều kiện đối với kết quả*

- Tài khoản đã xác nhận xóa không còn trong danh sách và tổng số tài khoản được cập nhật

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
<td>Sau khi xác nhận, hộp thoại đóng và hiển thị thông báo “Đã xóa tài khoản {tên}”.</td>
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

*a. Tác nhân chính*

- Quản trị viên

- Cộng tác viên

*b. Điều kiện ban đầu*

- Người dùng đã đăng nhập

- Quản trị viên đang ở Danh sách tài khoản hoặc người dùng mở Hồ sơ cá nhân từ menu tài khoản

*c. Điều kiện đối với kết quả*

- Thông tin cá nhân, hồ sơ đính kèm, lịch trình và thao tác tài khoản liên quan được hiển thị đúng theo ngữ cảnh người dùng

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
<p>- Với tài khoản do Admin chọn: hiển thị thông tin cá nhân, ảnh CCCD, CV (Xem/Tải về), lịch tuần, buồng làm việc, lịch sử, Ghi chú và nút Đặt lại mật khẩu.</p>
<p>- Với hồ sơ cá nhân: hiển thị ảnh đại diện, ảnh CCCD, CV, thông tin cá nhân/tài khoản, nút Đổi mật khẩu và Chỉnh sửa thông tin; CV có thể Xem, Thay đổi hoặc Tải về.</p></td>
</tr>
</tbody>
</table>

*e. Các trường hợp khác*

- Tại bước 2, nếu quản trị viên nhấn biểu tượng X ở góc cửa sổ chi tiết, hệ thống trở về danh sách mà không thay đổi dữ liệu.

- Tại bước 2, từ Hồ sơ cá nhân, người dùng có thể xem hoặc thay đổi ảnh đại diện, ảnh CCCD; xem, thay đổi hoặc tải CV. Hệ thống hiển thị thông báo ngắn sau khi cập nhật.

#### 1.8. Cập nhật thông tin hồ sơ

*a. Tác nhân chính*

- Quản trị viên

- Cộng tác viên

*b. Điều kiện ban đầu*

- Người dùng đang ở màn hình Thông tin tài khoản

- Thông tin hồ sơ hiện tại đã được hiển thị

*c. Điều kiện đối với kết quả*

- Họ tên, số điện thoại, ngày sinh, giới tính, địa chỉ và tệp CV mới được hiển thị trên hồ sơ cá nhân; ảnh đại diện và ảnh CCCD cũng phản ánh bản cập nhật trực tiếp

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
<td><p>Hộp thoại Chỉnh sửa thông tin cá nhân gồm:</p>
<p>- Họ và tên, Số điện thoại, Ngày sinh, Giới tính và Địa chỉ thường trú.</p>
<p>- Hồ sơ ứng tuyển (CV) cho phép tải lên, thay đổi hoặc xóa tệp PDF/DOC/DOCX; có nút Hủy và nút Lưu thay đổi.</p></td>
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
<td>Hệ thống cập nhật dữ liệu hồ sơ cùng thông tin tệp CV và đóng hộp thoại.</td>
</tr>
<tr class="odd">
<td>7</td>
<td></td>
<td>Màn hình hồ sơ hiển thị dữ liệu mới và thông báo “Đã cập nhật thông tin hồ sơ cá nhân.”.</td>
</tr>
</tbody>
</table>

*e. Các trường hợp khác*

- Tại bước 5, nếu người dùng chọn Hủy thay vì Lưu thay đổi, hệ thống đóng hộp thoại và bỏ các thay đổi chưa lưu.

- Tại bước 5, nếu người dùng chọn biểu tượng đóng ở góc hộp thoại thay vì Lưu thay đổi, hệ thống xử lý như thao tác Hủy.

- Tại bước 5, nếu Họ và tên để trống, ràng buộc bắt buộc của trường ngăn gửi biểu mẫu; các trường còn lại không có thông báo kiểm tra định dạng riêng.

- Tại bước 1, nếu người dùng thao tác trực tiếp trên ảnh đại diện, ảnh CCCD hoặc khối CV thay vì mở Chỉnh sửa thông tin, hệ thống cập nhật tệp tương ứng và hiển thị thông báo ngắn; CV hỗ trợ PDF, DOC và DOCX.

#### 1.9. Đổi/đặt lại mật khẩu

*a. Tác nhân chính*

- Quản trị viên và Cộng tác viên

*b. Điều kiện ban đầu*

- Người dùng đã đăng nhập và đang ở Thông tin tài khoản; hoặc Admin đang ở Danh sách tài khoản/Hồ sơ & Lịch trình tài khoản của CTV

*c. Điều kiện đối với kết quả*

- Mật khẩu được cập nhật theo đúng ngữ cảnh; hệ thống đóng hộp thoại và hiển thị thông báo thành công

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
<td>Người dùng nhấn Đổi mật khẩu trên Thông tin tài khoản; hoặc Admin nhấn biểu tượng/nút Đặt lại mật khẩu của một CTV</td>
<td></td>
</tr>
<tr class="even">
<td>2</td>
<td></td>
<td><p>Hệ thống mở hộp thoại theo ngữ cảnh:</p>
<p>- Đổi mật khẩu: Mật khẩu hiện tại, Mật khẩu mới, Xác nhận mật khẩu mới, khu vực lỗi, nút Hủy và nút Đổi mật khẩu.</p>
<p>- Đặt lại mật khẩu CTV: thẻ thông tin CTV, trường Mật khẩu mặc định mới (mặc định CTV@123456), nút Sao chép, biểu tượng X và nút Xác nhận.</p></td>
</tr>
<tr class="odd">
<td>3</td>
<td>Người dùng nhập dữ liệu theo hộp thoại và nhấn Đổi mật khẩu hoặc Xác nhận</td>
<td></td>
</tr>
<tr class="even">
<td>4</td>
<td></td>
<td>Với luồng tự đổi, hệ thống kiểm tra mật khẩu hiện tại không trống, mật khẩu mới tối thiểu 6 ký tự và hai mật khẩu mới khớp nhau. Với luồng Admin đặt lại, mật khẩu mặc định mới phải có nội dung.</td>
</tr>
<tr class="odd">
<td>5</td>
<td></td>
<td>Nếu hợp lệ, luồng tự đổi hiển thị “Đổi mật khẩu thành công!”. Luồng Admin đặt lại lưu mật khẩu mặc định, đánh dấu CTV phải đổi mật khẩu khi đăng nhập, ghi nhật ký vào Ghi chú và hiển thị thông báo kèm mật khẩu mới.</td>
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

- Tại bước 4, nếu Mật khẩu mới có dưới 6 ký tự, hệ thống hiển thị “Mật khẩu mới phải có ít nhất 6 ký tự”.

- Tại bước 4, nếu Mật khẩu mới và Xác nhận mật khẩu mới không khớp, hệ thống hiển thị “Mật khẩu xác nhận không khớp”.

- Tại bước 3, nếu người dùng chọn Hủy hoặc biểu tượng đóng thay vì Đổi mật khẩu, hệ thống đóng hộp thoại và không đổi mật khẩu. Với luồng Admin đặt lại, nếu trường mật khẩu mặc định trống thì nút Xác nhận bị vô hiệu hóa; Admin có thể dùng nút Sao chép trước khi xác nhận.

#### 1.10. Duyệt yêu cầu đăng ký tài khoản

*a. Tác nhân chính*

- Quản trị viên

*b. Điều kiện ban đầu*

- Quản trị viên đã đăng nhập

- Có yêu cầu đăng ký ở trạng thái Chờ duyệt

*c. Điều kiện đối với kết quả*

- Yêu cầu bị loại khỏi danh sách chờ; nếu phê duyệt thì tạo tài khoản Kích hoạt, nếu từ chối thì loại bỏ hồ sơ mà không tạo tài khoản

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
<p>- Ô tìm theo Họ tên, Email hoặc SĐT và nút Đặt lại</p>
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

- Tại bước 3, nếu quản trị viên chọn Đặt lại, hệ thống xóa từ khóa tìm kiếm và đưa phân trang về trang đầu.

- Tại bước 3, cửa sổ Chi tiết Hồ sơ Đăng ký CTV cho phép xem thông tin, ảnh CCCD và CV (Xem/Tải về), đồng thời có nút Từ chối hồ sơ, Phê duyệt và biểu tượng X; Duyệt/Từ chối cũng có thể thực hiện bằng biểu tượng tại bảng.

### 2. Quản lý lịch trình

#### 2.1. Đăng ký/cập nhật lịch làm việc

*a. Tác nhân chính*

- Cộng tác viên

*b. Điều kiện ban đầu*

- Cộng tác viên đã đăng nhập

- Cộng tác viên đang ở màn hình Lịch làm việc của tôi

*c. Điều kiện đối với kết quả*

- Mẫu ca Sáng/Chiều theo tuần và buồng làm việc được lưu, sau đó phản ánh trên Lịch tuần và Lịch sử làm việc

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
<td>CTV chọn Lịch làm việc của tôi trên thanh điều hướng</td>
<td></td>
</tr>
<tr class="even">
<td>2</td>
<td></td>
<td><p>Màn hình Lịch làm việc gồm:</p>
<p>- Tiêu đề Lịch làm việc</p>
<p>- Nút Đăng ký lịch làm việc</p>
<p>- Hai chế độ Lịch tuần và Lịch sử làm việc</p>
<p>- Nhãn buồng làm việc hiện tại</p>
<p>- Lưới Thứ 2-Thứ 6</p>
<p>- Ca Sáng và Ca Chiều</p>
<p>- Ngày hiện tại được đánh dấu Hôm nay</p></td>
</tr>
<tr class="odd">
<td>3</td>
<td>CTV nhấn Đăng ký lịch làm việc</td>
<td></td>
</tr>
<tr class="even">
<td>4</td>
<td></td>
<td>Hệ thống mở hộp thoại gồm Buồng làm việc và bảng Mẫu ca làm việc theo tuần với Ca Sáng/Ca Chiều từ Thứ 2 đến Thứ 6.</td>
</tr>
<tr class="odd">
<td>5</td>
<td></td>
<td>Nếu CTV đã có lần đăng ký gần nhất, hệ thống khôi phục mẫu tuần và buồng; nếu chưa có, hệ thống dùng mẫu mặc định và khoảng áp dụng tự động.</td>
</tr>
<tr class="even">
<td>6</td>
<td>CTV chọn buồng và bật/tắt các ô ca cần đăng ký</td>
<td></td>
</tr>
<tr class="odd">
<td>7</td>
<td></td>
<td>Ô được chọn hiển thị dấu kiểm; hệ thống chuẩn bị các lần làm việc tương ứng trong khoảng đăng ký tự động.</td>
</tr>
<tr class="even">
<td>8</td>
<td>CTV nhấn Đăng ký lịch</td>
<td></td>
</tr>
<tr class="odd">
<td>9</td>
<td></td>
<td>Hệ thống lưu hoặc cập nhật lịch, đóng hộp thoại, hiển thị thông báo thành công và cập nhật Lịch tuần/Lịch sử làm việc.</td>
</tr>
</tbody>
</table>

*e. Các trường hợp khác*

- Tại bước 8, nếu chưa chọn ca nào trong tuần, hệ thống hiển thị “Vui lòng chọn ít nhất một ca trong tuần.” và giữ hộp thoại mở.

- Tại bước 8, nếu chưa có buồng làm việc, hệ thống hiển thị “Vui lòng chọn buồng làm việc.” và không lưu lịch.

- Tại bước 3, nếu CTV nhấn Đóng, biểu tượng X hoặc vùng nền mờ, hệ thống đóng hộp thoại và không lưu thay đổi mới.

#### 2.2. Xem lịch tuần và lịch sử làm việc

*a. Tác nhân chính*

- Cộng tác viên

*b. Điều kiện ban đầu*

- Cộng tác viên đã đăng nhập và có quyền truy cập Lịch làm việc của tôi

*c. Điều kiện đối với kết quả*

- Lịch tuần hiện hành hoặc lịch sử theo tháng được hiển thị từ cùng dữ liệu lịch đã đăng ký

*d. Kịch bản thành công chính*

| **Bước** | **Thao tác của tác nhân**                            | **Phản ứng của hệ thống**                                                                                                    |
|----------|------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------|
| 1        | CTV chọn Lịch làm việc của tôi                       |                                                                                                                              |
| 2        |                                                      | Hệ thống mặc định hiển thị chế độ Lịch tuần cùng nhãn buồng làm việc hiện tại.                                               |
| 3        |                                                      | Lưới gồm năm ngày Thứ 2-Thứ 6; ngày hiện tại có nhãn Hôm nay và các ca đã đăng ký hiển thị thẻ tương ứng ở Ca Sáng/Ca Chiều. |
| 4        | CTV chọn Lịch sử làm việc                            |                                                                                                                              |
| 5        |                                                      | Hệ thống hiển thị lịch sử theo tháng từ cùng dữ liệu ca, kèm điều khiển chuyển tháng và các ngày Thứ 2-Thứ 6.                |
| 6        | CTV dùng nút chuyển tuần/tháng để xem giai đoạn khác |                                                                                                                              |
| 7        |                                                      | Hệ thống cập nhật tiêu đề thời gian và các ca thuộc giai đoạn được chọn; ngày không có ca được để trống.                     |

*e. Các trường hợp khác*

- Tại bước 3, nếu màn hình hẹp, lưới năm ngày giữ nguyên cấu trúc và cho phép cuộn ngang để xem đầy đủ.

- Tại bước 5, ngày không có ca hiển thị ô trống; ngày hiện tại được đánh dấu “Hôm nay” để phân biệt với các ngày còn lại.

#### 2.3. Xem chi tiết và hủy ca làm việc

*a. Tác nhân chính*

- Cộng tác viên

*b. Điều kiện ban đầu*

- Cộng tác viên đã đăng nhập và chọn một ca thuộc lịch cá nhân

*c. Điều kiện đối với kết quả*

- Chi tiết ca được hiển thị; nếu hủy, đúng ca đã chọn hoặc chuỗi ca định kỳ từ ngày đó trở đi được cập nhật

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
<td>CTV nhấn một ca đã đăng ký trong Lịch tuần hoặc Lịch sử làm việc</td>
<td></td>
</tr>
<tr class="even">
<td>2</td>
<td></td>
<td>Hệ thống mở cửa sổ Chi tiết ca làm việc gồm tên ca, ngày làm việc, trạng thái Đi làm, danh sách CTV làm cùng và nhóm thao tác hủy.</td>
</tr>
<tr class="odd">
<td>3</td>
<td>CTV nhấn Chỉ hủy ca này</td>
<td></td>
</tr>
<tr class="even">
<td>4</td>
<td></td>
<td><p>Hệ thống cập nhật ngay sau thao tác:</p>
<p>- Chỉ loại CTV khỏi đúng ca đang chọn</p>
<p>- Giữ nguyên các ca khác trong chuỗi đăng ký</p>
<p>- Đóng cửa sổ chi tiết</p>
<p>- Hiển thị thông báo hủy và cập nhật hai chế độ xem lịch</p></td>
</tr>
<tr class="odd">
<td>5</td>
<td>Hoặc CTV mở một ca tương lai và nhấn Hủy ca định kỳ</td>
<td></td>
</tr>
<tr class="even">
<td>6</td>
<td></td>
<td>Hệ thống loại CTV khỏi các ca cùng thứ và cùng buổi kể từ ngày đã chọn, giữ các ca trước đó và hiển thị thông báo kết quả.</td>
</tr>
<tr class="odd">
<td>7</td>
<td></td>
<td>Nếu ca đã qua, hệ thống chỉ hiển thị chi tiết và thông báo không thể hủy; CTV dùng nút Đóng hoặc biểu tượng X để thoát.</td>
</tr>
</tbody>
</table>

*e. Các trường hợp khác*

- Tại bước 1, nếu ca đã qua, hệ thống vẫn hiển thị chi tiết nhưng thông báo ca không thể hủy và chỉ cho phép đóng cửa sổ.

- Tại bước 5, nếu CTV chọn Hủy ca định kỳ, hệ thống hủy các ca cùng thứ và cùng buổi từ ngày đang chọn trở đi; các ca trước đó được giữ nguyên.

#### 2.4. Xem lịch làm việc tổng hợp

*a. Tác nhân chính*

- Quản trị viên

*b. Điều kiện ban đầu*

- Quản trị viên đã đăng nhập và chọn Lịch làm việc tổng hợp

*c. Điều kiện đối với kết quả*

- Danh sách CTV làm việc hôm nay và lịch tháng tổng thể được hiển thị từ dữ liệu phân công hiện có

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
<td>Quản trị viên chọn Lịch làm việc tổng hợp trên thanh điều hướng</td>
<td></td>
</tr>
<tr class="even">
<td>2</td>
<td></td>
<td><p>Màn hình hiển thị:</p>
<p>- Dòng tiêu đề Lịch làm việc tổng hợp</p>
<p>- Khối Danh sách CTV đăng ký hôm nay</p>
<p>- Ngày hiện tại và tổng số CTV hôm nay</p>
<p>- Thẻ từng CTV cùng các ca Sáng/Chiều đã đăng ký</p>
<p>- Khối Lịch Tháng tổng thể</p>
<p>- Nút Tháng trước và Tháng sau</p>
<p>- Năm cột Thứ 2-Thứ 6</p>
<p>- Mỗi ca có dữ liệu hiển thị số lượng CTV</p></td>
</tr>
<tr class="odd">
<td>3</td>
<td>Quản trị viên nhấn Tháng trước hoặc Tháng sau</td>
<td></td>
</tr>
<tr class="even">
<td>4</td>
<td></td>
<td>Hệ thống cập nhật tháng/năm, các ngày trong lưới và số lượng CTV của từng ca.</td>
</tr>
<tr class="odd">
<td>5</td>
<td>Quản trị viên nhấn thẻ CTV hôm nay hoặc thẻ số lượng CTV của một ca</td>
<td></td>
</tr>
<tr class="even">
<td>6</td>
<td></td>
<td>Hệ thống mở Hồ sơ &amp; Lịch trình tài khoản nếu chọn CTV; hoặc mở Chi tiết ca làm việc nếu chọn một ca trong lịch tháng.</td>
</tr>
<tr class="odd">
<td>7</td>
<td></td>
<td>Từ danh sách CTV trong Chi tiết ca làm việc, quản trị viên có thể nhấn Họ tên để tiếp tục mở hồ sơ của người đó.</td>
</tr>
</tbody>
</table>

*e. Các trường hợp khác*

- Tại bước 2, nếu hôm nay chưa có CTV đăng ký, hệ thống hiển thị “Chưa có CTV nào đăng ký hôm nay”.

- Tại bước 6, nếu ca được chọn chưa có CTV, cửa sổ chi tiết hiển thị trạng thái chưa có người đăng ký.

- Tại bước 3, nếu quản trị viên chuyển tháng, hệ thống cập nhật tiêu đề tháng, các ngày và số lượng CTV tương ứng.

- Tại bước 2, nếu màn hình hẹp, lịch tháng giữ năm cột Thứ 2-Thứ 6 và cho phép cuộn ngang.

#### 2.5. Xem chi tiết ca và hồ sơ CTV

*a. Tác nhân chính*

- Quản trị viên

*b. Điều kiện ban đầu*

- Quản trị viên đã đăng nhập và đang ở Lịch làm việc tổng hợp

- Quản trị viên đã chọn một ca có dữ liệu hoặc một CTV trong danh sách hôm nay

*c. Điều kiện đối với kết quả*

- Chi tiết ca hiển thị danh sách CTV; từ danh sách này có thể mở Hồ sơ & Lịch trình tài khoản của từng CTV

*d. Kịch bản thành công chính*

| **Bước** | **Thao tác của tác nhân**                                                                 | **Phản ứng của hệ thống**                                                                                                        |
|----------|-------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------|
| 1        | Quản trị viên nhấn một thẻ Ca Sáng/Ca Chiều có dữ liệu trong lịch tháng                   |                                                                                                                                  |
| 2        |                                                                                           | Hệ thống mở Chi tiết ca làm việc, hiển thị tên ca, ngày làm việc, tổng số CTV và bảng Họ tên CTV, Số điện thoại, Phòng làm việc. |
| 3        | Quản trị viên nhấn Họ tên hoặc ảnh đại diện của một CTV                                   |                                                                                                                                  |
| 4        |                                                                                           | Hệ thống đóng Chi tiết ca và mở cửa sổ Hồ sơ & Lịch trình tài khoản của đúng CTV.                                                |
| 5        | Quản trị viên dùng biểu tượng Xem/Tải CV, Lịch sử làm việc hoặc nhập Ghi chú rồi nhấn Lưu |                                                                                                                                  |
| 6        |                                                                                           | Hệ thống mở nội dung tương ứng hoặc lưu ghi chú và đổi trạng thái nút thành Đã lưu.                                              |
| 7        |                                                                                           | Khi quản trị viên nhấn biểu tượng X, hệ thống đóng hồ sơ và trở về màn hình Lịch làm việc tổng hợp.                              |

*e. Các trường hợp khác*

- Tại bước 2, nếu ca không có CTV, hệ thống hiển thị thông báo “Chưa có CTV nào đăng ký ca làm việc này”.

- Tại bước 3, nếu không tìm thấy tài khoản khớp với CTV, hệ thống hiển thị thông báo không tìm thấy hồ sơ.

- Tại bước 5, quản trị viên có thể xem/tải CV, xem lịch sử bằng các biểu tượng có chú thích hoặc lưu Ghi chú; đóng cửa sổ bằng biểu tượng X.
