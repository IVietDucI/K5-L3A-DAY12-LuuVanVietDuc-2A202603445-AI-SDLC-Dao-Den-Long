# CP2 — Ba hòn đảo

Baseline trên `phase-1` / `7a99a8a`: 10/10 test Windows trước khi sửa. [Log](../proof/phase-2/baseline.log)

## Tiêu chí nghiệm thu

1. **Gió Lạc.** Đêm 2/3 sinh ở tick 1200, tối đa hai. Tự đuổi, cướp trước Bóng Mực, lẩn đi, bị Tỏa Sáng xua và nhả đom đóm có TTL.
2. **Bùa Gió.** Có đúng vị trí, hiệu lực 600 tick, hồi sau 2700 tick, chạy 7,2 m/s và lướt liên tiếp bằng lần nhấn mới.
3. **Chuỗi ba đêm.** Menu → giới thiệu Đêm và lời Ông Đăng → chơi → kết quả → đêm tiếp hoặc chơi lại. Bình Minh sau Đêm 3 và cộng riêng điểm các đêm thắng.
4. **Tạm dừng.** Esc/P và menu hỗ trợ tiếp tục, chơi lại đêm, cài đặt, về menu. Tick CLI tiếp tục, `sim_tick` và mọi bộ đếm gameplay đóng băng.
5. **Cài đặt.** Âm lượng và độ nhạy chuột áp dụng ngay và giữ sau khi tải lại.
6. **Âm thanh.** Có nhạc nền và âm báo cho nhặt, thắp, Tỏa Sáng, hit, nhảy, lướt, thắng, thua, sinh Bóng Mực và mười giây cuối.
7. **HUD.** Lửa trái, đồng hồ giữa có cảnh báo 30 giây, đèn và điểm phải, 10 ô đom đóm dưới giữa, hồi chiêu dưới phải. Có nhắc E và mũi tên tới đèn chưa sáng gần nhất ngoài màn hình.
8. **Màu, ánh sáng.** Vật liệu và UI dùng mã RGB đã chốt. Cường độ ánh sáng môi trường đi từ 0,15 đến 0,70 theo tỷ lệ đèn sáng.

Đối chiếu thêm hình học 3 đêm, thứ tự tick, schema 1.1 và test tất định. Chạy build, đo CLI 21.600 tick và đo FPS trình duyệt 1280×720.

## Giả định triển khai

- Dùng Ticket-02 đính kèm và bảng số chuẩn, lịch đom đóm, quy tắc hồi sinh, palette RGB do người dùng bổ sung trong chat. Lịch Bóng Mực bắt đầu với 2 con tại tick 300 ở cả ba đêm theo bảng bổ sung.
- Điểm đầu Đảo Cau là tâm đảo A. Điểm đầu Đảo Chuông là `[0,0,-12]` trên tầng 0, tránh đặt Mây bên trong nền tầng 2. Cả ba đêm quay mặt +Z và hồi sinh tại điểm đầu đêm đó.
- Chạy đạt vận tốc yêu cầu ngay trong tick đầu và dừng trong tick thả, trong ngưỡng 0,1 giây. Khi lướt trong lúc bị phóng từ bục, dùng vận tốc lướt trong 12 tick rồi trở lại vận tốc phóng nếu vẫn trên không.
- PRD-0 dùng khoảng cách XZ cho tương tác. Ticket-02 đổi bán kính nạp từ 2,4 m thành 2 m và quy định riêng khoảng cách 3D cho Tỏa Sáng. Nạp đèn và tìm đèn chưa sáng gần nhất dùng XZ. Vùng an toàn dùng vòng tròn XZ. Gió Lạc dùng ngưỡng XZ khi phát hiện và cướp, và dùng ngưỡng 3D khi trúng Tỏa Sáng. Hai dốc và các điểm trên nửa vành khăn dùng quy ước góc 30°/150° hướng về phía Z dương, đúng phía có tầng 1.
- Lúc tiếp tục, input cạnh của nút tạm dừng mở lại simulation và xử lý một tick ngay. `night_start` ở tick 0 sau snapshot đầu. Snapshot theo đúng chu kỳ đã chọn, ngay cả khi kết thúc giữa hai mốc. Danh sách Gió Lạc chỉ giữ thực thể chưa biến mất.
- Trần 30 được dùng để quyết định có sinh đom đóm ngẫu nhiên hay không. Đom đóm rơi do hit hoặc do Gió Lạc nhả được tạo đủ theo số cần rơi. Vị trí hit dùng góc và bán kính theo seed trong vành 1,5–2,5 m. Gió Lạc dùng các điểm sương chung với điểm sinh Bóng Mực. Mỗi lần nhặt Bùa Gió làm mới hiệu lực theo ngưỡng nhặt của đom đóm.

## Hồi quy CP1

Đối chiếu từng ca của `test/phase-1.test.js` ở tag `phase-1` với `test/phase-2.test.js`. Baseline CP1 và bằng chứng v1.0 vẫn có ở tag đó.

| Ca CP1 | Kiểm và kỳ vọng v1.1 |
|---|---|
| Di chuyển, yaw, chuẩn hóa, nhặt và nhảy | Dùng lại input CP1, kiểm trạng thái đầu và các mốc snapshot 0/4/8/12. Tốc độ, nhảy và đồng hồ theo bảng chuẩn. Nhặt chưa cộng điểm. |
| Nạp cuối, thắng, thưởng giờ và lửa | Nạp L5 đúng biên XZ 2 m và đạt 10. Ca còn 29 giây nguyên và 2 lửa đạt 278 điểm. Ca đúng rạng đông vẫn thắng nếu còn lửa. |
| Bóng Mực khai báo sẵn, miễn thương và thua | Giữ ID `Bong-1` và hit ở tick 1/91 khi nằm trong ngưỡng cao 1,5 m. Rơi 2 rồi 1 đom đóm và thua `no_flames`. Scenario cũ đặt Bóng Mực ở Y = 20 giữ nguyên lửa theo ngưỡng mới. |
| Tỏa Sáng | Phép đo đổi sang 3D, tâm tại Y chân + 0,8 m. Kiểm mục tiêu đúng biên và ngoài biên, hồi chiêu 180 tick, đẩy 4 m trong 15 tick, choáng 120 tick và +5 điểm mỗi mục tiêu. |
| Dữ liệu lỗi | Dùng lại fixture sai CP1, kiểm mã 2, thông báo stderr và stdout rỗng. |
| Chạy tất định | Hai lần chạy mặc định Đêm 1 giống từng byte. S1/S2 sinh tick 300 và S3 sinh tick 780. Giữ thêm phép so byte cho Đêm 3 đủ 21.600 tick. |
| Trọn ván mặc định | Dùng lộ trình mới theo bản đồ và lịch sinh chuẩn. Kiểm trình tự thắp L3/L1/L2/L4/L5, kết thúc ở tick 8671 với 1460 điểm và đủ lửa. |
| Hết giờ | Dùng lại scenario CP1. Kiểm thời gian kẹp về 0 và dòng `end` ở tick 2 trong yêu cầu 300 tick. |
| Vùng an toàn | Kiểm miễn hit tại biên XZ mới 6 m. Bóng trong vùng bị đẩy ra mép trong 30 tick, Bóng ngoài bị chặn ở mép. |
| Giữ nút nạp | Chỉ lần nhấn tiếp theo mới nạp thêm. Tiến độ được giữ và chọn ID nhỏ hơn khi cùng khoảng cách. |

## Nhật ký AI

- Codex đọc Ticket-02, phát hiện bản TXT thiếu hai bảng và dùng phần người dùng gửi bổ sung để thay các giá trị tạm trước khi hoàn tất simulation. Dùng chung hình học giữa Three.js và CLI để kiểm cầu, dốc và các bục theo cùng tọa độ.
- Kiểm tra thứ tự tick phát hiện Bóng Mực còn trạng thái `spawning` ở bước Tỏa Sáng của tick đầu sau khi sinh. Chuyển trạng thái ở bước giảm bộ đếm và thêm scenario kiểm chính xác tick 300/301.
- Lần đầu đo FPS chạy Mây đến gần mép đảo, khiến kịch bản UI sau phép đo bị gián đoạn bởi cú rơi. Tách phép đo build thường và các scenario kiểm giao diện để lặp lại độc lập. UI dùng Web Audio tổng hợp và test đếm âm đã được xếp lịch.
- Lần đo build đầu đạt 26,70 FPS. Gộp khung đèn, thay point light của Mây bằng quầng mềm, giới hạn lớp phủ vào hai mép và giảm nhịp vẽ bản đồ nhỏ. Ảnh Đảo Chuông phát hiện tháp che Mây, nên camera tự rút gần trước tháp hoặc vách.
- Khi chốt CP2, rà lại quy tắc khoảng cách và khôi phục XZ cho nạp đèn. Bổ sung scenario chênh cao, ca thắng có thưởng thời gian và ca thua do Bóng Mực. Tạo lại JSONL, chạy 22/22 test và đo lại bản build trên Chrome headless SwiftShader. Lần đo khi chốt đạt 52,54 FPS tại framebuffer 1280 × 720.
- Kết quả và lệnh lặp lại nằm ở [bảng kiểm chứng](../proof/phase-2/README.md). Phiên không cung cấp số liệu token hoặc chi phí. Harness trong repo gồm AGENTS.md và hai lệnh kiểm chứng. Quy trình Sites chỉ dùng cục bộ.
