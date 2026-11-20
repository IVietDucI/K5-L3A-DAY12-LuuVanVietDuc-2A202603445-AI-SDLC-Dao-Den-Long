# Changelog

## Phase 4 · Contract v1.3 · v1.0.0

- Thêm `bench_cmd` và `soak_cmd` cho cảnh chuẩn 1280×720 và mười đêm headless trong một tiến trình. Giữ định dạng JSONL và các luật Phase 3.
- Launcher mới mở bản build, lưu top 10 cục bộ và xuất JSON qua `--export-leaderboard`. Điểm chỉ tính các đêm thắng.
- Thêm chín phím có thể đổi, kiểm tra trùng phím, phục hồi mặc định, cảnh báo trực quan, giảm chuyển động và chữ lớn.
- Đóng gói bản chạy từ Node, có README, giấy phép, credits, bằng chứng và kịch bản demo. Nâng Vite lên 8.3.8 sau khi kiểm tra bản cài sạch.

## Phase 3 · Contract v1.2

### Thay đổi phá vỡ tương thích

- Đêm 1/2/3 dài 240/270/300 giây. Thắp đủ đèn giữa Đêm giữ trạng thái `playing`. Khi hết giờ, cần sống sót và giữ 3/5, 4/6 hoặc 5/7 đèn đang sáng. Lý do thắng là `dawn_survived`; `all_lit` đã bỏ.
- Đèn sáng hao dầu và có thể nhận thêm đom đóm. Đèn hết dầu tắt, giữ `ever_lit` và mất tiến độ nạp. Thắp lần đầu cần 10, thắp lại cần 5. Vùng an toàn chỉ có từ 30 dầu trở lên.
- Bóng Mực có trạng thái `drain`, hút 5 dầu/giây mỗi con. Sau khi hết choáng, Bóng Mực về `wander`.
- Sức chứa bắt đầu ở 10, tăng 2 mỗi lần thắp thành công, tối đa 20. Đèn đặt sẵn trong scenario giữ sức chứa đầu Đêm.
- Điểm nạp giảm từ 10 xuống 5 mỗi đom đóm. Thắp mới +100 và thắp lại +40. Pulse +15 nếu Bóng Mực đang hút dầu, +5 nếu ở trạng thái khác. Thắng cộng 50 mỗi đèn sáng, phần nguyên của dầu trong từng đèn đó và 50 mỗi lửa còn. Bỏ thưởng theo thời gian còn lại.
- JSONL thêm dầu và lịch sử đèn, sức chứa, trạng thái `drain` và các sự kiện `refuel`, `lantern_out`, `fuel_drain`. `lantern_lit.data` có thêm `relight`. Scenario nhận `fuel`, `ever_lit`, `successful_lights` và `target_lantern_id`.

Thêm thanh dầu, chỉ báo dầu thấp, hình đèn tắt và cài đặt **Bảng màu dễ phân biệt**. Xem [ADR](docs/adr/0001-lantern-fuel-and-dawn.md) và [bằng chứng Phase 3](docs/proof/phase-3/README.md).

## Phase 2 · Contract v1.1

- Thêm Đảo Cau, Đảo Chuông, lướt, gió đảo, Gió Lạc, Bùa Gió, rơi và hồi sinh. Mở rộng CLI cho ba đêm, hai đồng hồ, snapshot và sự kiện.
- Chuẩn hóa vị trí sinh, đánh/hồi chiêu, nạp từng phần, vùng an toàn và khoảng cách Pulse 3D. Hoàn thành menu, chuyển đêm, HUD và âm thanh. [Bằng chứng Phase 2](docs/proof/phase-2/README.md).

## Phase 1 · Contract v1.0

- Dựng Đảo Bến 3D, di chuyển, nhảy, đom đóm, thắp đèn, Bóng Mực, Tỏa Sáng và kết quả ván.
- Mở CLI JSONL dùng chung simulation 60 tick/giây, hỗ trợ seed, scenario, input theo tick và replay tất định. [Bằng chứng Phase 1](docs/proof/phase-1/README.md).
