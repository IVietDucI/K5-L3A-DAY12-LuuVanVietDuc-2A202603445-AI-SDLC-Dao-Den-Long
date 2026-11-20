# Changelog

## Phase 3 · Contract v1.2

### Thay đổi phá vỡ tương thích

- Đêm 1/2/3 dài 240/270/300 giây. Thắp đủ đèn giữa Đêm giữ trạng thái `playing`. Khi hết giờ, cần sống sót và giữ 3/5, 4/6 hoặc 5/7 đèn đang sáng. Lý do thắng là `dawn_survived`; `all_lit` đã bỏ.
- Đèn sáng hao dầu và có thể nhận thêm đom đóm. Đèn hết dầu tắt, giữ `ever_lit` và mất tiến độ nạp. Thắp lần đầu cần 10, thắp lại cần 5. Vùng an toàn chỉ có từ 30 dầu trở lên.
- Bóng Mực có trạng thái `drain`, hút 5 dầu/giây mỗi con. Sau khi hết choáng, Bóng Mực về `wander`.
- Sức chứa bắt đầu ở 10, tăng 2 mỗi lần thắp thành công, tối đa 20. Đèn đặt sẵn trong scenario giữ sức chứa đầu Đêm.
- Điểm nạp giảm từ 10 xuống 5 mỗi đom đóm. Thắp mới +100 và thắp lại +40. Pulse +15 nếu Bóng Mực đang hút dầu, +5 nếu ở trạng thái khác. Thắng cộng 50 mỗi đèn sáng, phần nguyên của dầu trong từng đèn đó và 50 mỗi lửa còn. Bỏ thưởng theo thời gian còn lại.
- JSONL thêm dầu và lịch sử đèn, sức chứa, trạng thái `drain` và các sự kiện `refuel`, `lantern_out`, `fuel_drain`. `lantern_lit.data` có thêm `relight`. Scenario nhận `fuel`, `ever_lit`, `successful_lights` và `target_lantern_id`.

Thêm thanh dầu, chỉ báo dầu thấp, hình đèn tắt và cài đặt **Bảng màu dễ phân biệt**. Xem [ADR](docs/adr/0001-lantern-fuel-and-dawn.md) và [bằng chứng Phase 3](docs/proof/phase-3/README.md).
