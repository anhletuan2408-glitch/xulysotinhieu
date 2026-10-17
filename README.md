# Đề tài 13: Web App Tương tác Phân tích Biểu đồ Pole-Zero và Đáp ứng Tần số Hệ LTI (HCMUT)

🌐 **Link Chạy Trực Tiếp (Live Web App trên GitHub Pages):**  
👉 **[https://anhletuan2408-glitch.github.io/xulysotinhieu/](https://anhletuan2408-glitch.github.io/xulysotinhieu/)**

---

## Giới thiệu
Công cụ học tập trực quan hóa mối liên hệ giữa vị trí **Cực (Poles - $\times$)** và **Không điểm (Zeros - $\circ$)** trên mặt phẳng phức $Z$ với **Miền hội tụ (ROC)**, **Tính ổn định BIBO**, **Đáp ứng xung $h[n]$** và **Đáp ứng tần số $H(e^{j\omega})$** ở tốc độ **60 FPS**.

## Tính năng chính
- **Nhập trực tiếp biểu thức $H(z)$:** Hỗ trợ nhập theo $z^{-1}$, $z$, hoặc dạng tích các nhân tử và tự động xuất toàn bộ kết quả giải tích dưới dạng công thức LaTeX (KaTeX Display Mode).
- **Kéo thả Cực/Zero 60 FPS trên mặt phẳng phức $\text{Im}-\text{Re}$:** Tự động vẽ đường tròn đơn vị $|z|=1$, đường giới hạn ROC màu đỏ đặc trưng, và các vector hình học tới điểm khảo sát $e^{j\omega_0}$.
- **Giải tích & Đồ thị thời gian thực:**
  1. Hàm truyền dạng Đa thức tỷ lệ & Dạng Cực – Zero.
  2. Công thức giải tích tường minh của Đáp ứng xung $h[n] = \mathcal{Z}^{-1}\{H(z)\}$ (khai triển phân thức tối giản / thặng dư).
  3. Phương trình sai phân tuyến tính hệ số hằng $y[n]$.
  4. Đồ thị Đáp ứng Biên độ $|H(e^{j\omega})|$, Đáp ứng Pha $\angle H(e^{j\omega})$, Trễ nhóm $\tau_g(\omega)$ và Đáp ứng Xung $h[n]$ / Nhảy bậc $s[n]$.
- **2 Chế độ Giao diện:** Chuyển đổi linh hoạt giữa **🌙 Xanh Tối Gốc (Dark Mode)** và **☀️ Sáng Bách Khoa (Light Mode)**.

## Cấu trúc Thư mục
- `index.html`: Giao diện chính của ứng dụng.
- `css/styles.css`: Định dạng giao diện 2 chế độ Sáng/Tối & KaTeX typography.
- `js/dsp.js`: Engine số phức, bộ phân tích biểu thức $H(z)$, thuật toán tìm nghiệm đa thức Durand-Kerner, biến đổi Z ngược tìm $h[n]$ giải tích.
- `js/charts.js`: Bộ vẽ đồ họa 60 FPS HiDPI Canvas.
- `js/app.js`: Quản lý trạng thái, sự kiện tương tác kéo thả chuột và bộ lọc mẫu (Presets).
- `BAO_CAO_THIET_KE.md`: Báo cáo thiết kế công cụ & giải thuật.
- `HUONG_DAN_HOC_TAP.md`: Tài liệu hướng dẫn học tập & bài thực hành.
- `LTI_Pole_Zero_SingleFile.html`: Bản đóng gói 1 file `.html` duy nhất (chạy offline độc lập).
