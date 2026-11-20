# CP4 · Bình minh và v1.0.0

Ticket-04 là nguồn nghiệm thu. Bản xuất phát là `phase-3` ở `cca5bec`. Tài liệu này đi cùng [bảng nghiệm thu, lệnh, ảnh và log](../proof/phase-4/README.md).

## Phạm vi và cách làm

- Benchmark mở bản build Night 1 ở 1280×720. Seed tạo góc xoay ban đầu cho hai đĩa điểm phân bố đều theo diện tích. Chạy cùng bước wander của gameplay và cùng hình học, màu, hiệu ứng và ánh sáng. Bóng Mực luôn ở wander. Batch hình Bóng Mực theo từng vật liệu để giảm draw call trong cảnh có 200 con.
- Soak xoay vòng 1 → 2 → 3, đêm đầu dùng seed 7 và tăng thêm một cho mỗi lượt. Hướng lấy đều trên vòng tròn và đổi tại tick đầu mỗi nhóm 30. Bốn xác suất nút được lấy độc lập theo seed. Trình chạy giải phóng đêm đã qua trước khi tải đêm tiếp theo.
- Leaderboard dùng tên ASCII theo ticket. Timestamp tạo bằng UTC ISO 8601; xếp hòa điểm theo thời điểm tuyệt đối. Launcher và CLI chọn cùng tệp trên đĩa. Web tĩnh thuần dùng lưu trữ trình duyệt; gói Release chạy qua launcher để xem và xuất cùng một bảng.
- Giảm chuyển động giữ cảnh báo tĩnh và dừng nhấp nháy đồng hồ, dầu yếu, Mây bất tử. Camera của game dùng xoay theo chuột. Cỡ chữ gốc 18 px, chế độ lớn là 22,5 px.
- Bản phát hành dùng web tĩnh kèm launcher Node không cần cài package sau khi giải nén. Dùng MIT cho phần mã dự án để sinh viên duyệt. Gói giữ thông báo giấy phép Three.js.

## Hồi quy và nhật ký AI

- Đổi kỳ vọng phiên bản ở một test từ 1.2 sang 1.3. Giữ dữ liệu, sự kiện và luật chơi của Phase 3. Lấy baseline trước khi sửa, thêm test cho cảnh benchmark, công thức FPS, binding, xếp hạng và soak. Kiểm riêng bản cài sạch và gói Release.
- Chạy soak lần đầu với JIT mặc định, RSS 37,39 → 47,17 MiB, vượt ngưỡng. Chốt `--jitless --expose-gc` trong contract để phần headless dùng cấu hình đo thống nhất, rồi chạy lại. Kết quả riêng của máy chấm vẫn cần đo trên máy chấm.
- Lần đầu gọi Chrome qua sandbox hết thời gian chờ DevTools. Dùng cửa sổ Chromium riêng trên desktop để đo GPU thật. Dùng SwiftShader riêng khi kiểm UI. Kiểm ảnh 1280×720 phát hiện chữ lớn khiến dãy điều khiển chạm khay đom đóm; đã chuyển vị trí khay trong chế độ chữ lớn.
- Cài sạch phát hiện cảnh báo audit của Vite 8.0.14. Cập nhật Vite 8.3.8 và cài/test/build lại. [Bản phát hành Vite 8.3.8](https://github.com/vitejs/vite/releases/tag/v8.3.8).
- Codex thực hiện thay đổi, chạy kiểm và lưu output thật. Dùng AGENTS.md để chọn entry point và giữ mốc nộp; dùng fixture CP1–3 đã có để giảm lặp lại và giảm ngữ cảnh. Cách ước tính token theo đầu ra lưu và giới hạn dữ liệu nằm trong [retro](../retro.md).
