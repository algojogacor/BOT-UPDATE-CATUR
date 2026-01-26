const { saveDB } = require('../helpers/database');
const crypto = require('crypto');

// HELPER
const fmt = (num) => Math.floor(Number(num)).toLocaleString('id-ID');

// 🔑 KUNCI RAHASIA
const SECRET_KEY = "ULTRALISK_OMEGA_KEY_2026";

module.exports = async (command, args, msg, user, db) => {
    const validCommands = ['slither', 'snake', 'claimslither'];
    if (!validCommands.includes(command)) return;

    const now = Date.now();

    // 1. LINK GAME
    if (command === 'slither' || command === 'snake') {
        // GANTI LINK
        const GAME_LINK = "https://papaya-unicorn-f3a5a1.netlify.app/";

        let txt = `🐍 *SLITHER SULTAN.IO* 🐍\n\n`;
        txt += `Makan orb, panjangkan ular, cairkan Triliunan Rupiah!\n`;
        txt += `👉 *MAIN SEKARANG:* \n${GAME_LINK}\n\n`;
        txt += `_Game Over? Copy kode dan ketik:_ \n\`!claimslither <kode>\``;

        return msg.reply(txt);
    }

    // 2. CLAIM REWARD
    if (command === 'claimslither') {
        const code = args[0];
        if (!code) return msg.reply("❌ Mana kodenya?");

        // Format: SLIT-[TIMESTAMP]-[SCORE]-[SIGNATURE]
        const parts = code.split('-');
        if (parts.length !== 4 || parts[0] !== 'SLIT') return msg.reply("❌ Kode tidak valid.");

        const timestamp = parseInt(parts[1]);
        const score = parseInt(parts[2]); 
        const signature = parts[3];

        // Validasi Waktu & Replay
        if (now - timestamp > 5 * 60 * 1000) return msg.reply("❌ Kode kadaluarsa.");
        if (user.lastSlitherCode === code) return msg.reply("❌ Kode sudah dipakai.");

        // Validasi Anti-Cheat
        const checkString = `${timestamp}-${score}-${SECRET_KEY}`;
        const expectedSig = crypto.createHash('sha256').update(checkString).digest('hex').substring(0, 10).toUpperCase();

        if (signature !== expectedSig) {
            return msg.reply("❌ *CHEATER!* Jangan edit skornya bos.");
        }

        // --- 💰 UPDATE HARGA DI SINI 💰 ---
        
        // HARGA DASAR: 200 Miliar per Poin Panjang
        let basePrice = 200_000_000_000; 
        
        // BONUS: Jika panjang > 100, harga per poin naik jadi 300 Miliar
        if (score > 100) basePrice = 300_000_000_000;

        let reward = score * basePrice;

        user.balance += reward;
        user.lastSlitherCode = code;

        saveDB(db);

        return msg.reply(`🐍 *GAME OVER!* 🐍\nPanjang Ular: ${score}\nRate: Rp ${fmt(basePrice)} /cm\n\n💰 *Total Cair: Rp ${fmt(reward)}*`);
    }
};
