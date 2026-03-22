# Group 2: Auction Management Use Case Specifications

## 5. Create Auction Listing (Tạo phiên đấu giá)

**Đối tượng sử dụng:** Auctioneer (Đấu giá viên)

**Mô tả:** Tạo mới một phiên đấu giá với đầy đủ thông tin về tài sản, thời gian, và quy định tài chính. Hệ thống tự động thiết lập các tác vụ định thời (Scheduler) để mở và đóng phiên.

**Các bước thực hiện:**

1. **[Auctioneer]** truy cập trang quản lý đấu giá, chọn "Tạo mới".
2. **Hệ thống** hiển thị form nhập liệu chi tiết.
3. **[Auctioneer]** nhập các thông tin (`CreateAuctionDto`):
   - Thông tin cơ bản: Tên, Mã định danh (Code), Loại tài sản.
   - Thông tin tài sản: Mô tả, Địa chỉ, Tỉnh/Thành, Phường/Xã, Chủ sở hữu (Property Owner).
   - Thời gian:
     - Thời gian bán hồ sơ: `saleStartAt` - `saleEndAt`.
     - Thời gian xem tài sản: `viewTime`.
     - Hạn nộp tiền cọc: `depositEndAt`.
     - Thời gian đấu giá: `auctionStartAt` - `auctionEndAt`.
   - Tài chính: Giá khởi điểm (`startingPrice`), Bước giá (`bidIncrement`), Tiền cọc (`depositAmountRequired`), Phí hồ sơ/Phí tham gia (`saleFee`/`dossierFee`).
   - Cấu hình Check-in: Thời gian cho phép check-in trước và sau khi bắt đầu.
   - Tải lên hình ảnh (`images`) và tài liệu đính kèm (`attachments`).
4. **Hệ thống** thực hiện tạo phiên đấu giá (`AuctionService.create`):
   - Lưu thông tin vào database trong Transaction.
   - Lưu thông tin Cloudinary (Public IDs) của ảnh/tài liệu.
5. **Hệ thống** thiết lập lập lịch (Queue/Job Schedule):
   - Tạo Job `OPEN_AUCTION`: Chạy tại thời điểm `auctionStartAt` để chuyển trạng thái sang `LIVE`.
   - Tạo Job `CLOSE_AUCTION`: Chạy tại thời điểm `auctionEndAt` để kết thúc phiên.

**TH1 (Thành công):**

- Dữ liệu hợp lệ.
- Phiên đấu giá được tạo với trạng thái ban đầu (thường là `Scheduled`).
- Các Job được lên lịch thành công.
- Thông báo: "Tạo phiên đấu giá thành công".

**TH2 (Thất bại/Ngoại lệ):**

- Lỗi dữ liệu (Validation): Thiếu trường bắt buộc, ngày tháng không hợp lệ (Ngày kết thúc < Ngày bắt đầu, v.v.).
- Lỗi Database: Rollback transaction, đồng thời xóa các file đã upload lên Cloudinary để dọn dẹp (Cleanup).
- Báo lỗi chi tiết cho người dùng.

---

## 6. Manage Auction Costs & Media (Quản lý chi phí & Truyền thông)

**Đối tượng sử dụng:** Auctioneer

**Mô tả:** Cập nhật, chỉnh sửa thông tin hình ảnh, tài liệu và quản lý các chi phí phát sinh liên quan đến tổ chức đấu giá (Quảng cáo, thuê địa điểm, thẩm định, v.v.).

**Các bước thực hiện (Quản lý Media - Update):**

1. **[Auctioneer]** chọn phiên đấu giá cần sửa, tải lên ảnh mới hoặc xóa ảnh cũ.
2. **Hệ thống** (`AuctionService.update`):
   - Xác định các ảnh cần xóa (dựa trên Public ID).
   - Cập nhật danh sách ảnh mới trong Database.
   - Gọi Cloudinary API để xóa các ảnh cũ không còn sử dụng.

**Các bước thực hiện (Quản lý Chi phí - Costs):**

1. **[Auctioneer]** vào tab "Chi phí" của phiên đấu giá.
2. **Hệ thống** hiển thị các loại chi phí hiện tại (nếu có).
3. **[Auctioneer]** nhập/cập nhật các khoản chi phí (`AuctionCostService.upsert`):
   - Chi phí quảng cáo (`advertisingCost`).
   - Chi phí thuê địa điểm (`venueRentalCost`).
   - Chi phí thẩm định giá (`appraisalCost`).
   - Chi phí xem tài sản (`assetViewingCost`).
   - Các chi phí khác (Danh sách `otherCosts`).
4. **Hệ thống** (`PolicyCalculationService`):
   - Tính tổng chi phí: `TotalCosts = Sum(All Component Costs)`.
5. **Hệ thống** lưu trữ bản ghi `AuctionCost` (Upsert: Tạo mới nếu chưa có, Cập nhật nếu đã có).

**TH1 (Thành công):**

- Cập nhật thành công.
- Tổng chi phí được tính toán lại chính xác.

**TH2 (Thất bại/Ngoại lệ):**

- Phiên đấu giá không tồn tại.
- Lỗi kết nối Cloudinary khi xóa ảnh.

---

## 7. Finalize & Evaluate Auction (Đánh giá & Kết thúc phiên)

**Đối tượng sử dụng:** Auctioneer / System (Automated)

**Mô tả:** Quy trình đánh giá kết quả phiên đấu giá (Thành công hay Thất bại) dựa trên các quy tắc nghiệp vụ (Số lượng người tham gia, Giá đặt, Giá khởi điểm...) và xác nhận kết quả cuối cùng.

**Các bước thực hiện (Đánh giá tự động - System Evaluation):**

1. **[System/Auctioneer]** kích hoạt quy trình đánh giá (`AuctionEvaluationService.evaluateAuction`).
2. **Hệ thống** kiểm tra các quy tắc (Rules):
   - **Rule 1 (Thời gian):** Phiên đã kết thúc chưa (`NOW >= EndAt`)?
   - **Rule 2 (Số lượng):** Có đủ số lượng người tham gia tối thiểu (`ConfirmedParticipants >= 2`)?
   - **Rule 3 (Giá thầu):** Có giá thầu hợp lệ (`ValidBids > 0`)?
   - **Rule 4 (Giá sàn):** Giá cao nhất có đạt giá bảo lưu/giá khởi điểm (`HighestBid >= ReservePrice`)?
   - **Rule 5 (Tuân thủ):** Tỷ lệ tuân thủ bước giá có đạt chuẩn (VD: > 95%)?
   - **Rule 6 (Thời lượng):** Thời gian đấu giá có vượt quá giới hạn cho phép (7 ngày)?
3. **Hệ thống** đưa ra **Trạng thái đề xuất** (`RecommendedStatus`):
   - `SUCCESS`: Nếu thỏa mãn tất cả điều kiện và giá đạt yêu cầu.
   - `FAILED`: Nếu thiếu người tham gia, không có bid, hoặc giá không đạt.
   - Liệt kê danh sách các vấn đề (`issues`) phát hiện được.

**Các bước thực hiện (Chốt kết quả - Finalize):**

1. **[Auctioneer]** xem bảng kết quả đánh giá và đề xuất của hệ thống.
2. **[Auctioneer]** chọn hành động "Kết thúc phiên" (`finalizeAuction`) theo đề xuất hoặc ghi đè (Override) nếu cần thiết.
3. **Hệ thống** cập nhật trạng thái cuối cùng của phiên đấu giá (`Status` -> `SUCCESS` / `FAILED`).
4. **Hệ thống** gửi thông báo kết quả cho người thắng cuộc và các bên liên quan.

**TH1 (Thành công):**

- Phiên đấu giá được chuyển sang trạng thái kết thúc (Success/Failed).
- Ghi log kiểm toán (Audit Log) đầy đủ.

**TH2 (Thất bại/Ngoại lệ):**

- Phiên đấu giá chưa đến giờ kết thúc: Không cho phép Finalize.
- Phiên đấu giá đã Finalize rồi: Không cho phép thực hiện lại.
