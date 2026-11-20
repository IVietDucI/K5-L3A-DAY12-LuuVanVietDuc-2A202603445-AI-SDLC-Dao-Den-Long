# Đảo Đèn Lồng v1.0.0

Game 3D chơi bằng trình duyệt. Gom đom đóm và giữ đủ đèn sáng trên cả ba đảo tới bình minh.

1. Giải nén `dao-den-long-v1.0.0.tar.gz`.
2. Từ thư mục vừa giải nén, chạy `node scripts/run.mjs` với Node.js 22.12+.
3. Chơi ở `http://127.0.0.1:4173/`. Nếu trình duyệt chưa tự mở, nhập địa chỉ này. Trình duyệt cần WebGL 2.

WASD hoặc mũi tên để đi, Space để nhảy, Shift để lướt, E để nạp đèn, F để Tỏa Sáng, Esc hoặc P để tạm dừng. Kéo chuột để xoay camera. Đổi phím trong **Cài đặt**. Chọn **Bảng xếp hạng** từ menu để xem điểm. Xuất bằng `node scripts/run.mjs --export-leaderboard out.json`.

Dữ liệu điểm nằm trong `~/.dao-den-long/leaderboard.json`. Có thể đặt `DAO_DATA_DIR` để đổi thư mục. Nếu cổng 4173 bận, đặt `DAO_PORT` và dùng địa chỉ được launcher in ra. Dừng launcher bằng Ctrl+C.
