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
    // LEGAL
    'rtx4070': { name: "🟢 RTX 4070 Ti", basePrice: 20000000, hashrate: 160, type: 'legal' },
    'rtx4090': { name: "🔵 RTX 4090 OC", basePrice: 50000000, hashrate: 400, type: 'legal' },
    'dual4090': { name: "🟣 Dual 4090", basePrice: 80000000, hashrate: 640, type: 'legal' },
    'asic': { name: "🟠 Antminer S19", basePrice: 100000000, hashrate: 800, type: 'legal' },
    
    // BLACK MARKET (ILEGAL)
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
// 🔄 FUNGSI BANTUAN (LOGIC)
// ============================================================

// 1. Hitung Hashrate & Cek Ilegal (Real-time)
const recalculateStats = (userData) => {
    let total = 0;
    let illegal = 0;
    // Pastikan array racks ada
    if (userData.mining && Array.isArray(userData.mining.racks)) {
        userData.mining.racks.forEach(id => {
            if (HARDWARE[id]) {
                total += HARDWARE[id].hashrate;
                if (HARDWARE[id].type === 'illegal') illegal++;
            }
        });
    }
    userData.mining.totalHash = total;
    return { total, illegal };
};

// 2. Update Harga Market Dinamis
const updateMarketPrices = (db) => {
    const now = Date.now();
    // Update setiap 1 Jam
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
    // DAFTAR SEMUA COMMAND AGAR AKTIF
    const validCommands = [
        'mining', 'miner', 
        'belivga', 'buyvga', 'shopminer', 
        'claimmining', 
        'blackmarket', 'bm', 
        'upgrade', 
        'hack', 
        'topminer', 'tophash',
        'panduanminer', 'rulesminer', 'guide'
    ];
    
    if (!validCommands.includes(command)) return;

    const now = Date.now();
    updateMarketPrices(db);

    // ============================================================
    // 🚑 AUTO-FIX DATA (PENTING BUAT USER LAMA)
    // ============================================================
    if (!user.mining) user.mining = { racks: [], lastClaim: now, totalHash: 0, upgrades: {} };
    // Fix Crash: Pastikan upgrades ada objectnya
    if (!user.mining.upgrades) user.mining.upgrades = {}; 
    // Fix Crash: Pastikan racks ada arraynya
    if (!user.mining.racks) user.mining.racks = [];
    
    if (!user.crypto) user.crypto = { btc: 0 };

    // HITUNG ULANG STATS SETIAP JALAN COMMAND
    const { total: totalHash, illegal: illegalCount } = recalculateStats(user);

    // ============================================================
    // 📚 PANDUAN (!panduanminer)
    // ============================================================
    if (command === 'panduanminer' || command === 'rulesminer' || command === 'guide') {
        let txt = `📘 *PANDUAN MINING* 📘\n`;
        txt += `_Baca biar gak rugi bandar!_\n\n`;
        txt += `⚡ *LISTRIK:* Mining butuh biaya Rp 50/Hash/Jam. Bayar pas claim. Kalau saldo kurang, gak bisa panen.\n`;
        txt += `🚔 *POLISI:* Alat Black Market (BM) bisa disita polisi sewaktu-waktu. Risiko ditanggung penumpang.\n`;
        txt += `📉 *MARKET:* Harga VGA berubah tiap 2 jam. Beli pas murah!\n`;
        txt += `⚔️ *PVP:* Bisa hack user lain (curi 5% BTC) kalau mereka gak punya Firewall.\n`;
        txt += `🏆 *RANKING:* \`!topminer\` (Saldo BTC) & \`!tophash\` (Kekuatan Alat).`;
        return msg.reply(txt);
    }

    // ============================================================
    // 🖥️ DASHBOARD (!mining)
    // ============================================================
    if (command === 'mining' || command === 'miner') {
        // 1. CEK RAZIA POLISI
        if (illegalCount > 0) {
            const chance = 0.05 * illegalCount; // 5% per alat ilegal
            if (Math.random() < chance) {
                user.mining.racks = user.mining.racks.filter(id => HARDWARE[id].type !== 'illegal');
                recalculateStats(user); // Update hash langsung
                saveDB(db);
                return msg.reply(`🚔 *DORRR!! RAZIA POLISI!* 🚔\n\nSemua alat Black Market kamu disita karena ilegal!\nHashrate kamu anjlok. Sabar ya bos.`);
            }
        }

        // 2. RANDOM EVENT
        let eventMsg = "";
        if (totalHash > 0 && Math.random() < 0.2) { 
            const ev = Math.random() < 0.5 ? 'overheat' : 'lucky';
            
            // Cek Cooling (Aman karena upgrades udah di-init di atas)
            if (ev === 'overheat' && !user.mining.upgrades.cooling) {
                user.mining.lastClaim = now; 
                eventMsg = `🔥 *OVERHEAT!* Mesin kepanasan, waktu mining reset.`;
            } else if (ev === 'lucky') {
                const bonus = 0.00005;
                user.crypto.btc += bonus;
                eventMsg = `🍀 *LUCKY BLOCK!* Nemu bonus +${bonus} BTC.`;
            }
            if (eventMsg) saveDB(db);
        }

        const diffHours = (now - user.mining.lastClaim) / (1000 * 60 * 60);
        let pendingBTC = (totalHash * BTC_PER_HASH_HOUR * diffHours);
        let elecCost = totalHash * ELECTRICITY_COST * diffHours;
        
        // Cek PSU (Aman)
        if (user.mining.upgrades.psu) elecCost *= 0.7;

        const btcPrice = db.market?.forex?.usd ? (db.market.forex.usd * 63000) : 1500000000;
        const estRupiah = Math.floor(pendingBTC * btcPrice);

        let txt = `⛏️ *DASHBOARD MINING*\n`;
        txt += `👤 Miner: ${user.name}\n`;
        txt += `⚡ Hashrate: ${fmt(totalHash)} MH/s\n`;
        txt += `🔌 Listrik: -Rp ${fmt(elecCost)}\n`;
        txt += `━━━━━━━━━━━━━━━━\n`;
        txt += `💎 Hasil: ${pendingBTC.toFixed(8)} BTC\n`;
        txt += `💰 Estimasi: Rp ${fmt(estRupiah - elecCost)}\n`;
        if (eventMsg) txt += `\n⚠️ ${eventMsg}`;
        
        let upg = [];
        if(user.mining.upgrades.cooling) upg.push("❄️");
        if(user.mining.upgrades.psu) upg.push("⚡");
        if(user.mining.upgrades.firewall) upg.push("🛡️");
        txt += `\n🔧 Upgrade: ${upg.length>0 ? upg.join(" ") : "-"}`;

        return msg.reply(txt);
    }

    // ============================================================
    // 💰 CLAIM (!claimmining)
    // ============================================================
    if (command === 'claimmining') {
        if (totalHash === 0) return msg.reply("❌ Gak punya alat.");
        const diffHours = (now - user.mining.lastClaim) / (1000 * 60 * 60);
        if (diffHours < 0.01) return msg.reply(`⏳ Sabar, mesin baru jalan.`);

        let earnedBTC = (totalHash * BTC_PER_HASH_HOUR * diffHours);
        let elecBill = totalHash * ELECTRICITY_COST * diffHours;
        
        // Cek PSU
        if (user.mining.upgrades.psu) elecBill *= 0.7;

        if (user.balance < elecBill) {
            return msg.reply(`⚠️ *GAGAL KLAIM!*\nListrik: Rp ${fmt(elecBill)}\nSaldo: Rp ${fmt(user.balance)}\n\nBayar listrik dulu bos!`);
        }

        user.balance -= elecBill;
        user.crypto.btc = (user.crypto.btc || 0) + earnedBTC;
        user.mining.lastClaim = now;
        saveDB(db);

        return msg.reply(`✅ *PANEN SUKSES*\n+ ${earnedBTC.toFixed(8)} BTC\n- Rp ${fmt(elecBill)} (Listrik)`);
    }

    // ============================================================
    // 🛒 BELI LEGAL (!belivga)
    // ============================================================
    if (command === 'shopminer' || command === 'belivga' || command === 'buyvga') {
        if (args[0]) {
            const itemCode = args[0].toLowerCase();
            if (!HARDWARE[itemCode] || HARDWARE[itemCode].type === 'illegal') return msg.reply("❌ Barang tidak ada.");
            
            const price = db.market.miningPrices[itemCode];
            if (user.balance < price) return msg.reply(`❌ Uang kurang!`);

            user.balance -= price;
            user.mining.racks.push(itemCode);
            recalculateStats(user); // UPDATE HASH
            saveDB(db);
            return msg.reply(`✅ Beli **${HARDWARE[itemCode].name}** sukses!`);
        }

        let txt = `🛒 *TOKO MINING RESMI*\n_Harga berubah tiap jam!_\n\n`;
        for (let [code, hw] of Object.entries(HARDWARE)) {
            if (hw.type === 'legal') {
                const price = db.market.miningPrices[code];
                const diff = ((price - hw.basePrice) / hw.basePrice) * 100;
                let ind = diff > 0 ? "📈" : "📉";
                txt += `🔹 ${hw.name} [${code}]\n   ⚡ ${hw.hashrate} MH/s | 💰 Rp ${fmt(price)} (${ind} ${diff.toFixed(1)}%)\n\n`;
            }
        }
        txt += `Beli: \`!belivga rtx4070\``;
        return msg.reply(txt);
    }

    // ============================================================
    // 🏴‍☠️ BLACK MARKET (!bm)
    // ============================================================
    if (command === 'blackmarket' || command === 'bm') {
        if (args[0]) {
            const itemCode = args[0].toLowerCase();
            if (!HARDWARE[itemCode] || HARDWARE[itemCode].type !== 'illegal') return msg.reply("❌ Barang tidak ada.");
            
            const price = HARDWARE[itemCode].basePrice;
            if (user.balance < price) return msg.reply(`❌ Uang kurang!`);

            user.balance -= price;
            user.mining.racks.push(itemCode);
            recalculateStats(user); // UPDATE HASH
            saveDB(db);
            return msg.reply(`🤫 Transaksi sukses: **${HARDWARE[itemCode].name}**.`);
        }

        let txt = `🕵️ *BLACK MARKET*\n`;
        for (let [code, hw] of Object.entries(HARDWARE)) {
            if (hw.type === 'illegal') {
                txt += `🏴‍☠️ ${hw.name} [${code}]\n   ⚡ ${hw.hashrate} MH/s | 💰 Rp ${fmt(hw.basePrice)}\n   ⚠️ Risiko Sita: ${(hw.risk * 100)}%\n\n`;
            }
        }
        txt += `Beli: \`!bm usb_miner\``;
        return msg.reply(txt);
    }

    // ============================================================
    // 🛠️ UPGRADE (!upgrade)
    // ============================================================
    if (command === 'upgrade') {
        if (args[0]) {
            const upg = args[0].toLowerCase();
            if (!UPGRADES[upg]) return msg.reply("❌ Salah kode.");
            if (user.balance < UPGRADES[upg].price) return msg.reply("❌ Uang kurang.");

            user.balance -= UPGRADES[upg].price;
            user.mining.upgrades[upg] = true;
            saveDB(db);
            return msg.reply(`✅ Terpasang: ${UPGRADES[upg].name}`);
        }
        
        let txt = `🛠️ *UPGRADE*\n`;
        for (let [code, item] of Object.entries(UPGRADES)) {
            const st = user.mining.upgrades[code] ? "✅" : `💰 Rp ${fmt(item.price)}`;
            txt += `🔹 ${item.name} [${code}]\n   ℹ️ ${item.effect}\n   ${st}\n\n`;
        }
        return msg.reply(txt);
    }

    // ============================================================
    // ⚔️ HACK (!hack)
    // ============================================================
    if (command === 'hack') {
        if (!args[0]) return msg.reply("Tag user! `!hack @user`");
        const targetNumber = args[0].replace(/[^0-9]/g, '');
        const targetId = targetNumber + "@s.whatsapp.net";
        const targetUser = db.users[targetId];

        if (!targetUser || !targetUser.mining || targetUser.mining.totalHash === 0) return msg.reply("❌ Target bukan miner.");
        if (targetUser.mining.upgrades.firewall) return msg.reply("🛡️ Gagal! Target punya Firewall.");

        if (Math.random() < 0.4) {
            const steal = (targetUser.crypto.btc || 0) * 0.05;
            if (steal <= 0) return msg.reply("❌ Wallet target kosong.");
            targetUser.crypto.btc -= steal;
            user.crypto.btc = (user.crypto.btc || 0) + steal;
            saveDB(db);
            return msg.reply(`✅ *BERHASIL!* Mencuri ${steal.toFixed(8)} BTC.`);
        } else {
            const fine = 500000;
            user.balance = Math.max(0, user.balance - fine);
            saveDB(db);
            return msg.reply(`🚨 *GAGAL!* Denda Rp ${fmt(fine)}.`);
        }
    }

    // ============================================================
    // 🏆 LEADERBOARD (!topminer & !tophash)
    // ============================================================
    if (command === 'topminer') {
        const top = Object.values(db.users)
            .filter(u => u.crypto && u.crypto.btc > 0)
            .sort((a, b) => b.crypto.btc - a.crypto.btc)
            .slice(0, 10);
        let txt = `🏆 *TOP SALDO BITCOIN*\n`;
        top.forEach((u, i) => txt += `${i+1}. ${u.name} — ₿ ${u.crypto.btc.toFixed(6)}\n`);
        return msg.reply(txt);
    }

    if (command === 'tophash') {
        const top = Object.values(db.users)
            .filter(u => u.mining && u.mining.totalHash > 0)
            .sort((a, b) => b.mining.totalHash - a.mining.totalHash)
            .slice(0, 10);
        let txt = `⚡ *TOP KEKUATAN ALAT*\n`;
        top.forEach((u, i) => txt += `${i+1}. ${u.name} — ${fmt(u.mining.totalHash)} MH/s\n`);
        return msg.reply(txt);
    }
};
