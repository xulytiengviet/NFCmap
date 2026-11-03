# NFCmap — NFC × GPS WebGIS Lab

Mã nguồn: https://github.com/xulytiengviet/NFCmap  
Trang dự kiến sau khi bật GitHub Pages: https://xulytiengviet.github.io/NFCmap/  

Trang web mô phỏng độc lập ba mô hình kết hợp NFC + tọa độ: **GeoTag**, **Position Anchor**, **GeoAccess**. Giao diện tiếng Việt, tương thích GitHub Pages và website tĩnh.

## Chạy thử

Mở `index.html` hoặc dùng máy chủ tĩnh:

```bash
python -m http.server 8000
# Truy cập http://localhost:8000
```

Trang vẫn chạy mô phỏng trên máy tính **không có phần cứng NFC**. Nếu có Internet, bản đồ sử dụng Leaflet/OpenStreetMap; khi không tải được thư viện/bản đồ, trang cung cấp **sơ đồ vị trí dự phòng**, không phải bản đồ địa lý thật.

## Triển khai GitHub Pages

1. Mã nguồn đã nằm trong nhánh `main` của repository.
2. Vào **Settings → Pages → Build and deployment → Source → GitHub Actions**.
3. Workflow `.github/workflows/deploy.yml` sẽ triển khai trang từ nhánh `main`; có thể chạy lại ở **Actions** sau khi kích hoạt Pages.
4. Truy cập `https://xulytiengviet.github.io/NFCmap/` khi bản triển khai đã thành công.

> Không khẳng định trang đã lên live khi chưa có một lần GitHub Pages deployment thành công.

## Ba mô hình

| Mô hình | Mô phỏng trên desktop | Tích hợp phần cứng tùy chọn |
|---|---|---|
| GeoTag | Chọn thẻ mẫu, sửa tọa độ, xem bản đồ, sao chép JSON | Quét thẻ NDEF có JSON/`geo:` hoặc ghi NDEF JSON |
| Position Anchor | Tạo sai số GPS giả lập, chạm mốc và so sánh trước/sau | Dùng dữ liệu Geolocation của trình duyệt để so sánh; áp vị trí mốc là thao tác nội bộ app |
| GeoAccess | Chạm thẻ hợp lệ/không hợp lệ, điều chỉnh khoảng cách và bán kính, xem quyết định | Vị trí thật theo quyền trình duyệt; quét NDEF thật được nếu được hỗ trợ. Không mở khóa thật |

## Payload NDEF mẫu

Một bản ghi NDEF `text` chứa JSON dạng:

```json
{"version":1,"kind":"nfc-geo","id":"TAG-INFO-01","name":"Trạm thông tin du lịch · Demo","lat":10.77689,"lon":106.70087}
```

Chức năng đọc cũng nhận bản ghi text `geo:10.77689,106.70087` nếu trình duyệt trả được bản ghi ở định dạng được hỗ trợ. Ứng dụng này **không** giả định URI `geo:` là định dạng NFC bắt buộc hoặc được hỗ trợ đồng nhất giữa nền tảng.

## Giới hạn kỹ thuật / bảo mật

- **Web NFC** chỉ giao tiếp với thẻ NDEF trên những trình duyệt và thiết bị hỗ trợ. Không thể truy cập NFC nói chung hoặc UID/bảo mật tầng thấp. Chrome Android là môi trường thử nghiệm chính. NFC cần HTTPS và thao tác từ người dùng.
- **Geolocation API** trả lại ước lượng vị trí từ dịch vụ của thiết bị (có thể sử dụng GNSS/GPS, Wi-Fi, mạng di động), **không** bảo đảm chỉ là phép đo GPS vệ tinh. Người dùng phải cấp quyền.
- **Position Anchor** đưa tọa độ mốc vào thuật toán ở cấp ứng dụng. Không can thiệp hay hiệu chuẩn phần cứng/hệ điều hành. Sai số sau hiệu chỉnh bằng 0 m chỉ là giả định lý tưởng của demo, không phải cam kết độ chính xác vật lý.
- **GeoAccess** chỉ là **cỗ máy quy tắc mô phỏng tại máy khách**. NDEF thông thường là dữ liệu dễ sao chép; tọa độ thiết bị có thể bị giả mạo; bản đọc NFC không chứng minh danh tính. Không sử dụng quy trình này để vận hành khóa thật. Sản phẩm thực tế cần NFC/chứng chỉ xác thực mật mã hoặc khóa thẻ bảo mật phù hợp, chống phát lại, phát hiện relay, xác thực người dùng và chính sách phía máy chủ, đối chiếu độ chính xác và độ mới vị trí, cùng kiểm toán sự kiện.
- Demo không tải dữ liệu người dùng lên máy chủ ứng dụng. Khi tải bản đồ từ OpenStreetMap hoặc CDN, trình duyệt thực hiện các yêu cầu tới các dịch vụ này. Nhật ký chỉ giữ trong bộ nhớ cho đến khi xuất JSON.
- Mốc và địa điểm trên bản đồ là **tọa độ minh họa**, không được khảo sát hoặc xác minh là cơ sở ngoài thực tế.

## Tài liệu

- https://developer.mozilla.org/en-US/docs/Web/API/Web_NFC_API
- https://developer.mozilla.org/en-US/docs/Web/API/NDEFReader
- https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API
- https://developer.chrome.com/docs/capabilities/nfc

Không có backend; không cần Node.js/npm và không cần API key để chạy mô phỏng.