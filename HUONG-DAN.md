# Bổ sung v2 — Random đề và hỏi AI từng câu

Cài lần đầu hoặc cập nhật từ bản trước đều dùng `install-history.cjs` như hướng dẫn dưới. Dừng Node trước khi cài. Bộ cài nhận diện mô-đun đã có, sao lưu file cũ rồi cập nhật. Không cần nhập lại đề hoặc xóa dữ liệu trình duyệt.

## Chọn đề ngẫu nhiên

Nút 🎲 Chọn đề ngẫu nhiên ở danh sách đề. Ưu tiên đề chưa từng nộp và chưa có bài đang dở. Nếu đã làm hết thì chọn trong các đề không có bài dở. Nếu tất cả đều đang dở, chọn một bài để tiếp tục. Mở màn hình chọn thời gian trước khi bắt đầu đề mới; không tự nộp hoặc ghi đè bài cũ. Nút này chọn trên toàn bộ đề đã đăng, không bị giới hạn bởi ô tìm kiếm/bộ lọc hiện tại.

## Chưa hiểu? Hỏi AI

Sau khi nộp, mỗi câu có nút hỏi AI, kể cả câu đúng. Có gợi ý câu hỏi và ô chat để hỏi tiếp. AI nhận nội dung câu, đáp án chuẩn, lựa chọn của bạn, lời giải có sẵn và tối đa 8 tin nhắn gần nhất. Không thay điểm. Hội thoại được lưu theo từng câu/từng lần làm trong trình duyệt và đi kèm sao lưu (giữ tối đa 40 tin nhắn mỗi câu). Lỗi mạng giữ nguyên câu hỏi để gửi lại. Mỗi câu hỏi tối đa 1500 ký tự.

## File lời giải sẵn

Vào Quản lý đề → Xem / sửa / đăng → Lời giải có sẵn. Có thể gõ/dán trực tiếp cho từng câu, hoặc bấm **Tải mẫu file lời giải**. File JSON có `examId` và danh sách `items`; chỉ điền nội dung `explanation`, giữ các trường còn lại. Sau đó chọn **Nhập file lời giải**, kiểm tra, bấm **Kiểm tra và đăng đề**. File tối đa 512 KB, mỗi lời giải tối đa 12000 ký tự. Chưa tự đọc lời giải từ PDF/Word riêng trong bản này.

Lời giải hiển thị sau khi nộp và được dùng làm căn cứ khi chat; không cần AI để xem lời giải có sẵn. Bài đã nộp trước khi bổ sung lời giải vẫn giữ bản kết quả cũ; làm lại đề để nhận nội dung mới. Việc cập nhật nội dung/đáp án/lời giải tạo phiên bản đề mới, nên thực hiện khi không có người đang làm đề đó.

## Kiểm tra v2

Đã kiểm tra random ưu tiên đề mới và giữ bài dở; lưu lời giải; không lộ lời giải trước chấm; chat nhận đúng câu và lời giải trên server, có lịch sử hỏi tiếp; từ chối số câu sai, tin nhắn quá dài, phiên bản cũ; điểm không thay đổi. Kiểm tra chat dùng AI mô phỏng, chưa gọi Gemini thật. Vẫn chưa xác nhận giao diện trực tiếp trên tablet.

---

# Hikarii — Ôn đề Lịch sử

## Cài trên tablet

1. Sao lưu cả thư mục web đang chạy. Dừng Node bằng Ctrl+C trong phiên chạy server.
2. Giải nén gói này. Giữ nguyên thư mục `payload`, `server-patches.json` và `install-history.cjs` cạnh nhau.
3. Trong Termux, chạy:

   node /duong/dan/hikarii-history-update/install-history.cjs /duong/dan/thu-muc-web

   Thay hai đường dẫn bằng vị trí thật. Thư mục web đích phải có `server_old.cjs`, `public`, `data`.
4. Vào thư mục web và chạy `bash start-server.sh` như trước.
5. Mở `/admin`, chọn **Quản lý đề Lịch sử** (hoặc `/lich-su-quan-tri`). Đăng nhập bằng mật khẩu quản trị hiện có.
6. Bấm **Quét thư mục data/history/import**. Đề mẫu 01 đi kèm sẽ thành bản nháp. Bấm **Xem / sửa / đăng**, kiểm tra rồi **Kiểm tra và đăng đề**.
7. Mở `/lich-su`. Cuối trang chủ tiếng Anh đã có nút sang Lịch sử. Tải lại trang nếu còn thấy bản cũ; không xóa dữ liệu trang.

Không cần npm install hoặc Python trên tablet. Không có API key, mật khẩu hay cấu hình cá nhân trong gói. Bộ cài sửa đúng các đoạn server đã kiểm tra, không thay dòng mật khẩu. Nếu server khác bản gốc, bộ cài dừng. Các file được thay có bản sao trong `backup-history-...`.

## Thêm đề

- Tải nhiều DOCX qua quản trị hoặc chép vào `data/history/import` rồi quét.
- Tên file không dấu (ví dụ De_Lich_Su_2026_02.docx), tối đa 8 MB/file. Tải tuần tự để giảm tải tablet.
- Mẫu hiện hỗ trợ: mỗi file một đề; 24 câu A–D, 4 câu đúng/sai; mỗi lựa chọn một đoạn; đáp án nằm trong hai bảng Word ở cuối như đề mẫu đã gửi. Dữ liệu lỗi không được đăng.
- Khi sửa Word, giữ tên file cũ; quét lại tạo bản nháp cập nhật. File không đổi được bỏ qua. Bài đang làm theo phiên bản cũ được giữ nhưng không tự chấm bằng đáp án phiên bản mới.
- Trình sửa quản trị có xem trước và phần sửa JSON: `answer` trắc nghiệm 0=A, 1=B, 2=C, 3=D; đúng/sai gồm 4 true/false. Có thể thêm `explanation` vào mỗi câu.
- Quy tắc điểm: trắc nghiệm 0,25; đúng/sai đúng 0/1/2/3/4 ý được 0/0,1/0,25/0,5/1. Điểm này theo tài liệu mẫu.

## Tính năng

Chọn/lọc đề, đang làm dở lên đầu, đề hoàn thành xuống cuối; làm trắc nghiệm và đúng/sai; đánh dấu, chuyển câu; có/không giới hạn thời gian; tự nộp khi hết giờ; giữ bài khi mất mạng; lịch sử từng lần, điểm gần nhất/cao nhất; xem đáp án và luyện lại câu sai; sao lưu/khôi phục riêng hoặc kèm sao lưu tiếng Anh.

Tiến độ, lịch sử và nhận xét AI lưu trong trình duyệt, không đồng bộ giữa máy. Thời gian dùng đồng hồ thiết bị, dành cho tự luyện, không phải hệ thống thi giám sát. Khi trình duyệt đóng, việc gửi bài hết giờ chỉ thực hiện lúc mở lại. Tự lưu chỉ bảo đảm khi trình duyệt cho phép và còn dung lượng.

Nút AI sử dụng key/model máy chủ sẵn có, không đổi điểm. Nhận xét tạo theo yêu cầu, lưu trên máy. Lời giải AI cần đối chiếu với tài liệu. Không gửi tên/hồ sơ cá nhân trong yêu cầu nhận xét. Chỉ xử lý một yêu cầu nhận xét tại một thời điểm.

## Giới hạn bản này

- Chưa nhập file Word có ảnh, nhiều đề trong cùng file, đáp án file riêng hoặc ZIP 50 đề trực tiếp. Hệ thống báo file có ảnh thay vì âm thầm bỏ ảnh. Giải nén ZIP trên thiết bị của bạn rồi chọn nhiều DOCX để tải lên.
- Chưa có 50 đề trong gói: chỉ kèm đề mẫu 01 đã cung cấp.
- Trình sửa nội dung nâng cao dùng JSON, chưa phải trình soạn thảo trực quan từng câu.
- Không lưu tài khoản học sinh; không có chế độ xem toàn bộ đề cùng lúc.

## Kiểm chứng

Đã chạy kiểm tra bộ đọc đề mẫu, điểm 0/10 và 10/10, cả năm mức điểm đúng/sai; xác thực quản trị; upload/quét; nháp/đăng; dữ liệu đề công khai không chứa đáp án; chặn đường dẫn upload không hợp lệ; từ chối nộp theo phiên bản cũ. Đã kiểm tra cú pháp JavaScript.

Chưa kiểm thử trực tiếp Android 5/Chrome 95. Môi trường kiểm thử chặn Chromium khởi chạy nên chưa xác nhận giao diện bằng trình duyệt tự động. Chưa gọi Gemini thật bằng key cá nhân. Cần thử một đề trên điện thoại sau khi cài trước khi nhập hàng loạt.

## Khôi phục

Dừng Node, chép các file từ `backup-history-...` về đúng vị trí cũ, khởi động lại. Các file mô-đun mới có thể giữ nguyên vì server cũ không gọi chúng. Không xóa `data` hay bộ nhớ trình duyệt.
