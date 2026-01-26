module.exports = async function(command, args, msg, sock) {
    const sender = msg.author || msg.from; // Nomor WA User
    
    // Cek Taruhan
    const bet = parseInt(args[0]);
    if (!bet || isNaN(bet) || bet < 100) {
        return msg.reply("⚠️ Masukkan taruhan minimal 100 perak.\nContoh: *!catur 1000*");
    }

    // Cek Saldo User (Ambil dari global.db di index.js)
    const user = global.db.users[sender];
    if (user.balance < bet) {
        return msg.reply(`❌ Uangmu kurang! Saldo: ${user.balance}, butuh: ${bet}`);
    }

    // Potong Saldo Dulu (Biar gak kabur pas kalah)
    user.balance -= bet;
    
    // Buat Link
    // Ganti 'localhost' dengan IP Server kamu / Domain kamu jika sudah online
    // Format: domain.com/game/index.html?user=NOMORWA&bet=JUMLAH
    const myIp = "localhost"; // Atau IP Public VPS kamu
    const link = `http://${myIp}:3000/game/index.html?user=${sender}&bet=${bet}`;

    await sock.sendMessage(msg.from, { 
        text: `🎮 *CATUR VS AI*\n\n💰 Taruhan: ${bet}\n🏆 Hadiah: ${bet * 2}\n\n👇 *KLIK LINK BUAT MAIN:* 👇\n${link}\n\n_(Jangan refresh browser atau uang hangus!)_`
    }, { quoted: msg });
};