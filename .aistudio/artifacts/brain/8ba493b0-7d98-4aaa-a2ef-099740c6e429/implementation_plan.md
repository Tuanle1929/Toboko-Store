# Kế hoạch Tối ưu Giao diện Mobile & Luồng Thanh toán Trực tiếp

Sau khi phân tích ảnh chụp màn hình và phản hồi về nút thanh toán, kế hoạch hoàn thiện gồm các mục sau:

## 1. Cố định vị trí Header & Cuộn trang tức thì (Fix Header Overlap)
- **Vấn đề**: Khi chuyển từ trang chủ sang trang chi tiết, lệnh `window.scrollTo({ behavior: 'smooth' })` có độ trễ cuộn, khiến thanh Header tạm thời bị đè ngang thân ảnh sản phẩm nếu người dùng chạm tay vào màn hình khi trang đang cuộn.
- **Giải pháp**:
  - Chuyển lệnh cuộn trang sang `window.scrollTo(0, 0)` tức thì khi chuyển trang, đảm bảo Header luôn nằm ở đỉnh màn hình, bên trên ảnh sản phẩm.
  - Tối ưu khoảng cách `padding-top` của trang chi tiết để không bị che khuất viền trên của ảnh sản phẩm.

## 2. Nút Thanh toán Trực tiếp (`⚡ Mua ngay`)
- **Vấn đề**: Khách hàng chọn xong phân loại muốn thanh toán ngay nhưng trước đây chỉ có nút "Thêm vào giỏ hàng", phải tìm mở giỏ hàng ở trên cùng mới thấy nút thanh toán.
- **Giải pháp**:
  - Bổ sung ngay nút **`⚡ Mua ngay`** nổi bật bên cạnh nút **`🛒 Thêm vào giỏ`** tại thanh công cụ đáy cố định.
  - Khi khách bấm **`⚡ Mua ngay`**: Hệ thống tự động thêm sản phẩm đã chọn vào giỏ và chuyển thẳng sang màn hình **Thanh toán (Checkout)** để điền thông tin và đặt hàng chỉ trong 1 thao tác.

## 3. Ghim cố định thanh thao tác ở đáy màn hình (`Sticky Bottom Bar`)
- **Giải pháp**:
  - Đảm bảo thanh thao tác luôn nổi ở mép dưới cùng màn hình với `z-index: 95`, hỗ trợ vùng an toàn tai thỏ/thanh điều hướng `env(safe-area-inset-bottom)`.
  - Luôn hiện rõ ràng các nút dù khách đang ở bất kỳ vị trí cuộn nào trên trang.
