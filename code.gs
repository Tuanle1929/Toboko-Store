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

/**
 * Ngăn chặn Formula Injection toàn diện:
 * - Loại bỏ ký tự zero-width, null byte
 * - Giới hạn độ dài chuỗi maxLen
 * - Nếu giá trị bắt đầu bằng =, +, -, @, %, |, tab, return thì thêm nháy đơn '
 */
function _sanitizeCell(value, maxLen) {
  if (value == null) return '';
  var limit = maxLen || 1000;
  var s = String(value).replace(/[\x00\x08\x0B\x0C\u200B\u200C\u200D\uFEFF]/g, '').trim();
  if (s.length > limit) s = s.substring(0, limit);
  if (s.length > 0 && '=+-@%|\t\r'.indexOf(s[0]) !== -1) {
    return "'" + s;
  }
  return s;
}

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
  if (!prodSheet) return Object.create(null);
  var prodData = prodSheet.getDataRange().getValues();
  // Khởi tạo Object không prototype để chặn triệt để "toString", "valueOf", "__proto__"
  var priceMap = Object.create(null);
  for (var i = 1; i < prodData.length; i++) {
    var name = prodData[i][1] ? prodData[i][1].toString().trim() : '';
    if (!name) continue;
    priceMap[name] = Number(prodData[i][2]) || 0;
  }
  return priceMap;
}

function _getInventoryStockMap() {
  var invSheet = _openSheet().getSheetByName('Inventory');
  if (!invSheet) return Object.create(null);
  var invData = invSheet.getDataRange().getValues();
  var stockMap = Object.create(null);
  var hasNamedVariants = Object.create(null);
  var defaultRows = Object.create(null);

  for (var j = 1; j < invData.length; j++) {
    var pName = invData[j][1] ? invData[j][1].toString().trim() : '';
    var vName = invData[j][2] ? invData[j][2].toString().trim() : '';
    var stock = Math.max(0, Number(invData[j][3]) || 0);
    if (!pName) continue;

    if (vName) {
      hasNamedVariants[pName] = true;
      var key = pName + '||' + vName;
      stockMap[key] = (stockMap[key] || 0) + stock;
    } else {
      defaultRows[pName] = (defaultRows[pName] || 0) + stock;
    }
  }

  Object.keys(defaultRows).forEach(function(pName) {
    if (!hasNamedVariants[pName]) {
      stockMap[pName + '||' + DEFAULT_VARIANT_LABEL] = defaultRows[pName];
    }
  });

  return stockMap;
}

function doGet(e) {
  var ss = _openSheet();
  var prodSheet = ss.getSheetByName('Products');
  var invSheet = ss.getSheetByName('Inventory');

  if (!prodSheet || !invSheet) {
    return ContentService.createTextOutput(JSON.stringify({
      products: [],
      inventory: {},
      defaultVariantLabel: DEFAULT_VARIANT_LABEL,
      discountTiers: _getDiscountTiers()
    })).setMimeType(ContentService.MimeType.JSON);
  }

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
  // 1. Khóa atomic chống race condition ghi đè mất đơn hàng (VULN-02)
  var lock = LockService.getScriptLock();
  var hasLock = lock.tryLock(15000); // Đợi tối đa 15 giây
  if (!hasLock) {
    return ContentService.createTextOutput(JSON.stringify({ 
      success: false, 
      error: 'Hệ thống đang bận xử lý nhiều đơn hàng. Quý khách vui lòng thử lại sau vài giây nhé!' 
    })).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    // Chống DoS: Giới hạn kích thước payload tối đa 200KB
    if (!e || !e.postData || !e.postData.contents || e.postData.contents.length > 200000) {
      throw new Error('Dữ liệu yêu cầu không hợp lệ hoặc vượt quá dung lượng cho phép.');
    }

    var body = JSON.parse(e.postData.contents);
    if (!body || typeof body !== 'object') {
      throw new Error('Định dạng yêu cầu không đúng.');
    }

    // Xử lý lệnh đồng bộ tồn kho từ Admin (File Excel)
    if (body.action === 'syncInventory') {
      return _handleSyncInventory(body);
    }

    // Chống Spam Bot: Bẫy Honeypot
    if (body.hp_website && String(body.hp_website).trim() !== '') {
      throw new Error('Yêu cầu bị từ chối.');
    }

    var sheet = _openSheet().getSheetByName('DonHang');
    if (!sheet) {
      throw new Error('Hệ thống chưa tìm thấy bảng DonHang. Vui lòng kiểm tra lại cấu trúc Google Sheet.');
    }
    _ensureDonHangHeader(sheet);

    // 2. Xác thực thông tin khách hàng bắt buộc ở Server
    var customerName = String(body.customerName || '').trim();
    var phone = String(body.phone || '').trim();
    var address = String(body.address || '').trim();
    var note = String(body.note || '').trim();
    var rawOrderId = String(body.orderId || '').trim();
    var orderId = /^TBK[A-Z0-9]{8,20}$/.test(rawOrderId) 
      ? rawOrderId 
      : ('TBK' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 7).toUpperCase());

    if (!customerName || !phone || !address) {
      throw new Error('Vui lòng điền đầy đủ Tên, Số điện thoại và Địa chỉ nhận hàng.');
    }

    var phoneDigits = phone.replace(/[\s.\-\+]/g, '');
    if (phoneDigits.indexOf('0084') === 0 && phoneDigits.length === 13) {
      phoneDigits = '0' + phoneDigits.slice(4);
    }
    if (phoneDigits.indexOf('84') === 0 && phoneDigits.length === 11) {
      phoneDigits = '0' + phoneDigits.slice(2);
    }
    if (!/^0\d{9}$/.test(phoneDigits)) {
      throw new Error('Số điện thoại không hợp lệ (cần 10 chữ số).');
    }

    // Chống Spam đơn: Mỗi SĐT hoặc Mã đơn phải cách nhau tối thiểu 45 giây
    var cache = CacheService.getScriptCache();
    var rateKeyPhone = 'ORDER_RATE_' + phoneDigits;
    var rateKeyId = 'ORDER_ID_' + orderId;
    if (cache.get(rateKeyPhone) || cache.get(rateKeyId)) {
      throw new Error('Đơn hàng của bạn vừa được gửi rồi! Vui lòng đợi ít phút trước khi đặt thêm đơn mới nhé.');
    }

    // 3. Xác thực danh sách sản phẩm & số lượng
    var items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) {
      throw new Error('Đơn hàng không có sản phẩm nào (items rỗng hoặc sai định dạng).');
    }

    var validItems = items.filter(function(it) {
      return it && typeof it === 'object';
    });
    if (validItems.length === 0 || validItems.length > 50) {
      throw new Error('Danh sách sản phẩm không hợp lệ (tối đa 50 mục).');
    }

    var priceMap = _getProductPriceMap();
    var stockMap = _getInventoryStockMap();
    var createdAt = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'GMT+7', 'dd/MM/yyyy HH:mm:ss');

    // Xác thực số lượng, phân loại có thật & cộng dồn chống lách tồn kho bằng nhiều dòng trùng nhau
    var totalQty = 0;
    var requestedVariantQty = Object.create(null);

    for (var k = 0; k < validItems.length; k++) {
      var itName = String(validItems[k].name || '').trim();
      var itVariant = validItems[k].variant ? String(validItems[k].variant).trim() : DEFAULT_VARIANT_LABEL;
      var itQty = Number(validItems[k].qty);

      if (!Object.prototype.hasOwnProperty.call(priceMap, itName)) {
        throw new Error('Không tìm thấy sản phẩm "' + itName + '" trong danh mục.');
      }
      if (isNaN(itQty) || !isFinite(itQty) || !Number.isInteger(itQty) || itQty <= 0 || itQty > 1000) {
        throw new Error('Số lượng sản phẩm "' + itName + '" không hợp lệ (từ 1 đến 1000).');
      }

      var invKey = itName + '||' + itVariant;
      if (!Object.prototype.hasOwnProperty.call(stockMap, invKey)) {
        throw new Error('Phân loại "' + itVariant + '" của sản phẩm "' + itName + '" không tồn tại.');
      }

      requestedVariantQty[invKey] = (requestedVariantQty[invKey] || 0) + itQty;
      if (requestedVariantQty[invKey] > stockMap[invKey]) {
        throw new Error('Sản phẩm "' + itName + (itVariant !== DEFAULT_VARIANT_LABEL ? ' (' + itVariant + ')' : '') + '" chỉ còn ' + stockMap[invKey] + ' sản phẩm trong kho.');
      }

      totalQty += itQty;
    }

    // 4. Server tự tính Phí Ship & Freeship (chống gian lận client) — Đã đổi về 5 hộp
    var SHIPPING_FREE_THRESHOLD = 5;
    var shippingStatus = (totalQty >= SHIPPING_FREE_THRESHOLD) ? 'Freeship' : 'Khách trả ship';

    // Server tự tra cứu mốc giảm giá sỉ
    var discountTiers = _getDiscountTiers();
    var appliedDiscount = _getDiscountForQty(totalQty, discountTiers);

    // 5. Mapping đơn hàng: Bọc _sanitizeCell đầy đủ cho tất cả các trường
    var rows = validItems.map(function (it) {
      var itemName = String(it.name || '').trim();
      var variant = it.variant ? String(it.variant).trim() : '';
      var phanLoai = (variant && variant !== DEFAULT_VARIANT_LABEL) ? variant : ''; 
      var qty = Number(it.qty);
      
      // Bảo vệ biên lợi nhuận: Giảm tối đa không quá 80% đơn giá gốc
      var basePrice = priceMap[itemName]; 
      var maxDiscount = Math.min(appliedDiscount, Math.floor(basePrice * 0.8));
      var finalPrice = Math.max(0, basePrice - maxDiscount);

      return [
        _sanitizeCell(orderId, 50),
        _sanitizeCell(itemName, 150),
        _sanitizeCell(phanLoai, 100),
        qty,
        _sanitizeCell(customerName, 100),
        _sanitizeCell(phoneDigits, 20),
        _sanitizeCell(address, 300),
        _sanitizeCell(note, 500),
        finalPrice,
        finalPrice * qty,
        createdAt,
        shippingStatus
      ];
    });

    // 6. Ghi đơn an toàn trong khối có khóa
    var startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 6, rows.length, 1).setNumberFormat('@');
    sheet.getRange(startRow, 1, rows.length, DONHANG_HEADERS.length).setValues(rows);
    SpreadsheetApp.flush();

    // Lưu dấu vào Cache 45 giây để chặn bấm đúp hoặc tool spam liên tục
    cache.put(rateKeyPhone, '1', 45);
    cache.put(rateKeyId, '1', 300);

    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    var errMsg = err && err.message ? err.message : 'Lỗi xử lý đơn hàng.';
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: errMsg }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function _handleSyncInventory(body) {
  if (body.secretKey !== 'TBK_STOCK_SYNC_2026') {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Không có quyền cập nhật tồn kho.' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var updates = body.updates;
  if (!updates || typeof updates !== 'object') {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Dữ liệu updates không hợp lệ.' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var ss = _openSheet();
  var invSheet = ss.getSheetByName('Inventory');
  if (!invSheet) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Không tìm thấy tab Inventory.' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var range = invSheet.getDataRange();
  var data = range.getValues();
  var updatedCount = 0;
  var stockColIdx = 3; // Cột D (0-indexed: 0=SKU, 1=Tên SP, 2=Phân Loại, 3=SL Kho)

  for (var i = 1; i < data.length; i++) {
    var rawSku = data[i][0] ? String(data[i][0]).trim().toUpperCase() : '';
    if (!rawSku) continue;

    if (Object.prototype.hasOwnProperty.call(updates, rawSku)) {
      var newStock = Math.max(0, parseInt(updates[rawSku], 10) || 0);
      data[i][stockColIdx] = newStock;
      updatedCount++;
    }
  }

  range.setValues(data);
  SpreadsheetApp.flush();

  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    updatedCount: updatedCount,
    message: 'Đã cập nhật thành công tồn kho cho ' + updatedCount + ' mã SKU.'
  })).setMimeType(ContentService.MimeType.JSON);
}

function _ensureDonHangHeader(sheet) {
  if (!sheet) return;
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, DONHANG_HEADERS.length).setValues([DONHANG_HEADERS]);
    sheet.getRange('F:F').setNumberFormat('@'); 
  }
}