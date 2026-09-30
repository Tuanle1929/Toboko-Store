# Tối ưu giao diện Bottom Bar trang sản phẩm trên Mobile

Kế hoạch tái cấu trúc thanh công cụ đặt hàng cố định phía dưới màn hình trên thiết bị di động (Mobile) nhằm giúp khách hàng theo dõi ngay đơn giá thực tế sau khi áp dụng chiết khấu sỉ, tăng giảm số lượng ở vị trí trung tâm thuận tiện cho ngón tay cái, và thêm vào giỏ bằng nút icon tinh gọn.

---

### Xác nhận yêu cầu & Lựa chọn đã thống nhất

> [!IMPORTANT]
> **Các quyết định đã chốt trong bước trao đổi:**
> 1. **Thứ tự sắp xếp trên Mobile**: **[Đơn giá bên trái]** — **[Cụm số lượng ở giữa]** — **[Nút giỏ hàng bên phải]**.
> 2. **Cách hiển thị giá**: Hiển thị **Đơn giá 1 sản phẩm**, có gạch ngang giá gốc và làm nổi bật giá sỉ thực tế khi khách đạt mốc số lượng.
> 3. **Phạm vi áp dụng**: Chỉ áp dụng cho giao diện Mobile (`max-width: 768px`). Giao diện PC (`min-width: 769px`) giữ nguyên 100% bố cục và nút bấm chữ đầy đủ hiện tại.
> 4. **Nguyên tắc an toàn**: Không chỉnh sửa mã nguồn cho đến khi bạn bấm duyệt kế hoạch này.

---

## 1. Tổng quan & Trải nghiệm người dùng (UX)

### Mục đích & Vấn đề giải quyết
- **Trước đây**: Nút *"Thêm vào giỏ hàng"* chiếm phần lớn chiều ngang thanh dưới cùng. Khách hàng khi tăng số lượng lên các mốc sỉ (5, 10, 20...) không nhìn thấy trực tiếp giá mỗi sản phẩm đã giảm xuống bao nhiêu nếu không cuộn lên đầu trang hoặc mở giỏ hàng.
- **Sau cải tiến**:
  - **Bên trái**: Luôn hiển thị đơn giá thực tế theo thời gian thực. Khi khách tăng số lượng chạm mốc sỉ, đơn giá lập tức gạch ngang giá gốc và hiện giá sỉ ưu đãi màu tím thương hiệu.
  - **Ở giữa**: Cụm nút `[ − ] [ số lượng ] [ + ]` nằm ngay trung tâm màn hình, vị trí tự nhiên nhất của ngón tay cái (thumb zone) khi cầm điện thoại 1 tay.
  - **Bên phải**: Nút thêm vào giỏ hàng được thu gọn thành nút icon hiện đại: Biểu tượng Giỏ hàng kèm dấu cộng (`🛒+`), kích thước chạm chuẩn $48 \times 48\text{px}$ chống bấm trượt.

---

## 2. Thiết kế chi tiết & Bố cục Responsive

### Sơ đồ so sánh bố cục PC vs Mobile

```
[ GIAO DIỆN PC - min-width: 769px (Giữ nguyên) ]
+-------------------------------------------------------------------------+
| [Thanh tiến trình ưu đãi sỉ & Freeship]                                 |
| [-] [ 1 ] [+]         [            Thêm vào giỏ hàng            ]       |
+-------------------------------------------------------------------------+

[ GIAO DIỆN MOBILE - max-width: 768px (Mới) ]
+-------------------------------------------------------------------------+
| [Thanh tiến trình ưu đãi sỉ & Freeship]                                 |
| [  ĐƠN GIÁ      ]       [ CỤM SỐ LƯỢNG ]             [ NÚT GIỎ ]         |
| 150.000₫ (gạch) |        [-]  [ 5 ]  [+]              (  🛒+  )         |
| 147.000₫        |                                                       |
+-------------------------------------------------------------------------+
```

### Chi tiết từng khối trên Mobile:

1. **Khối Đơn giá bên trái (`.bottom-bar-price`)**:
   - Nhãn phụ nhỏ: `ĐƠN GIÁ` (font size: 10.5px, màu `--text-muted`, chữ in hoa thanh lịch).
   - Khi chưa đạt giá sỉ: Hiện giá gốc chữ đậm rõ nét (15-16px, `font-weight: 800`).
   - Khi đạt giá sỉ (từ giỏ hàng hoặc do số lượng preview đang chọn):
     - Giá gốc gạch ngang: `150.000₫` (mờ nhẹ, font 11.5px).
     - Giá sỉ thực tế: `147.000₫` (màu tím hồng `--primary`, font 15-16px, `font-weight: 800`).

2. **Khối Số lượng ở giữa (`.qty-control`)**:
   - Căn giữa tự nhiên (`margin: 0 auto;`).
   - Kích thước vừa vặn, bo tròn mềm mại chuẩn thiết kế hiện tại.
   - Các nút `−`, `+` tự động vô hiệu hóa nếu mã hết hàng hoặc số lượng chạm mức tối đa trong kho.

3. **Khối Nút thêm giỏ hàng bên phải (`#addToCartBtn`)**:
   - Kích thước $48 \times 48\text{px}$, bo góc tròn mềm mại (`border-radius: 14px` hoặc `999px` dạng tròn).
   - Nền dải màu thương hiệu `var(--toboko-gradient)`, đổ bóng nhẹ nhàng.
   - Icon: Biểu tượng xe đẩy giỏ hàng sắc nét (SVG vector) kèm ký hiệu `+` ở góc trên.
   - **Xử lý các trạng thái**:
     - *Chưa chọn phân loại*: Bấm vào sẽ cuộn mượt lên cụm phân loại, rung nhẹ viền và báo toast *"Chọn phân loại để thêm vào giỏ hàng nha"*.
     - *Hết hàng*: Nút tự động chuyển màu xám `disabled`, khóa bấm.
     - *Bình thường*: Bấm để thêm vào giỏ kèm hiệu ứng phản hồi và mở giỏ hàng/thông báo ưu đãi.

---

## 3. Kiến trúc kỹ thuật & Kế hoạch triển khai

```
┌────────────────────────────────────────────────────────┐
│               Trang Chi Tiết Sản Phẩm                   │
│ state.productId | state.selectedVariant | state.qty    │
└───────────────────────────┬────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
┌───────────────────────────────┐  ┌─────────────────────────────────┐
│     Hàm tính giá thực tế      │  │     Cấu trúc DOM Responsive     │
│   effectiveDiscount & Unit    │  │  .btn-text-desktop (hiện ở PC)  │
│   Price tính theo preview     │  │  .btn-icon-mobile  (hiện ở ĐT)  │
└───────────────┬───────────────┘  └────────────────┬────────────────┘
                │                                   │
                └───────────────┬───────────────────┘
                                ▼
┌────────────────────────────────────────────────────────┐
│             Bottom Bar Action Row                      │
│ [Mobile Price] ─── [Centered Qty] ─── [Compact CTA]    │
└────────────────────────────────────────────────────────┘
```

### Các bước thực hiện cụ thể:
1. **Bước 1: Tính toán đơn giá hiển thị theo thời gian thực**:
   - Viết hàm trợ năng tính toán đơn giá 1 sản phẩm dựa trên tổng số lượng giỏ hàng hiện tại kết hợp với số lượng `state.qty` đang chọn xem trước.
   - Tự động phản hồi ngay khi khách bấm tăng/giảm số lượng hoặc đổi phân loại.

2. **Bước 2: Cập nhật template HTML trong `renderDetail`**:
   - Bổ sung khối HTML `.bottom-bar-price` ở đầu dòng hành động `.bottom-action-row`.
   - Trong `#addToCartBtn`: Tách thành 2 container con:
     - `.btn-text-desktop`: Chứa nhãn chữ ("Thêm vào giỏ hàng", "Chọn phân loại", "Đã hết hàng").
     - `.btn-icon-mobile`: Chứa icon SVG giỏ hàng kèm badge `+`.

3. **Bước 3: Tối ưu CSS Responsive**:
   - `@media (min-width: 769px)`: Ẩn `.bottom-bar-price`, ẩn `.btn-icon-mobile`, hiển thị đầy đủ nút chữ như trước đây.
   - `@media (max-width: 768px)`: Ẩn `.btn-text-desktop`, căn giữa `.qty-control`, tạo kiểu dáng gọn gàng cho nút giỏ hàng và khối giá bên trái.

4. **Bước 4: Kiểm tra & Nghiệm thu (Verification)**:
   - Kiểm tra hiển thị trên khung nhìn Mobile (375px, 390px, 414px) và PC (1080px).
   - Kiểm tra thay đổi giá khi tăng số lượng từ 1 $\rightarrow$ 5 sản phẩm xem giá có tự động gạch ngang giá gốc và hiện giá sỉ hay không.
   - Đảm bảo biên dịch (compile) thành công và dev server hoạt động ổn định.
