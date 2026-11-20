# Hướng dẫn làm việc trong repo

- Đọc `game.contract.json` và ghi chú phase trước khi sửa luật game. Browser và CLI dùng chung `src/simulation.js`, chạy theo bước cố định 1/60 giây.
- Cài bằng `npm ci`, chơi bằng `npm run dev`, kiểm bằng `npm test` và `npm run build`. Trong PowerShell dùng `npm.cmd` nếu chính sách chặn `npm.ps1`.
- Chạy headless bằng `node src/headless.js --seed 12 --night 1 --ticks 60 --out trial.jsonl`. Giữ thông số gameplay trong contract, cập nhật test và tạo lại bằng chứng bằng CLI khi đổi hành vi.
- Khi dùng `agent-desktop` trên Windows, đọc `agent-desktop skills get desktop` và `agent-desktop skills get platform` trước. Dùng vòng snapshot, thao tác, snapshot. Bọc ref trong dấu nháy đơn khi gọi từ PowerShell.
- Sinh viên review thay đổi cục bộ và tự commit, push, gắn tag.
