const { saveDB } = require('../helpers/database');
const crypto = require('crypto'); 

// HELPER
const fmt = (num) => Math.floor(Number(num)).toLocaleString('id-ID');

// 🔑 KUNCI RAHASIA (WAJIB SAMA DENGAN DI FILE HTML)
// Ganti dengan password acak yang panjang!
const SECRET_KEY = "SULTAN_OMEGA_SECURE_9999"; 

module.exports = async (command, args, msg, user, db) => {
    const validCommands = ['rpg', 'battle', 'claim', 'redeem'];
    if (!validCommands.includes(command)) return;

    const now = Date.now();

    // 1. LINK GAME
    if (command === 'rpg' || command === 'battle') {
        const CD = 10 * 60 * 1000; // Cooldown 10 Menit
        if (now - (user.lastBattle || 0) < CD) {
            const sisa = Math.ceil((CD - (now - user.lastBattle)) / 60000);
            return msg.reply(`🔋 *STAMINA LOW!* Isi tenaga dulu ${sisa} menit.`);
        }

        const GAME_LINK = "https://rpgkeren.netlify.app/"; 

        let txt = `⚔️ *NEON WARS: CYBER RPG* ⚔️\n\n`;
        txt += `Hadapi Boss & Dapatkan Reward Ratusan Triliun!\n`;
        txt += `Pilih Class: Samurai / Titan / Netrunner\n\n`;
        txt += `👉 *PLAY NOW:* \n${GAME_LINK}\n\n`;
        txt += `_Menang? Copy kode Victory dan ketik:_ \n\`!claim <kode>\``;

        return msg.reply(txt);
    }

    // 2. CLAIM REWARD (DEKRIPSI KODE)
    if (command === 'claim' || command === 'redeem') {
        const code = args[0];
        if (!code) return msg.reply("❌ Mana kodenya?");

        // Format Kode: WIN-[TIMESTAMP]-[NOMINAL]-[SIGNATURE]
        const parts = code.split('-');
        if (parts.length !== 4 || parts[0] !== 'WIN') return msg.reply("❌ Kode Palsu / Rusak.");

        const timestamp = parseInt(parts[1]);
        const amount = parseInt(parts[2]); // Nominal hadiah ada di dalam kode
        const signature = parts[3];

        // A. Cek Expired (Kode cuma valid 5 menit)
        if (now - timestamp > 5 * 60 * 1000) return msg.reply("❌ Kode Kadaluarsa! Main lagi sana.");

        // B. Kode gak bisa dipake 2x
        if (user.lastClaimCode === code) return msg.reply("❌ Kode sudah pernah diklaim!");

        // C. VERIFIKASI KEAMANAN (ANTI CHEAT)
        // Kita hitung ulang hash dari data yang dikirim
        const checkString = `${timestamp}-${amount}-${SECRET_KEY}`;
        const expectedSig = crypto.createHash('sha256').update(checkString).digest('hex').substring(0, 10).toUpperCase();

        if (signature !== expectedSig) {
            return msg.reply("❌ *CHEATER DETECTED!* Jangan coba-coba edit nominal ya bos.");
        }

        // D. CAIRKAN HADIAH
        user.balance += amount;
        user.xp = (user.xp || 0) + 1000;
        user.lastBattle = now;
        user.lastClaimCode = code;
        
        saveDB(db);

        return msg.reply(`🎉 *VICTORY SECURED!* 🎉\n\n💰 Reward: Rp ${fmt(amount)}\n🆙 XP: +1000\n\n_Saldo sudah masuk rekening!_`);
    }
};
