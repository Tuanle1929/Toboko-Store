# SỔ TAY QUẢN LÝ KHO & VẬN HÀNH MINI WEB TOBOKO STORE

Tài liệu này lưu lại toàn bộ nguyên lý hoạt động, cấu trúc dữ liệu và quy trình cập nhật kho để bạn dễ dàng tra cứu và vận hành bất cứ lúc nào.

---

## 1. NGUYÊN LÝ QUẢN LÝ TỒN KHO

* **Tồn kho cố định:** Hệ thống web và Google Sheet **không tự động trừ kho** sau mỗi đơn hàng. Số lượng tồn kho được giữ nguyên vẹn để bạn chủ động kiểm soát và khớp 100% với dữ liệu thực tế từ hệ thống quản lý tổng/Shopee/TikTok Shop.
* **Cập nhật theo đợt:** Định kỳ (hàng ngày hoặc hàng tuần), bạn xuất file tồn kho từ sàn về máy và nhờ trợ lý cập nhật hàng loạt trong 2-3 giây.

---

## 2. QUY TRÌNH CẬP NHẬT KHO BẰNG FILE EXCEL

Mỗi khi muốn cập nhật tồn kho mới:
1. Xuất file từ sàn về (file dạng `.zip` hoặc `.xlsx`, ví dụ: `Danh_sach_quan_ly_kho_phien_ban_san_pham_...xlsx`).
2. Gửi đường dẫn hoặc file vào khung chat: *"Cập nhật tồn kho theo file này nha: [Đường dẫn file]"*.
3. Trợ lý AI sẽ tự động:
   - Đọc cột **`SKU`** (Cột C trong Excel) và cột **`Tồn kho / Có thể bán`** (Cột D/E trong Excel).
   - Tự động chuẩn hóa số âm (nếu có mã âm như `-1` sẽ quy về `0` - Hết hàng).
   - Báo cáo số lượng mã có biến động tồn kho.
   - Bắn API cập nhật thẳng vào tab **`Inventory`** trên Google Sheet.
   - Web bán hàng [tobokostore.pro.vn](https://tobokostore.pro.vn) sẽ hiển thị ngay số lượng mới mà không cần sửa code.

---

## 3. LƯU Ý QUAN TRỌNG VỀ GOOGLE SHEET (TAB `Inventory`)

* **Cột A (SKU) là chìa khóa đối soát:**
  - Mọi phân loại con (variant) hoặc sản phẩm đơn phải có mã **`SKU`** chính xác ở Cột A (khớp với SKU trên file sàn như: `X01`, `KMMLX`, `NMLA`...).
  - Dòng tiêu đề sản phẩm cha (dòng chỉ có Tên SP, phân loại để trống như `Lược Tony&Guy`, `Kích Mí Mlen...`) không cần điền SKU.
* **Cột D (SL Kho):** Là cột nhận số lượng tồn kho tự động từ file Excel.
* **Khi có sản phẩm mới:** Nếu bạn thêm sản phẩm mới vào tab `Products`, hãy nhớ thêm các dòng SKU tương ứng ở tab `Inventory`.

---

## 4. THÔNG TIN HỆ THỐNG KỸ THUẬT

* **Google Sheet ID:** `1D2SmTbrtAQP4-VA2RZY6zJbYnRvplZcsnZtaUmInhN0`
* **Apps Script Deployment:** Version 17 (`AKfycbyu77ZRFca0pFXZPnfwn3gISQRbXOp5x-TCDg6RKGR_beG8zargaNKB0SoqI9bwwf8`)
* **Secret Key đồng bộ kho:** `TBK_STOCK_SYNC_2026`
* **Hosting Frontend:** GitHub Pages qua repository `Tuanle1929/Toboko-Store` trỏ về tên miền `https://tobokostore.pro.vn`.
* **Quy ước hiển thị:**
  - Ngoài trang chủ: `Kho: [số]` (font 11px đậm rõ nét, hết hàng hiện `Hết hàng` màu đỏ).
  - Trang chi tiết / phân loại: `Kho: [số]` (hết hàng hiện `Kho: 0`).
  - Nút *Sao chép link*: Nằm cùng hàng với giá tiền, tự tạo link dạng `?sp=ten-san-pham&ma=ten-phan-loai`.
