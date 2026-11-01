# Kiểm tra bản 2.0

## Đã chạy

- 4 bài kiểm tra tự động bằng `node --test`: link YouTube hợp lệ/giả mạo, streak qua ranh giới tháng, escape nội dung HTML, dữ liệu bài học.
- API trên máy chủ thử nghiệm không có key: 27 bài học tải được; `/api/config` không trả API key; POST thay cấu hình bị chặn; đối chiếu câu chính xác ra 100 và lặp từ không làm tăng điểm sai.
- Chromium headless ở 1440 × 1050 và 390 × 844: trang chủ, tìm bài, nhập và tải lại bản nháp, XP không cộng trùng, mở đáp án, ôn câu, nhập link nhạc sai/đúng, giữ iframe khi chuyển trang, sổ từ vựng, lật thẻ, cài đặt.
- Kiểm tra thêm: tải ảnh avatar và lưu, tắt lời chào qua lần tải lại, đổi sáng/tối, tạo bài AI (phản hồi mô phỏng), hoàn thành bài, tải và nhập bản sao lưu, lượt hội thoại trên điện thoại.
- Không phát hiện lỗi JavaScript trong các luồng trên. Trang chủ, danh mục và trang luyện hội thoại không tràn ngang ở kích thước điện thoại đã kiểm tra.
- Đã xem ảnh chụp trang chủ và luyện tập trên máy tính, trang chủ/danh mục trên điện thoại để sửa bố cục.

## Chưa xác minh trực tiếp

- Không sử dụng API key cá nhân để gọi Gemini trả phí: kiểm tra giao diện chấm AI/tạo bài dùng phản hồi mô phỏng; API đối chiếu cục bộ đã kiểm tra thật.
- Đã kiểm tra tạo iframe và giữ trình phát YouTube, chưa xác minh phát âm thanh trực tiếp từ YouTube trong môi trường này. Quyền nhúng và phát nền do YouTube/trình duyệt quyết định.
- Chưa chạy Windows `.bat`, dịch vụ public tunnel hoặc triển khai lên máy chủ công khai. Script Windows và tunnel được cung cấp để chạy tại máy của bạn.

## Cập nhật lời chào nhập tên

Đã kiểm tra Chromium 390 × 844: nhập và gửi bằng Enter, tên hiện trên trang chủ và hồ sơ, giữ sau khi tải lại, bỏ trống không xóa tên cũ, ẩn/mở lại lời chào từ Cài đặt, tên có ký tự HTML hiển thị như văn bản. Không có lỗi JavaScript trong luồng thử nghiệm.

## Cập nhật tên trong API

8 kiểm tra Node đều đạt; bổ sung kiểm tra chuẩn hóa tên, điền tên không thay nhân vật khác, nội dung ngữ cảnh Gemini và learnerName trong cả hai request. Chromium kiểm tra tên nhập ở lời chào đi qua API tạo bài, hiện trong đề song ngữ, gửi tiếp cùng đáp án mẫu tới API chấm; đổi sang tên có dấu hoạt động trong bài có sẵn. Phản hồi Gemini trong bài kiểm tra trình duyệt được mô phỏng, chưa gọi Gemini thật.
