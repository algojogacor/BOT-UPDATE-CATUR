const { saveDB } = require('../helpers/database');

// HELPER FORMAT ANGKA
const fmt = (num) => Math.floor(Number(num)).toLocaleString('id-ID');
const safeInt = (val) => isNaN(Number(val)) ? 0 : Number(val);

// ==================================================================
// 💰 DATA REFERENSI HARGA (UNTUK MENGHITUNG KEKAYAAN)
// ==================================================================
// Harga ini disesuaikan dengan harga beli di fitur masing-masing

// 1. HARGA HEWAN (Ternak)
const ANIMAL_PRICES = {
    'ayam': 50000, 'gurame': 200000, 'kambing': 3000000,
    'sapi': 15000000, 'kuda': 40000000, 'unta': 80000000
};

// 2. HARGA MESIN (Farming/Industri)
const MACHINE_PRICES = {
    'gilingan': 50000000, 'popcorn_maker': 80000000,
    'penggorengan': 150000000, 'roaster': 300000000, 'penyulingan': 1000000000
};

// 3. HARGA HASIL TANI (Estimasi Rata-rata Pasar)
const CROP_PRICES = {
    'padi': 2300000, 'jagung': 6500000, 'bawang': 14000000, 
    'kopi': 35000000, 'sawit': 80000000,
    'beras': 6000000, 'popcorn': 18000000, 'bawang_goreng': 40000000,
    'kopi_bubuk': 100000000, 'minyak': 250000000
};

// 4. HARGA MINING RIG
const MINING_PRICES = { 
    'rtx4070': 20000000, 'rtx4090': 50000000, 
    'dual4090': 80000000, 'asic': 100000000
};

// 5. LIST PROFESI (Untuk Display Name)
const JOB_TITLES = {
    'petani': "🌾 Petani", 'peternak': "🤠 Peternak", 'polisi': "👮 Polisi"
};

module.exports = async (command, args, msg, user, db, chat, sock) => {
    
    // --- FUNGSI MENGHITUNG TOTAL KEKAYAAN (NET WORTH) ---
    const calculateNetWorth = (userData) => {
        let total = 0;

        // 1. Uang Tunai & Bank
        total += safeInt(userData.balance);
        total += safeInt(userData.bank);

        // 2. Aset Crypto (Hitung pakai harga market real-time)
        if (userData.crypto) {
            for (let [coin, amt] of Object.entries(userData.crypto)) {
                let price = 0;
                if (db.market && db.market.prices && db.market.prices[coin]) {
                    price = db.market.prices[coin].price;
                }
                total += safeInt(amt) * price;
            }
        }

        // 3. Aset Saham (Portfolio)
        if (userData.portfolio) {
            for (let [code, stock] of Object.entries(userData.portfolio)) {
                // Utamakan harga market real-time, kalau error pakai harga beli rata-rata
                let price = stock.avg;
                if (db.stockMarket && db.stockMarket.prices && db.stockMarket.prices[code]) {
                    price = db.stockMarket.prices[code].price;
                }
                total += safeInt(stock.qty) * price;
            }
        }

        // 4. Aset Valas & Emas
        if (userData.forex) {
             for (let [code, qty] of Object.entries(userData.forex)) {
                 let price = 0;
                 if (db.market.forex && db.market.forex[code]) price = db.market.forex[code];
                 // Fallback harga jika DB belum update
                 if (price === 0 && code === 'usd') price = 16200;
                 if (price === 0 && code === 'eur') price = 17500;
                 if (price === 0 && code === 'jpy') price = 110;
                 if (price === 0 && code === 'emas') price = 1450000;
                 
                 total += safeInt(qty) * price;
             }
        }

        // 5. Aset Ternak (Nilai Hewan)
        if (userData.ternak) {
            userData.ternak.forEach(a => {
                total += (ANIMAL_PRICES[a.type] || 0); 
            });
        }
        
        // 6. Aset Industri (Mesin Pabrik)
        if (userData.farm?.machines) {
            userData.farm.machines.forEach(m => {
                total += (MACHINE_PRICES[m] || 0);
            });
        }

        // 7. Aset Mining (VGA/ASIC)
        if (userData.mining?.racks) {
            userData.mining.racks.forEach(m => {
                total += (MINING_PRICES[m] || 0);
            });
        }

        // 8. Gudang Hasil Panen (Inventory)
        if (userData.farm?.inventory) {
            for (let [item, qty] of Object.entries(userData.farm.inventory)) {
                // Cek harga pasar real-time kalau ada, kalau tidak pakai standar
                let price = db.market?.commodities?.[item] || CROP_PRICES[item] || 0;
                total += safeInt(qty) * price;
            }
        }

        // Kurangi Hutang
        total -= safeInt(userData.debt);

        return total;
    };

    const getTitle = (lvl) => {
        if (lvl >= 100) return "🐲 Dragon Slayer";
        if (lvl >= 50) return "👑 Sultan";
        if (lvl >= 30) return "🧛 Lord";
        if (lvl >= 20) return "⚔️ Commander";
        if (lvl >= 10) return "🛡️ Warrior";
        if (lvl >= 5) return "🗡️ Soldier";
        return "🥚 Warga Sipil";
    };

    // ==================================================================
    // 1. PROFILE USER (!me)
    // ==================================================================
    if (command === "me" || command === "profile" || command === "level") {
        const netWorth = calculateNetWorth(user);
        const jobTitle = user.job ? JOB_TITLES[user.job] : "Pengangguran";
        const nextLevelXP = user.level * 1000;
        
        // Hitung Aset Spesifik untuk Display
        let farmAsset = 0;
        if (user.farm?.machines) user.farm.machines.forEach(m => farmAsset += (MACHINE_PRICES[m] || 0));
        let miningAsset = 0;
        if (user.mining?.racks) user.mining.racks.forEach(m => miningAsset += (MINING_PRICES[m] || 0));
        
        let txt = `👤 *KARTU IDENTITAS* 👤\n`;
        txt += `━━━━━━━━━━━━━━━━━━━\n`;
        txt += `🏷️ Nama: *${user.name || msg.pushName}*\n`;
        txt += `💼 Profesi: *${jobTitle}*\n`;
        txt += `🎖️ Pangkat: ${getTitle(user.level)} (Lv.${user.level})\n`;
        txt += `✨ XP: ${Math.floor(user.xp)} / ${nextLevelXP}\n`;
        txt += `━━━━━━━━━━━━━━━━━━━\n`;
        txt += `💰 *RINCIAN KEKAYAAN*\n`;
        txt += `💵 Tunai: Rp ${fmt(user.balance)}\n`;
        txt += `🏦 Bank: Rp ${fmt(user.bank)}\n`;
        txt += `⛏️ Rig Mining: Rp ${fmt(miningAsset)}\n`;
        txt += `🏭 Mesin Pabrik: Rp ${fmt(farmAsset)}\n`;
        txt += `🐔 Hewan Ternak: ${user.ternak ? user.ternak.length : 0} Ekor\n`;
        if (user.debt > 0) txt += `⚠️ Hutang: -Rp ${fmt(user.debt)}\n`;
        txt += `━━━━━━━━━━━━━━━━━━━\n`;
        txt += `💎 *NET WORTH (BERSIH)*\n`;
        txt += `Rp ${fmt(netWorth)}\n`;
        txt += `━━━━━━━━━━━━━━━━━━━\n`;
        
        if (user.jailExpired > Date.now()) {
            txt += `⚠️ *STATUS: DIPENJARA* ⛓️`;
        } else {
            txt += `✅ Status: Bebas & Sehat`;
        }

        return msg.reply(txt);
    }

    // ==================================================================
    // 2. LEADERBOARD (!rank) - MENGHITUNG KEKAYAAN ASLI
    // ==================================================================
    if (command === "rank" || command === "top" || command === "leaderboard") {
        let targetIds = [];
        let titleHeader = "";

        try {
            if (chat.isGroup) {
                // Versi Grup
                if (!sock) return msg.reply("❌ Error Sistem: Socket.");
                const metadata = await sock.groupMetadata(chat.id._serialized);
                targetIds = metadata.participants.map(p => p.id);
                titleHeader = `🏆 *TOP SULTAN (GRUP)* 🏆\n_(Total Aset + Uang - Hutang)_`;
            } else {
                // Versi Global
                targetIds = Object.keys(db.users);
                titleHeader = `🌍 *TOP SULTAN GLOBAL* 🏆`;
            }

            let allPlayers = targetIds
                .filter(id => db.users[id])
                .map(id => {
                    const data = db.users[id];
                    return {
                        id: id,
                        name: data.name || "Warga",
                        job: data.job ? (JOB_TITLES[data.job] || "Pengangguran") : "Pengangguran",
                        netWorth: calculateNetWorth(data) // RUMUS BARU
                    };
                });

            allPlayers.sort((a, b) => b.netWorth - a.netWorth);
            const top10 = allPlayers.slice(0, 10);
            
            let text = `${titleHeader}\n━━━━━━━━━━━━━━━━━\n`;
            
            if (top10.length === 0) text += "_Belum ada data._";
            else {
                top10.forEach((u, i) => {
                    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
                    const mentionId = `@${u.id.split('@')[0]}`;
                    text += `${medal} ${mentionId}\n   └ 💼 ${u.job} | 💎 Rp ${fmt(u.netWorth)}\n`;
                });
            }

            const myRank = allPlayers.findIndex(u => u.id === (msg.author || msg.from));
            if (myRank !== -1) text += `━━━━━━━━━━━━━━━━━\n👤 Posisi Kamu: #${myRank + 1}`;

            if (chat.sendMessage) await chat.sendMessage({ text: text, mentions: top10.map(u => u.id) });
            else await sock.sendMessage(msg.key.remoteJid, { text: text, mentions: top10.map(u => u.id) }, { quoted: msg });

        } catch (err) {
            console.error("Error Rank:", err);
            msg.reply("⚠️ Gagal mengambil rank.");
        }
    }
    
    // ==================================================================
    // 3. INVENTORY LENGKAP (!inv)
    // ==================================================================
    if (command === "inv" || command === "inventory" || command === "tas") {
        let txt = `🎒 *INVENTORY PLAYER*\n━━━━━━━━━━━━━━━━━\n`;
        
        // 1. Item Dasar (Gacha/Shop)
        const counts = {};
        if (user.inv) user.inv.forEach(x => { counts[x] = (counts[x] || 0) + 1; });
        if (Object.keys(counts).length > 0) {
            txt += `📦 *BARANG UMUM:*\n`;
            for (let [k, v] of Object.entries(counts)) txt += `- ${k.toUpperCase()} (x${v})\n`;
            txt += `\n`;
        }

        // 2. Hasil Panen
        if (user.farm && user.farm.inventory) {
            let hasFarm = false;
            let subTxt = `🌾 *GUDANG PERTANIAN:*\n`;
            for (let [k, v] of Object.entries(user.farm.inventory)) {
                if (v > 0) {
                    subTxt += `- ${k.toUpperCase()} (${v} Unit)\n`;
                    hasFarm = true;
                }
            }
            if (hasFarm) txt += subTxt + `\n`;
        }

        // 3. Pakan Ternak
        if (user.ternak_inv) {
            let hasFeed = false;
            let subTxt = `🥫 *GUDANG PAKAN:*\n`;
            for (let [k, v] of Object.entries(user.ternak_inv)) {
                if (v > 0) {
                    subTxt += `- ${k.toUpperCase()} (${v})\n`;
                    hasFeed = true;
                }
            }
            if (hasFeed) txt += subTxt + `\n`;
        }

        // 4. Valas & Emas
        if (user.forex) {
            let hasForex = false;
            let subTxt = `💱 *BRANKAS VALAS:*\n`;
            if (user.forex.usd > 0) { subTxt += `- USD: $${fmt(user.forex.usd)}\n`; hasForex = true; }
            if (user.forex.eur > 0) { subTxt += `- EUR: €${fmt(user.forex.eur)}\n`; hasForex = true; }
            if (user.forex.jpy > 0) { subTxt += `- JPY: ¥${fmt(user.forex.jpy)}\n`; hasForex = true; }
            if (user.forex.emas > 0) { subTxt += `- EMAS: ${fmt(user.forex.emas)} gram\n`; hasForex = true; }
            if (hasForex) txt += subTxt;
        }

        return msg.reply(txt);
    }

    // ==================================================================
    // 4. QUEST & CLAIM (Biarkan tetap ada)
    // ==================================================================
    // ... Copy paste logika Quest & Claim dari kode sebelumnya jika mau ...
    if (command === "quest" || command === "misi") {
        if (!user.quest) return msg.reply("❌ Data quest belum reset.");
        let text = `📜 *MISI HARIAN*\n📅 ${today}\n\n`;
        user.quest.daily.forEach(q => {
            const percent = Math.min(100, Math.floor((q.progress / q.target) * 100));
            const status = q.claimed ? "✅" : (percent >= 100 ? "🎁" : "🔄");
            text += `${status} *${q.name}* (${q.progress}/${q.target})\n   Reward: Rp ${fmt(q.reward)}\n`;
        });
        text += `\n💡 Ketik *!claim* untuk ambil hadiah.`;
        return msg.reply(text);
    }

    if (command === "claim") {
        if (!user.quest) return;
        let totalGift = 0;
        let count = 0;
        user.quest.daily.forEach(q => {
            if (q.progress >= q.target && !q.claimed) {
                q.claimed = true; totalGift += q.reward; count++;
            }
        });
        if (count === 0) return msg.reply("❌ Belum ada misi selesai.");
        user.balance += totalGift;
        saveDB(db);
        return msg.reply(`🎉 *KLAIM SUKSES*\n💰 Dapat: Rp ${fmt(totalGift)}`);
    }
};
