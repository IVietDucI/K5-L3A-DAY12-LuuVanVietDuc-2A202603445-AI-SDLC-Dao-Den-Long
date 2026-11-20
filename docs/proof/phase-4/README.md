# Bằng chứng Phase 4 · Test Contract v1.3

Baseline là tag `phase-3` tại `cca5becd6a3c01de082f78973ce5a7312b9ca4ae`. Chạy từ bản sao của tag trước khi sửa mã. [34 test baseline](baseline-test.log) · [47 ca replay baseline](baseline-replay.log).

| Hạng mục | Kết quả và bằng chứng |
|---|---|
| Hồi quy CP1–3 và test CP4 | 39/39 bài test. Replay 47 ca trong bản sao sạch; bộ test còn đối chiếu JSONL v1.2 từng byte. [Log cài sạch](clean-source.log). |
| Benchmark | 541,56 FPS trung bình, 141,70 FPS ở 1% chậm nhất, p95 3,30 ms, 16.245 khung, tải 2.674,34 ms. Đạt các ngưỡng khi thử trên máy cục bộ. [JSON gốc](bench.json) · [stdout](bench.log). |
| Soak | 10 đêm, 0 crash, 32,48 → 36,65 MiB (tăng 12,86%, ngưỡng 20%), 2,26 s. Các lượt input ngẫu nhiên kết thúc `lost`. [JSON gốc](soak.json) · [Lệnh và kết quả](soak.log). |
| Đổi phím, phụ đề và dễ tiếp cận | Có 9 hành động; chặn trùng phím; phím pause mới dùng được sau reload; khôi phục Esc. 18 px và 22,5 px ở 1280×720. Đủ bốn cảnh báo, mũi tên ở mép, đồng hồ dừng nhấp nháy khi giảm chuyển động. [JSON](browser-check.json) · [Đổi phím](bindings.png) · [HUD](accessibility.png). |
| Bảng xếp hạng | Nhập điểm sau lượt thua Đêm 2 và sau Bình Minh. Lượt thua có điểm riêng nhưng JSON xuất chỉ tính các đêm thắng. Mở trình duyệt mới vẫn thấy hai mục; test Node kiểm thứ tự khi hòa điểm, giới hạn top 10 và tên. [Ảnh bảng điểm](leaderboard.png) · [JSON xuất](leaderboard-export.json). |
| Cài đặt và gói chạy | Từ bản sao nguồn chưa có `node_modules` hay `dist`, chạy `npm ci`, test, build, đóng gói và replay. Giải nén gói vào thư mục mới, launcher trả HTTP 200 cho HTML, JS và API; Chrome mở game từ menu ra HUD 3D. [Log và SHA256 của lần kiểm trước khi gắn tag](clean-source.log) · [Cách chạy gói](../../release.md). |

## Cấu hình đo

- Cảnh benchmark chạy bản production tại framebuffer 1280×720, cửa sổ Chrome 157.0.8103.79 độc lập, GPU Intel UHD Graphics qua ANGLE Direct3D 11, Three.js r183. Windows x64 10.0.26300, Intel Core i7-11800H @ 2.30 GHz, RAM khả dụng khoảng 7,71 GiB theo Node, chế độ nguồn High performance.
- Cờ Chromium `--disable-frame-rate-limit` và `--disable-gpu-vsync`; mỗi mẫu tính theo chu kỳ khung có WebGL hoàn thành, 3 giây warm-up rồi 30 giây đo, không tính khoảng khung chưa hoàn chỉnh ở biên. FPS là tốc độ hoàn thành khung WebGL trong cảnh mở khóa. `peak_mem_mb: null` vì WebGL không cung cấp RSS riêng cho cảnh trong Chromium đa tiến trình. [Mã nguồn cờ Chromium](https://chromium.googlesource.com/chromium/src/%2B/6fce3ce354a9abd5a4fd06f558ea5713e29a8d92/components/viz/common/switches.cc).
- Soak cùng máy, Node v26.13.1, `--jitless --expose-gc`. Đo RSS sau tải đêm đầu và sau khi giải phóng đêm cuối, GC ở cả hai điểm.
- Kiểm giao diện dùng Chrome headless SwiftShader ở 1280×720 với hồ sơ và bảng điểm tạm. Kịch bản đưa game tới các trạng thái cuối đêm để kiểm luồng UI. Kết quả FPS ở trên lấy từ Chrome cửa sổ dùng GPU Intel.

## Lặp lại

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run build
node docs/proof/phase-3/replay.mjs
node scripts/bench.mjs --seed 42 --duration 30 --out docs/proof/phase-4/bench.json
node --jitless --expose-gc scripts/soak.mjs --seed 7 --nights 10 --out docs/proof/phase-4/soak.json
node docs/proof/phase-4/browser-check.mjs
node docs/proof/phase-4/clean-source.mjs
```

Vite 8.3.8 vẫn báo chunk Three.js lớn hơn 500 kB trước gzip. Kiểm cài sạch và gói Release hoàn thành trên Windows. Chưa đo trên máy chấm hoặc chạy cài sạch trên macOS/Linux. Chưa chơi thủ công trọn ba đêm hoặc quay MP4. Video và việc công bố GitHub Release do sinh viên thực hiện. [Kịch bản quay](../../demo/script.md).
