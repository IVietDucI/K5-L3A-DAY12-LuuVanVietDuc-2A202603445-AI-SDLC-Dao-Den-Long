# Kiểm chứng CP2 — Ba hòn đảo

Baseline CP1 ở `7a99a8a` đạt [10/10](baseline.log). Phase 2 đạt [22/22 test](test.log) và [build thành công](build.log) trên Windows với Node v26.13.1. Vite báo bundle JS vượt ngưỡng cảnh báo 500 kB. `cases.json` lưu Đêm, số tick, nhịp snapshot và đường dẫn scenario/input của 31 ca. `replay.mjs` gọi CLI thật với seed 12 để dựng bằng chứng.

| Yêu cầu | Lệnh hoặc ca kiểm | Kết quả và bằng chứng |
|---|---|---|
| Tuning và cấu trúc ba đêm | `npm test`, ca *v1.1 manifests* | Đạt. 300/330/360 giây, 5/6/7 đèn, 20 đom đóm riêng biệt ở tick 0, đủ mảng và khóa v1.1. [Đêm 1](night1-spawn.jsonl) · [Đêm 2](night2-spawn.jsonl) · [Đêm 3](night3-spawn.jsonl) |
| Chạy, camera, nhảy, nhặt | `npm test`, ca *CP1 movement*, *pickup requires* | Đạt. Di chuyển theo yaw, đường chéo chuẩn hóa, chỉ nhặt khi đúng hai ngưỡng XZ/Y, điểm cộng lúc nạp. [JSONL](movement.jsonl) · [Biên XZ/Y](pickup-height.jsonl) |
| Nạp XZ và Pulse 3D khi chênh cao | `npm test`, ca *elevation does not affect* | Đạt. L1 cao hơn Mây 6 m vẫn nhận nạp ở đúng biên XZ 2 m. L2 ở 2,001 m không nhận nạp. Tỏa Sáng trúng mục tiêu đúng biên 3D 5 m và bỏ qua mục tiêu ở 5,001 m. [JSONL](deposit-height.jsonl) |
| Nạp nhiều lần, ID hòa, tính điểm và ưu tiên kết thúc | `npm test`, ca *CP1 deposit*, *final inclusive-range* | Đạt. Giữ tiến độ, chọn L1 khi hòa và xét hết lửa trước 5 đèn sáng. L5 đúng biên 2 m thắng đúng tick hết giờ với 270 điểm. Ca còn 29 giây nguyên và 2 lửa được 278 điểm. [Nạp](partial-deposit.jsonl) · [Thắng ở rạng đông](final-lantern.jsonl) · [Thưởng giờ/lửa](timed-win.jsonl) · [Ưu tiên](priority.jsonl) · [Hết giờ](dawn.jsonl) |
| Tạm dừng, lướt, hồi chiêu | `npm test`, ca *pause counts* | Đạt. Tick 4–16 vẫn có `sim_tick: 3`, vị trí và bộ đếm giữ nguyên. Sau 12 tick mô phỏng lướt được 2,8 m, Y giữ ở 1 m. Lướt lại đúng tick mô phỏng 91. [JSONL](pause-dash.jsonl) |
| Rơi và hồi sinh | `npm test`, ca *fall ignores* | Đạt. Rơi tại tick 1 dù đang bất tử và mất 7 đom đóm. Hồi sinh tại tick 61 với vận tốc 0 và bất tử. [JSONL](fall.jsonl) |
| Cầu và bục Đảo Cau | `npm test`, ca *Đảo Cau bridge* | Đạt. Kiểm cạnh z = 2, qua cầu trong giới hạn và phóng 24 m/s ngang tới cả hai đảo. [Cầu](bridge.jsonl) · [Bục](pad-cau.jsonl) |
| Dốc, tầng, bục, tháp và gió Đảo Chuông | `npm test`, ca *Đảo Chuông levels*, *wind activates* | Đạt. Hai dốc lên Y = 3, bục đáp Y = 6; tháp chặn ngang, bước khỏi tầng cao rơi về Y = 0. Gió đẩy 10 m trong 5 giây trên đường trống. [Dốc](ramp.jsonl) · [Bục](pad-chuong.jsonl) · [Gió](wind.jsonl) |
| Pulse, khu an toàn, hit, recoil | `npm test`, ca *Pulse locks*, *Bóng Mực evicts*, *shade contact*, *CP1 configured shade* | Đạt. Pulse nhận đúng biên 3D, đẩy 4 m/15 tick và chặn tại tháp. Khu an toàn đưa Bóng Mực ra bán kính 6 m ở tick 30 và bảo vệ đúng biên. Hit theo ID, rơi đúng vành và recoil đủ 2 m qua 60 bước. Bóng cấu hình sẵn đánh ở tick 1 và 91, dẫn đến `no_flames`. [Pulse](pulse.jsonl) · [Tháp](pulse-wall.jsonl) · [Vùng an toàn](shelter.jsonl) · [Recoil](recoil.jsonl) · [Cạn lửa](shade-loss.jsonl) |
| Gió Lạc và Bùa Gió | `npm test`, ca *Gió Lạc steals*, *Bùa Gió permits* | Đạt. Cướp trước hit, bị Pulse xua hoặc nhả lại hàng; đom đóm nhả chỉ nhặt từ tick sau. Bùa cho lướt lại bằng lần nhấn mới và hồi sau 2700 tick. [Cướp và nhả](steal-drop.jsonl) · [Xua](drifter-repel.jsonl) · [Bùa](charm.jsonl) |
| Thực thể mới và lỗi định dạng | `npm test`, ca *spawn schedules*, *errors return* | Đạt. Mote sinh tick 240, nhặt tick 241. Bóng Mực sinh tick 300, bị Pulse ở tick 301. Gió Lạc D1 sinh tick 1200. Input sai trả 2. [Nhặt sau sinh](spawn-pickup.jsonl) · [Pulse sau sinh](spawn-pulse.jsonl) · [stderr](validation.log) |
| Ván Đảo Bến mặc định và hồi quy tất định | `npm test`, ca *default Đảo Bến*, *repeating the no-scenario Night 1*, *full 21,600-tick* | Đạt. Ván mặc định thắng ở tick 8671 với 1460 điểm. Đêm 1 mặc định và benchmark Đêm 3 đều cho JSONL giống từng byte khi chạy lại. [Inputs thắng](night1-win.inputs.json) · [JSONL thắng](night1-win.jsonl) |
| Hiệu năng CLI | `node docs/proof/phase-2/replay.mjs full-night` | Đạt trong 0,268 s, gồm khởi động Node và ghi JSONL. Đêm 3 chạy đủ 21.600 tick với 30 đom đóm, 10 Bóng Mực, 2 Gió Lạc và gió bật. [Số đo](headless-performance.json) · [JSONL](full-night.jsonl) |
| Luồng web, thua và chơi lại, tổng điểm, âm thanh, HUD và cài đặt | `node docs/proof/phase-2/browser-check.mjs` theo lệnh bên dưới | Đạt. Chrome dùng scenario ngắn để thắng ba đêm qua nút E, thua một lượt 777 điểm và xác nhận Bình Minh chỉ cộng 1042 điểm của ba đêm thắng. Kiểm pause, HUD 10 ô, đồng hồ cảnh báo, audio chạy, camera tránh tháp, ánh sáng môi trường 0,15→0,70 và cài đặt giữ qua reload. [Kết quả](browser-result.json) · [Menu](browser-menu.png) · [Pause](browser-pause.png) · [Cài đặt](browser-settings.png) · [Thua](browser-retry.png) · [Đảo Chuông](browser-tower.png) · [Bình Minh](browser-dawn.png) |
| Hiệu năng web 1280 × 720 | Phần đo bản build trong `browser-check.mjs` | Đạt 52,54 FPS trung bình (421 frame trong 8,014 s). Đo Đêm 1 đang chạy bằng bản build Vite preview trên Windows x64 10.0.26300, Intel i7-11800H, Chrome 157 headless và WebGL phần mềm SwiftShader qua ANGLE. [FPS và môi trường](browser-performance.json) |

## Chạy lại

```powershell
npm.cmd test
npm.cmd run build
node docs/proof/phase-2/replay.mjs
```

Để kiểm web, mở Vite dev và preview trong hai terminal. Bộ chạy cần Node 22.12+ và Chrome đã cài.

```powershell
npm.cmd run dev -- --host 127.0.0.1 --strictPort
npm.cmd run preview -- --host 127.0.0.1 --strictPort
node docs/proof/phase-2/browser-check.mjs 'C:\Program Files\Google\Chrome\Application\chrome.exe' 'http://127.0.0.1:5173/' swiftshader 'http://127.0.0.1:4173/'
```

Phép đo FPS dùng bản build qua preview. Kiểm luồng UI dùng Vite dev để tạo tình huống ngắn bằng simulation, sau đó nhấn phím và nút của game. Các bài chưa chạy thủ công gồm chơi trọn ba đêm bằng bàn phím và chuột để đánh giá camera, nghe nhạc và hiệu ứng qua loa, và đo FPS với GPU thật. macOS và Linux chưa được chạy trong phiên này.
