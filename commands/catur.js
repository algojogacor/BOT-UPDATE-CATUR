module.exports = async function(command, args, msg, user, db, sock) {
    const sender = msg.author || msg.from; 
    
    // 1. Validasi Taruhan
    const bet = parseInt(args[0]);
    if (!bet || isNaN(bet) || bet < 100) {
        return msg.reply("⚠️ Masukkan taruhan minimal 100 perak.\nContoh: *!catur 1000*");
    }

    // 2. Cek Saldo User
    if (user.balance < bet) {
        return msg.reply(`❌ Uangmu kurang! Saldo: ${user.balance}, butuh: ${bet}`);
    }

    // 3. Potong Saldo (Biar gak kabur)
    user.balance -= bet;
    
    // 4. BUAT LINK (ANTI ERROR SLASH)
    // Ambil URL dari Koyeb atau Localhost
    let baseUrl = process.env.APP_URL || "http://localhost:3000";
    
   
    if (baseUrl.endsWith('/')) {
        baseUrl = baseUrl.slice(0, -1);
    }
    
    const link = `${baseUrl}/game/index.html?user=${sender}&bet=${bet}`;

    // 5. Kirim Pesan
    await sock.sendMessage(msg.from, { 
        text: `🎮 *CATUR VS AI*\n\n💰 Taruhan: ${bet}\n🏆 Hadiah: ${bet * 2}\n\n👇 *KLIK LINK BUAT MAIN:* 👇\n${link}\n\n_(Jangan refresh browser atau uang hangus!)_`
    }, { quoted: msg });
};
