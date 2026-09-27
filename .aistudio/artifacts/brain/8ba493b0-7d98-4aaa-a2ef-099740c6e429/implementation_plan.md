# Kế hoạch tối ưu hiển thị danh sách sản phẩm & Tồn kho

Kế hoạch điều chỉnh giao diện danh mục sản phẩm của Toboko Store: tự động sắp xếp sản phẩm hết hàng xuống cuối, chuyển số lượng tồn kho xuống cùng dòng với giá tiền (căn phải), và làm dịu tag HOT sang phong cách hồng pastel nhẹ nhàng.

## Lựa chọn & Thống nhất từ người dùng

> [!IMPORTANT]
> Các yêu cầu cụ thể đã được người dùng xác nhận:
> - **Tag HOT**: Thiết kế nhỏ nhắn, tinh tế với tone hồng pastel dịu nhẹ, thanh thoát, không gây chói mắt.
> - **Hiển thị SL tồn kho**: Đưa ra khỏi ảnh sản phẩm, đặt cùng dòng với giá tiền nhưng căn sát lề phải (`SL xxxx` dạng chữ nhỏ màu xám nhạt, khi hết hàng ghi `Hết hàng` màu đỏ nhẹ).
> - **Tương thích giá sỉ**: Bố cục linh hoạt để khi giá gốc bị gạch ngang và giá sỉ hiển thị, vị trí giá và tồn kho căn phải không bị xô lệch hay rớt dòng.
> - **Sắp xếp danh sách**: Tự động đưa toàn bộ sản phẩm hết hàng xuống cuối danh sách.

---

### 1. Tổng quan & Luồng trải nghiệm

- **Trải nghiệm mua sắm mượt mà**: Khách hàng luôn nhìn thấy các sản phẩm còn hàng ở vị trí đầu tiên. Các sản phẩm hết hàng được gom xuống cuối giúp tránh gây tụt cảm xúc khi xem hàng.
- **Hình ảnh sản phẩm thoáng đãng**: Bỏ tag số lượng che góc ảnh, giúp ảnh mẫu mi và phụ kiện hiển thị trọn vẹn, sang trọng đúng chuẩn gian hàng làm đẹp.
- **Thông tin giá và tồn kho rõ ràng**: Người mua dễ dàng đối chiếu giá tiền và số lượng còn lại chỉ trong một ánh nhìn ở phần chân thẻ sản phẩm.

---

### 2. Thiết kế giao diện & Bố cục chi tiết

#### A. Căn chỉnh dòng giá & Tồn kho (`.card-price-row`)
- Cấu trúc flexbox:
  ```html
  <div class="card-price-row">
    <div class="price" data-price-id="...">
      <!-- Giá gốc hoặc Giá cũ gạch ngang + Giá sỉ mới -->
    </div>
    <span class="card-stock">SL 20046</span>
  </div>
  ```
- **Bố cục**: `display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-top: auto;`
- **Giá tiền (`.price`)**: Nằm bên trái, hiển thị giá hiện tại hoặc `<span class="price-old">...</span><span class="price-new">...</span>` khi có chiết khấu sỉ.
- **Tồn kho (`.card-stock`)**:
  - `margin-left: auto; font-size: 12px; color: var(--text-muted); font-weight: 500; font-variant-numeric: tabular-nums; white-space: nowrap;`
  - Khi hết hàng (`.card-stock.oos`): Chữ `Hết hàng` màu đỏ dịu (`#e05260`), đậm nét vừa phải.
  - Tách biệt khỏi `[data-price-id]` để hàm `refreshVisiblePrices()` khi cập nhật giá sỉ theo số lượng giỏ hàng không làm đè mất hoặc xô lệch thẻ tồn kho.

#### B. Tag HOT phong cách hồng pastel dịu nhẹ
- Thay thế dải màu đỏ cam chói gắt (`linear-gradient(#ff3366, #ff5e3a)`) bằng tone hồng pastel thanh lịch:
  - Nền: `background: #ffe7f1;`
  - Viền: `border: 1px solid rgba(214, 51, 132, 0.25);`
  - Màu chữ: `color: #b82d73;`
  - Font: `font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 2px 7px; border-radius: 999px;`
  - Giữ ở góc trên bên phải ảnh (`top: 8px; right: 8px`), tạo điểm nhấn tinh tế cho sản phẩm nổi bật mà không che chắn chi tiết.

#### C. Thẻ sản phẩm hết hàng
- Các thẻ sản phẩm hết hàng khi xuống cuối có thêm trạng thái visual mờ nhẹ (`opacity: 0.72`) khi hiển thị, giúp khách hàng nhận biết trực quan mà không bị nhầm lẫn với hàng sẵn có.

---

### 3. Kiến trúc kỹ thuật & Sắp xếp dữ liệu

#### A. Sắp xếp danh sách sản phẩm (`sortProductsByStock`)
- Trước khi render ra grid trang chủ:
  ```
  Còn hàng (totalStock > 0) ──> Giữ thứ tự ban đầu / ưu tiên bán
  Hết hàng (totalStock <= 0) ──> Đẩy xuống cuối danh sách
  ```
- Đảm bảo khi dữ liệu tồn kho được cập nhật từ Google Apps Script / Sheet (`fetchShopData`), danh sách sẽ tự động sắp xếp lại chuẩn xác.

#### B. Sơ đồ cấu trúc Component Thẻ sản phẩm

```
┌────────────────────────────────────────────────────────┐
│ .card                                                  │
│ ┌────────────────────────────────────────────────────┐ │
│ │ .thumb (Ảnh sản phẩm vuông vức)                   │ │
│ │ ┌────────────────────────────────────────────────┐ │ │
│ │ │ Tag HOT (Hồng pastel, góc trên phải)          │ │ │
│ │ └────────────────────────────────────────────────┘ │ │
│ └────────────────────────────────────────────────────┘ │
│ ┌────────────────────────────────────────────────────┐ │
│ │ .card-body                                         │ │
│ │   Tên sản phẩm (2 dòng tối đa)                     │ │
│ │ ┌────────────────────────────────────────────────┐ │ │
│ │ │ .card-price-row (flex justify-between)         │ │ │
│ │ │   .price: 60.000đ hoặc 60k 57k (bên trái)     │ │ │
│ │ │   .card-stock: SL 20046 (căn phải)             │ │ │
│ │ └────────────────────────────────────────────────┘ │ │
│ └────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```
