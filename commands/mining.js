const { saveDB } = require('../helpers/database');

// HELPER FORMAT ANGKA
const fmt = (num) => Math.floor(Number(num)).toLocaleString('id-ID');

// ============================================================
// ⚙️ KONFIGURASI UTAMA
// ============================================================
const BTC_PER_HASH_HOUR = 0.00000035; 
const ELECTRICITY_COST = 50; // Rp 50 per Hash/Jam (Biaya Listrik)

// DATA HARDWARE (Base Price)
const HARDWARE = {
    'rtx4070': { name: "🟢 RTX 4070 Ti", basePrice: 20000000, hashrate: 160, type: 'legal' },
    'rtx4090': { name: "🔵 RTX 4090 OC", basePrice: 50000000, hashrate: 400, type: 'legal' },
    'dual4090': { name: "🟣 Dual 4090", basePrice: 80000000, hashrate: 640, type: 'legal' },
    'asic': { name: "🟠 Antminer S19", basePrice: 100000000, hashrate: 800, type: 'legal' },
    // BLACK MARKET ITEMS
    'usb_miner': { name: "🏴‍☠️ USB Miner Hack", basePrice: 5000000, hashrate: 100, type: 'illegal', risk: 0.1 },
    'quantum_rig': { name: "🏴‍☠️ Quantum Rig", basePrice: 150000000, hashrate: 1500, type: 'illegal', risk: 0.25 }
};

// UPGRADES
const UPGRADES = {
    'cooling': { name: "❄️ Liquid Cooling", price: 10000000, effect: "Mengurangi risiko Overheat & Meledak" },
    'psu': { name: "⚡ Platinum PSU", price: 15000000, effect: "Diskon Biaya Listrik 30%" },
    'firewall': { name: "🛡️ Anti-Hack Firewall", price: 25000000, effect: "Kebal dari serangan Hacker PvP" }
};

// ============================================================
// 🔄 LOGIKA MARKET DINAMIS
// ============================================================
const updateMarketPrices = (db) => {
    const now = Date.now();
    // Update setiap 2 Jam
    if (!db.market.miningPrices || (now - db.market.lastMiningUpdate > 1 * 60 * 60 * 1000)) {
        db.market.miningPrices = {};
        for (let [key, item] of Object.entries(HARDWARE)) {
            // Fluktuasi -15% sampai +15%
            const fluctuation = 1 + (Math.random() * 0.3 - 0.15); 
            db.market.miningPrices[key] = Math.floor(item.basePrice * fluctuation);
        }
        db.market.lastMiningUpdate = now;
        saveDB(db);
    }
};

module.exports = async (command, args, msg, user, db, sock) => {
    const validCommands = [
        'mining', 'miner', 
        'belivga', 'buyvga', 'shopminer', 
        'claimmining', 
        'blackmarket', 'bm', 
        'upgrade', 
        'hack', 
        'topminer',
        'panduanminer', 'rulesminer', 'guide'
    ];
    
    if (!validCommands.includes(command)) return;

    const now = Date.now();
    updateMarketPrices(db);

    // INIT DATA USER
    if (!user.mining) user.mining = { racks: [], lastClaim: now, totalHash: 0, upgrades: {} };
    if (!user.crypto) user.crypto = { btc: 0 };

    // ============================================================
    // 📚 PANDUAN & ATURAN MINING (!panduanminer)
    // ============================================================
    if (command === 'panduanminer' || command === 'rulesminer' || command === 'guide') {
        let txt = `📘 *BUKU PANDUAN PENAMBANG KRIPTO* 📘\n`;
        txt += `_Pelajari aturan main sebelum bangkrut!_\n\n`;

        txt += `⚡ *1. SISTEM LISTRIK (PLN)*\n`;
        txt += `Setiap rig menyedot listrik *Rp 50 / MHs / Jam*.\n`;
        txt += `• Listrik dibayar OTOMATIS saat kamu ketik \`!claimmining\`.\n`;
        txt += `• ⚠️ *AWAS:* Jika saldo Rupiah kurang, kamu GAK BISA panen BTC (Rig disandera PLN).\n`;
        txt += `• _Tips: Beli PSU Platinum untuk diskon listrik 30%._\n\n`;

        txt += `🚔 *2. PASAR GELAP (BLACK MARKET)*\n`;
        txt += `Item ilegal (USB Miner/Quantum) memang murah & kencang, TAPI:\n`;
        txt += `• Setiap kali ketik \`!mining\`, ada risiko *POLISI DATANG*.\n`;
        txt += `• Jika tertangkap, semua alat ilegal akan *DISITA/HILANG*.\n`;
        txt += `• _Tips: High Risk, High Reward. Jangan nangis kalau dirazia._\n\n`;

        txt += `📉 *3. MARKET DINAMIS (HARGA BERUBAH)*\n`;
        txt += `Harga VGA di \`!shopminer\` berubah setiap *2 Jam*.\n`;
        txt += `• Bisa naik mahal 📈 atau diskon besar 📉.\n`;
        txt += `• _Tips: Cek harga dulu sebelum beli!_\n\n`;

        txt += `⚔️ *4. PVP & PERETASAN (HACKER)*\n`;
        txt += `Kamu bisa mencuri 5% BTC user lain dengan \`!hack @user\`.\n`;
        txt += `• Peluang sukses: 40%.\n`;
        txt += `• Jika GAGAL: Didenda Rp 500.000 oleh Polisi Siber.\n`;
        txt += `• _Tips: Pasang Firewall di \`!upgrade\` agar kebal dari hacker._\n\n`;

        txt += `🛠️ *5. UPGRADE RIG*\n`;
        txt += `• ❄️ *Cooling:* Mencegah rig meledak saat *Random Event*.\n`;
        txt += `• ⚡ *PSU:* Menghemat tagihan listrik 30%.\n`;
        txt += `• 🛡️ *Firewall:* Anti-maling/Anti-hack.\n\n`;

        txt += `🍀 *6. EVENT ACAK*\n`;
        txt += `Hati-hati saat cek status! Bisa terjadi:\n`;
        txt += `• 🔥 *Overheat:* Waktu mining reset (Rugi waktu).\n`;
        txt += `• ⚡ *Konslet:* BTC berkurang 5%.\n`;
        txt += `• 🍀 *Lucky Block:* Dapat bonus BTC gratis.`;

        return msg.reply(txt);
    }

    // HITUNG HASHRATE & RISK
    let totalHash = 0;
    let illegalCount = 0;
    user.mining.racks.forEach(id => {
        if (HARDWARE[id]) {
            totalHash += HARDWARE[id].hashrate;
            if (HARDWARE[id].type === 'illegal') illegalCount++;
        }
    });
    user.mining.totalHash = totalHash;

    // ============================================================
    // 🖥️ STATUS & RANDOM EVENTS (!mining)
    // ============================================================
    if (command === 'mining' || command === 'miner') {
        // 1. CEK RAZIA POLISI (Jika punya barang ilegal)
        if (illegalCount > 0) {
            const chance = 0.05 * illegalCount; // 5% per alat ilegal
            if (Math.random() < chance) {
                // RAZIA!
                user.mining.racks = user.mining.racks.filter(id => HARDWARE[id].type !== 'illegal');
                saveDB(db);
                return msg.reply(`🚔 *POLISI MENGGEEREBEK RUMAHMU!* 🚔\n\nSemua mesin **Black Market** disita karena tidak berizin!\nHashrate kamu turun drastis. Jangan main ilegal kalau gak siap rugi!`);
            }
        }

        // 2. RANDOM EVENTS (Hanya trigger jika hash > 0)
        let eventMsg = "";
        if (totalHash > 0 && Math.random() < 0.3) { // 30% Chance Event
            const events = ['overheat', 'short_circuit', 'lucky'];
            const ev = events[Math.floor(Math.random() * events.length)];

            if (ev === 'overheat' && !user.mining.upgrades.cooling) {
                user.mining.lastClaim = now; // Reset timer (Rugi waktu)
                eventMsg = `🔥 *SYSTEM OVERHEAT!*\nMesin kepanasan! Mining terhenti otomatis. Waktu mining di-reset.\n_Tips: Beli Liquid Cooling di !upgrade_`;
            } else if (ev === 'short_circuit') {
                const lostBTC = user.crypto.btc * 0.05;
                user.crypto.btc -= lostBTC;
                eventMsg = `⚡ *KONSLET LISTRIK!*\nAda arus pendek! Kamu kehilangan 5% BTC (${lostBTC.toFixed(8)}) untuk perbaikan.`;
            } else if (ev === 'lucky') {
                const bonus = 0.00005;
                user.crypto.btc += bonus;
                eventMsg = `🍀 *LUCKY BLOCK!*\nKamu menemukan blok langka! Bonus +${bonus} BTC.`;
            }
            if (eventMsg) saveDB(db);
        }

        // Hitung Pendapatan
        const diffHours = (now - user.mining.lastClaim) / (1000 * 60 * 60);
        let pendingBTC = (totalHash * BTC_PER_HASH_HOUR * diffHours);
        
        // Biaya Listrik
        let elecCost = totalHash * ELECTRICITY_COST * diffHours;
        if (user.mining.upgrades.psu) elecCost *= 0.7; // Diskon 30% kalau ada PSU

        const btcPrice = db.market?.forex?.usd ? (db.market.forex.usd * 63000) : 1500000000;
        const estRupiah = Math.floor(pendingBTC * btcPrice);

        let txt = `⛏️ *MINING DASHBOARD* ⛏️\n`;
        txt += `👤 Miner: ${user.name}\n`;
        txt += `⚡ Hashrate: ${fmt(totalHash)} MH/s\n`;
        txt += `🔌 Tagihan Listrik: -Rp ${fmt(elecCost)}\n`;
        txt += `━━━━━━━━━━━━━━━━━━━\n`;
        txt += `⏳ *PENDAPATAN SAAT INI*\n`;
        txt += `⏱️ Jalan: ${diffHours.toFixed(2)} Jam\n`;
        txt += `💎 Yield: ${pendingBTC.toFixed(8)} BTC\n`;
        txt += `💰 Estimasi Bersih: Rp ${fmt(estRupiah - elecCost)}\n`;
        txt += `━━━━━━━━━━━━━━━━━━━\n`;
        
        if (eventMsg) txt += `\n⚠️ *EVENT REPORT:*\n${eventMsg}\n`;

        // Tampilkan Upgrades
        let upgList = [];
        if (user.mining.upgrades.cooling) upgList.push("❄️");
        if (user.mining.upgrades.psu) upgList.push("⚡");
        if (user.mining.upgrades.firewall) upgList.push("🛡️");
        txt += `🔧 Upgrade: ${upgList.length > 0 ? upgList.join(" ") : "Standar"}\n`;

        txt += `\n👇 *MENU:*\n`;
        txt += `• \`!claimmining\` : Panen & Bayar Listrik\n`;
        txt += `• \`!shopminer\` : Toko Resmi (Legal)\n`;
        txt += `• \`!blackmarket\` : Pasar Gelap (Ilegal)\n`;
        txt += `• \`!upgrade\` : Beli Komponen\n`;
        txt += `• \`!hack @user\` : Curi BTC Orang`;

        return msg.reply(txt);
    }

    // ============================================================
    // 💰 CLAIM HASIL (BAYAR LISTRIK)
    // ============================================================
    if (command === 'claimmining') {
        if (user.mining.totalHash === 0) return msg.reply("❌ Belum punya mesin.");

        const diffHours = (now - user.mining.lastClaim) / (1000 * 60 * 60);
        if (diffHours < 0.1) return msg.reply(`⏳ Mesin baru nyala, belum ada hasil.`);

        // Hitung BTC
        const earnedBTC = (user.mining.totalHash * BTC_PER_HASH_HOUR * diffHours);
        
        // Hitung Listrik
        let elecBill = user.mining.totalHash * ELECTRICITY_COST * diffHours;
        if (user.mining.upgrades.psu) elecBill *= 0.7; // Diskon PSU

        // Cek Saldo User untuk Bayar Listrik
        if (user.balance < elecBill) {
            // Kalau saldo kurang, potong dari hasil BTC (Dikonversi paksa)
            // Atau tolak klaim (Disini kita buat tolak biar user harus cari uang dulu)
            return msg.reply(`⚠️ *GAGAL KLAIM!* ⚠️\n\nTagihan listrik kamu: *Rp ${fmt(elecBill)}*\nSaldo Dompet: *Rp ${fmt(user.balance)}*\n\nKamu tidak mampu bayar listrik! Cari uang dulu (Rob/Farming) untuk menebus hasil mining.`);
        }

        // Eksekusi
        user.balance -= elecBill;
        user.crypto.btc = (user.crypto.btc || 0) + earnedBTC;
        user.mining.lastClaim = now;
        saveDB(db);

        const btcPrice = db.market?.forex?.usd ? (db.market.forex.usd * 63000) : 1500000000;
        const valueIdr = Math.floor(earnedBTC * btcPrice);

        return msg.reply(`✅ *PANEN SUKSES*\n\n📥 Masuk: *${earnedBTC.toFixed(8)} BTC* (Rp ${fmt(valueIdr)})\n💸 Bayar Listrik: -Rp ${fmt(elecBill)}\n\n_BTC sudah masuk wallet!_`);
    }

    // ============================================================
    // 🛒 SHOP (MARKET DINAMIS)
    // ============================================================
    if (command === 'shopminer' || command === 'belivga') {
        // Cek argumen beli
        if (args[0]) {
            const itemCode = args[0].toLowerCase();
            if (!HARDWARE[itemCode] || HARDWARE[itemCode].type === 'illegal') return msg.reply("❌ Barang tidak ditemukan di toko resmi.");
            
            const price = db.market.miningPrices[itemCode];
            if (user.balance < price) return msg.reply(`❌ Uang kurang! Harga saat ini: Rp ${fmt(price)}`);

            user.balance -= price;
            user.mining.racks.push(itemCode);
            saveDB(db);
            return msg.reply(`✅ Berhasil membeli **${HARDWARE[itemCode].name}** seharga Rp ${fmt(price)}`);
        }

        let txt = `🛒 *TOKO MINING RESMI* 🛒\n_Harga berubah setiap 2 jam!_\n\n`;
        for (let [code, hw] of Object.entries(HARDWARE)) {
            if (hw.type === 'legal') {
                const price = db.market.miningPrices[code];
                // Indikator Harga (Murah/Mahal)
                const diff = ((price - hw.basePrice) / hw.basePrice) * 100;
                let indicator = diff > 0 ? "📈 Mahal" : "📉 Diskon";
                if (Math.abs(diff) < 1) indicator = "⚖️ Normal";

                txt += `🔹 *${hw.name}* [${code}]\n`;
                txt += `   ⚡ ${hw.hashrate} MH/s\n`;
                txt += `   💰 Rp ${fmt(price)} (${indicator} ${diff.toFixed(1)}%)\n\n`;
            }
        }
        txt += `Cara beli: \`!belivga rtx4070\``;
        return msg.reply(txt);
    }

    // ============================================================
    // 🏴‍☠️ BLACK MARKET (RIG ILEGAL)
    // ============================================================
    if (command === 'blackmarket' || command === 'bm') {
        if (args[0]) {
            const itemCode = args[0].toLowerCase();
            if (!HARDWARE[itemCode] || HARDWARE[itemCode].type !== 'illegal') return msg.reply("❌ Barang ini tidak dijual disini.");
            
            // Harga BM Tetap (Flat Price)
            const price = HARDWARE[itemCode].basePrice;
            if (user.balance < price) return msg.reply(`❌ Uang kurang!`);

            user.balance -= price;
            user.mining.racks.push(itemCode);
            saveDB(db);
            return msg.reply(`🤫 *TRANSAKSI BERHASIL*\nKamu membeli **${HARDWARE[itemCode].name}**.\n⚠️ *Hati-hati!* Barang ini berisiko disita polisi saat cek status mining.`);
        }

        let txt = `🕵️ *BLACK MARKET* 🕵️\n_Barang kencang, murah, tapi RISIKO TINGGI._\n\n`;
        for (let [code, hw] of Object.entries(HARDWARE)) {
            if (hw.type === 'illegal') {
                txt += `🏴‍☠️ *${hw.name}* [${code}]\n`;
                txt += `   ⚡ ${hw.hashrate} MH/s (Kencang!)\n`;
                txt += `   💰 Rp ${fmt(hw.basePrice)}\n`;
                txt += `   ⚠️ Risiko Sita: ${(hw.risk * 100)}%\n\n`;
            }
        }
        txt += `Cara beli: \`!bm usb_miner\``;
        return msg.reply(txt);
    }

    // ============================================================
    // 🛠️ UPGRADE RIG
    // ============================================================
    if (command === 'upgrade') {
        if (args[0]) {
            const upg = args[0].toLowerCase();
            if (!UPGRADES[upg]) return msg.reply("❌ Upgrade tidak ditemukan.");
            if (user.mining.upgrades[upg]) return msg.reply("❌ Sudah punya upgrade ini.");
            if (user.balance < UPGRADES[upg].price) return msg.reply("❌ Uang kurang.");

            user.balance -= UPGRADES[upg].price;
            user.mining.upgrades[upg] = true;
            saveDB(db);
            return msg.reply(`✅ Upgrade **${UPGRADES[upg].name}** terpasang!`);
        }

        let txt = `🛠️ *BENGKEL UPGRADE*\n\n`;
        for (let [code, item] of Object.entries(UPGRADES)) {
            const status = user.mining.upgrades[code] ? "✅ TERPASANG" : `💰 Rp ${fmt(item.price)}`;
            txt += `🔹 *${item.name}* [${code}]\n`;
            txt += `   ℹ️ ${item.effect}\n`;
            txt += `   ${status}\n\n`;
        }
        txt += `Cara: \`!upgrade cooling\``;
        return msg.reply(txt);
    }

    // ============================================================
    // ⚔️ PVP HACKING
    // ============================================================
    if (command === 'hack') {
        if (!args[0]) return msg.reply("❌ Tag target yg mau di-hack. Contoh: `!hack @user`");
        
        // Cari Target
        const targetNumber = args[0].replace(/[^0-9]/g, '');
        const targetId = targetNumber + "@s.whatsapp.net";
        const targetUser = db.users[targetId];

        if (!targetUser || !targetUser.mining || targetUser.mining.totalHash === 0) {
            return msg.reply("❌ Target tidak menambang atau tidak ditemukan.");
        }

        // Cek Firewall Target
        if (targetUser.mining.upgrades.firewall) {
            return msg.reply(`🛡️ *GAGAL!* Target menggunakan Firewall canggih. Seranganmu mental!`);
        }

        // Cek Cooldown Penyerang (Misal 1 jam sekali)
        if (user.lastHack && (now - user.lastHack < 60 * 60 * 1000)) {
            return msg.reply("⏳ Tunggu 1 jam sebelum hacking lagi.");
        }

        // Mini Game Hacking (Chance 40%)
        if (Math.random() < 0.4) {
            // Sukses
            const stealAmount = (targetUser.crypto.btc || 0) * 0.05; // Curi 5%
            if (stealAmount <= 0) return msg.reply("❌ Wallet target kosong.");

            targetUser.crypto.btc -= stealAmount;
            user.crypto.btc = (user.crypto.btc || 0) + stealAmount;
            user.lastHack = now;
            saveDB(db);

            return msg.reply(`👨‍💻 *HACK SUKSES!* 👨‍💻\nKamu berhasil mencuri *${stealAmount.toFixed(8)} BTC* dari ${targetUser.name}!`);
        } else {
            // Gagal & Denda
            const fine = 500000;
            user.balance = Math.max(0, user.balance - fine);
            user.lastHack = now;
            saveDB(db);
            return msg.reply(`🚨 *HACK GAGAL!* 🚨\nIP kamu terlacak! Kamu didenda *Rp ${fmt(fine)}* oleh Cyber Police.`);
        }
    }

    // ============================================================
    // 🏆 LEADERBOARD MINER
    // ============================================================
    if (command === 'topminer') {
        const top = Object.values(db.users)
            .filter(u => u.crypto && u.crypto.btc > 0)
            .sort((a, b) => b.crypto.btc - a.crypto.btc)
            .slice(0, 10);

        let txt = `🏆 *TOP 10 BITCOIN HOLDER* 🏆\n\n`;
        top.forEach((u, i) => {
            txt += `${i+1}. ${u.name} — ₿ ${u.crypto.btc.toFixed(6)}\n`;
        });
        return msg.reply(txt);
    }
};
