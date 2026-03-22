# Group 1: Identity & Access Use Case Specifications

## 1. Register Account (Đăng ký tài khoản)

**Đối tượng sử dụng:** Guest (Khách)

**Mô tả:** Người dùng chưa có tài khoản thực hiện đăng ký mới vào hệ thống thông qua email và mật khẩu. Hệ thống tạo tài khoản đồng thời trên Supabase Auth và cơ sở dữ liệu cục bộ.

**Các bước thực hiện:**

1. **[Guest]** chọn chức năng "Đăng ký" trên giao diện.
2. **Hệ thống** hiển thị form yêu cầu nhập thông tin: Email, Mật khẩu, Họ tên, SĐT, CCCD/CMND (Identity Number), Loại tài khoản (Cá nhân/Doanh nghiệp), Mã số thuế (nếu có).
3. **[Guest]** nhập thông tin và nhấn "Đăng ký".
4. **Hệ thống** thực hiện kiểm tra (Validation):
   - Kiểm tra trùng lặp (Unique Validate): Email, Số điện thoại, Số CCCD trong cơ sở dữ liệu cục bộ.
5. **Hệ thống** thực hiện quy trình đăng ký (Transaction):
   - **B1 (Supabase):** Gọi API `supabase.auth.signUp` để tạo tài khoản xác thực. Cấu hình gửi email xác thực tự động.
   - **B2 (Local DB):** Tạo bản ghi `User` mới trong database với vai trò mặc định là `bidder`.
   - **Rollback:** Nếu bước tạo Local DB thất bại, hệ thống sẽ xóa tài khoản Supabase vừa tạo để đảm bảo tính nhất quán.
6. **Hệ thống** thông báo thành công và yêu cầu người dùng kiểm tra email để xác thực.

**TH1 (Thành công):**

- Thông tin hợp lệ, không trùng lặp.
- Tài khoản được tạo trên cả hai hệ thống.
- Email xác thực được gửi.
- Thông báo: "Đăng ký thành công. Vui lòng kiểm tra email để xác thực tài khoản."

**TH2 (Thất bại/Ngoại lệ):**

- Nếu Email/SĐT/CCCD đã tồn tại: Báo lỗi "Thông tin [Trường] đã được sử dụng".
- Nếu lỗi kết nối Supabase: Báo lỗi "Không thể tạo tài khoản xác thực".
- Nếu lỗi tạo DB cục bộ: Báo lỗi hệ thống, tự động hủy tài khoản Supabase.

---

## 2. Login & Authenticate (Đăng nhập & Xác thực)

**Đối tượng sử dụng:** Guest (Khách)

**Mô tả:** Người dùng sử dụng Email và Mật khẩu để truy cập vào hệ thống.

**Các bước thực hiện:**

1. **[Guest]** truy cập trang Đăng nhập, nhập Email và Mật khẩu.
2. **Hệ thống** kiểm tra sơ bộ:
   - Kiểm tra tài khoản có tồn tại trong Local DB không.
3. **Hệ thống** gọi API `supabase.auth.signInWithPassword`.
   - Supabase kiểm tra thông tin đăng nhập và trạng thái xác thực email.
4. **Hệ thống** nhận kết quả từ Supabase:
   - Nếu thành công: Nhận về `access_token`, `refresh_token`, và `user_info`.
5. **Hệ thống** trả về token và thông tin người dùng cho Client.

**TH1 (Thành công):**

- Thông tin chính xác, email đã xác thực.
- Hệ thống chuyển hướng người dùng vào trang chủ/Dashboard.

**TH2 (Thất bại/Ngoại lệ):**

- Nếu người dùng không tồn tại trong DB: Báo lỗi "Tài khoản không tồn tại".
- Nếu sai mật khẩu hoặc Email chưa xác thực (lỗi từ Supabase): Báo lỗi tương ứng (VD: "Thông tin đăng nhập không đúng" hoặc "Email chưa được xác thực").

---

## 3. Manage User Profile & Promote (Quản lý hồ sơ & Thăng cấp)

**Đối tượng sử dụng:** Registered User (Người dùng đã đăng nhập) / Admin

**Mô tả:**

- Người dùng xem thông tin cá nhân của mình.
- Admin thực hiện thăng cấp vai trò (Role) cho người dùng khác.
- Quản lý quên mật khẩu/đặt lại mật khẩu.

**Các bước thực hiện (Xem Profile):**

1. **[User]** gửi yêu cầu lấy thông tin cá nhân (`GET /auth/me`) kèm Token.
2. **Hệ thống** xác thực Token với Supabase (`getUser`).
3. **Hệ thống** truy vấn thông tin chi tiết từ Local DB dựa trên User ID từ Token.
4. **Hệ thống** trả về thông tin người dùng.

**Các bước thực hiện (Thăng cấp - Admin only):**

1. **[Admin]** chọn người dùng và role mới (VD: `auctioneer`), nhấn "Cập nhật".
2. **Hệ thống** kiểm tra quyền hạn (`UserService.promoteUser`):
   - Người thực hiện phải là `admin` hoặc `super_admin`.
   - Logic chặn: `admin` thường không thể tạo ra `admin` hoặc `super_admin` khác (chỉ `super_admin` mới có quyền cao nhất).
3. **Hệ thống** cập nhật role trong cơ sở dữ liệu.

**Các bước thực hiện (Quên mật khẩu):**

1. **[Guest]** chọn "Quên mật khẩu", nhập Email.
2. **Hệ thống** kiểm tra Email tồn tại trong DB.
3. **Hệ thống** gọi `supabase.auth.resetPasswordForEmail`.
4. **Hệ thống** gửi email chứa link đặt lại mật khẩu.

**TH1 (Thành công):**

- Lấy/Cập nhật thông tin thành công.
- Email reset password được gửi.

**TH2 (Thất bại/Ngoại lệ):**

- Token hết hạn/không hợp lệ: Báo lỗi "Phiên đăng nhập hết hạn" (`Unauthorized`).
- Không đủ quyền hạn (Khi thăng cấp): Báo lỗi "Bạn không có quyền thực hiện thao tác này" (`Forbidden`).
- Email không tồn tại (Quên mật khẩu): Báo lỗi "Người dùng không tồn tại".

---

## 4. Verify Identity (KYC - Email Verification)

**Đối tượng sử dụng:** Registered User

**Mô tả:** Quy trình xác thực danh tính cơ bản thông qua Email Verification Link và xác thực nâng cao thông qua hồ sơ đấu giá (đã mô tả chi tiết ở Use Case "Register to Bid"). Ở đây tập trung vào xác thực Email.

**Các bước thực hiện:**

1. **[User]** nhận được email xác thực sau khi đăng ký hoặc yêu cầu gửi lại (`Resend Verification`).
2. **[User]** click vào link xác thực trong email (Link trỏ về `/auth/verify`).
3. **Hệ thống** (Backend) nhận request với `token` và `email`.
4. **Hệ thống** gọi `supabase.auth.verifyOtp` với loại `email` và `token`.
5. **Hệ thống** kiểm tra kết quả:
   - Nếu hợp lệ: Xác nhận email thành công.
   - Chuyển hướng (Redirect) người dùng về trang giao diện Frontend kèm trạng thái (`success=true`).

**TH1 (Thành công):**

- Token hợp lệ.
- Tài khoản chuyển sang trạng thái đã xác thực (Verified).
- Người dùng có thể đăng nhập.

**TH2 (Thất bại/Ngoại lệ):**

- Link hết hạn hoặc Token sai: Báo lỗi "Xác thực thất bại".
- Hệ thống chuyển hướng về trang lỗi.
