# Retro · Đảo Đèn Lồng

| Phase | Điều đã kiểm chứng | Điều sửa sau khi có bằng chứng |
|---|---|---|
| 1 | Đảo Bến và CLI dùng chung simulation. Replay cùng seed và input cho kết quả giống nhau từng byte. | Kỳ vọng Pulse ban đầu sai vì Bóng Mực đã đuổi vào vùng trước lần kích hoạt kế tiếp. JSONL theo tick xác định được vị trí thật. |
| 2 | Ba đảo, các mốc hình học, lịch sinh, recoil, gió, rơi và hồi sinh. Bản chốt được đo ở framebuffer 1280×720. | Đối chiếu lại PRD-0 và Ticket-02 để sửa tầm nạp về XZ. Thêm ca chênh cao chứng minh nạp theo XZ và Pulse theo 3D. Perf đầu thấp và camera bị tháp che, nên giảm draw call và cho camera lùi ngắn trước vách. |
| 3 | Ngưỡng dầu được kiểm ở đúng 30 và dưới 30 một đơn vị tick. Có nhiều Bóng hút, bật lại vùng an toàn khi châm, ưu tiên cạn lửa vào tick bình minh. | Quyết định lưu dầu theo đơn vị nguyên 1/60 và ghi ADR. Thay test thắng sớm bằng ca tới bình minh, giữ replay cho các cơ chế vẫn áp dụng. |
| 4 | Cảnh benchmark, soak 10 đêm, đổi phím, lưu cài đặt, bảng điểm, cài nguồn sạch và mở game từ gói đã giải nén. | Lần soak đầu chạy JIT vượt ngưỡng RSS. Đo lại runtime đã khai báo trong hợp đồng với `--jitless`; thu RSS sau GC ở cả hai mốc. Ảnh 1280×720 cho thấy HUD chữ lớn chạm dãy phím, nên nâng khối túi. Cài sạch phát hiện cảnh báo Vite và kiểm lại với phiên bản đã cập nhật. |

**Cách làm việc.** `AGENTS.md` có tác dụng lớn nhất vì chỉ rõ simulation chung, đồng hồ nào áp dụng cho dầu, lệnh kiểm chứng và ranh giới commit. Các fixture replay và ảnh chụp ở kích thước cố định bắt được sai lệch nhanh hơn đọc diff dài. Quy trình Sites hỗ trợ triển khai web cục bộ ở các phase đầu. Chưa ghi nhận hook tự động riêng. Codex làm nhanh khi yêu cầu đã định lượng và có case đạt/trượt. Các đoạn spec thiếu số hoặc không nói rõ trục cần được so lại với yêu cầu gốc trước khi điều chỉnh.

**Ước tính lượng AI.** Lấy số ký tự được thêm vào mã, test và contract ở mỗi phase chia cho khoảng 4 ký tự/token cho ước tính thô về đầu ra còn lưu. CP1 khoảng 13 nghìn, CP2 21 nghìn, CP3 6 nghìn và CP4 12 nghìn, tổng khoảng 52 nghìn token. Phép tính dùng diff giữa các tag và working tree CP4, bỏ ảnh, JSONL và lockfile. Đây là ước tính theo mã lưu, thiếu prompt, lượt sửa, nội dung bị bỏ và phần cache. Phiên không cung cấp số token thanh toán hoặc chi phí. Tái dùng fixture, chạy ca nhỏ trước rồi chạy hồi quy theo lô giúp tránh gửi lại toàn bộ repo và log dài.

**Nếu làm lại.** Chốt bảng ngưỡng, đơn vị, chiều trục và thứ tự tick ngay khi ticket tới. Đo benchmark ở chế độ cửa sổ bằng GPU thật sớm hơn. Chạy `npm ci` trên bản sao sạch trước khi sửa phần phát hành để tách lỗi môi trường khỏi lỗi tính năng.
