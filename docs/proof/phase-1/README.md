# Kiểm chứng CP1 — Đảo Bến

Chạy trên Windows với Node.js 26.13.1 và npm 11.20.0. Các tệp JSONL do CLI ghi trực tiếp. `npm test` chạy lại từng scenario và so với các tệp đã lưu theo byte.

| Yêu cầu | Lệnh kiểm chứng | Kết quả thực tế |
|---|---|---|
| 60 tick/s, snapshot tick 0, input giữ trạng thái, di chuyển theo yaw, chuẩn hóa đường chéo, nhặt, nhảy | `npm test`, ca *movement* | Đạt. Nhặt ở tick 1. Vị trí ở tick 4 là `[0.367,0,0]`, ở tick 12 là `[0.626,0.337,0.259]`. [Scenario](movement.scenario.json) · [Inputs](movement.inputs.json) · [JSONL](movement.jsonl) |
| Nạp sát biên 2,4 m, thắp L5, thắng sớm và thưởng điểm | `npm test`, ca *last deposit* | Đạt. Nạp 2 đom đóm, sáng L5 và thắng ở tick 1 với 308 điểm. [Scenario](last-lantern.scenario.json) · [Inputs](last-lantern.inputs.json) · [JSONL](last-lantern.jsonl) |
| Bóng Mực tấn công ngay, miễn thương 1,5 giây, cạn lửa thì thua | `npm test`, ca *the first shade* | Đạt. Trúng ở tick 1 và 91, giữ nguyên số đom đóm mang theo. [Scenario](collision.scenario.json) · [JSONL](collision.jsonl) |
| Pulse chỉ dùng khi nhấn mới, tiêu hao, đẩy, làm choáng; vùng sáng bảo vệ | `npm test`, ca *Pulse*, *shelter boundary* | Đạt. Pulse ở tick 1 và 102, đẩy mục tiêu sát biên từ 5 lên 7,5 m. Hai lần dùng tốn 4 đom đóm, làm choáng hai mục tiêu và ghi 50 điểm. [Scenario](pulse.scenario.json) · [Inputs](pulse.inputs.json) · [JSONL](pulse.jsonl) |
| Giữ E không tự nạp tiếp | `npm test`, ca *holding interact* | Đạt. Chỉ lần nhấn mới nạp đom đóm nhặt thêm. [Log](test.log) |
| Hết thời gian thì dừng sớm | `npm test`, ca *dawn* | Đạt. Hết giờ ở tick 2 trong yêu cầu chạy 300 tick. [Scenario](dawn.scenario.json) · [JSONL](dawn.jsonl) |
| Input và scenario sai trả mã 2, ghi stderr | `npm test`, ca *malformed inputs* | Đạt. Tick input trùng và ID đèn L6 đều trả 2. [Inputs](invalid.inputs.json) · [Scenario](invalid.scenario.json) · [Log](validation.log) |
| Tính tất định và ID Bóng Mực | `npm test`, ca *two independent seeded CLI runs* | Đạt. Hai lần chạy cho JSONL giống từng byte. S1 sinh ở tick 360. [JSONL](seeded.jsonl) |
| Thắng với bản đồ và kẻ địch mặc định | `npm test`, ca *a complete round* | Đạt. Thắp L1–L5, thắng ở tick 1869 với 926 điểm và còn 1 lửa. [Inputs](full-night.inputs.json) · [JSONL](full-night.jsonl) |
| Build Vite | `npm run build` | Đạt. Có cảnh báo kích thước bundle JS khoảng 529 kB, nén gzip khoảng 136 kB. [Log](build.log) |
| Cài từ lockfile trên Windows | Chép nguồn vào thư mục tạm, chạy `npm ci --offline` với cache đã tải, rồi `npm test` và `npm run build` | Đạt. Cài 16 gói, 10/10 test đạt và build thành công. |
| WebGL 2, Mây đội nón lá cầm đèn, bản đồ nhỏ và HUD trên Windows | `node docs/proof/phase-1/browser-check.mjs <đường-dẫn-Chrome>` | Đạt trên Chrome 157 headless ở 1280 × 800. [Ảnh mở đầu](browser-start.png) |
| Camera, phím di chuyển, Pulse, thắng, thua, ánh sáng đảo và chơi lại | `node docs/proof/phase-1/browser-check.mjs <đường-dẫn-Chrome>` | Đạt. Kéo chuột đổi góc nhìn. Nhặt 2 đom đóm và dùng hết bằng Pulse. HUD ghi 0 lửa khi thua, 5/5 đèn và 926 điểm khi thắng, rồi về trạng thái đầu khi chơi lại. [Log](browser-result.log) · [Ảnh thua](browser-lost.png) · [Ảnh thắng](browser-won.png) |

## Chạy lại

Chạy các lệnh ở gốc repo. Thay `npm` bằng `npm.cmd` nếu PowerShell chặn `npm.ps1`.

```sh
npm test
npm run build
node src/headless.js --seed 12 --night 1 --inputs docs/proof/phase-1/full-night.inputs.json --ticks 7200 --out trial.jsonl --snapshot-every 180
```

Bộ chạy trình duyệt cần Node.js 22.12+ và Chrome đã cài. Chạy `npm run dev -- --host 127.0.0.1` trước. Ví dụ PowerShell khi Vite dùng cổng 5173.

```powershell
node docs/proof/phase-1/browser-check.mjs 'C:\Program Files\Google\Chrome\Application\chrome.exe' 'http://127.0.0.1:5173/'
```

Bộ chạy điều khiển thời gian của từng frame để tái lập ván mặc định và dùng WebGL phần mềm. Ảnh được Chrome chụp trực tiếp. Bài kiểm tra jump theo tick nằm trong `npm test`.

## Chơi thử trên Windows

1. Chạy `npm run dev`, mở địa chỉ Vite in ra bằng Chrome hoặc Edge, rồi bấm **Bắt đầu**.
2. Dùng WASD để đi, Space để nhảy và kéo chuột để xoay góc nhìn. Đi qua đom đóm và đối chiếu số trên HUD.
3. Mang đủ 4 đom đóm đến đèn, nhấn **E**. Kiểm tra vòng sáng và ánh sáng tăng. Dùng bản đồ nhỏ để tìm các đèn còn lại.
4. Khi có ít nhất 2 đom đóm và Bóng Mực đến gần, nhấn **F**. Quan sát Bóng Mực bị đẩy và choáng. Thử đứng trong vùng sáng khi Bóng Mực tiến đến.
5. Thắp đủ 5 đèn để thắng. Sau khi chơi lại, đứng ngoài vùng sáng để kiểm tra mất lửa và thua. Bấm **Chơi lại** để xác nhận HUD về 0 đèn, 0 điểm, 3 lửa và 2:00.

Phần cần sinh viên xác nhận là cảm giác di chuyển, góc camera, khả năng đọc HUD và nhịp chơi một ván bằng bàn phím, chuột và GPU thật trên Windows. macOS và Linux chưa được chạy trực tiếp trong phiên này.
