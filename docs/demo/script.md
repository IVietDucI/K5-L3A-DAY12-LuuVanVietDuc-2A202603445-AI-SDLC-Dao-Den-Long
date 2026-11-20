# Kịch bản demo MP4 · 4 phút 35 giây

Quay ngang 1280×720 hoặc lớn hơn, giữ tiếng game ở mức nghe được. Mở game bằng gói Release đã giải nén và chuẩn bị terminal trong thư mục nguồn. Khởi động với thư mục điểm thử riêng qua `DAO_DATA_DIR`.

| Mốc | Hình và lời dẫn |
|---|---|
| 00:00–00:20 | Mở menu từ launcher. Giới thiệu Mây, ba đảo, mục tiêu giữ đèn tới bình minh. |
| 00:20–01:30 | Chơi trực tiếp Đảo Bến. Di chuyển, xoay camera, nhặt đom đóm và nạp một đèn. Chỉ vào thanh dầu và sức chứa. Nếu gặp Bóng Mực, Tỏa Sáng hoặc lướt khỏi đường đuổi. |
| 01:30–02:00 | Tạm dừng, đổi một phím, thử gán trùng, bật chữ lớn và giảm chuyển động. Quay lại ván, thử phím mới. |
| 02:00–02:30 | Cho thấy màn kết quả và nhập tên sau một lượt thua. Về menu, mở bảng xếp hạng. Nếu dùng clip riêng để minh họa màn Bình Minh, ghi rõ clip được cắt từ lượt khác. |
| 02:30–03:15 | Chạy `npm.cmd test` và lệnh headless bên dưới. Dừng ở dòng kết quả test và JSONL chứa `refuel`. |
| 03:15–04:05 | Chạy benchmark cửa sổ. Cho thấy camera quay và output FPS, p1, tải cảnh. Nêu cấu hình máy đo và phân biệt với kết quả máy chấm. |
| 04:05–04:35 | Mở `soak.json`, chỉ vào 10 đêm, số crash và RSS. Cho thấy file Release cùng hướng dẫn giải nén. |

```powershell
node src/headless.js --seed 12 --night 1 --scenario docs/proof/phase-3/refuel-shelter.scenario.json --inputs docs/proof/phase-3/refuel-shelter.inputs.json --ticks 31 --out trial.jsonl --snapshot-every 1
node scripts/bench.mjs --seed 42 --duration 30 --out bench.json
```

Xuất H.264 trong tệp MP4. Mở lại tệp, kiểm âm lượng, chữ CLI và thời lượng dưới 5 phút. Đính kèm vào Release `v1.0.0` hoặc đặt ở `docs/demo/demo.mp4`, rồi đưa link lên đầu README.
