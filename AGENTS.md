# Hướng dẫn làm việc trong repo

- Đọc `game.contract.json` và `docs/notes/phase-2.md` trước khi sửa luật. Browser và CLI dùng chung `src/simulation.js` ở 60 tick/giây, và hình học đặt trong `src/islands.js`.
- Cài bằng `npm ci`, chơi bằng `npm run dev`, kiểm bằng `npm test` và `npm run build`. Trong PowerShell dùng `npm.cmd` nếu chính sách chặn `npm.ps1`.
- Chạy headless bằng `node src/headless.js --seed 12 --night 3 --ticks 60 --out trial.jsonl`. Contract v1.1 có `tick` và `sim_tick`. Dùng `sim_tick` cho mọi bộ đếm gameplay, xử lý sinh thực thể sau tương tác và duy trì thứ tự Gió Lạc → Bóng Mực → xét kết thúc.
- Khi đổi hành vi, chạy `node docs/proof/phase-2/replay.mjs`, review JSONL rồi chạy `npm test`. Phần trình duyệt và đo FPS có lệnh trong `docs/proof/phase-2/README.md`. Dùng tag `phase-1` để tái lập bằng chứng CP1.
- Khi dùng `agent-desktop` trên Windows, đọc `agent-desktop skills get desktop` và `agent-desktop skills get platform` trước. Dùng vòng snapshot, thao tác, snapshot. Bọc ref trong dấu nháy đơn khi gọi từ PowerShell.
- Sinh viên review thay đổi cục bộ và tự commit, push, gắn tag.
