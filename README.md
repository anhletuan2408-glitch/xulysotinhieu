# Đề tài 13: Web App Tương tác Phân tích Biểu đồ Pole-Zero và Đáp ứng Tần số Hệ LTI (HCMUT)

🌐 **Link Chạy Trực Tiếp (Live Web App trên GitHub Pages):**  
👉 **[https://anhletuan2408-glitch.github.io/xulysotinhieu/](https://anhletuan2408-glitch.github.io/xulysotinhieu/)**

---

## Giới thiệu
Công cụ học tập trực quan hóa mối liên hệ giữa vị trí **Cực (Poles - $\times$)** và **Không điểm (Zeros - $\circ$)** trên mặt phẳng phức $Z$ với **Miền hội tụ (ROC)**, **Tính ổn định BIBO**, **Đáp ứng xung $h[n]$** và **Đáp ứng tần số $H(e^{j\omega})$** ở tốc độ **60 FPS** (hỗ trợ cả **2D $\text{Im}-\text{Re}$** và **Mặt cong 3D $|H(z)|$**).

## Tính năng chính
- **Bộ phân tích Đại số Hữu tỷ Laurent $H(z)$:** Hỗ trợ nhập tự do biểu thức theo $z$, $z^{-1}$, nhiều phân thức lồng nhau, lũy thừa âm/dương và ký hiệu khoa học; xuất toàn bộ kết quả giải tích dưới dạng **LaTeX Display-Mode (KaTeX)**.
- **Mặt phẳng phức $Z$ Tương tác 2D & 3D $|H(z)|$:**
  - Kéo thả Cực/Zero (hỗ trợ chuột, cảm ứng, giữ `Shift` hoặc bật bắt dính $|z|=1$, cuộn chuột Zoom, `Ctrl+Z` / `Ctrl+Y` Hoàn tác/Làm lại).
  - Tự động vẽ đường tròn đơn vị $|z|=1$, đường giới hạn ROC đỏ đặc trưng, cực/zero ẩn tại gốc $z=0$ và vector hình học kèm độ dài tới điểm khảo sát $e^{j\omega_0}$.
  - Chế độ **3D $|H(z)|$ Surface** xoay tự do, làm nổi bật đường cắt $|z|=1$ tạo phổ biên độ $|H(e^{j\omega})|$.
- **Giải tích & Đồ thị thời gian thực:**
  1. Hàm truyền dạng Đa thức tỷ lệ & Dạng nhân tử Cực – Zero.
  2. Công thức giải tích tường minh của Đáp ứng xung $h[n] = \mathcal{Z}^{-1}\{H(z)\}$ cho **cả cực đơn lẫn cực bội** (khai triển phân thức tối giản bằng chuỗi lũy thừa cắt cụt).
  3. Phương trình sai phân tuyến tính hệ số hằng $y[n]$ và bảng tọa độ có thể **chỉnh sửa trực tiếp** theo $(Re, Im)$ hoặc $(r, \angle^\circ)$.
  4. Đồ thị **Đáp ứng Biên độ** (có vạch $-3\text{ dB}$ & đo băng thông), **Pha Wrapped (ngắt nhảy sạch) / Pha Liên tục (Unwrapped) / Trễ nhóm giải tích $\tau_g(\omega)$**, và **Miền thời gian $h[n]$, $s[n]$, Lọc tín hiệu $x[n] \to y[n]$** kèm tooltip chi tiết.
- **2 Chế độ Giao diện & Xuất Báo cáo:** Chuyển đổi linh hoạt **🌙 Xanh Tối Gốc** và **☀️ Sáng Bách Khoa**, hỗ trợ `@media print` xuất PDF báo cáo sạch đẹp.

## Cấu trúc Thư mục
- [`index.html`](index.html): Giao diện chính tập trung vào bộ mô phỏng trực quan và thanh chọn Demo nhanh 1 chạm.
- [`css/styles.css`](css/styles.css): Định dạng giao diện 2 chế độ Sáng/Tối, KaTeX typography & `@media print`.
- [`js/dsp.js`](js/dsp.js): Engine số phức, bộ parser Laurent hữu tỷ, giải nghiệm Aberth-Ehrlich, PFE cực đơn/cực bội tìm $h[n]$, trễ nhóm giải tích.
- [`js/charts.js`](js/charts.js): Bộ vẽ đồ họa HiDPI Canvas 2D & 3D $|H(z)|$.
- [`js/app.js`](js/app.js): Quản lý trạng thái, Pointer/Touch, Undo/Redo, chỉnh sửa tọa độ và bộ lọc mẫu (Presets).
- [`BAO_CAO_THIET_KE.md`](BAO_CAO_THIET_KE.md): Báo cáo thiết kế công cụ & giải thuật.
- [`HUONG_DAN_HOC_TAP.md`](HUONG_DAN_HOC_TAP.md): Tài liệu hướng dẫn học tập & bài thực hành.
- [`LTI_Pole_Zero_SingleFile.html`](LTI_Pole_Zero_SingleFile.html): Bản đóng gói 1 file `.html` duy nhất (chạy offline độc lập).
