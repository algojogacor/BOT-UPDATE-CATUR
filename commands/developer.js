const { saveDB } = require('../helpers/database');

// HELPER FORMAT ANGKA
const fmt = (num) => Math.floor(Number(num)).toLocaleString('id-ID');

// 👑 DAFTAR NOMOR HP DEVELOPER (WHITELIST)
// Masukkan ID WhatsApp kamu di sini.
// Format: "NOMOR@s.whatsapp.net" (tanpa spasi/tanda +)
const ALLOWED_DEVELOPERS = [
    "62895627521746@s.whatsapp.net", // Nomor Utama (Arya)
    "6281234567890@s.whatsapp.net"   // Nomor Cadangan (Contoh)
];

module.exports = async (command, args, msg, user, db, sock) => {
    // List Command Developer
    const devCommands = ['resetall', 'add', 'tambah', 'set', 'setuang'];
    if (!devCommands.includes(command)) return;

    // 1. CEK IDENTITAS (SISTEM WHITELIST)
    // msg.key.participant = ID pengirim di grup
    // msg.key.remoteJid = ID pengirim di chat pribadi
    // Kita ambil mana yang ada.
    const sender = msg.key.participant || msg.key.remoteJid;

    // Cek apakah pengirim ada di dalam daftar ALLOWED_DEVELOPERS?
    if (!ALLOWED_DEVELOPERS.includes(sender)) {
        // Kalau tidak ada di list, abaikan (Silent Mode)
        return; 
    }

    // --- HELPER PENCARI USER BERDASARKAN ID ---
    const findUserByCustomId = (targetId) => {
        for (let jid in db.users) {
            // Pastikan database kamu punya property .id
            if (String(db.users[jid].id) === String(targetId)) {
                return jid;
            }
        }
        return null;
    };

    // ============================================================
    // COMMAND 1: RESET ALL
    // ============================================================
    if (command === 'resetall') {
        if (args[0] !== 'confirm') return msg.reply("⚠️ Ketik `!resetall confirm` untuk mereset semua user ke saldo 10.");
        
        let count = 0;
        Object.keys(db.users).forEach(userId => {
            db.users[userId].balance = 10;
            db.users[userId].business = { owned: {}, lastCollect: 0 };
            db.users[userId].crypto = {};
            db.users[userId].portfolio = {}; 
            db.users[userId].debt = 0;
            count++;
        });

        saveDB(db);
        return msg.reply(`✅ *RESET SUKSES*\n${count} user direset.`);
    }

    // ============================================================
    // COMMAND 2: ADD SALDO (!add <id/tag> <nominal>)
    // ============================================================
    if (command === 'add' || command === 'tambah') {
        const targetInput = args[0]; 
        const amount = parseInt(args[1]);

        if (!targetInput || isNaN(amount)) return msg.reply("❌ Format: `!add <id> <jumlah>`");

        let targetJid = null;

        // Cek Tag atau ID
        if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]) {
            targetJid = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
        } else {
            targetJid = findUserByCustomId(targetInput);
        }

        if (!targetJid) return msg.reply(`❌ User "${targetInput}" tidak ditemukan.`);
        if (!db.users[targetJid]) db.users[targetJid] = { balance: 10 }; 

        db.users[targetJid].balance += amount;
        saveDB(db);

        const targetName = db.users[targetJid].name || targetJid.split('@')[0];
        return msg.reply(`✅ *GOD MODE: ADD*\nTarget: ${targetName}\nNominal: +Rp ${fmt(amount)}\nSisa Saldo: Rp ${fmt(db.users[targetJid].balance)}`);
    }

    // ============================================================
    // COMMAND 3: SET SALDO (!set <id/tag> <nominal>)
    // ============================================================
    if (command === 'set' || command === 'setuang') {
        const targetInput = args[0];
        const amount = parseInt(args[1]);

        if (!targetInput || isNaN(amount)) return msg.reply("❌ Format: `!set <id> <jumlah>`");

        let targetJid = null;

        if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]) {
            targetJid = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
        } else {
            targetJid = findUserByCustomId(targetInput);
        }

        if (!targetJid) return msg.reply(`❌ User "${targetInput}" tidak ditemukan.`);
        if (!db.users[targetJid]) db.users[targetJid] = {};

        db.users[targetJid].balance = amount;
        saveDB(db);

        const targetName = db.users[targetJid].name || targetJid.split('@')[0];
        return msg.reply(`✅ *GOD MODE: SET*\nTarget: ${targetName}\nSaldo Baru: Rp ${fmt(amount)}`);
    }
};
