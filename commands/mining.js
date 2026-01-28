const { saveDB } = require('../helpers/database');

// HELPER FORMAT ANGKA
const fmt = (num) => Math.floor(Number(num)).toLocaleString('id-ID');

// ============================================================
// ⚙️ KONFIGURASI HARDWARE
// ============================================================
const HARDWARE = {
    'rtx4070': { 
        name: "Rig Starter (RTX 4070 Ti)", 
        price: 20000000, 
        hashrate: 160,     
        desc: "Income: ~Rp 2 Juta/hari"
    }, 
    'rtx4090': { 
        name: "Rig Gaming (RTX 4090 OC)", 
        price: 50000000, 
        hashrate: 400,     
        desc: "Income: ~Rp 5 Juta/hari" 
    },     
    'dual4090': { 
        name: "Dual Rig (2x RTX 4090)", 
        price: 80000000, 
        hashrate: 640,    
        desc: "Income: ~Rp 8 Juta/hari" 
    },   
    'asic': { 
        name: "ASIC Antminer S19 Pro", 
        price: 100000000, 
        hashrate: 800,    
        desc: "Income: ~Rp 10 Juta/hari" 
    } 
};

// ROI TARGET: ~10 HARI (Agresif tapi masih wajar)
// Rumus: 0.00000035 * 24 jam * 160 Hash * 1.5M = Rp 2.016.000
const BTC_PER_HASH_HOUR = 0.00000035; 

module.exports = async (command, args, msg, user, db) => {
    const validCommands = ['mining', 'miner', 'belivga', 'buyvga', 'claimmining', 'overclock', 'oc'];
    if (!validCommands.includes(command)) return;

    const now = Date.now();

    // INIT DATA
    if (!user.mining) {
        user.mining = { racks: [], lastClaim: now, totalHash: 0, ocEnd: 0 };
    }

    // ============================================================
    // 🖥️ STATUS RIG
    // ============================================================
    if (command === 'mining' || command === 'miner') {
        const m = user.mining;
        
        // Cek Status Overclock
        const isOC = now < m.ocEnd;
        const multiplier = isOC ? 2 : 1; // Kalau OC aktif, speed 2x
        
        // Hitung Pendapatan
        const diffHours = (now - m.lastClaim) / (1000 * 60 * 60);
        const pendingBTC = (m.totalHash * BTC_PER_HASH_HOUR * diffHours * multiplier);

        // Harga BTC (Asumsi 1.5M jika db market belum siap)
        const btcPrice = db.market?.forex?.usd ? (db.market.forex.usd * 63000) : 1500000000; 
        const estRupiah = Math.floor(pendingBTC * btcPrice);

        // Estimasi Harian
        const dailyBTC = m.totalHash * BTC_PER_HASH_HOUR * 24;
        const dailyRupiah = Math.floor(dailyBTC * btcPrice);

        let txt = `⛏️ *MINING FARM STATUS* ⛏️\n`;
        txt += `👤 Owner: ${user.name}\n`;
        txt += `⚡ Hashrate: ${fmt(m.totalHash)} MH/s\n`;
        if (isOC) txt += `🔥 *STATUS: OVERCLOCK AKTIF! (2x Cuan)* 🔥\n`;
        txt += `━━━━━━━━━━━━━━━━━━━\n`;
        txt += `⏳ *PENDAPATAN (UNCLAIMED)*\n`;
        txt += `⏱️ Jalan: ${diffHours.toFixed(2)} Jam\n`;
        txt += `₿ ${pendingBTC.toFixed(8)} BTC\n`;
        txt += `💰 Cairkan: Rp ${fmt(estRupiah)}\n`;
        txt += `━━━━━━━━━━━━━━━━━━━\n`;
        txt += `📈 *Potensi Harian (Normal):*\nRp ${fmt(dailyRupiah)} / hari\n`;
        
        // Inventory Ringkas
        if (m.racks.length > 0) {
            const counts = {};
            m.racks.forEach(x => { counts[x] = (counts[x] || 0) + 1; });
            txt += `\n🛒 *Alat:* `;
            const items = [];
            for (let [code, qty] of Object.entries(counts)) items.push(`${HARDWARE[code].name} (${qty})`);
            txt += items.join(", ");
        } else {
            txt += `\n_Belum punya alat._`;
        }

        txt += `\n\n💡 \`!belivga <tipe>\` : Beli alat\n💡 \`!claimmining\` : Panen\n🔥 \`!overclock\` : Genjot mesin (Berisiko!)`;
        return msg.reply(txt);
    }

    // ============================================================
    // 🔥 OVERCLOCK (Fitur Anti Bosan)
    // ============================================================
    if (command === 'overclock' || command === 'oc') {
        if (user.mining.racks.length === 0) return msg.reply("❌ Gak punya alat, apa yang mau di-overclock?");
        
        // Cek cooldown/aktif
        if (now < user.mining.ocEnd) {
            const sisa = Math.ceil((user.mining.ocEnd - now) / 60000);
            return msg.reply(`🔥 Mesin masih ngebut! Sisa durasi OC: ${sisa} menit.`);
        }

        // Paksa Claim Dulu (Penting)
        // Kita simpan hasil mining normal dulu sebelum mulai fase ngebut
        const diffHours = (now - user.mining.lastClaim) / (1000 * 60 * 60);
        const earnedBTC = (user.mining.totalHash * BTC_PER_HASH_HOUR * diffHours);
        if (!user.crypto) user.crypto = {};
        user.crypto.btc = (user.crypto.btc || 0) + earnedBTC;
        user.mining.lastClaim = now; // Reset timer ke sekarang

        // LOGIKA JUDI OVERCLOCK
        // Chance: 30% Meledak, 70% Sukses
        const chance = Math.random();

        if (chance < 0.3) {
            // MELEDAK! Hapus 1 VGA secara acak
            const lostIndex = Math.floor(Math.random() * user.mining.racks.length);
            const lostItemCode = user.mining.racks[lostIndex];
            const lostItemName = HARDWARE[lostItemCode].name;

            // Hapus dari array
            user.mining.racks.splice(lostIndex, 1);
            
            // Recalculate Hash
            let newHash = 0;
            user.mining.racks.forEach(code => newHash += HARDWARE[code].hashrate);
            user.mining.totalHash = newHash;

            saveDB(db);
            return msg.reply(`💥 *DUARRR!! VGA MELEDAK!* 💥\n\nKamu terlalu memaksa mesin!\n❌ *${lostItemName}* hangus terbakar dan hilang dari inventory.\n\n_Sabar bang, namanya juga usaha..._ 😭`);
        } else {
            // SUKSES
            // Set durasi OC selama 1 Jam
            user.mining.ocEnd = now + (60 * 60 * 1000); 
            saveDB(db);
            return msg.reply(`🚀 *OVERCLOCK SUKSES!* 🚀\n\nMesin bekerja **2x LEBIH CEPAT** selama 1 Jam ke depan!\nHashrate digandakan. Cuan deres bosku! 🔥`);
        }
    }

    // ============================================================
    // 🛒 BELI VGA
    // ============================================================
    if (command === 'belivga' || command === 'buyvga') {
        const type = args[0]?.toLowerCase();
        const qty = parseInt(args[1]) || 1;

        if (!type || !HARDWARE[type]) {
            let list = `🛒 *TOKO MINING SULTAN*\n`;
            list += `_ROI: ~10 Hari (Normal) / Cepat (Overclock)_\n\n`;
            for (let [code, hw] of Object.entries(HARDWARE)) {
                list += `🔹 *${hw.name}* [${code}]\n`;
                list += `   💰 Rp ${fmt(hw.price)}\n`;
                list += `   ⚡ ${hw.hashrate} MH/s\n`;
            }
            return msg.reply(list + `\nCara: \`!belivga rtx4070\``);
        }

        const hw = HARDWARE[type];
        const totalCost = hw.price * qty;

        if (user.balance < totalCost) return msg.reply(`❌ Uang kurang! Butuh Rp ${fmt(totalCost)}.`);

        // Force Claim
        const diffHours = (now - user.mining.lastClaim) / (1000 * 60 * 60);
        // Cek apakah lagi OC?
        const isOC = now < user.mining.ocEnd;
        const multiplier = isOC ? 2 : 1;
        
        const earnedBTC = (user.mining.totalHash * BTC_PER_HASH_HOUR * diffHours * multiplier);
        if (!user.crypto) user.crypto = {};
        user.crypto.btc = (user.crypto.btc || 0) + earnedBTC;
        user.mining.lastClaim = now; 

        user.balance -= totalCost;
        for (let i = 0; i < qty; i++) user.mining.racks.push(type);
        
        // Recalculate
        let newHash = 0;
        user.mining.racks.forEach(code => newHash += HARDWARE[code].hashrate);
        user.mining.totalHash = newHash;

        saveDB(db);
        return msg.reply(`✅ *SUKSES MERAKIT!*\nBeli ${qty}x ${hw.name}.\n⚡ Total Hashrate: ${fmt(newHash)} MH/s.`);
    }

    // ============================================================
    // 💰 CLAIM HASIL
    // ============================================================
    if (command === 'claimmining') {
        if (user.mining.totalHash === 0) return msg.reply("❌ Belum punya mesin.");

        const diffHours = (now - user.mining.lastClaim) / (1000 * 60 * 60);
        if (diffHours < 0.05) return msg.reply(`⏳ Tunggu bentar, mesin baru jalan.`);

        // Logika OC saat Claim
        // Sederhana: Kita asumsikan status OC saat claim berlaku untuk seluruh durasi pending 
        // (Atau bisa dibuat kompleks, tapi ini cukup untuk WA bot)
        const isOC = now < user.mining.ocEnd;
        const multiplier = isOC ? 2 : 1;

        const earnedBTC = (user.mining.totalHash * BTC_PER_HASH_HOUR * diffHours * multiplier);
        
        if (!user.crypto) user.crypto = {};
        user.crypto.btc = (user.crypto.btc || 0) + earnedBTC;

        user.mining.lastClaim = now;
        saveDB(db);

        const btcPrice = db.market?.forex?.usd ? (db.market.forex.usd * 63000) : 1500000000; 
        const estIdr = Math.floor(earnedBTC * btcPrice);
        const status = isOC ? "🔥 (OVERCLOCK 2x)" : "";

        return msg.reply(`⛏️ *PANEN BERHASIL* ${status}\n\n💰 Dapat: *${earnedBTC.toFixed(8)} BTC*\n💵 Nilai: Rp ${fmt(estIdr)}\n⏱️ Durasi: ${diffHours.toFixed(2)} Jam\n\n_BTC sudah diamankan!_`);
    }
};
