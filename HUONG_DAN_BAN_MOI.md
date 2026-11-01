# hikarii — English Corner 2.0

## Chạy web

1. Cài Node.js 20 trở lên.
2. Giải nén toàn bộ file ZIP vào một thư mục mới.
3. Trên Windows: mở `start.bat`. Hoặc mở terminal trong thư mục, chạy `npm install`, sau đó `npm start`.
4. Mở `http://localhost:3000`. Không mở trực tiếp `public/index.html` vì ứng dụng cần máy chủ Node.

Nếu thay bản đang chạy: dừng máy chủ cũ trước, giữ lại cấu hình riêng và dữ liệu, rồi chạy bản mới. Để tiếp tục dùng tiến độ trong trình duyệt, truy cập cùng địa chỉ web/cổng như trước.

## Điểm mới

- Giao diện sáng/tối, menu rõ ràng và thanh điều hướng phía dưới trên điện thoại.
- Trang chủ với mục tiêu ngày, số ngày học liên tiếp, bài hoàn thành và từ vựng.
- Tìm bài, lọc loại/trình độ, đánh dấu yêu thích, tiếp tục bài đang học.
- Thêm 9 bài mới ở cả ba trình độ: câu đời sống, đoạn văn và hội thoại. Bài mới có mục tiêu, ghi nhớ ngữ pháp và giải thích từng câu.
- Lưu tự động bản nháp, tiến độ từng câu, ôn các câu cần luyện và tổng kết bài.
- Câu đã được thưởng không thể cộng XP nhiều lần. Câu đã mở đáp án không được cộng XP.
- Sổ từ vựng riêng theo trình duyệt, nghe phát âm, sửa nghĩa và flashcard.
- Avatar từ ảnh cá nhân, tự cắt vuông và thu nhỏ về 256 px; tên và mục tiêu riêng.
- Lời chào mỗi lần tải trang; có lựa chọn không hiện lại và bật lại trong Cài đặt.
- Chữ ký người làm **hikarii** ở cuối mọi trang.
- Sao lưu / khôi phục việc học bằng file JSON trong Cài đặt, không kèm API key.

## Nghe nhạc

Bấm **♫ Góc âm nhạc**, dán link YouTube video/Shorts/live hoặc playlist, bấm **Mở nhạc**, rồi bấm Play trong khung YouTube. Không tự động phát tiếng khi vừa vào web.

Trình phát vẫn giữ nguyên khi chuyển trang trong ứng dụng. Nút “−” thu gọn phần nhạc; mở lại để điều chỉnh âm lượng hoặc tạm dừng. **Dừng nhạc** gỡ trình phát. Link được nhớ nhưng tải lại toàn bộ trang sẽ không tự phát nhạc.

Video giới hạn nhúng, giới hạn vùng/tuổi hoặc yêu cầu đăng nhập có thể không phát được; sử dụng liên kết **Mở trên YouTube**. Không cam kết tiếp tục phát khi điện thoại khóa màn hình hoặc hệ điều hành đưa trình duyệt vào nền.

## Gemini và đánh giá bài

- Trong Cài đặt, nhập key cá nhân hoặc sử dụng key máy chủ đã cấu hình, bấm **Quét model**, chọn model rồi **Test kết nối**.
- Máy chủ nhận key qua biến môi trường `GEMINI_API_KEY` (ưu tiên) hoặc `data/config.json`.
- Không trả key máy chủ từ `/api/config`; người dùng web không sửa được file cấu hình máy chủ qua API này.
- Khi AI lỗi hoặc chưa cấu hình, ứng dụng đối chiếu thứ tự từ với câu mẫu. Đây không phải chấm ngữ pháp/ngữ nghĩa: cách dịch khác vẫn có thể đúng. Giao diện ghi rõ giới hạn này.
- Việc tạo bài mới bằng AI cần Gemini hoạt động. Bài tự tạo được lưu trên trình duyệt và có trong bản sao lưu.
- Phát âm dùng giọng tiếng Anh của trình duyệt/thiết bị. Tra từ dùng từ điển trực tuyến, thường trả định nghĩa tiếng Anh; bạn có thể tự ghi nghĩa tiếng Việt.

## Dữ liệu cá nhân

Avatar, hồ sơ, bản nháp, tiến độ, từ vựng, XP và bài AI lưu trên trình duyệt hiện tại. Chưa có tài khoản hoặc đồng bộ giữa các thiết bị. Xóa dữ liệu web sẽ xóa dữ liệu này: hãy tải bản sao lưu trước. Lần đầu mở bản mới sẽ nhập sổ từ cũ trên trình duyệt hoặc trên máy chủ nếu có.

Không đưa `data/config.json` lên kho mã nguồn công khai. Khi triển khai lên server, đặt key bằng biến môi trường. Công cụ public tunnel cũ được giữ lại, cần mạng và dịch vụ tunnel hoạt động; bản này không tự xuất bản lên Internet.

## Kiểm tra

`npm test` kiểm tra link YouTube, chuỗi ngày học, escape nội dung và tính hợp lệ của dữ liệu bài học. Kiểm tra giao diện bằng Chromium được ghi trong `KIEM_TRA.md`.

## Cập nhật: nhập tên trong lời chào

Lời chào có ô **Bạn tên là gì?**. Nhập tên hoặc biệt danh rồi bấm Bắt đầu (hoặc Enter). Tên đồng bộ ngay với Hồ sơ và lời chào trang chủ, được lưu trên trình duyệt. Để trống sẽ giữ nguyên tên đang có; người mới vẫn có thể học mà chưa nhập tên. Mở lại từ Cài đặt → Xem lại lời chào. Tên hồ sơ được gửi kèm yêu cầu tạo bài và chấm bài Gemini để cá nhân hóa câu nói về chính người học.

Nếu cập nhật từ bản 2.0 trên GitHub, chỉ cần thay `public/index.html` và `public/js/app.js`, rồi để Render triển khai commit mới. Biến `GEMINI_API_KEY` trên Render tiếp tục dùng như trước.

## Cập nhật: tên trong API và bài học

Tên nhập ở lời chào hoặc Hồ sơ được gửi qua trường `learnerName` tới cả API tạo bài và chấm bài. Máy chủ đưa tên vào ngữ cảnh Gemini, yêu cầu dùng tên đó khi tự giới thiệu và giữ đúng tên nhân vật khác. Câu sửa/nhận xét cũng được yêu cầu giữ tên người học, kể cả tên có dấu tiếng Việt.

Bài AI mới được hướng dẫn dùng `{{learnerName}}` ở vị trí cần tên của chính người học; ứng dụng điền tên hiện tại khi mở bài. Bài “Làm quen ở câu lạc bộ” có câu cuối “Xin chào, mình tên là ...”; bài nhận phòng cũng dùng tên của bạn. Những tên cố định trong bài AI đã lưu từ trước không tự bị thay thế; hãy tạo lại bài nếu muốn có tên cá nhân. Khi chưa nhập tên, vị trí tên mẫu hiển thị Alex.

Cập nhật GitHub: thay đủ 6 file bên dưới, rồi triển khai lại trên Render:
- `server.js`
- `public/index.html`
- `public/js/app.js`
- `public/js/ai_service.js`
- `public/js/personalization.js` (file mới, cần tải lên)
- `data/lessons_sentence.json`

Key trên Render vẫn đặt ở `GEMINI_API_KEY`. Không đưa `data/config.json` chứa key lên GitHub.
