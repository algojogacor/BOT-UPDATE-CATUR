const { saveDB } = require('../helpers/database');

// ==========================================
// ⚙️ KONFIGURASI PABRIK & WAKTU
// ==========================================
const CONFIG = {
    // Definisi Mesin: Harga & Waktu (Real-Time)
    LINES: {
        'ayam':    { name: '🏭 Lini Unggas', cost: 15_000_000, cooldown: 15 * 60 * 1000 },   // 15 Menit
        'gurame':  { name: '🏭 Lini Perikanan', cost: 25_000_000, cooldown: 30 * 60 * 1000 },   // 30 Menit
        'kambing': { name: '🏭 Lini Kambing', cost: 50_000_000, cooldown: 60 * 60 * 1000 },   // 1 Jam
        'sapi':    { name: '🏭 Lini Sapi', cost: 100_000_000, cooldown: 2 * 60 * 60 * 1000 }, // 2 Jam
        'kuda':    { name: '🏭 Lini Kuda', cost: 250_000_000, cooldown: 4 * 60 * 60 * 1000 }, // 4 Jam
        'unta':    { name: '🏭 Lini Sultan', cost: 500_000_000, cooldown: 6 * 60 * 60 * 1000 }  // 6 Jam
    },
    oprCost: 1_000_000,    // Biaya Listrik
    taxRate: 0.05,         // Pajak Jual
    breakdownChance: 0.02, // Risiko Meledak
    repairCost: 5_000_000, // Biaya Service
    staminaCost: 10,       // Stamina per aksi
    maxStamina: 100,       // Max Stamina
    coffeePrice: 1_000_000,// Harga Kopi
    coffeeRegen: 50,       // Regen Stamina Kopi
    weekendBonus: 1.10     // Bonus Yield Weekend
};

// ==========================================
// 📚 DATA RESEP (TIER 1, 2, & 3)
// ==========================================
const RECIPES = {
    // --- TIER 1 (HEWAN -> BAHAN) ---
    'ayam':    { tier: 1, line: 'ayam', outputCode: 'nugget', outputName: '🍗 Chicken Nugget', yield: 0.7, price: 100000 },
    'gurame':  { tier: 1, line: 'gurame', outputCode: 'fillet', outputName: '🍣 Fillet Ikan', yield: 0.6, price: 300000 },
    'kambing': { tier: 1, line: 'kambing', outputCode: 'giling_kambing', outputName: '🥩 Daging Giling', yield: 0.65, price: 200000 },
    'sapi':    { tier: 1, line: 'sapi', outputCode: 'wagyu', outputName: '🥩 Wagyu A5 Cut', yield: 0.7, price: 90000 }, 
    'kuda':    { tier: 1, line: 'kuda', outputCode: 'sosis_kuda', outputName: '🌭 Sosis Kuda', yield: 0.7, price: 350000 },
    'unta':    { tier: 1, line: 'unta', outputCode: 'susu_unta', outputName: '🥛 Susu Unta Bubuk', yield: 0.5, price: 400000 },

    // --- TIER 2 (BAHAN -> MASAKAN) ---
    'nugget':         { tier: 2, line: 'ayam', outputCode: 'burger', outputName: '🍔 Burger Ayam', batchSize: 5, yield: 1.2, price: 180000 },
    'fillet':         { tier: 2, line: 'gurame', outputCode: 'fish_chips', outputName: '🍱 Fish & Chips', batchSize: 5, yield: 1.1, price: 550000 },
    'giling_kambing': { tier: 2, line: 'kambing', outputCode: 'kebab', outputName: '🌯 Kebab Turki', batchSize: 10, yield: 1.0, price: 350000 },
    'wagyu':          { tier: 2, line: 'sapi', outputCode: 'steak', outputName: '🍲 Steak House', batchSize: 10, yield: 0.9, price: 180000 },
    'sosis_kuda':     { tier: 2, line: 'kuda', outputCode: 'pizza_kuda', outputName: '🍕 Pizza Salami', batchSize: 5, yield: 1.5, price: 500000 },
    'susu_unta':      { tier: 2, line: 'unta', outputCode: 'suplemen', outputName: '💊 Suplemen Vitalitas', batchSize: 2, yield: 0.8, price: 900000 },

    // --- TIER 3 (LUXURY) ---
    'burger':     { tier: 3, line: 'ayam', outputCode: 'happy_meal', outputName: '🍟 Paket Franchise', batchSize: 5, yield: 1.0, price: 350000 },
    'fish_chips': { tier: 3, line: 'gurame', outputCode: 'sushi_platter', outputName: '🍱 Sushi Platter', batchSize: 5, yield: 1.0, price: 900000 },
    'kebab':      { tier: 3, line: 'kambing', outputCode: 'kambing_guling', outputName: '🍖 Kambing Guling', batchSize: 5, yield: 1.0, price: 600000 },
    'steak':      { tier: 3, line: 'sapi', outputCode: 'beef_wellington', outputName: '🥂 Beef Wellington', batchSize: 5, yield: 1.0, price: 250000 },
    'pizza_kuda': { tier: 3, line: 'kuda', outputCode: 'lasagna', outputName: '🍝 Lasagna Premium', batchSize: 5, yield: 1.0, price: 800000 },
    'suplemen':   { tier: 3, line: 'unta', outputCode: 'elixir', outputName: '🧪 Elixir Keabadian', batchSize: 2, yield: 1.0, price: 1800000 }
};

// ==========================================
// 🛠️ HELPER FUNCTIONS
// ==========================================
const getDynamicPrice = (basePrice) => {
    const hour = new Date().getHours();
    const factor = Math.cos(hour * 1.5) * (basePrice * 0.15); 
    return Math.floor(basePrice + factor);
};
const fmt = (num) => Math.floor(Number(num)).toLocaleString('id-ID');
const createProgressBar = (current, max) => {
    const percent = Math.min(Math.floor((current / max) * 10), 10);
    return '▰'.repeat(percent) + '▱'.repeat(10 - percent);
};

// ==========================================
// 🚀 MAIN MODULE
// ==========================================
module.exports = async (command, args, msg, user, db, sock) => {
    const validCommands = [
        'pabrik', 'bangunpabrik', 'rekrut', 'pecat', 'resign', 
        'buat', // <--- SUDAH DIGANTI DARI OLAH
        'gudang', 'jualproduk', 'service', 'ngopi', 'makan',
        'leaderboard', 'topkorporat', 'cekpasar', 
        'pabrikhelp', 'panduanpabrik'
    ];
    if (!validCommands.includes(command)) return;

    if (!db.factories) db.factories = {};
    if (!db.workers) db.workers = {};
    if (!db.locks) db.locks = {}; 

    const senderId = msg.sender;
    const now = Date.now();

    // ============================================================
    // 📖 1. PANDUAN LENGKAP / HELP
    // ============================================================
    if (command === 'pabrikhelp' || command === 'panduanpabrik' || (command === 'pabrik' && args[0] === 'help')) {
        const formatTime = (ms) => {
            const min = ms / 60000;
            return min >= 60 ? `${min/60} Jam` : `${min} Mnt`;
        };

        let txt = `🏭 *GRAND PANDUAN PABRIK & HILIRISASI* 🏭\n`;
        txt += `_Panduan lengkap penguasa industri tier 1-3._\n\n`;

        txt += `🏗️ *INVESTASI MESIN (LINI PRODUKSI)*\n`;
        // Loop otomatis dari CONFIG
        for (let k in CONFIG.LINES) {
            const line = CONFIG.LINES[k];
            txt += `▪️ *${line.name.replace('🏭 ', '')}*: Rp ${fmt(line.cost)} (⏳ ${formatTime(line.cooldown)})\n`;
        }
        txt += `➤ Beli: \`!bangunpabrik <jenis>\` (Cth: !bangunpabrik sapi)\n\n`;

        txt += `📜 *POHON RESEP (HILIRISASI)*\n`;
        txt += `_Tier 1 (Bahan) ➡️ Tier 2 (Masakan) ➡️ Tier 3 (Luxury)_\n`;
        txt += `_Gunakan kode di sebelah kiri untuk command buat._\n\n`;

        txt += `🐔 *AYAM*\n├ \`ayam\` ➡️ Nugget (T1)\n├ \`nugget\` ➡️ Burger (T2)\n└ \`burger\` ➡️ Paket Franchise (T3)\n\n`;
        txt += `🐟 *GURAME*\n├ \`gurame\` ➡️ Fillet (T1)\n├ \`fillet\` ➡️ Fish & Chips (T2)\n└ \`fish_chips\` ➡️ Sushi Platter (T3)\n\n`;
        txt += `🐐 *KAMBING*\n├ \`kambing\` ➡️ Daging Giling (T1)\n├ \`giling_kambing\` ➡️ Kebab (T2)\n└ \`kebab\` ➡️ Kambing Guling (T3)\n\n`;
        txt += `🐄 *SAPI*\n├ \`sapi\` ➡️ Wagyu (T1)\n├ \`wagyu\` ➡️ Steak (T2)\n└ \`steak\` ➡️ Beef Wellington (T3)\n\n`;
        txt += `🐎 *KUDA*\n├ \`kuda\` ➡️ Sosis (T1)\n├ \`sosis_kuda\` ➡️ Pizza (T2)\n└ \`pizza_kuda\` ➡️ Lasagna (T3)\n\n`;
        txt += `🐫 *UNTA*\n├ \`unta\` ➡️ Susu Bubuk (T1)\n├ \`susu_unta\` ➡️ Suplemen (T2)\n└ \`suplemen\` ➡️ Elixir (T3)\n\n`;

        txt += `👮 *PEMBAGIAN TUGAS*\n`;
        txt += `👑 *BOS (OWNER)*\n`;
        txt += `├ \`!bangunpabrik <jenis>\` : Beli mesin.\n`;
        txt += `├ \`!rekrut @tag\` : Cari karyawan.\n`;
        txt += `├ \`!pecat @tag\` : Pecat karyawan.\n`;
        txt += `├ \`!gudang\` : Cek stok barang jadi.\n`;
        txt += `├ \`!jualproduk <kode>\` : Cairkan stok jadi uang.\n`;
        txt += `└ \`!service\` : Perbaiki mesin meledak.\n\n`;

        txt += `👷 *KARYAWAN (WORKER)*\n`;
        txt += `├ \`!pabrik\` : Cek stamina & antrian mesin.\n`;
        txt += `├ \`!buat <kode> <jumlah>\` : Kerja (Max 3).\n`;
        txt += `├ \`!ngopi\` : Isi 50 stamina (Bayar 1Jt).\n`;
        txt += `└ \`!resign\` : Keluar dari pabrik.\n\n`;
        
        return msg.reply(txt);
    }

    // ============================================================
    // 🏗️ 2. BANGUN MESIN
    // ============================================================
    if (command === 'bangunpabrik') {
        const type = args[0]?.toLowerCase();
        
        if (!type || !CONFIG.LINES[type]) {
            let txt = `❌ Tipe mesin salah. Pilih salah satu:\n`;
            for (let k in CONFIG.LINES) txt += `➤ \`!bangunpabrik ${k}\` (Rp ${fmt(CONFIG.LINES[k].cost)})\n`;
            return msg.reply(txt);
        }

        const machineCost = CONFIG.LINES[type].cost;

        if (!db.factories[senderId]) {
            db.factories[senderId] = { 
                level: 1, exp: 0, employees: [], inventory: {}, 
                activeLines: [], isBroken: false, createdAt: now 
            };
        }
        const factory = db.factories[senderId];

        if (factory.activeLines.includes(type)) return msg.reply(`❌ Pabrikmu sudah punya **${CONFIG.LINES[type].name}**.`);
        if (user.balance < machineCost) return msg.reply(`❌ Modal kurang Rp ${fmt(machineCost)}.`);

        user.balance -= machineCost;
        factory.activeLines.push(type);
        saveDB(db);

        return msg.reply(`🎉 *INVESTASI BERHASIL*\n${CONFIG.LINES[type].name} telah terpasang!\nDurasi Produksi: ${CONFIG.LINES[type].cooldown / 60000} Menit per item.`);
    }

    // ============================================================
    // ⚙️ 3. BUAT PRODUK (GANTI DARI OLAH)
    // ============================================================
    if (command === 'buat') { // <--- GANTI DISINI
        if (db.locks[senderId]) return msg.reply("⏳ Sabar, mesin lagi proses!");
        db.locks[senderId] = true;

        try {
            const workerData = db.workers[senderId];
            if (!workerData || !workerData.employer) throw "Kamu pengangguran. Minta direkrut dulu.";

            const ownerId = workerData.employer;
            const ownerUser = db.users[ownerId];
            const factory = db.factories[ownerId];

            if (!factory) throw "Pabrik bosmu tutup.";
            if (factory.isBroken) throw "⚙️ MESIN RUSAK! Lapor bosmu.";

            const inputKey = args[0]?.toLowerCase();
            const recipe = RECIPES[inputKey];
            if (!recipe) throw `❌ Resep salah. Cek \`!pabrik help\`.`;

            const requiredLine = recipe.line; 
            if (!factory.activeLines.includes(requiredLine)) {
                throw `❌ Bosmu belum membeli **${CONFIG.LINES[requiredLine].name}**.\nSuruh dia ketik \`!bangunpabrik ${requiredLine}\`.`;
            }

            let qty = parseInt(args[1]) || 1;
            if (qty > 3) qty = 3;

            // Stamina & Cost Check
            const lastUpdate = workerData.lastStaminaUpdate || now;
            const hoursPassed = (now - lastUpdate) / 3600000;
            if (hoursPassed > 0.5) {
                workerData.stamina = Math.min(CONFIG.maxStamina, (workerData.stamina || 100) + Math.floor(hoursPassed * 10));
                workerData.lastStaminaUpdate = now;
            }

            const totalStaminaCost = CONFIG.staminaCost * qty;
            const totalOprCost = CONFIG.oprCost * qty;

            if ((workerData.stamina || 100) < totalStaminaCost) throw `😴 Stamina kurang. Ketik \`!ngopi\` dulu.`;
            if (ownerUser.balance < totalOprCost) throw `❌ Saldo Bos kurang Rp ${fmt(totalOprCost)}.`;

            // --- PROSES PRODUKSI ---
            let totalOutputWeight = 0;
            let efficiency = 1 + (factory.level * 0.05);
            const day = new Date().getDay();
            if (day === 0 || day === 6) efficiency *= CONFIG.weekendBonus;

            // TIER 1 (DARI TERNAK)
            if (recipe.tier === 1) {
                const ternakArr = ownerUser.ternak || [];
                let validIndexes = [];
                ternakArr.forEach((a, i) => { if (a.type === inputKey && !a.isSick) validIndexes.push(i); });
                
                if (validIndexes.length < qty) throw `❌ Stok Hewan **${inputKey}** kurang.`;
                
                const targetIndexes = validIndexes.slice(0, qty).sort((a, b) => b - a);
                targetIndexes.forEach(idx => {
                    const animal = ternakArr[idx];
                    totalOutputWeight += (animal.weight * recipe.yield * efficiency);
                    ownerUser.ternak.splice(idx, 1);
                });
            } 
            // TIER 2 & 3 (DARI GUDANG)
            else {
                const requiredStock = recipe.batchSize * qty;
                const currentStock = factory.inventory?.[inputKey] || 0;
                
                if (currentStock < requiredStock) throw `❌ Stok bahan **${inputKey}** kurang.\nButuh: ${requiredStock.toFixed(2)} unit`;

                factory.inventory[inputKey] -= requiredStock;
                totalOutputWeight = (recipe.batchSize * qty) * recipe.yield * efficiency;
            }

            // QUEUE
            const durationPerItem = CONFIG.LINES[requiredLine].cooldown;
            const totalDuration = durationPerItem * qty;

            ownerUser.balance -= totalOprCost;
            workerData.stamina -= totalStaminaCost;
            workerData.lastStaminaUpdate = now;
            
            if (!ownerUser.farm) ownerUser.farm = {};
            if (!ownerUser.farm.processing) ownerUser.farm.processing = [];
            
            ownerUser.farm.processing.push({
                machine: requiredLine,
                product: recipe.outputCode,
                qty: qty,
                durationPerItem: durationPerItem,
                startedAt: now,
                finishAt: now + totalDuration
            });

            factory.exp += (20 * qty);
            while (factory.exp >= factory.level * 100) { factory.exp -= factory.level * 100; factory.level++; }

            const risk = 1 - Math.pow((1 - CONFIG.breakdownChance), qty);
            let brokenMsg = "";
            if (Math.random() < risk) {
                factory.isBroken = true;
                brokenMsg = "\n💥 *MESIN MELEDAK!* Lapor bos segera.";
            }

            saveDB(db);

            let txt = `⚙️ *PRODUKSI BERJALAN (${qty}x)*\n`;
            txt += `📦 Output Target: ${totalOutputWeight.toFixed(2)} kg ${recipe.outputName}\n`;
            txt += `⏱️ Total Waktu: ${(totalDuration/60000).toFixed(0)} Menit\n`;
            txt += `⚡ Stamina: -${totalStaminaCost}\n`;
            txt += brokenMsg;

            msg.reply(txt, { mentions: [senderId, ownerId] });

        } catch (e) {
            msg.reply(typeof e === 'string' ? e : "❌ Error sistem.");
            console.error(e);
        } finally {
            delete db.locks[senderId];
        }
        return;
    }

    // ============================================================
    // 🧱 4. DASHBOARD PABRIK
    // ============================================================
    if (command === 'pabrik') {
        const workerData = db.workers[senderId];
        if (workerData) {
            const lastUpdate = workerData.lastStaminaUpdate || now;
            const hoursPassed = (now - lastUpdate) / 3600000;
            if (hoursPassed > 0.5) workerData.stamina = Math.min(CONFIG.maxStamina, (workerData.stamina || 100) + Math.floor(hoursPassed * 10));
        }

        if (workerData && workerData.employer) {
            const bossName = db.users[workerData.employer]?.name || "Bos";
            let txt = `👷 *KARTU KARYAWAN*\n👤 Nama: ${user.name}\n🏢 Majikan: ${bossName}\n⚡ Stamina: ${workerData.stamina}/${CONFIG.maxStamina}\n${createProgressBar(workerData.stamina, CONFIG.maxStamina)}\n\n🛠️ Tugas: \`!buat <item> [jumlah]\``;
            return msg.reply(txt);
        }

        const factory = db.factories[senderId];
        if (!factory) return msg.reply(`❌ Belum punya pabrik.\nKetik: \`!bangunpabrik\``);
        
        // --- LOGIKA KLAIM OTOMATIS ---
        if (!user.farm) user.farm = {}; 
        let processingQueue = user.farm.processing || [];
        let newQueue = [];
        let claimedItems = {};

        processingQueue.forEach(p => {
            const elapsedTime = now - p.startedAt;
            const finishedCount = Math.floor(elapsedTime / p.durationPerItem);
            let take = Math.min(finishedCount, p.qty);

            if (take > 0) {
                if (!factory.inventory[p.product]) factory.inventory[p.product] = 0;
                factory.inventory[p.product] += take;
                
                if (!claimedItems[p.product]) claimedItems[p.product] = 0;
                claimedItems[p.product] += take;

                p.qty -= take;
                p.startedAt += (take * p.durationPerItem); 
            }
            if (p.qty > 0) newQueue.push(p);
        });

        user.farm.processing = newQueue;
        saveDB(db);

        const nextLvlXp = factory.level * 100;
        let machines = factory.activeLines && factory.activeLines.length > 0 
            ? factory.activeLines.map(l => CONFIG.LINES[l].name.replace('🏭 ', '')).join(', ')
            : "⚠️ Belum ada mesin";

        let txt = `🏭 *FACTORY DASHBOARD* (Lv. ${factory.level})\n`;
        txt += `⚙️ Status: ${factory.isBroken ? '🔴 RUSAK' : '🟢 NORMAL'}\n`;
        txt += `🏗️ Mesin: ${machines}\n`;
        txt += `📘 XP: ${factory.exp}/${nextLvlXp}\n`;
        txt += `${createProgressBar(factory.exp, nextLvlXp)}\n`;
        
        if (newQueue.length > 0) {
            txt += `\n🔄 *SEDANG DIPROSES:*\n`;
            newQueue.forEach(p => {
                const timeLeft = Math.ceil((p.durationPerItem - (now - p.startedAt)) / 60000);
                let pName = p.product;
                for(let k in RECIPES) if(RECIPES[k].outputCode === p.product) pName = RECIPES[k].outputName;
                txt += `⚙️ ${pName}: Sisa ${p.qty} (Next: ${timeLeft} mnt)\n`;
            });
        }

        if (Object.keys(claimedItems).length > 0) {
            txt += `\n✅ *BARANG JADI (MASUK GUDANG):*\n`;
            for (let [code, count] of Object.entries(claimedItems)) {
                let pName = code;
                for(let k in RECIPES) if(RECIPES[k].outputCode === code) pName = RECIPES[k].outputName;
                txt += `+ ${count} ${pName}\n`;
            }
        }

        return msg.reply(txt);
    }

    // ============================================================
    // ☕ NGOPI (ISI STAMINA)
    // ============================================================
    if (command === 'ngopi' || command === 'makan') {
        const workerData = db.workers[senderId];
        if (!workerData || !workerData.employer) return msg.reply("❌ Kamu bukan karyawan pabrik.");

        const price = CONFIG.coffeePrice; 
        const restoreAmount = CONFIG.coffeeRegen; 

        if (user.balance < price) return msg.reply(`❌ Uang kurang. Harga Kopi: Rp ${fmt(price)}.`);
        if (workerData.stamina >= CONFIG.maxStamina) return msg.reply("⚡ Staminamu masih penuh.");

        user.balance -= price;
        workerData.stamina = Math.min(CONFIG.maxStamina, (workerData.stamina || 0) + restoreAmount);
        workerData.lastStaminaUpdate = now; 
        
        saveDB(db);
        return msg.reply(`☕ *Sruput... Segar!* (Rp -${fmt(price)})\n⚡ Stamina: +${restoreAmount} (${workerData.stamina}/${CONFIG.maxStamina})`);
    }

    // --- COMMAND STANDAR ---
    if (command === 'rekrut') {
        const factory = db.factories[senderId];
        if (!factory) return msg.reply("❌ Belum punya pabrik. Ketik !bangunpabrik dulu.");

        // FIX: Ambil dari Mention/Tag (Bukan Text)
        let targetId = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        
        // Backup Logic (Teks)
        if (!targetId) {
            let rawNum = args[0]?.replace(/[^0-9]/g, '');
            if (!rawNum) return msg.reply("❌ Format salah. Tag orangnya: `!rekrut @member`");
            if (rawNum.startsWith('08')) rawNum = '62' + rawNum.slice(1);
            targetId = rawNum + "@s.whatsapp.net";
        }

        if (db.workers[targetId]) {
            const employerId = db.workers[targetId].employer;
            if (employerId === senderId) return msg.reply("❌ Dia sudah jadi karyawanmu.");
            return msg.reply(`❌ Dia sudah kerja di tempat lain.`);
        }

        factory.employees.push(targetId);
        db.workers[targetId] = { employer: senderId, stamina: 100, lastStaminaUpdate: now };
        saveDB(db);
        return msg.reply(`✅ Berhasil merekrut karyawan!`, { mentions: [targetId] });
    }

    if (command === 'gudang') {
         const factory = db.factories[senderId];
         if (!factory) return msg.reply("❌ Gak punya pabrik.");
         let txt = `📦 *GUDANG PABRIK*\n`;
         for (let k in RECIPES) {
             const qty = factory.inventory?.[RECIPES[k].outputCode];
             if(qty > 0) txt += `${RECIPES[k].tier===3?'🌟':RECIPES[k].tier===2?'🍔':'🍗'} ${RECIPES[k].outputName}: ${qty.toFixed(2)} kg\n`;
         }
         return msg.reply(txt || "Kosong");
    }
    if (command === 'jualproduk') {
         const factory = db.factories[senderId];
         if (!factory) return;
         const code = args[0]?.toLowerCase();
         const qty = factory.inventory?.[code] || 0;
         if(qty<=0) return msg.reply("Kosong.");
         let itemKey = Object.keys(RECIPES).find(k => RECIPES[k].outputCode === code);
         if(!itemKey) return;
         const item = RECIPES[itemKey];
         const price = getDynamicPrice(item.price);
         const total = Math.floor(qty * price * (1 - CONFIG.taxRate));
         user.balance += total;
         factory.inventory[code] = 0;
         saveDB(db);
         return msg.reply(`💰 Terjual semua! Net: Rp ${fmt(total)}`);
    }
    if (command === 'cekpasar') {
         let txt = "💹 *HARGA SAAT INI*\n";
         Object.keys(RECIPES).forEach(k => txt += `${RECIPES[k].outputName}: Rp ${fmt(getDynamicPrice(RECIPES[k].price))}\n`);
         return msg.reply(txt);
    }
    if (command === 'service') {
         const factory = db.factories[senderId];
         if(!factory || !factory.isBroken) return msg.reply("Mesin aman.");
         if(user.balance < CONFIG.repairCost) return msg.reply("Uang kurang.");
         user.balance -= CONFIG.repairCost;
         factory.isBroken = false;
         saveDB(db);
         return msg.reply("✅ Mesin beres.");
    }
    if (command === 'pecat') {
        const factory = db.factories[senderId];
        if(!factory) return;
        const rawNum = args[0]?.replace(/[^0-9]/g, '');
        const targetId = rawNum + "@s.whatsapp.net";
        const idx = factory.employees.indexOf(targetId);
        if(idx === -1) return msg.reply("Bukan karyawanmu.");
        factory.employees.splice(idx, 1);
        delete db.workers[targetId];
        saveDB(db);
        return msg.reply("👢 Dipecat.");
    }
    if (command === 'resign') {
        const worker = db.workers[senderId];
        if(!worker) return msg.reply("Kamu pengangguran.");
        const bossFactory = db.factories[worker.employer];
        if(bossFactory) {
            const idx = bossFactory.employees.indexOf(senderId);
            if(idx > -1) bossFactory.employees.splice(idx, 1);
        }
        delete db.workers[senderId];
        saveDB(db);
        return msg.reply("✅ Resign sukses.");
    }
    if (command === 'leaderboard' || command === 'topkorporat') {
        const factoryOwners = Object.keys(db.factories);
        if (factoryOwners.length === 0) return msg.reply("Belum ada korporat.");
        const sorted = factoryOwners.sort((a, b) => {
            const fa = db.factories[a];
            const fb = db.factories[b];
            return (fb.level - fa.level) || (fb.exp - fa.exp);
        }).slice(0, 5);
        let txt = `🏆 *TOP KORPORAT*\n`;
        sorted.forEach((id, i) => {
            const f = db.factories[id];
            const name = db.users[id]?.name || "Unknown";
            const machineCount = f.activeLines ? f.activeLines.length : 0;
            txt += `${i+1}. *${name}* (Lv.${f.level} | ${machineCount} Mesin)\n`;
        });
        return msg.reply(txt);
    }
};
