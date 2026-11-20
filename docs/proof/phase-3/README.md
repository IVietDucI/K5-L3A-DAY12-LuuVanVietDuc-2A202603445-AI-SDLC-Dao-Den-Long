# Kiểm chứng CP3 — Đèn cạn dầu

Tag `phase-2` (`b2f2247`) đạt [22/22 baseline](baseline.log). CP3 dùng Node v26.13.1 trên Windows x64. [Log replay](replay.log) · [Log test](test.log) · [Log build](build.log).

| Yêu cầu | Kết quả kiểm chứng |
|---|---|
| Hao theo đơn vị nguyên, ngưỡng 30 | Đạt. Fuel đúng 30 bảo vệ Mây. Ở 1799/60 dầu, Mây bị hit dù snapshot vẫn hiện 30. [Biên ngưỡng](fuel-threshold.jsonl) |
| Hút cộng dồn, mỗi 60 tick, dầu về 0 | Đạt. Hai Bóng Mực đang hút làm mất 11 dầu/s kể cả hao tự nhiên, báo dầu 14 ở tick 60 và 3 ở tick 120. Đèn tắt ở tick 137, reset nạp và giữ lịch sử sáng. [JSONL](multi-drain.jsonl) |
| Chọn đèn, bắt đầu và thoát drain | Đạt. Wander chọn L1 khi hai đèn yếu đều cách 5 m. Chase đi về phía Mây. Kiểm vào drain tại đúng 2 m, thoát khi cách hơn 2 m hoặc Mây tới đúng 6 m. [Mục tiêu](wander-targets.jsonl) · [Thoát hút](drain-exits.jsonl) |
| Pulse ngắt hút và +15/+5 | Đạt. Pulse ở tick 1 làm choáng hai mục tiêu, nhận 20 điểm. Hao sau tick đó chỉ còn phần tự nhiên. Kết thúc choáng về `wander`. [JSONL](pulse-drain.jsonl) |
| Châm dầu, bỏ đèn đầy, khôi phục an toàn | Đạt. Từ 90 dầu, hao một đơn vị trước nạp khiến cần hai đom đóm để đạt trần. Ở ca đèn yếu, châm một đom đóm đưa dầu lên 34,9, đưa Bóng Mực ra mép 6 m trong 30 tick và giữ 3 lửa. Test còn kiểm khôi phục đúng 30 và bỏ đèn đầy tại thời điểm chọn. [Trần dầu](refuel-full.jsonl) · [Vùng an toàn](refuel-shelter.jsonl) |
| Đèn tắt và thắp lại, sức chứa | Đạt. L1 tắt rồi thắp lại cùng tick bằng 5 đom đóm, dầu lên 100, nhận 65 điểm và sức chứa tăng 18 → 20. Thắp tiếp vẫn giữ trần 20. Đèn scenario giữ sức chứa 10 và nhặt tối đa 12 sau lần thắp đầu. [Thắp lại](relight-cap.jsonl) · [Nhặt](capacity-pickup.jsonl) |
| Pause đóng băng nhiên liệu | Đạt. `sim_tick` đứng ở 5 từ tick 6 tới 20. Báo cáo hút ở tick 75, tương ứng tick mô phỏng 60. [JSONL](pause-fuel.jsonl) |
| Thắng bình minh, điểm thưởng và ưu tiên cạn lửa | Đạt. Đủ 3/5, 4/6 và 5/7 ở tick cuối thắng. Thắp kịp thắng 703 điểm, đèn tắt ở tick cuối làm thua, hết lửa vẫn thua khi 5 đèn sáng. Ca còn thời gian với 5 đèn sáng vẫn `playing`. [Đêm 1](dawn-n1.jsonl) · [Đêm 2](dawn-n2.jsonl) · [Đêm 3](dawn-n3.jsonl) · [Thắp kịp](dawn-light.jsonl) · [Đèn tắt](dawn-out.jsonl) · [Hết lửa](priority.jsonl) · [Còn giờ](timed-win.jsonl) |
| Chơi trọn Đêm 1 mặc định | Đạt. Seed 12 giữ L1/L2/L3 và 3 lửa tới tick 14400, thắng với 1000 điểm. [Inputs](night1-survival.inputs.json) · [JSONL](night1-survival.jsonl) |
| Tất định và hồi quy CP1–2 | Đạt. Test so byte JSONL khi chạy lại. Đêm 3 đủ 18000 tick với 30 đom đóm, 10 Bóng Mực, 2 Gió Lạc và gió bật. Fixture tải dùng túi dựng sẵn để châm dầu tại chỗ. [Số đo](headless-performance.json) · [Hồi quy](../../notes/phase-3.md) |
| HUD, đèn chớp, vết rách, bảng màu và lưu cài đặt | Đạt bằng Chrome 157 headless và SwiftShader ở 1280 × 720. Kiểm đồng tử và viền `#00B3FF`, cảnh báo trắng có ⚠, dầu và nhấp nháy đóng băng khi pause, đèn xẹp 20% có rách, thanh dầu hiện lại và sức chứa 10 → 12 → 10 khi sang Đêm 2. [Log](browser-result.json) · [Cài đặt](browser-settings.png) · [Dầu thấp](browser-low-fuel.png) · [Đèn tắt](browser-out.png) · [Thắp lại](browser-relit.png) · [Bình minh](browser-dawn.png) |

## Chạy lại

```powershell
node docs/proof/phase-3/replay.mjs
npm.cmd test
npm.cmd run build
```

Bộ replay dùng seed 12, hợp nhất [manifest CP2](../phase-2/cases.json) với [manifest CP3](cases.json) và lưu JSONL v1.2 tại đây. Có thể truyền tên ca, ví dụ `node docs/proof/phase-3/replay.mjs pause-fuel`. Các ca đầu vào sai được lưu ở [invalid.log](invalid.log) và [invalid-target.log](invalid-target.log).

Để chạy kiểm chứng web cần Node 22.12+ và Chrome. Mở server ở một terminal và chạy bộ kiểm ở terminal khác.

```powershell
npm.cmd run dev -- --host 127.0.0.1 --strictPort
node docs/proof/phase-3/browser-check.mjs 'C:\Program Files\Google\Chrome\Application\chrome.exe'
```

Kiểm web dùng các tình huống ngắn trên Vite dev. Chưa chơi chuỗi ba Đêm bằng tay hoặc đánh giá hình ảnh và âm thanh trên phần cứng thật. Kết quả FPS ở Phase 2 dùng bản build v1.1 của phase đó.
