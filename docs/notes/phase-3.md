# CP3 — Đèn cạn dầu

Nguồn là Ticket-03 trong yêu cầu CP3. Tag `phase-2` và `HEAD` cùng trỏ tới `b2f2247` trước khi sửa. [Baseline 22/22](../proof/phase-3/baseline.log).

## Nghiệm thu

- Dầu nguyên theo tick, đủ ca đúng 30 và một đơn vị dưới 30. Hao, cộng dồn hút và tắt diễn ra trước tương tác. Pause đóng băng dầu và mốc báo cáo hút.
- Châm dầu theo khoảng cách và trần, giữ thứ tự ID khi hòa. Thắp lại dùng 5, phát `relight: true`, làm đầy dầu và tăng sức chứa. Đèn dựng sẵn giữ sức chứa ban đầu.
- Bóng Mực ở `wander` chọn đèn yếu. `chase` giữ mục tiêu Mây. Mây đến gần, Pulse, thay đổi dầu hoặc vị trí hoàn tất các lối thoát `drain`. Sau châm kiểm đẩy ra mép và miễn hit.
- Kết thúc sau mọi cập nhật tick cuối. Kiểm cả ba ngưỡng, thắng khi thắp kịp, thua khi đèn tắt và `no_flames` ưu tiên. Điểm thưởng dựa trên đèn còn sáng, dầu nguyên và lửa.
- Chrome kiểm thanh dầu và nhấp nháy, hình đèn tắt, sức chứa theo lần thắp lại, màu mắt/viền Bóng Mực, màu và biểu tượng cảnh báo, lưu cài đặt sau reload.

## Quyết định và hồi quy

- [ADR 0001](../adr/0001-lantern-fuel-and-dawn.md) ghi thứ tự cập nhật và các lựa chọn khi nhiều điều kiện xảy ra ở cùng tick. Bán kính nạp tiếp tục dùng XZ 2 m và Pulse tiếp tục dùng 3D 5 m.
- Đo đèn đầy tại lúc xét tương tác. Đèn ở 100 lúc đầu tick vẫn có thể nhận một đom đóm sau bước hao dầu. Đèn đầy tại lúc chọn bị bỏ qua.
- Giữ và chạy lại di chuyển, yaw, nhặt đom đóm, nạp từng phần, lướt, pause, rơi, cầu, bục, gió, hit và recoil, Gió Lạc, Bùa Gió, lịch sinh, lỗi đầu vào và tính tất định. Giữ fixture CP1/CP2 cần thiết, ghi JSONL v1.2 riêng ở Phase 3.
- Đổi kỳ vọng của ca thắng sớm thành tiếp tục chơi. Ca thắp ở tick bình minh dùng `dawn_survived`, với điểm theo dầu và lửa. Ca hết lửa vẫn ưu tiên. Thay lộ trình Đảo Bến v1.1 kết thúc tại tick 8671 bằng lộ trình châm dầu tới bình minh tick 14400. Đêm 3 kiểm đủ 18000 tick thay cho 21600 và châm dầu để Mây còn sống tới bình minh.
- Kết quả Pulse lần hai trong fixture cũ đổi từ hai mục tiêu thành một, vì khi hết choáng, Bóng Mực về `wander` và đường đi đã đổi theo hướng tới đèn. Chi phí, hồi chiêu, khoảng cách 3D và khả năng chặn bởi tháp tiếp tục được kiểm.
- Bảng thay đổi schema và lý do cập nhật kỳ vọng có trong [changelog](../../CHANGELOG.md). Bằng chứng v1.0/v1.1 tái lập tại `phase-1`/`phase-2`.

## Nhật ký AI

- Codex giữ bước mô phỏng 60 tick và dùng một hàm chọn đèn cho nạp từ CLI lẫn HUD. Bộ kiểm chứng đọc manifest cũ để tái sử dụng scenario và so JSONL v1.2 theo byte khi chạy lại.
- Ca ngưỡng dầu xác nhận cả 30 và 1799/60 có thể hiện là 30 trên snapshot dù trạng thái an toàn khác nhau. Kiểm điểm bình minh với đèn hiện 100 trên snapshot nhưng dầu thực vừa hao, nên phần nguyên chỉ là 99.
- Lần chụp đầu tiên cho thấy vết rách tối hòa với giấy đèn tắt. Dùng hình rách răng cưa có phần giấy sáng lộ ra để phân biệt hình dáng dễ hơn trong cảnh tối.
- Kết quả chạy và môi trường nằm trong [bảng kiểm chứng](../proof/phase-3/README.md). Phiên không cung cấp số liệu token hay chi phí.
