# Hikarii - English Learning & Writing Practice (Personal Edition)

Ứng dụng luyện dịch câu song ngữ và học tiếng Anh cá nhân hóa, tích hợp **Google Gemini AI**, tái hiện trải nghiệm học tập của `english.datpmt.com`.

## 🌟 Tính Năng Nổi Bật

- 🎯 **Luyện Viết 3 Chế Độ**:
  - Đoạn văn (Paragraph): Email, Nhật ký, Bài luận, Báo cáo...
  - Câu đời sống (Sentence): 16 chủ đề giao tiếp quen thuộc.
  - Hội thoại (Conversation): Thực hành đối đáp phản xạ 2 chiều.
- 🎓 **Phân Loại Trình Độ Rõ Ràng**: 🌱 Beginner (A1-A2), ⭐ Intermediate (B1-B2), 👑 Advanced (C1-C2).
- 🧠 **Tích Hợp Google Gemini AI**:
  - Chấm điểm chính xác theo ngữ nghĩa và ngữ pháp.
  - Phân tích chi tiết lỗi sai và gợi ý cách hành văn chuẩn bản xứ.
  - Tự động quét và kết nối với các model mới nhất (`gemini-flash-lite-latest`, `gemini-3.5-flash-lite`, `gemini-flash-latest`, `gemini-3.8-flash`).
  - Tự sinh đề bài theo chủ đề tùy ý.
- 📖 **Tra Từ 1-Click Có Phát Âm**: Click vào bất kỳ từ tiếng Anh nào để nghe phát âm, xem phiên âm IPA và lưu vào Sổ từ vựng cá nhân.
- ⚡ **Hoàn Toàn Không Giới Hạn**: Không giới hạn lượt/ngày, không yêu cầu đăng nhập.

## 🚀 Hướng Dẫn Cài Đặt & Khởi Chạy

### 1. Khởi chạy trên máy tính cá nhân
1. Cài đặt [Node.js](https://nodejs.org/) (phiên bản 18 trở lên).
2. Tải mã nguồn về máy và mở thư mục dự án.
3. Cài đặt các thư viện:
   ```bash
   npm install
   ```
4. Khởi động ứng dụng:
   ```bash
   npm start
   ```
   hoặc nhấp đúp vào file `start.bat` (Windows).
5. Mở trình duyệt tại địa chỉ: `http://localhost:3000`.

### 2. Tạo link truy cập công khai (Public Online)
- Nhấp đúp vào file `chay_public_online.bat` để tạo đường link HTTPS chia sẻ cho bạn bè và mở trên điện thoại.

### 3. Triển khai 24/7 lên Render.com
- **Runtime**: Node
- **Build Command**: `npm install`
- **Start Command**: `node server.js`
- **Environment Variable**: `GEMINI_API_KEY` = `<YOUR_GEMINI_API_KEY>`
