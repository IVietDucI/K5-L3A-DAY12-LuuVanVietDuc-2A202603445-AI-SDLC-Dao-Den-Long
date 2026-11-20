# Hướng dẫn làm việc trong repo

- Đọc `game.contract.json`, `docs/notes/phase-3.md` và ADR về dầu trước khi sửa luật. Browser và CLI dùng chung `src/simulation.js` ở 60 tick/giây, và hình học đặt trong `src/islands.js`.
- Cài bằng `npm ci`, chơi bằng `npm run dev`, kiểm bằng `npm test` và `npm run build`. Trong PowerShell dùng `npm.cmd` nếu chính sách chặn `npm.ps1`.
- Chạy headless bằng `node src/headless.js --seed 12 --night 3 --ticks 60 --out trial.jsonl`. Contract v1.2 giữ hai đồng hồ. Dùng tick mô phỏng cho dầu và mọi thời hạn gameplay. Xét cạn lửa trước điều kiện bình minh.
- Khi đổi hành vi, chạy `node docs/proof/phase-3/replay.mjs`, review JSONL rồi chạy `npm test`. Bằng chứng trình duyệt và lệnh lặp lại ở `docs/proof/phase-3/README.md`. Các phase trước tái lập tại tag tương ứng.
- Khi dùng `agent-desktop` trên Windows, đọc `agent-desktop skills get desktop` và `agent-desktop skills get platform` trước. Dùng vòng snapshot, thao tác, snapshot. Bọc ref trong dấu nháy đơn khi gọi từ PowerShell.
- Sinh viên review thay đổi cục bộ và tự commit, push, gắn tag.
