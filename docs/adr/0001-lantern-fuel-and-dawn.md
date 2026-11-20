# ADR 0001 — Dầu đèn và sống tới bình minh

**Trạng thái** Đã áp dụng cho Phase 3.

## Quyết định

- Mỗi đèn có trạng thái sáng, số đom đóm đã nạp, lịch sử sáng và số lần thắp lại. Dầu là số nguyên đếm theo đơn vị 1/60. Dầu tối đa 100 tương đương 6000 đơn vị, và ngưỡng an toàn 30 tương đương 1800 đơn vị. Scenario được quy đổi về đơn vị gần nhất. Snapshot làm tròn dầu tới một chữ số, còn sự kiện xuất giá trị dầu theo số đơn vị thực.
- Ở bước 2, lấy danh sách Bóng Mực đang hút hợp lệ rồi trừ đồng thời hao dầu tự nhiên và phần hút. Đèn hết dầu tắt và reset số đom đóm đã nạp trước lúc đọc tương tác nạp. Việc vào `drain` trong bước di chuyển chỉ có hiệu lực trừ dầu từ tick sau. Mốc báo cáo tính theo 60 tick thực sự hút của từng Bóng Mực và đóng băng cùng simulation khi pause.
- Xét đèn và mục tiêu của Bóng Mực bằng khoảng cách XZ và ID tăng dần khi hòa. Châm dầu khôi phục vùng an toàn có thể ngắt `drain` trước Tỏa Sáng. Bóng Mực đã bắt đầu bị đẩy bởi vùng vừa tái lập vẫn đi hết lần đẩy nếu dầu ngay sau đó giảm dưới 30. Vùng mất khả năng bảo vệ Mây dưới 30, và Bóng Mực đang bị đẩy vẫn không gây sát thương. Hết choáng chuyển về `wander` trước khi chọn mục tiêu tiếp.
- Đèn sáng sẵn bắt đầu với dầu 100 nếu scenario bỏ trường `fuel` và có lịch sử sáng. Bộ đếm thắp thành công chỉ tăng khi nạp đủ trong gameplay, kể cả thắp lại. Điểm, dầu và sức chứa của mỗi Đêm nằm trong simulation của chính Đêm đó.
- Đến bước xét kết thúc, cạn lửa luôn thua. Khi hết giờ, đếm đèn đang sáng sau mọi cập nhật. Thắng từ ngưỡng 3/5, 4/6 hoặc 5/7 tương ứng, cộng thưởng theo dầu nguyên chính xác, đèn và lửa còn lại.

## Hệ quả

Quy tắc tại ngưỡng không phụ thuộc hiển thị làm tròn. Một đèn có thể vừa tắt vừa được thắp lại trong một tick. Việc thắp đủ đèn giữa Đêm vẫn để người chơi tiếp tục châm dầu và đối phó với Bóng Mực. Client v1.1 cần cập nhật schema và cách xét điểm như ghi trong [changelog](../../CHANGELOG.md).
