# hikarii — Nền tảng học tập cá nhân (Tiếng Anh & Luyện thi Lịch sử)

Ứng dụng học tập cá nhân được xây dựng trên nền tảng **Node.js (>=20)** + **Express** + **JavaScript ES Modules thuần**.

---

## 🌟 Tính năng chính

1. **Học tiếng Anh thông minh (English Corner)**:
   - Luyện dịch câu, viết đoạn luận, giao tiếp song ngữ Việt - Anh.
   - Chấm điểm và sửa lỗi bằng Google Gemini AI kèm bộ suy diễn heuristic cục bộ dự phòng.
   - Sổ tay từ vựng thông minh, tra từ điển IPA và phát âm chuẩn bản ngữ.
   - Theo dõi tiến độ học (Streak, XP tích lũy, mục tiêu mỗi ngày).

2. **Luyện thi trắc nghiệm Lịch sử THPT v3 (History Subsystem)**:
   - Ngân hàng hơn 30+ đề thi chuẩn cấu trúc Bộ GD&ĐT (24 câu trắc nghiệm + 4 câu đúng/sai).
   - Tự động nhập đề từ file Microsoft Word (`.docx`).
   - Lời giải chi tiết và gia sư giải thích thông minh bằng AI.
   - Bảng điều khiển quản trị đề thi và xuất file in ấn tiện lợi.

3. **Thời khóa biểu cá nhân (Timetable Workspace)**:
   - Bảng quản lý lịch học tập trực quan ngay trong ứng dụng (`/#timetable`).

4. **Góc âm nhạc tập trung (Music Corner)**:
   - Phát nhạc thư giãn trực tiếp từ YouTube, Spotify, TikTok hoặc link MP3.

5. **Trang quản trị hệ thống (`/admin`)**:
   - Giám sát tài nguyên CPU, RAM, lưu lượng truy cập thời gian thực.
   - Đổi cấu hình model Gemini, kiểm tra kết nối API key.
   - Bật/tắt chế độ bảo trì máy chủ an toàn.

---

## 🚀 Khởi chạy nhanh

### Yêu cầu:
- **Node.js**: Phiên bản 20 trở lên (khuyến nghị Node.js 20.x, 22.x hoặc 24.x).

### Trên Windows:
- Bấm đúp vào file `start.bat` để tự động mở ứng dụng trên trình duyệt (`http://localhost:3000`).
- Nếu muốn chia sẻ link trực tuyến cho điện thoại hoặc bạn bè: bấm đúp vào `chay_public_online.bat`.

### Bằng lệnh Terminal:
```bash
# 1. Cài đặt các gói phụ thuộc
npm install

# 2. Khởi chạy máy chủ
npm start

# 3. Chạy kiểm thử tự động
npm test
```

Truy cập:
- Trang học tiếng Anh: `http://localhost:3000`
- Luyện thi Lịch sử: `http://localhost:3000/lich-su`
- Trang quản trị: `http://localhost:3000/admin`

---

## 🛡️ Bảo mật
- File cấu hình chứa API Key (`data/config.json`) và mật khẩu quản trị (`.hikarii-admin.json`) được cấu hình tự động bỏ qua trong `.gitignore` nhằm đảm bảo bảo mật tuyệt đối.

Made with care by **hikarii** ✦
