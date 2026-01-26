module.exports = async function(command, args, msg, sock) {
    const sender = msg.author || msg.from; // Nomor WA User
    
    // 1. Validasi Taruhan
    const bet = parseInt(args[0]);
    if (!bet || isNaN(bet) || bet < 100) {
        return msg.reply("⚠️ Masukkan taruhan minimal 100 perak.\nContoh: *!catur 1000*");
    }

    // 2. Cek Saldo User (Ambil dari global.db)
    const user = global.db.users[sender];
    if (user.balance < bet) {
        return msg.reply(`❌ Uangmu kurang! Saldo: ${user.balance}, butuh: ${bet}`);
    }

    // 3. Potong Saldo (Agar tidak kabur saat kalah)
    user.balance -= bet;
    
    // 4. BUAT LINK
    const baseUrl = process.env.APP_URL || "http://localhost:3000";
    
    // Gabungkan URL dasar dengan path game & data user
    const link = `${baseUrl}/game/index.html?user=${sender}&bet=${bet}`;

    // 5. Kirim Pesan ke WA
    await sock.sendMessage(msg.from, { 
        text: `🎮 *CATUR VS AI*\n\n💰 Taruhan: ${bet}\n🏆 Hadiah: ${bet * 2}\n\n👇 *KLIK LINK BUAT MAIN:* 👇\n${link}\n\n_(Jangan refresh browser atau uang hangus!)_`
    }, { quoted: msg });
};
