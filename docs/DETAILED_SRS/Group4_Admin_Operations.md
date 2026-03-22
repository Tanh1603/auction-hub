# Group 4: Admin Operations Use Case Specifications

## 11. Manage User Roles & Bans (Quản lý Vai trò & Khóa tài khoản)

**Đối tượng sử dụng:** Admin / Super Admin

**Mô tả:** Admin thực hiện quản lý quyền truy cập của người dùng thông qua việc thay đổi vai trò (Role) và trạng thái hoạt động (Ban/Unban).

**Các bước thực hiện (Thăng cấp/User Roles):**

1. **[Admin]** truy cập danh sách người dùng, chọn người dùng cần cấp quyền.
2. **Hệ thống** hiển thị thông tin và vai trò hiện tại.
3. **[Admin]** chọn vai trò mới (VD: `auctioneer`) và xác nhận.
4. **Hệ thống** kiểm tra phân quyền (`UserService.promoteUser`):
   - Người thực hiện phải có quyền `admin` hoặc `super_admin`.
   - **Quy tắc:** `admin` thường không thể thăng cấp người khác lên `admin` hoặc `super_admin` (quyền hạn chế). Chỉ `super_admin` mới có toàn quyền.
5. **Hệ thống** cập nhật role mới cho người dùng trong cơ sở dữ liệu.
6. **Hệ thống** trả về thông tin người dùng với role mới.

**Các bước thực hiện (Khóa tài khoản / Bans):**

1. **[Admin]** chọn người dùng vi phạm.
2. **[Admin]** thực hiện hành động "Khóa tài khoản" (Ban).
3. **Hệ thống** cập nhật trạng thái `isBanned = true` cho người dùng.
4. **Hệ thống** (khi người dùng thực hiện các hành động khác):
   - Tại các điểm kiểm tra như `Login`, `RegisterToBid` (`UserRegistrationService`), `ManualBid` (`ManualBidService`), hệ thống luôn kiểm tra cờ `isBanned`.
   - Nếu `isBanned == true`, từ chối mọi thao tác (Throw `ForbiddenException`).

**TH1 (Thành công):**

- Cập nhật Role hoặc trạng thái Ban thành công.
- Quyền hạn người dùng thay đổi ngay lập tức.

**TH2 (Thất bại/Ngoại lệ):**

- Không đủ quyền hạn (VD: Admin thường cố gắng Promote lên Super Admin).
- Người dùng không tồn tại.

---

## 12. Process Refunds (Xử lý hoàn trả tiền cọc)

**Đối tượng sử dụng:** Admin (người có quyền phê duyệt tài chính)

**Mô tả:** Xử lý các yêu cầu hoàn trả tiền đặt cọc cho người tham gia đấu giá không trúng thầu hoặc rút lui hợp lệ. Quy trình bao gồm đánh giá điều kiện, phê duyệt, và thực hiện lệnh hoàn tiền.

**Các bước thực hiện:**

1. **[Admin]** truy cập danh sách yêu cầu hoàn tiền (`RefundStatus: PENDING`).
2. **[Admin]** xem chi tiết một yêu cầu từ người dùng hoặc kích hoạt xử lý hàng loạt cho một phiên đấu giá (`processAllRefundsForAuction`).
3. **Hệ thống** tự động đánh giá điều kiện (`RefundService.evaluateRefundEligibility`):
   - **Rule 1:** Người bị tước quyền (`Disqualified`) -> **Không** được hoàn tiền.
   - **Rule 2:** Người trúng thầu (`Winner`) -> **Không** được hoàn tiền (tiền cọc chuyển thành tiền thanh toán).
   - **Rule 3:** Người không Check-in sau khi phiên đấu giá kết thúc -> **Không** được hoàn tiền (mất cọc).
   - **Rule 4:** Rút lui muộn (sau hạn chót `saleEndAt`) -> **Không** được hoàn tiền.
   - **Rule 5:** Rút lui hợp lệ hoặc không trúng thầu -> **Được** hoàn 100% tiền cọc.
4. **[Admin]** thực hiện hành động dựa trên kết quả đánh giá:
   - **Phê duyệt (Approve):** Chuyển trạng thái sang `APPROVED`.
   - **Từ chối (Reject):** Chuyển trạng thái sang `REJECTED` kèm lý do.
5. **[Admin]** nhấn "Thực hiện hoàn tiền" (Process) cho các yêu cầu đã duyệt (`APPROVED`).
6. **Hệ thống** (`PaymentProcessingService`):
   - Thực hiện lệnh hoàn tiền (Refund) thông qua cổng thanh toán (Stripe).
   - Cập nhật trạng thái hoàn tiền sang `PROCESSED`.
   - Ghi lại thời gian xử lý (`refundProcessedAt`).
7. **Hệ thống** gửi Email thông báo kết quả (Approved/Rejected/Processed) cho người dùng.

**TH1 (Thành công):**

- Hoàn tiền thành công, trạng thái cập nhật `PROCESSED`.
- Tiền được trả về phương thức thanh toán ban đầu của người dùng.

**TH2 (Thất bại/Ngoại lệ):**

- Người dùng không đủ điều kiện (Vi phạm quy chế).
- Lỗi cổng thanh toán (Stripe Error) khi thực hiện lệnh Refund.
- Trạng thái yêu cầu không hợp lệ (VD: Cố gắng hoàn tiền cho yêu cầu đã bị từ chối).
