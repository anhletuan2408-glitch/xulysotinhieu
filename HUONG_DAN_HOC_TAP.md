# TÀI LIỆU HƯỚNG DẪN HỌC TẬP & THỰC HÀNH
## Phân tích Biểu đồ Pole-Zero, Miền hội tụ (ROC) và Đáp ứng Tần số Hệ LTI

---

### Phần 1: Hướng dẫn Sử dụng Nhanh Công cụ Web App
1. **Khởi chạy:** Mở trực tiếp file [`index.html`](index.html) (hoặc bản offline [`LTI_Pole_Zero_SingleFile.html`](LTI_Pole_Zero_SingleFile.html)) bằng bất kỳ trình duyệt hiện đại nào (Chrome, Edge, Firefox, Safari) — không cần cài đặt môi trường.
2. **Thao tác trên Mặt phẳng Phức Z (Z-Plane):**
   - **Kéo thả** vào **Cực ($\times$)** hoặc **Zero ($\circ$)** để di chuyển vị trí nghiệm theo thời gian thực (hỗ trợ cả chuột lẫn màn hình cảm ứng).
   - **Bắt dính (Snap):** Tích chọn **"Bắt dính $|z|=1$"** hoặc **giữ phím `Shift`** khi kéo để đặt Zero/Cực nằm chính xác lên đường tròn đơn vị $|z|=1$ hay các trục tọa độ.
   - **Nhập tọa độ chính xác:** Bấm biểu tượng **`✎`** ở bảng danh sách Cực/Zero để nhập chính xác bán kính $r$, góc $\theta^\circ$ hoặc phần thực/ảo.
   - **Zoom / Hoàn tác:** Cuộn chuột trên mặt phẳng $Z$ để phóng to/thu nhỏ; nhấn `Ctrl+Z` / `Ctrl+Y` (hoặc nút `↶`/`↷`) để Hoàn tác / Làm lại.
   - **Góc nhìn 3D $|H(z)|$:** Chuyển sang nút **`🌐 3D |H(z)|`** và kéo chuột để xoay bề mặt biên độ $H(z)$ trong không gian 3 chiều, quan sát đường tròn đơn vị cắt bề mặt tại đường màu vàng $|H(e^{j\omega})|$.
3. **Khảo sát Vector Hình học tại tần số $\omega_0$:**
   - Kéo thanh trượt **Tần số khảo sát $\omega_0$** hoặc rê/kéo trực tiếp trên đồ thị **Biên độ / Pha** để di chuyển điểm vàng $e^{j\omega_0}$ dọc theo đường tròn đơn vị.
   - Quan sát các đoạn thẳng nét đứt kèm độ dài $d$ nối từ các Cực và Zero tới điểm $e^{j\omega_0}$ cùng công thức thế số trực tiếp ở bên dưới.

---

### Phần 2: Các Bài Thực hành Khám phá (Guided Labs)

#### Bài Thực hành 1: Khảo sát Bộ cộng hưởng (Band-pass Resonator) & Băng thông
- **Cách thực hiện:** Chọn Preset **"Cộng hưởng thông dải (Band-pass Resonator)"**.
- **Cấu hình:** Cặp cực phức liên hợp tại $p_{1,2} = r e^{\pm j\pi/4}$ ($\omega_0 = 0.25\pi$) và hai Zero tại $z = 1$ (triệt tần số DC $\omega=0$) và $z = -1$ (triệt tần số Nyquist $\omega=\pi$).
- **Thí nghiệm:**
  1. Giữ nguyên góc $\theta = 45^\circ$ ($\pi/4$), kéo cực từ bán kính $r = 0.60$ ra $r = 0.96$.
  2. Quan sát đồ thị **Đáp ứng Biên độ $|H(e^{j\omega})|$** và chỉ số **`BW(-3dB)`**: Đỉnh cộng hưởng tại $\omega = 0.25\pi$ càng lúc càng cao và hẹp ($\Delta\omega_{-3\text{dB}} \approx 2(1 - r)$ giảm).
  3. Quan sát đồ thị **Đáp ứng Xung $h[n]$**: Khi $r$ gần $1$, dao động hình sin tắt dần rất chậm ($h[n] \propto r^n \cos(\omega_0 n) u[n]$).

#### Bài Thực hành 2: Thiết kế Bộ lọc Khử nhiễu Tần số Đơn (Notch Filter) & Lọc Tín hiệu
- **Cách thực hiện:** Chọn Preset **"Chắn dải / Khử nhiễu 50Hz (Notch Filter)"**.
- **Nguyên lý:**
  - Để loại bỏ hoàn toàn tần số nhiễu $\omega_N = \pi/3$, đặt cặp Zero **nằm chính xác trên đường tròn đơn vị** tại $z_{1,2} = e^{\pm j\pi/3}$ ($|H(e^{j\pi/3})| = 0$, hay $-\infty\text{ dB}$).
  - Đặt thêm cặp **Cực** có cùng góc $\theta = \pm \pi/3$ với bán kính $r = 0.92 < 1$ ngay phía sau Zero để thu hẹp hố cắt.
  - Chuyển đồ thị số 3 sang tab **"Lọc $x[n]$"**, chọn **"Tổng 2 hình sin"**, chỉnh $\omega_1 = 0.10\pi$ và $\omega_2 = 0.33\pi$ để thấy thành phần nhiễu $\omega_2$ bị triệt tiêu hoàn toàn ở đầu ra $y[n]$!

#### Bài Thực hành 3: Hệ thống All-Pass (Thông toàn dải) & Cân bằng Pha
- **Cách thực hiện:** Chọn Preset **"Hệ thống All-Pass (Cân bằng pha)"**.
- **Nguyên lý:**
  $$H_{\text{ap}}(z) = \frac{z^{-1} - a^*}{1 - a z^{-1}}$$
  Cực nằm trong đường tròn đơn vị tại $p = r e^{j\theta}$ ($r = 0.8$) và Zero nằm ngoài đường tròn đơn vị tại vị trí nghịch đảo liên hợp $z = \frac{1}{r} e^{j\theta}$ ($1/r = 1.25$).
- **Hiện tượng quan sát:**
  - Đồ thị **Biên độ $|H(e^{j\omega})|$** phẳng tuyệt đối bằng $1$ ($0\text{ dB}$) trên toàn bộ dải tần $\omega \in [0, \pi]$.
  - Chuyển sang tab **Trễ nhóm $\tau_g(\omega)$** ở đồ thị số 2: Trễ nhóm tập trung cực đại quanh tần số góc $\theta = \pi/3$.

#### Bài Thực hành 4: Ranh giới Ổn định BIBO, Miền hội tụ (ROC) & Cực bội
- **Cách thực hiện:** Chọn Preset **"Hệ Không ổn định (Cực ngoài đường tròn đơn vị)"** hoặc **"Cực bội bậc 2"**.
- **Thí nghiệm:**
  1. Với loại ROC là **Nhân quả ($|z| > r_{\max}$)** và cực tại $r = 1.07 > 1$:
     - Miền hội tụ $|z| > 1.07$ **không chứa đường tròn đơn vị** $|z|=1$.
     - Đáp ứng xung $h[n]$ tăng vọt theo hàm mũ $(1.07)^n \to \infty$.
  2. Đổi menu **Chế độ Miền hội tụ (ROC)** sang **"Chứa |z| = 1 (Hệ ổn định)"** hoặc **"Phản nhân quả ($|z| < r_{\min}$)"**:
     - Lúc này $\text{ROC}: |z| < 1.07$ chứa đường tròn đơn vị $|z|=1$, hệ thống trở thành **Ổn định BIBO** và $h[n]$ hội tụ về phía $n \le 0$.
  3. Chọn Preset **"Cực bội bậc 2"** (`0.25 / (1 - 0.5*z^-1)^2`) để quan sát đáp ứng xung giải tích xuất hiện thừa số tuyến tính $(n+1)(0.5)^n u[n]$.

---

### Phần 3: Câu hỏi Ôn tập & Tự kiểm tra
1. **Câu hỏi 1:** Tại sao việc thêm hoặc bớt các cực/zero tại chính gốc tọa độ $z = 0$ không làm thay đổi biên độ $|H(e^{j\omega})|$ mà chỉ làm thay đổi pha tuyến tính và trễ nhóm?
   - *Gợi ý:* Khoảng cách từ gốc tọa độ $z=0$ đến bất kỳ điểm nào trên đường tròn đơn vị $e^{j\omega}$ luôn bằng $|e^{j\omega} - 0| = 1$. Thử nhập `z^-1 / (1 - 0.8*z^-1)` và so sánh trễ nhóm với `1 / (1 - 0.8*z^-1)`.
2. **Câu hỏi 2:** Giữa bộ lọc FIR (chỉ có Zero ngoài gốc tọa độ) và bộ lọc IIR (có cả Cực và Zero), bộ lọc nào dễ đạt được độ dốc chuyển tiếp sắc nét với bậc thấp hơn? Đánh đổi về tính ổn định và pha tuyến tính là gì?
   - *Gợi ý:* So sánh Preset *Trung bình trượt FIR bậc 3* với *Thông thấp IIR bậc 2* trực tiếp trên Web App.
