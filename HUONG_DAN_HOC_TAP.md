# TÀI LIỆU HƯỚNG DẪN HỌC TẬP & THỰC HÀNH
## Phân tích Biểu đồ Pole-Zero, Miền hội tụ (ROC) và Đáp ứng Tần số Hệ LTI

---

### Phần 1: Hướng dẫn Sử dụng Nhanh Công cụ Web App
1. **Khởi chạy:** Mở trực tiếp file [`index.html`](file:///C:/Users/lecon/.gemini/antigravity/scratch/lti-pole-zero-analyzer/index.html) bằng bất kỳ trình duyệt hiện đại nào (Chrome, Edge, Firefox, Safari) — không cần cài đặt môi trường.
2. **Thao tác trên Mặt phẳng Phức Z (Z-Plane):**
   - **Kéo thả chuột trái** vào **Cực ($\times$ màu đỏ hồng)** hoặc **Zero ($\circ$ màu xanh cyan)** để di chuyển vị trí nghiệm trong thời gian thực (60 FPS).
   - **Tích chọn "Cặp liên hợp phức":** Khi di chuyển một cực/zero ngoài trục thực, nghiệm liên hợp phức $r e^{-j\theta}$ sẽ tự động di chuyển đối xứng qua trục thực để đảm bảo hệ thống có hệ số thực.
   - **Thêm Cực / Zero:** Nhấp đúp chuột lên mặt phẳng phức (hoặc chọn nút `+ Cực (×)` / `+ Zero (○)` trên thanh công cụ).
   - **Xóa Cực / Zero:** Nhấp chuột phải trực tiếp vào Cực/Zero trên đồ thị hoặc bấm nút `✕` trong bảng danh sách nghiệm.
3. **Khảo sát Vector Hình học tại tần số $\omega_0$:**
   - Kéo thanh trượt **Tần số khảo sát $\omega_0$** hoặc rê chuột trực tiếp trên đồ thị **Biên độ / Pha** để di chuyển điểm vàng $e^{j\omega_0}$ dọc theo đường tròn đơn vị.
   - Quan sát các đoạn thẳng nét đứt nối từ các Cực và Zero tới điểm $e^{j\omega_0}$ để hiểu vì sao biên độ tăng cao khi điểm khảo sát đi qua gần Cực và giảm về $0$ khi đi qua Zero.

---

### Phần 2: Các Bài Thực hành Khám phá (Guided Labs)

#### Bài Thực hành 1: Khảo sát Bộ cộng hưởng (Band-pass Resonator) & Băng thông
- **Cách thực hiện:** Chọn Preset **"Bộ cộng hưởng thông dải (Band-pass Resonator)"**.
- **Cấu hình:** Cặp cực phức liên hợp tại $p_{1,2} = r e^{\pm j\pi/4}$ ($\omega_0 = 0.25\pi$) và hai Zero tại $z = 1$ (triệt tần số DC $\omega=0$) và $z = -1$ (triệt tần số Nyquist $\omega=\pi$).
- **Thí nghiệm:**
  1. Giữ nguyên góc $\theta = 45^\circ$ ($\pi/4$), kéo cực từ bán kính $r = 0.60$ ra $r = 0.96$.
  2. Quan sát đồ thị **Đáp ứng Biên độ $|H(e^{j\omega})|$**: Đỉnh cộng hưởng tại $\omega = 0.25\pi$ càng lúc càng cao và hẹp (hệ số phẩm chất $Q$ tăng, băng thông $\Delta\omega_{-3\text{dB}} \approx 2(1 - r)$ giảm).
  3. Quan sát đồ thị **Đáp ứng Xung $h[n]$**: Khi $r$ gần $1$, dao động hình sin tắt dần rất chậm ($h[n] \propto r^n \cos(\omega_0 n) u[n]$).

#### Bài Thực hành 2: Thiết kế Bộ lọc Khử nhiễu Tần số Đơn (Notch Filter)
- **Cách thực hiện:** Chọn Preset **"Bộ lọc chắn dải / Khử nhiễu 50Hz (Notch Filter)"**.
- **Nguyên lý:**
  - Để loại bỏ hoàn toàn một tần số nhiễu $\omega_N = \pi/3$, ta đặt một cặp Zero **nằm chính xác trên đường tròn đơn vị** tại $z_{1,2} = e^{\pm j\pi/3}$. Khi $\omega = \pi/3$, độ dài vector từ Zero tới $e^{j\omega_N}$ bằng $0 \implies |H(e^{j\omega_N})| = 0$ ($-\infty\text{ dB}$).
  - Nếu chỉ có Zero (bộ lọc FIR), hố lõm trên phổ rất rộng làm suy hao cả các tần số lân cận. Để thu hẹp vết cắt (tạo bộ lọc Notch sắc nét), ta đặt thêm một cặp **Cực** có cùng góc $\theta = \pm \pi/3$ nhưng bán kính $r = 0.92 < 1$ ngay phía sau Zero!

#### Bài Thực hành 3: Hệ thống All-Pass (Thông toàn dải) & Cân bằng Pha
- **Cách thực hiện:** Chọn Preset **"Hệ thống All-Pass (Cân bằng pha)"**.
- **Nguyên lý:**
  $$H_{\text{ap}}(z) = \frac{z^{-1} - a^*}{1 - a z^{-1}}$$
  Cực nằm trong đường tròn đơn vị tại $p = r e^{j\theta}$ ($r = 0.8$) và Zero nằm ngoài đường tròn đơn vị tại vị trí nghịch đảo liên hợp $z = \frac{1}{r} e^{j\theta}$ ($1/r = 1.25$).
- **Hiện tượng quan sát:**
  - Đồ thị **Biên độ $|H(e^{j\omega})|$** phẳng tuyệt đối bằng $1$ ($0\text{ dB}$) trên toàn bộ dải tần $\omega \in [0, \pi]$.
  - Chuyển sang tab **Trễ nhóm $\tau_g(\omega)$** ở đồ thị số 2: Bạn sẽ thấy trễ nhóm tập trung cực đại quanh tần số góc của cực $\theta = \pi/3$. Đây là nền tảng để thiết kế bộ cân bằng pha (Phase Equalizer) trong viễn thông.

#### Bài Thực hành 4: Ranh giới Ổn định BIBO và Miền hội tụ (ROC)
- **Cách thực hiện:** Chọn Preset **"Hệ thống Không ổn định (Cực ngoài đường tròn đơn vị)"**.
- **Thí nghiệm:**
  1. Với loại ROC là **Nhân quả (Causal: $|z| > r_{\max}$)** và cực tại $r = 1.07 > 1$:
     - Miền hội tụ $|z| > 1.07$ **không chứa đường tròn đơn vị** $|z|=1$ (vùng tô màu đỏ).
     - Nhãn trạng thái báo **▲ Không ổn định (Unstable)**.
     - Đáp ứng xung $h[n]$ tăng vọt theo hàm mũ $(1.07)^n \to \infty$.
  2. Giữ nguyên vị trí cực ở $r = 1.07$, đổi menu **Loại Miền hội tụ (ROC)** sang **"Chứa vòng tròn đơn vị (Ổn định)"** hoặc **"Phản nhân quả ($|z| < r_{\min}$)"**:
     - Lúc này $\text{ROC}: |z| < 1.07$ chứa đường tròn đơn vị $|z|=1$, hệ thống trở thành **Ổn định BIBO** (nhưng là hệ phản nhân quả).

---

### Phần 3: Câu hỏi Ôn tập & Tự kiểm tra
1. **Câu hỏi 1:** Tại sao việc thêm hoặc bớt các cực/zero tại chính gốc tọa độ $z = 0$ không làm thay đổi biên độ $|H(e^{j\omega})|$ mà chỉ làm thay đổi pha tuyến tính?
   - *Gợi ý:* Khoảng cách từ gốc tọa độ $z=0$ đến bất kỳ điểm nào trên đường tròn đơn vị $e^{j\omega}$ luôn bằng $|e^{j\omega} - 0| = 1$.
2. **Câu hỏi 2:** Giữa bộ lọc FIR (chỉ có Zero, không có Cực ngoài gốc tọa độ) và bộ lọc IIR (có cả Cực và Zero), bộ lọc nào dễ đạt được độ dốc chuyển tiếp sắc nét với bậc thấp hơn? Đánh đổi về tính ổn định và pha là gì?
   - *Gợi ý:* Thử so sánh Preset *Moving Average FIR bậc 4* với *Butterworth Low-pass IIR bậc 2* trực tiếp trên Web App.
