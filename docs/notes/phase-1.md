# CP1 — Đêm 1: Đảo Bến

Lưu Văn Việt Đức · 2A202603445 · L3A

## Kế hoạch

1. Dựng simulation 60 tick/giây, Test Contract v1.0 và CLI. Chạy một scenario thật trước khi nối giao diện.
2. Nối giao diện Three.js vào cùng simulation. Hoàn thiện vòng đi, nhảy, nhặt, nạp, Pulse, thắng, thua và chơi lại.
3. Chạy bộ test và build, kiểm tra trên trình duyệt Windows, lưu đầu vào và bằng chứng ở `docs/proof/phase-1/`.

## Tiêu chí nghiệm thu

- CLI dựng snapshot tick 0 trước input. Input tick `k` áp dụng cho trạng thái và sự kiện tick `k+1`. Hai lần chạy cùng dữ liệu tạo JSONL giống từng byte. JSON đầu vào sai trả mã 2.
- Kiểm tra tự động di chuyển theo camera, nhặt đom đóm, thắp L5 để thắng, va chạm, Pulse, hết giờ và cạn máu.
- Trình duyệt hiện Đảo Bến, Mây, năm đèn và HUD. Các nút điều khiển chạy đúng và chơi lại đưa game về trạng thái đầu. Người chơi thử trọn một ván trên Windows trước khi duyệt.
- `npm test` và `npm run build` chạy thành công. Bảng kiểm chứng liên kết đến các tệp đầu vào và kết quả thật.

## Giả định PRD-0

- Bán kính đảo 24 m. Mép đảo chặn di chuyển. Tắt rơi khỏi đảo và rơi đom đóm khi trúng đòn.
- Mây đi 5,5 m/s, có 3 lửa, túi chứa 8 đom đóm. Đèn nhận tối đa số đom đóm còn thiếu, mỗi đèn cần 4. Nạp vào đèn chưa sáng gần nhất trong 2,4 m. Mây nhặt tự động trong 0,9 m.
- Pulse dùng 2 đom đóm, hồi 1,5 giây, bán kính 5 m, choáng 2 giây và đẩy 2,5 m. Đèn sáng bảo vệ trong 4 m. Bóng Mực đuổi với tốc độ 3,8 m/s và gây sát thương trong 0,85 m. Mây miễn thương 1,5 giây sau khi trúng đòn.
- Đêm dài 120 giây. Đảo có sẵn 32 đom đóm và 3 Bóng Mực xuất hiện theo seed. Bóng Mực sinh tự động vào giây 6, 12 và 18. Bóng Mực khai báo trong scenario hoạt động từ đầu.
- Nhặt +10 điểm, thắp +100 điểm, làm choáng +25 điểm mỗi Bóng Mực. Thắng thưởng +2 điểm mỗi giây nguyên còn lại và +50 điểm mỗi lửa còn lại. Nếu thắp đèn cuối đúng bước hết giờ thì thắng.
- Đo tầm tương tác theo XZ, kể cả khi Mây nhảy. Thao tác trong một tick theo thứ tự di chuyển, nhặt, nạp, Pulse, xử lý Bóng Mực rồi xét kết thúc. Nếu thắp đèn cuối, game kết thúc ngay sau lần nạp.
- Năm đèn đặt cách đều nhau trên vòng bán kính 14 m. Giao diện dùng seed 12 và khôi phục cùng bố cục ở mỗi lần chơi lại. Mây nhảy với vận tốc đầu 5,4 m/s và gia tốc trọng trường 14 m/s².
- Scenario ghi đè độc lập các trường của từng đèn. Trường bị bỏ qua giữ giá trị mặc định, kể cả `lit` và `deposited`. Snapshot theo chu kỳ đã đặt, gồm mốc 0. Event và dòng `end` ghi lại cả trường hợp dừng giữa hai mốc snapshot.

## Nhật ký AI và đánh giá

- Codex đọc sáu tệp hướng dẫn trong repo và triển khai từ đặc tả CP1 đính kèm. Yêu cầu chính là dựng CLI trước giao diện, dùng chung simulation, lưu kết quả chạy thật và giữ thay đổi cục bộ để sinh viên duyệt. Lab board không truy cập được qua công cụ đọc trang.
- Codex thêm kiểm tra chạy lại output theo từng byte và một lộ trình chơi hết đêm với các thực thể mặc định. Ca Pulse lúc đầu dự đoán sai mục tiêu thứ hai. JSONL cho thấy S1 đã đuổi vào phạm vi trước lần dùng tiếp theo, nên kỳ vọng được sửa theo vị trí ở thời điểm Pulse và được chạy lại.
- Ảnh kiểm tra phát hiện bảng mở màn che Mây và font Georgia hiển thị dấu tiếng Việt lệch. Bảng được dời khỏi giữa cảnh và font được thay bằng Cambria. [Ảnh sau khi sửa](../proof/phase-1/browser-start.png).
- 10/10 test đạt, build thành công trong repo và bản sao nguồn cài từ lockfile. Chrome headless trên Windows xác nhận camera, Pulse, thắng, thua và chơi lại, với kết quả ván thắng trùng CLI. Cảnh báo còn lại của Vite là kích thước bundle. [Bảng kiểm chứng và log](../proof/phase-1/README.md).
- Trình duyệt tích hợp không có trong phiên và `agent-desktop` không lấy được cây cửa sổ Windows (`EnumWindows failed`). Bộ chạy trình duyệt dùng hồ sơ tạm và WebGL phần mềm. Sinh viên kiểm tra cảm giác điều khiển trên máy thật khi review.
- Phiên làm việc không cung cấp số liệu token hoặc chi phí. Giới hạn phạm vi ở Đêm 1, dùng chung simulation, chạy scenario trước khi làm 3D và dùng lại các fixture trong kiểm chứng.
