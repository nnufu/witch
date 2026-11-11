# Xứ sở Một 3 — Game chọn ngẫu nhiên học sinh

Website dành cho giáo viên tiểu học, với sân khấu cổ tích 2:1, ảnh chibi do người dùng cung cấp và lựa chọn ngẫu nhiên không lặp.

## Chạy website

**Đăng lên GitHub Pages (khuyến nghị):**

1. Giải nén ZIP, giữ nguyên thư mục `assets` và các tệp `index.html`, `style.css`, `game.js`.
2. Tạo repository GitHub mới và tải **nội dung bên trong thư mục** `xu_so_mot_3_web` lên thư mục gốc repository.
3. Vào Settings → Pages → Build and deployment → Deploy from a branch.
4. Chọn nhánh `main`, thư mục `/(root)`, bấm Save.
5. Truy cập địa chỉ website GitHub Pages được thông báo trong mục Pages.

Có thể dùng trình chủ web tĩnh cục bộ như `python -m http.server 8000` từ thư mục đã giải nén để dùng ở `http://localhost:8000`. Hạn chế mở tệp theo đường dẫn `file://` vì một số trình duyệt có thể chặn IndexedDB.

**Không cần API key, máy chủ riêng hay tài khoản đăng nhập.** Font Quicksand được tải qua Google Fonts nếu máy có Internet; khi offline trình duyệt sử dụng font dự phòng.

## Thiết lập lớp học

1. Nhấn biểu tượng bánh răng góc trên phải.
2. Mục **Học sinh**: dán họ tên học sinh (mỗi dòng một tên), hoặc nhập số lượng để tạo trước các ô họ tên rồi chỉnh sửa.
3. Mục **Ảnh chibi**: tải nhiều PNG/JPG/WebP cùng lúc; trong màn hình xem trước, chọn tên tương ứng với mỗi ảnh và nhấn Xác nhận.
4. Đóng Cài đặt. Mỗi lần sân khấu tự hiển thị tối đa 10 ảnh chibi, chuyển nhóm sau khoảng 7,6 giây.
5. Chọn 1–5 HS rồi bấm **Quay ngẫu nhiên**. Hệ thống chọn trong **toàn bộ học sinh chưa được chọn**, không chỉ nhóm đang hiển thị.
6. Ảnh học sinh vừa được chọn sẽ bay từ sân khấu về đứng cạnh ảnh giáo viên ở góc trái. Nhấn **Lượt tiếp** để dọn ảnh kết quả; **Làm mới** để đưa học sinh trở lại vòng chọn (giữ lịch sử).

Ảnh chibi xuất hiện trực tiếp, **không được đưa vào khung avatar hoặc cắt mất hình gốc**. Họ tên chỉ xuất hiện khi học sinh được lựa chọn.

## Dữ liệu và quyền riêng tư

- Ảnh và danh sách học sinh chỉ được lưu trong **IndexedDB của trình duyệt** trên chính thiết bị đang dùng; không có mã gửi ảnh lên máy chủ.
- Khi đổi máy, trình duyệt hoặc dọn dẹp dữ liệu website, dùng **Cài đặt → Dữ liệu → Xuất bản sao lưu** trước, sau đó nhập bản sao lưu trên máy mới.
- Mỗi lượt học sinh chỉ được chọn một lần cho tới khi giáo viên nhấn Làm mới.
- Có thể tạm tắt quyền tham gia của một học sinh bằng ô checkbox trong danh sách.
- Nếu số học sinh chưa được chọn ít hơn số học sinh cần chọn, web sẽ nhắc giảm số lượng hoặc đặt lại vòng, không chọn thiếu ngầm.

## Các tệp đồ họa riêng biệt

| Tệp | Chức năng |
|---|---|
| `assets/outer_background.webp` | Nền thiên nhiên phía sau toàn bộ giao diện |
| `assets/stage_combined_2to1.png` | **Ảnh khung vàng và phong cảnh sân khấu gộp, tỉ lệ 2:1** (không có nhân vật, chữ hay nút) |
| `assets/banner_xu_so_co_tich.png` | Banner tiêu đề đã có sẵn chữ “Xứ sở cổ tích”; chỉ “Lucky Wheel” là chữ HTML |
| `assets/button_primary.svg` | Nút Quay ngẫu nhiên màu hồng |
| `assets/button_secondary.svg` | Nền các nút chức năng màu tím |
| `assets/button_icon.svg` | Nền nút tròn vàng ở góc trên phải |

Các icon được tạo bằng SVG nằm trong mã `index.html`. Chữ “Xứ sở cổ tích” là một phần của ảnh banner; dòng “Lucky Wheel” và nhãn nút là HTML.

## Kỹ thuật

- HTML5, CSS3, JavaScript thuần. Không framework, không build step.
- IndexedDB để lưu danh sách và dữ liệu ảnh; ảnh được thu nhỏ và mã hóa WebP trước khi lưu.
- Web Crypto API dùng để chọn số ngẫu nhiên và tránh thiên lệch khi lấy phần dư.
- Phân nhóm tối đa 10 chibi chỉ dành cho **hiển thị**, không ảnh hưởng đến thuật toán lựa chọn.
- Mã nguồn giữ nguyên các chức năng nhập danh sách, tải ghép ảnh, hiển thị nhóm và chọn ngẫu nhiên; cần thử giao diện trên trình duyệt thực tế sau khi cập nhật.

## Thay đổi bố cục mới (11/11/2026)

- Khung vàng, bầu trời, cây hoa, cầu vồng, thác nước, hồ và bục hồng được **gộp vào một ảnh PNG tỉ lệ chính xác 2:1**. Không còn lớp viền và sàn rời gây thu nhỏ hoặc lệch vị trí.
- Trên màn hình ngang, sân khấu tự mở rộng theo cả chiều rộng và chiều cao khả dụng; giữ nguyên tỉ lệ 2:1, không kéo giãn ảnh.
- Chibi vẫn là ảnh tải lên riêng, đứng phía trước bệ sân khấu, 1 hàng cho tối đa 5 bạn hoặc 2 hàng so le khi có 6-10 bạn; mỗi nhóm tối đa 10 bạn.
- Các nút điều khiển, bảng Cài đặt, IndexedDB, lựa chọn ngẫu nhiên và lịch sử giữ nguyên.
- Chế độ thay đổi phong cảnh cũ được bỏ khỏi Cài đặt để không vô tình đổi sang nền 4:3 gây méo tỉ lệ.
- Tệp ảnh nền cũ và khung rời không còn được trang web tham chiếu; vẫn lưu cùng gói để tiện tham khảo.


## Cập nhật Lucky Wheel – nút 👁

- Phụ đề banner đã đổi thành **Lucky Wheel**.
- Nút hình con mắt mới nằm **bên trái nút nhạc**, nhấn lần đầu để hiện **tất cả học sinh đang tham gia và đã có ảnh** trên một sân khấu 2:1; nhấn lần hai để trở về chế độ luân phiên tối đa 10 học sinh/nhóm.
- Khi hiện cả lớp, chibi tự động thu nhỏ, chia thành nhiều hàng tùy sĩ số và vẫn chuyển động nhẹ.
- Học sinh đã được chọn vẫn có mặt khi bật chế độ hiện tất cả, nhưng được làm mờ để phân biệt. **Thuật toán chỉ chọn trong danh sách chưa được chọn**, không lặp lại cho đến khi đặt lại vòng.
- Chế độ hiển thị được lưu bằng IndexedDB; tương thích dữ liệu và bản sao lưu trước đó.


## Cập nhật giao diện 11/11/2026 (bố cục cân đối)

- Banner Lucky Wheel căn chính giữa, thu nhỏ nhẹ và hiển thị đủ vương miện.
- Ba thẻ trạng thái (tổng học sinh, chưa chọn, nhóm/hiện toàn lớp) cùng một hàng trên desktop; trên màn hình nhỏ chúng tự xuống dòng.
- Tránh lặp số học sinh chưa chọn ở thẻ nhóm.
- Điều chỉnh khoảng cách giữa banner, sân khấu 2:1 và cụm nút dưới.
- Nền fantasy được áp dụng cả trên phần tử fullscreen.
- Chức năng học sinh, ảnh chibi, chế độ hiện tất cả, lựa chọn không lặp và IndexedDB vẫn giữ nguyên.


## Banner mới (11/11/2026)

Ảnh `assets/banner_xu_so_co_tich.png` đã có sẵn chữ **Xứ sở cổ tích**. HTML chỉ còn chứa dòng **Lucky Wheel**. Không cần thêm chữ tiêu đề bằng CSS/HTML nữa.



### Bản kết quả góc giáo viên (11/11/2026)
- Xóa hoàn toàn cửa sổ popup kết quả. Ảnh học sinh được chọn sẽ bay về cạnh ảnh chibi giáo viên ở góc trái, kèm tên và sao vàng nhỏ.
- Bấm nút “Ảnh chibi Giáo viên” tại góc trái trên giao diện để tải ảnh PNG/JPG/WebP; sau khi tải, bấm ảnh để thay.
- Ảnh giáo viên được lưu trong IndexedDB cùng dữ liệu lớp, có trong bản sao lưu JSON.
- Mỗi lần Quay sẽ hiển thị các học sinh vừa chọn (1–5 em) bên cạnh giáo viên. Bấm “Lượt tiếp” để dọn kết quả và chuẩn bị lượt kế tiếp.
- Nếu chưa tải ảnh giáo viên, kết quả vẫn được hiển thị cạnh nút tải ảnh.
- Nhấn Làm mới để đặt lại vòng chọn và dọn kết quả; thuật toán chọn không lặp và lịch sử vẫn hoạt động như trước.
- Ảnh học sinh giữ nguyên PNG/WebP không khung avatar và không có lời chúc mừng.


### Cập nhật kích thước và hiệu ứng bay nhẹ (11/11/2026)
- Ảnh chibi của học sinh được chọn luôn giữ cùng một kích thước nhỏ, tương tự bạn Minh Đăng trong ảnh tham chiếu, dù chọn từ 1 đến 5 học sinh. Các thẻ không tự kéo giãn khi số học sinh ít.
- Các học sinh được chọn bay nhẹ lên, xuống và sang hai bên; chibi giáo viên cũng lơ lửng tương tự. Tên học sinh đứng yên để dễ đọc.
- Hiệu ứng bắt chibi từ sân khấu và sao vàng từ giáo viên được giữ nguyên. Chọn “Giảm chuyển động” trong Cài đặt sẽ tắt chuyển động lơ lửng.

### Điều chỉnh vị trí và kích thước ảnh chibi (11/11/2026)

- Nâng góc giáo viên cùng các học sinh được chọn lên một chút; giữ hiệu ứng bay nhẹ và kích thước ô kết quả đồng nhất cho 1–5 em.
- Không có quy tắc CSS/JavaScript dựa vào tên học sinh. Trong khu vực hiển thị kết quả, các khoảng trong suốt dư thừa quanh ảnh PNG/WebP được bỏ khi dựng ảnh xem trước, giúp các ảnh chibi có kích thước *nhìn thấy* tương đồng hơn. Tệp ảnh gốc trong IndexedDB, ảnh hiển thị trên sân khấu và dữ liệu sao lưu được giữ nguyên.
- Nâng dòng “Lucky Wheel” lên dải màu kem của banner; không thay đổi ảnh banner có sẵn chữ “Xứ sở cổ tích”.

### Quay vòng và đường bay phù thủy (11/11/2026)

- Khi quay, ảnh chibi trên sân khấu giữ nguyên các phần tử HTML, di chuyển theo quỹ đạo tròn/oval với tốc độ vừa phải; không đổi nhóm chớp hình mỗi 240ms như trước. Khi bật hiển thị toàn lớp, các hàng di chuyển thành những vòng riêng để hạn chế chồng ảnh.
- Chibi phù thủy bay một hành trình dạng sóng Catmull-Rom nội suy theo kích thước sân khấu, lật ngang ảnh và bay ngược đúng đường về vị trí ban đầu. Sau đó mới công bố ảnh và tên 1–5 học sinh được chọn ở góc trái. Có sao vàng tỏa theo đường bay.
- Khu vực giáo viên được đặt cao lên, các ảnh kết quả trên desktop ưu tiên cùng một hàng, mỗi ảnh dùng cùng kích thước.
- Trường hợp chưa tải ảnh phù thủy, vòng quay chibi vẫn hoạt động và công bố kết quả. Có thể bật *Giảm chuyển động* trong cài đặt để bỏ hoạt ảnh.

## Điều chỉnh vị trí giao diện (11/11/2026)

- Tên của học sinh đã được chọn ở góc trái hiển thị **màu trắng**, có ánh sáng trắng nhẹ và nét viền tím rất mảnh để dễ đọc trên nền trời.
- Ba ô **Tổng số học sinh / Còn chưa chọn / Nhóm đang hiển thị** được chuyển từ dưới sân khấu lên **phía dưới hàng icon tròn góc phải**. Trên tablet chúng xếp dọc để không che banner; trên mobile nằm dưới thanh icon.
- Thông báo khi bấm icon hình mắt (ví dụ “Đang hiển thị tất cả học sinh có ảnh”) hiện **ở chính giữa ngay dưới banner**. Các thông báo khác vẫn hiện ở cuối màn hình.
- Không chỉnh sửa thuật toán quay, quy tắc không lặp, ảnh giáo viên, hiệu ứng bay hay dữ liệu đã lưu.
