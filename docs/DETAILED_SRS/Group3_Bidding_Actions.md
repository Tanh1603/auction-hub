# Group 3: Bidding Actions Use Case Specifications

## 8. Register to Bid (Đăng ký tham gia đấu giá)

**Đối tượng sử dụng:** Bidder (Người đấu giá - Guest/Registered User)

**Mô tả:** Người dùng đăng ký tham gia vào một phiên đấu giá cụ thể bằng cách nộp hồ sơ (tài liệu và phương tiện truyền thông) để xác minh danh tính và năng lực tài chính.

**Các bước thực hiện:**

1. **[Bidder]** truy cập trang chi tiết phiên đấu giá và nhấn nút "Đăng ký tham gia" (Register).
2. **Hệ thống** hiển thị form đăng ký yêu cầu tải lên tài liệu xác minh (Documents) và phương tiện truyền thông (Media).
3. **[Bidder]** tải lên các file cần thiết (hỗ trợ PDF, DOC, DOCX cho tài liệu; hình ảnh/video cho media) và nhấn "Xác nhận".
4. **Hệ thống** thực hiện tải các file lên Cloud storage (Cloudinary).
5. **Hệ thống** kiểm tra các điều kiện (Validation Rules):
   - Kiểm tra tài khoản người dùng: Không bị khóa (Banned) và chưa bị xóa.
   - Kiểm tra phiên đấu giá: Tồn tại, chưa kết thúc (`now <= saleEndAt`) và đã mở đăng ký (`now >= saleStartAt`).
   - Kiểm tra trạng thái tham gia hiện tại (nếu có):
     - Nếu đã được xác nhận (`confirmed`): Báo lỗi đã tham gia.
     - Nếu đang chờ duyệt (`pending`): Báo lỗi đang chờ xử lý.
     - Nếu đã rút lui (`withdrawn`) hoặc bị từ chối hồ sơ (`documentsRejected`): Cho phép tái đăng ký (Reset trạng thái cũ).
6. **Hệ thống** thực hiện cập nhật cơ sở dữ liệu:
   - Nếu là đăng ký mới: Tạo mới bản ghi `AuctionParticipant` với trạng thái `submittedAt = NOW`.
   - Nếu là tái đăng ký: Cập nhật bản ghi cũ, xóa các trạng thái rút lui/từ chối cũ, cập nhật `submittedAt = NOW` và đường dẫn file mới.
7. **Hệ thống** trả về thông tin đăng ký thành công.

**TH1 (Thành công):**

- Thông tin hợp lệ, file upload thành công.
- Hệ thống ghi nhận trạng thái người dùng là "Đang chờ duyệt tài liệu" (Pending Document Review).
- Thông báo "Đăng ký thành công, vui lòng chờ duyệt hồ sơ".

**TH2 (Thất bại/Ngoại lệ):**

- Nếu tài khoản bị khóa (`User banned`): Báo lỗi "Tài khoản của bạn đã bị khóa".
- Nếu phiên đấu giá chưa mở hoặc đã đóng đăng ký: Báo lỗi "Thời gian đăng ký không hợp lệ".
- Nếu người dùng đã được xác nhận tham gia: Báo lỗi "Bạn đã được xác nhận tham gia phiên này".
- Nếu lỗi upload file: Báo lỗi "Không thể tải lên tài liệu, vui lòng thử lại".

---

## 9. Place Manual & Auto Bids (Đặt giá thầu thủ công & Tự động)

**Đối tượng sử dụng:** Bidder (Người đấu giá đã Check-in)

**Mô tả:** Người dùng đặt giá thầu cho sản phẩm trong phiên đấu giá đang diễn ra (Live). Hệ thống kiểm tra tính hợp lệ của giá thầu và cập nhật theo thời gian thực.
_(Lưu ý: Dựa trên mã nguồn hiện tại, chỉ có logic Đặt giá thầu thủ công - Manual Bid được tìm thấy và mô tả dưới đây)._

**Các bước thực hiện:**

1. **[Bidder]** theo dõi phiên đấu giá (đã kết nối WebSocket `auction:{id}`) và nhập số tiền muốn đặt, sau đó nhấn "Đặt giá" (Place Bid).
2. **Hệ thống** kiểm tra các điều kiện tiên quyết:
   - Kiểm tra phiên đấu giá: Phải ở trạng thái `LIVE` (đang diễn ra).
   - Kiểm tra thời gian: Thời gian hiện tại phải nằm trong khung giờ đấu giá (`StartAt <= NOW <= EndAt`).
   - Kiểm tra tư cách tham gia của người dùng (`Participant`):
     - Đã xác nhận tham gia (`confirmedAt`).
     - Đã Check-in vào phòng đấu giá (`checkedInAt`).
     - Chưa rút lui (`withdrawnAt`) và không bị từ chối (`rejectedAt`).
     - Tài khoản không bị khóa (`isBanned`).
3. **Hệ thống** kiểm tra tính hợp lệ của giá thầu (`ManualBidService`):
   - Nếu là giá thầu đầu tiên: Phải lớn hơn hoặc bằng Giá khởi điểm (`StartingPrice`).
   - Nếu đã có giá thầu trước đó: Phải lớn hơn Giá thầu cao nhất hiện tại (`CurrentHighestBid`).
   - Kiểm tra Bước giá (`BidIncrement`): Số tiền đặt phải tuân thủ bước giá ( `(BidAmount - Baseline) % Increment == 0`).
4. **Hệ thống** thực hiện cập nhật cơ sở dữ liệu (trong Transaction):
   - Kiểm tra lại (Re-check) trạng thái phiên đấu giá và giá thầu cao nhất mới nhất để tránh tranh chấp (Race Condition).
   - Cập nhật tất cả các giá thầu trước đó (`isWinningBid = false`).
   - Tạo bản ghi giá thầu mới (`AuctionBid`) với `bidType = 'manual'` và `isWinningBid = true`.
5. **Hệ thống** phát sự kiện thời gian thực (WebSocket):
   - Gửi sự kiện `newBid` tới tất cả người dùng trong phòng đấu giá (`auction:{id}`), bao gồm thông tin giá mới và người đặt.

**TH1 (Thành công):**

- Giá thầu hợp lệ và được ghi nhận.
- Hệ thống cập nhật giá cao nhất trên giao diện của tất cả người tham gia.
- Thông báo "Đặt giá thành công".

**TH2 (Thất bại/Ngoại lệ):**

- Nếu chưa Check-in: Báo lỗi "Bạn phải Check-in trước khi đặt giá".
- Nếu giá thầu thấp hơn giá hiện tại: Báo lỗi "Giá đặt phải cao hơn [Giá hiện tại]".
- Nếu bước giá sai: Báo lỗi "Giá đặt không đúng bước giá quy định".
- Nếu phiên đấu giá đã kết thúc hoặc tạm dừng: Báo lỗi "Phiên đấu giá không khả dụng".

---

## 10. Pay Participation Deposit (Thanh toán tiền cọc tham gia)

**Đối tượng sử dụng:** Bidder (Người đấu giá đã được duyệt hồ sơ)

**Mô tả:** Người dùng thực hiện thanh toán tiền đặt cọc (Deposit) và phí tham gia để hoàn tất thủ tục đăng ký sau khi hồ sơ tài liệu đã được duyệt (Tier 1 Approval).

**Các bước thực hiện:**

1. **[Bidder]** nhận được thông báo hồ sơ đã được duyệt và yêu cầu đóng tiền cọc.
2. **[Bidder]** nhấn nút "Thanh toán tiền cọc" (Pay Deposit).
3. **Hệ thống** kiểm tra trạng thái đăng ký (`RegistrationPaymentService.initiateDepositPayment`):
   - Hồ sơ tài liệu đã được duyệt (`documentsVerifiedAt`).
   - Chưa thanh toán cọc (`depositPaidAt` is null).
4. **Hệ thống** tính toán số tiền cần thanh toán:
   - `TotalAmount` = `DepositAmountRequired` (Tiền cọc) + `SaleFee` (Phí tham gia).
5. **Hệ thống** gọi cổng thanh toán (Stripe) để tạo phiên thanh toán (Session/Payment Intent) và trả về URL/QR Code thanh toán.
6. **[Bidder]** thực hiện chuyển khoản hoặc thanh toán qua thẻ theo hướng dẫn.
7. **Hệ thống** (thông qua Webhook hoặc Callback) nhận kết quả thanh toán và thực hiện xác minh (`verifyDepositPayment`):
   - Kiểm tra trạng thái thanh toán từ Stripe (`paid`).
   - Kiểm tra số tiền nhận được (`ReceivedAmount >= TotalAmount`).
8. **Hệ thống** cập nhật cơ sở dữ liệu:
   - Cập nhật trạng thái thanh toán (`Payment`) thành `completed`.
   - Cập nhật trạng thái người tham gia (`AuctionParticipant`): set `depositPaidAt`, lưu `depositAmount` và `depositPaymentId`.
9. **Hệ thống** gửi Email thông báo:
   - Gửi email xác nhận đã nhận tiền cọc cho Bidder.
   - Gửi email thông báo cho Admin/Auctioneer để thực hiện phê duyệt cuối cùng (Final Approval).

**TH1 (Thành công):**

- Thanh toán thành công, số tiền khớp.
- Hệ thống cập nhật trạng thái "Đã đóng tiền cọc" (Deposit Paid) và chuyển sang chờ duyệt cuối cùng.
- Thông báo "Thanh toán thành công, vui lòng chờ xác nhận cuối cùng".

**TH2 (Thất bại/Ngoại lệ):**

- Nếu hồ sơ chưa được duyệt: Báo lỗi "Hồ sơ chưa được xác minh".
- Nếu thanh toán thất bại hoặc chưa hoàn tất: Báo lỗi "Thanh toán chưa hoàn tất".
- Nếu số tiền thanh toán thiếu (do tỷ giá hoặc lỗi): Báo lỗi "Số tiền thanh toán không đủ tổng chi phí yêu cầu".
- Nếu quá hạn thanh toán (Quá 24h kể từ khi duyệt hồ sơ): Hệ thống có thể tự động hủy hoặc yêu cầu đăng ký lại (tùy cấu hình logic `verifyAndConfirmDepositPayment`).
