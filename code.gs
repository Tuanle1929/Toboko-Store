/**
 * BACKEND CHO TOBOKO STORE — dán TOÀN BỘ code này vào 1 file Apps Script duy nhất
 * (Extensions > Apps Script từ trong Google Sheet của bạn)
 *
 * Cấu trúc Sheet cần có:
 * - Tab "Products": Tag | Tên SP | Giá | Mô Tả | Màu Nền | Emoji
 *   (Cột A đổi từ "ID Sản phẩm" sang "Tag", VD: "Hot", "Bestseller", hoặc "Hot, Bestseller")
 * - Tab "Inventory": SKU | Tên Sp | Phân Loại | SL Kho | URL Hình Ảnh
 *   (Cột A mới là "SKU" dùng nội bộ, dời 4 cột cũ sang B-E)
 * - Tab "DonHang": MaDon | Tên SP | Phân Loại | Số Lượng | TenKhach | SDT | DiaChi | GhiChu | Đơn Giá | Thành Tiền | Thời Gian | Phí Ship
 * - Tab "CauHinhGiam": SL Từ | SL Đến | Giảm Mỗi SP
 */

var DEFAULT_VARIANT_LABEL = 'Mặc định'; // nhãn dùng cho sản phẩm không chia phân loại

// Dán ID của Google Sheet vào đây
var SHEET_ID = '1D2SmTbrtAQP4-VA2RZY6zJbYnRvplZcsnZtaUmInhN0';

var DONHANG_HEADERS = ['MaDon', 'Tên SP', 'Phân Loại', 'Số Lượng', 'TenKhach', 'SDT', 'DiaChi', 'GhiChu', 'Đơn Giá', 'Thành Tiền', 'Thời Gian', 'Phí Ship'];

function _openSheet() {
  if (!SHEET_ID) throw new Error('Chưa dán SHEET_ID vào đầu file code.gs');
  return SpreadsheetApp.openById(SHEET_ID);
}

// ==== HỆ THỐNG GIẢM GIÁ THEO SỐ LƯỢNG (TIER-DISCOUNT) ====

// Đọc cấu hình giảm giá từ tab CauHinhGiam, có cơ chế Fallback an toàn
function _getDiscountTiers() {
  var defaultTiers = [
    { min: 100, max: Infinity, discount: 10000 },
    { min: 50, max: 99, discount: 7000 },
    { min: 20, max: 49, discount: 5000 },
    { min: 5, max: 19, discount: 3000 },
    { min: 1, max: 4, discount: 0 }
  ];
  
  try {
    var sheet = _openSheet().getSheetByName('CauHinhGiam');
    if (!sheet) return defaultTiers; // Fallback nếu quên tạo tab
    
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return defaultTiers; // Fallback nếu tab trống (chỉ có tiêu đề)
    
    var tiers = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var min = Number(row[0]);
      var max = (row[1] !== '' && row[1] !== null) ? Number(row[1]) : Infinity;
      var discount = Number(row[2]);
      
      // Bỏ qua các dòng gõ sai định dạng chữ
      if (!isNaN(min) && !isNaN(discount)) {
        tiers.push({ min: min, max: max, discount: discount });
      }
    }
    
    if (tiers.length === 0) return defaultTiers;
    
    // Sắp xếp giảm dần theo min để đảm bảo tra cứu chuẩn
    tiers.sort(function(a, b) { return b.min - a.min; });
    return tiers;
    
  } catch (e) {
    return defaultTiers; // Fallback cho mọi rủi ro lỗi khác
  }
}

// Hàm tính mức giảm dựa trên tổng số lượng
function _getDiscountForQty(totalQty, tiers) {
  if (!totalQty || totalQty <= 0) return 0;
  for (var i = 0; i < tiers.length; i++) {
    if (totalQty >= tiers[i].min && totalQty <= tiers[i].max) {
      return tiers[i].discount;
    }
  }
  return 0;
}

// ==========================================================

function _getProductPriceMap() {
  var prodSheet = _openSheet().getSheetByName('Products');
  var prodData = prodSheet.getDataRange().getValues();
  var priceMap = {};
  for (var i = 1; i < prodData.length; i++) {
    var name = prodData[i][1] ? prodData[i][1].toString().trim() : '';
    if (!name) continue;
    priceMap[name] = Number(prodData[i][2]) || 0;
  }
  return priceMap;
}

function doGet(e) {
  var ss = _openSheet();
  var prodSheet = ss.getSheetByName('Products');
  var invSheet = ss.getSheetByName('Inventory');

  var invData = invSheet.getDataRange().getValues();
  var inventoryMap = {};   
  var flatInventory = {};  
  var totalStockMap = {}; // Cộng dồn tồn kho của từng sản phẩm

  for (var j = 1; j < invData.length; j++) {
    // Chỉ số cột mới do chèn SKU ở cột A:
    // [0] = SKU (dùng nội bộ, không gửi ra client)
    // [1] = Tên Sp
    // [2] = Phân Loại
    // [3] = SL Kho
    // [4] = URL Hình Ảnh
    var pName = invData[j][1] ? invData[j][1].toString().trim() : '';
    var vName = invData[j][2] ? invData[j][2].toString().trim() : '';
    var stock = Number(invData[j][3]) || 0;
    var imgUrl = invData[j][4] ? invData[j][4].toString().trim() : '';

    if (!pName) continue;

    // Cộng dồn tồn kho cho sản phẩm
    totalStockMap[pName] = (totalStockMap[pName] || 0) + stock;

    if (!inventoryMap[pName]) {
      inventoryMap[pName] = { variants: [], variantImages: {}, mainImage: '', defaultRow: null };
    }

    if (vName) {
      inventoryMap[pName].variants.push(vName);
      if (imgUrl) inventoryMap[pName].variantImages[vName] = imgUrl;
      flatInventory[pName + '||' + vName] = stock;
    } else {
      if (imgUrl) inventoryMap[pName].mainImage = imgUrl;
      inventoryMap[pName].defaultRow = { stock: stock, imgUrl: imgUrl };
    }
  }

  Object.keys(inventoryMap).forEach(function (pName) {
    var info = inventoryMap[pName];
    if (info.variants.length === 0 && info.defaultRow) {
      info.variants.push(DEFAULT_VARIANT_LABEL);
      flatInventory[pName + '||' + DEFAULT_VARIANT_LABEL] = info.defaultRow.stock;
    }
  });

  var prodData = prodSheet.getDataRange().getValues();
  var products = [];

  for (var i = 1; i < prodData.length; i++) {
    // Chỉ số cột tab Products:
    // [0] = Tag (chuỗi thô "Hot", "Bestseller", hoặc "Hot, Bestseller")
    // [1] = Tên SP
    // [2] = Giá
    // [3] = Mô Tả
    // [4] = Màu Nền
    // [5] = Emoji
    var rawTags = prodData[i][0] ? prodData[i][0].toString() : '';
    var tags = rawTags.split(',').map(function(t) { return t.trim(); }).filter(function(t) { return t.length > 0; });
    var name = prodData[i][1] ? prodData[i][1].toString().trim() : '';
    if (!name) continue;

    var invInfo = inventoryMap[name] || { variants: [], variantImages: {}, mainImage: '' };
    var totalStock = totalStockMap[name] !== undefined ? totalStockMap[name] : 0;

    products.push({
      name: name,
      price: Number(prodData[i][2]) || 0,
      desc: prodData[i][3] ? prodData[i][3].toString() : '',
      color: prodData[i][4] ? prodData[i][4].toString().trim() : '#f2eef4',
      emoji: prodData[i][5] ? prodData[i][5].toString().trim() : '📦',
      tags: tags,
      totalStock: totalStock,
      image: invInfo.mainImage,
      variants: invInfo.variants,
      variantImages: invInfo.variantImages
    });
  }

  // Đẩy cả mốc cấu hình giảm giá (discountTiers) xuống cho client
  return ContentService.createTextOutput(JSON.stringify({
    products: products,
    inventory: flatInventory,
    defaultVariantLabel: DEFAULT_VARIANT_LABEL,
    discountTiers: _getDiscountTiers() 
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var sheet = _openSheet().getSheetByName('DonHang');

    _ensureDonHangHeader(sheet);

    var items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) {
      throw new Error('Đơn hàng không có sản phẩm nào (items rỗng hoặc sai định dạng).');
    }

    var priceMap = _getProductPriceMap();
    var createdAt = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'GMT+7', 'dd/MM/yyyy HH:mm:ss');

    // PHÍ SHIP: chỉ ghi lại trạng thái do client gửi lên (tạm tính), không tính toán/kiểm tra lại ở server.
    // Nếu client không gửi hoặc gửi giá trị lạ, mặc định ghi "Khách trả ship" cho an toàn (không tự ý cho freeship).
    var shippingStatus = (body.shippingStatus === 'Freeship') ? 'Freeship' : 'Khách trả ship';

    // Server TỰ ĐẾM tổng số lượng toàn đơn và tự tra cứu mốc giảm giá
    var totalQty = items.reduce(function(sum, it) { return sum + (Number(it.qty) || 0); }, 0);
    var discountTiers = _getDiscountTiers();
    var appliedDiscount = _getDiscountForQty(totalQty, discountTiers);

    var rows = items.map(function (it) {
      var itemName = it.name || '';
      if (!(itemName in priceMap)) {
        throw new Error('Không tìm thấy sản phẩm "' + itemName + '" trong tab Products, không thể xác nhận giá.');
      }
      var variant = it.variant ? it.variant.toString().trim() : '';
      var phanLoai = (variant && variant !== DEFAULT_VARIANT_LABEL) ? variant : ''; 
      var qty = Number(it.qty) || 0;
      
      // BẢO MẬT: Giá thật trừ đi mức giảm do server tự tính, có chặn không cho giá bị âm
      var basePrice = priceMap[itemName]; 
      var finalPrice = Math.max(0, basePrice - appliedDiscount);

      return [
        body.orderId,
        itemName,
        phanLoai,
        qty,
        body.customerName,
        body.phone,
        body.address,
        body.note || '',
        finalPrice,         // Ghi nhận Đơn Giá mới (Đã giảm)
        finalPrice * qty,   // Thành Tiền = Giá mới x Số Lượng
        createdAt,
        shippingStatus      // Ghi lặp lại ở TẤT CẢ các dòng sản phẩm của cùng 1 đơn
      ];
    });

    var startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 6, rows.length, 1).setNumberFormat('@');
    sheet.getRange(startRow, 1, rows.length, DONHANG_HEADERS.length).setValues(rows);

    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function _ensureDonHangHeader(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, DONHANG_HEADERS.length).setValues([DONHANG_HEADERS]);
    sheet.getRange('F:F').setNumberFormat('@'); 
  }
}
