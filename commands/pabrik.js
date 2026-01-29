const { saveDB } = require('../helpers/database');

// ==========================================
// ⚙️ KONFIGURASI MESIN (PER JENIS & PER TIER)
// ==========================================
const MACHINES = {
    // --- AYAM ---
    'ayam_1': { name: '🐔 Pemotong Unggas (T1)', cost: 15_000_000, cooldown: 15 * 60 * 1000 },
    'ayam_2': { name: '🍗 Dapur Nugget (T2)', cost: 30_000_000, cooldown: 20 * 60 * 1000 },
    'ayam_3': { name: '🍔 Franchise Packaging (T3)', cost: 60_000_000, cooldown: 30 * 60 * 1000 },

    // --- GURAME ---
    'gurame_1': { name: '🐟 Fillet Station (T1)', cost: 25_000_000, cooldown: 30 * 60 * 1000 },
    'gurame_2': { name: '🍳 Penggorengan Ikan (T2)', cost: 50_000_000, cooldown: 40 * 60 * 1000 },
    'gurame_3': { name: '🍱 Sushi Conveyor (T3)', cost: 100_000_000, cooldown: 60 * 60 * 1000 },

    // --- KAMBING ---
    'kambing_1': { name: '🐐 Penggiling Daging (T1)', cost: 50_000_000, cooldown: 60 * 60 * 1000 },
    'kambing_2': { name: '🌯 Kebab Rotisserie (T2)', cost: 100_000_000, cooldown: 90 * 60 * 1000 },
    'kambing_3': { name: '🔥 Grill Kambing Guling (T3)', cost: 200_000_000, cooldown: 120 * 60 * 1000 },

    // --- SAPI ---
    'sapi_1': { name: '🐄 RPH Modern (T1)', cost: 100_000_000, cooldown: 2 * 60 * 60 * 1000 },
    'sapi_2': { name: '🥩 Steak House Kitchen (T2)', cost: 200_000_000, cooldown: 3 * 60 * 60 * 1000 },
    'sapi_3': { name: '🥂 Fine Dining Unit (T3)', cost: 400_000_000, cooldown: 4 * 60 * 60 * 1000 },

    // --- KUDA ---
    'kuda_1': { name: '🐎 Pengolahan Kuda (T1)', cost: 250_000_000, cooldown: 4 * 60 * 60 * 1000 },
    'kuda_2': { name: '🍕 Pizza Oven (T2)', cost: 500_000_000, cooldown: 5 * 60 * 60 * 1000 },
    'kuda_3': { name: '🍝 Pasta Factory (T3)', cost: 1_000_000_000, cooldown: 6 * 60 * 60 * 1000 },

    // --- UNTA ---
    'unta_1': { name: '🐫 Ekstraktor Susu (T1)', cost: 500_000_000, cooldown: 6 * 60 * 60 * 1000 },
    'unta_2': { name: '💊 Lab Farmasi (T2)', cost: 1_000_000_000, cooldown: 8 * 60 * 60 * 1000 },
    'unta_3': { name: '🧪 Alchemy Lab (T3)', cost: 2_500_000_000, cooldown: 12 * 60 * 60 * 1000 },
};

const GLOBAL_CONFIG = {
    oprCost: 1_000_000,    
    taxRate: 0.05,         
    breakdownChance: 0.02, 
    repairCost: 5_000_000, 
    staminaCost: 10,       
    maxStamina: 100,
    weekendBonus: 1.10
};

// ==========================================
// 📚 DATA RESEP (DIPETAKAN KE KODE MESIN)
// ==========================================
// Key = Input Item
const RECIPES = {
    // --- TIER 1 (HEWAN -> BAHAN) ---
    // Butuh Mesin *_1
    'ayam':    { tier: 1, machine: 'ayam_1', outputCode: 'nugget', outputName: '🍗 Chicken Nugget', yield: 0.7, price: 100000 },
    'gurame':  { tier: 1, machine: 'gurame_1', outputCode: 'fillet', outputName: '🍣 Fillet Ikan', yield: 0.6, price: 300000 },
    'kambing': { tier: 1, machine: 'kambing_1', outputCode: 'giling_kambing', outputName: '🥩 Daging Giling', yield: 0.65, price: 200000 },
    'sapi':    { tier: 1, machine: 'sapi_1', outputCode: 'wagyu', outputName: '🥩 Wagyu A5 Cut', yield: 0.7, price: 90000 }, 
    'kuda':    { tier: 1, machine: 'kuda_1', outputCode: 'sosis_kuda', outputName: '🌭 Sosis Kuda', yield: 0.7, price: 350000 },
    'unta':    { tier: 1, machine: 'unta_1', outputCode: 'susu_unta', outputName: '🥛 Susu Unta Bubuk', yield: 0.5, price: 400000 },

    // --- TIER 2 (BAHAN -> MASAKAN) ---
    // Butuh Mesin *_2
    'nugget':         { tier: 2, machine: 'ayam_2', outputCode: 'burger', outputName: '🍔 Burger Ayam', batchSize: 5, yield: 1.2, price: 180000 },
    'fillet':         { tier: 2, machine: 'gurame_2', outputCode: 'fish_chips', outputName: '🍱 Fish & Chips', batchSize: 5, yield: 1.1, price: 550000 },
    'giling_kambing': { tier: 2, machine: 'kambing_2', outputCode: 'kebab', outputName: '🌯 Kebab Turki', batchSize: 10, yield: 1.0, price: 350000 },
    'wagyu':          { tier: 2, machine: 'sapi_2', outputCode: 'steak', outputName: '🍲 Steak House', batchSize: 10, yield: 0.9, price: 180000 },
    'sosis_kuda':     { tier: 2, machine: 'kuda_2', outputCode: 'pizza_kuda', outputName: '🍕 Pizza Salami', batchSize: 5, yield: 1.5, price: 500000 },
    'susu_unta':      { tier: 2, machine: 'unta_2', outputCode: 'suplemen', outputName: '💊 Suplemen Vitalitas', batchSize: 2, yield: 0.8, price: 900000 },

    // --- TIER 3 (LUXURY) ---
    // Butuh Mesin *_3
    'burger':     { tier: 3, machine: 'ayam_3', outputCode: 'happy_meal', outputName: '🍟 Paket Franchise', batchSize: 5, yield: 1.0, price: 350000 },
    'fish_chips': { tier: 3, machine: 'gurame_3', outputCode: 'sushi_platter', outputName: '🍱 Sushi Platter', batchSize: 5, yield: 1.0, price: 900000 },
    'kebab':      { tier: 3, machine: 'kambing_3', outputCode: 'kambing_guling', outputName: '🍖 Kambing Guling', batchSize: 5, yield: 1.0, price: 600000 },
    'steak':      { tier: 3, machine: 'sapi_3', outputCode: 'beef_wellington', outputName: '🥂 Beef Wellington', batchSize: 5, yield: 1.0, price: 250000 },
    'pizza_kuda': { tier: 3, machine: 'kuda_3', outputCode: 'lasagna', outputName: '🍝 Lasagna Premium', batchSize: 5, yield: 1.0, price: 800000 },
    'suplemen':   { tier: 3, machine: 'unta_3', outputCode: 'elixir', outputName: '🧪 Elixir Keabadian', batchSize: 2, yield: 1.0, price: 1800000 }
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
        'olah', 'gudang', 'jualproduk', 'service', 
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
        // Helper untuk format waktu biar rapi
        const formatTime = (ms) => {
            const min = ms / 60000;
            return min >= 60 ? `${min/60} Jam` : `${min} Mnt`;
        };

        let txt = `🏭 *GRAND PANDUAN PABRIK & HILIRISASI* 🏭\n`;
        txt += `_Panduan lengkap penguasa industri tier 1-3._\n\n`;

        txt += `🏗️ *INVESTASI MESIN (LINI PRODUKSI)*\n`;
        txt += `_Tanpa mesin ini, hewan tidak bisa diolah._\n`;
        
        // Loop otomatis dari CONFIG biar kalau config diubah, help ikut berubah
        for (let k in CONFIG.LINES) {
            const line = CONFIG.LINES[k];
            txt += `▪️ *${line.name.replace('🏭 ', '')}*: Rp ${fmt(line.cost)} (⏳ ${formatTime(line.cooldown)})\n`;
        }
        txt += `➤ Beli: \`!bangunpabrik <jenis>\` (Cth: !bangunpabrik sapi)\n\n`;

        txt += `📜 *POHON RESEP (HILIRISASI)*\n`;
        txt += `_Tier 1 (Bahan) ➡️ Tier 2 (Masakan) ➡️ Tier 3 (Luxury)_\n`;
        txt += `_Gunakan kode di sebelah kiri untuk command olah._\n\n`;

        txt += `🐔 *AYAM*\n`;
        txt += `├ \`ayam\` ➡️ Nugget (T1)\n`;
        txt += `├ \`nugget\` ➡️ Burger (T2)\n`;
        txt += `└ \`burger\` ➡️ Paket Franchise (T3)\n\n`;

        txt += `🐟 *GURAME*\n`;
        txt += `├ \`gurame\` ➡️ Fillet (T1)\n`;
        txt += `├ \`fillet\` ➡️ Fish & Chips (T2)\n`;
        txt += `└ \`fish_chips\` ➡️ Sushi Platter (T3)\n\n`;

        txt += `🐐 *KAMBING*\n`;
        txt += `├ \`kambing\` ➡️ Daging Giling (T1)\n`;
        txt += `├ \`giling_kambing\` ➡️ Kebab (T2)\n`;
        txt += `└ \`kebab\` ➡️ Kambing Guling (T3)\n\n`;

        txt += `🐄 *SAPI*\n`;
        txt += `├ \`sapi\` ➡️ Wagyu (T1)\n`;
        txt += `├ \`wagyu\` ➡️ Steak (T2)\n`;
        txt += `└ \`steak\` ➡️ Beef Wellington (T3)\n\n`;

        txt += `🐎 *KUDA*\n`;
        txt += `├ \`kuda\` ➡️ Sosis (T1)\n`;
        txt += `├ \`sosis_kuda\` ➡️ Pizza (T2)\n`;
        txt += `└ \`pizza_kuda\` ➡️ Lasagna (T3)\n\n`;

        txt += `🐫 *UNTA*\n`;
        txt += `├ \`unta\` ➡️ Susu Bubuk (T1)\n`;
        txt += `├ \`susu_unta\` ➡️ Suplemen (T2)\n`;
        txt += `└ \`suplemen\` ➡️ Elixir (T3)\n\n`;

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
        txt += `├ \`!olah <kode> <jumlah>\` : Kerja (Max 3).\n`;
        txt += `├ \`!ngopi\` : Isi 50 stamina (Bayar 1Jt).\n`;
        txt += `└ \`!resign\` : Keluar dari pabrik.\n\n`;

        txt += `⚙️ *MEKANISME GAME*\n`;
        txt += `1. *Waktu:* Produksi berjalan Real-Time (bisa ditinggal).\n`;
        txt += `2. *Claim:* Barang otomatis masuk gudang bos saat selesai.\n`;
        txt += `3. *Stamina:* Kerja butuh 10 Stamina. Regen otomatis atau \`!ngopi\`.\n`;
        txt += `4. *Risiko:* Ada 2% kemungkinan mesin meledak saat produksi.\n`;
        
        return msg.reply(txt);
    }
    // ============================================================
    // 🏗️ 2. BANGUN MESIN (NEW: HEWAN + TIER)
    // ============================================================
    if (command === 'bangunpabrik') {
        const type = args[0]?.toLowerCase();
        const tier = parseInt(args[1]);

        if (!type || !tier || isNaN(tier) || tier < 1 || tier > 3) {
            return msg.reply(`❌ Format salah!\nGunakan: \`!bangunpabrik <hewan> <tier>\`\nContoh: \`!bangunpabrik sapi 1\``);
        }

        const machineCode = `${type}_${tier}`; // Contoh: sapi_1
        const machineData = MACHINES[machineCode];

        if (!machineData) return msg.reply(`❌ Tipe hewan tidak ditemukan.`);

        // Init Factory
        if (!db.factories[senderId]) {
            db.factories[senderId] = { 
                level: 1, exp: 0, employees: [], inventory: {}, 
                activeLines: [], isBroken: false, createdAt: now 
            };
        }
        const factory = db.factories[senderId];

        if (factory.activeLines.includes(machineCode)) return msg.reply(`❌ Pabrikmu sudah punya **${machineData.name}**.`);
        
        if (user.balance < machineData.cost) return msg.reply(`❌ Modal kurang. Butuh Rp ${fmt(machineData.cost)}.`);

        // Eksekusi
        user.balance -= machineData.cost;
        factory.activeLines.push(machineCode);
        saveDB(db);

        return msg.reply(`🎉 *INVESTASI SUKSES*\n**${machineData.name}** berhasil dibangun!\n\nSekarang kamu bisa mengolah produk Tier ${tier} dari ${type}.\nDurasi: ${machineData.cooldown/60000} Menit.`);
    }

    // ============================================================
    // ⚙️ 3. OLAH PRODUK (CHECK SPECIFIC MACHINE)
    // ============================================================
    if (command === 'olah') {
        if (db.locks[senderId]) return msg.reply("⏳ Sabar...");
        db.locks[senderId] = true;

        try {
            const workerData = db.workers[senderId];
            if (!workerData || !workerData.employer) throw "Kamu pengangguran. Minta direkrut dulu.";

            const ownerId = workerData.employer;
            const ownerUser = db.users[ownerId];
            const factory = db.factories[ownerId];

            if (!factory) throw "Pabrik bosmu tutup.";
            if (factory.isBroken) throw "⚙️ MESIN RUSAK! Lapor bos.";

            // 1. Cek Input & Resep
            const inputKey = args[0]?.toLowerCase();
            const recipe = RECIPES[inputKey];
            if (!recipe) throw `❌ Resep salah. Ketik \`!pabrik help\`.`;

            // 2. Cek Apakah Bos Punya Mesin Spesifik (Contoh: sapi_1)
            const requiredMachine = recipe.machine; 
            if (!factory.activeLines.includes(requiredMachine)) {
                const mData = MACHINES[requiredMachine];
                throw `❌ Pabrik bosmu belum punya **${mData ? mData.name : 'Mesin Ini'}**.\nSuruh dia ketik \`!bangunpabrik ${requiredMachine.split('_')[0]} ${requiredMachine.split('_')[1]}\`.`;
            }

            const machineData = MACHINES[requiredMachine];
            let qty = parseInt(args[1]) || 1;
            if (qty > 3) qty = 3;

            // 3. Cek Stamina & Biaya
            const lastUpdate = workerData.lastStaminaUpdate || now;
            const hoursPassed = (now - lastUpdate) / 3600000;
            if (hoursPassed > 0.5) {
                workerData.stamina = Math.min(GLOBAL_CONFIG.maxStamina, (workerData.stamina || 100) + Math.floor(hoursPassed * 10));
                workerData.lastStaminaUpdate = now;
            }

            const totalStamina = GLOBAL_CONFIG.staminaCost * qty;
            const totalCost = GLOBAL_CONFIG.oprCost * qty;

            if ((workerData.stamina || 100) < totalStamina) throw `😴 Stamina kurang.`;
            if (ownerUser.balance < totalCost) throw `❌ Saldo Bos kurang.`;

            // 4. Proses Logika Bahan
            let totalOutputWeight = 0;
            let efficiency = 1 + (factory.level * 0.05);
            const day = new Date().getDay();
            if (day === 0 || day === 6) efficiency *= GLOBAL_CONFIG.weekendBonus;

            // TIER 1 (Ambil dari Ternak)
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
            // TIER 2 & 3 (Ambil dari Gudang)
            else {
                const requiredStock = recipe.batchSize * qty;
                const currentStock = factory.inventory?.[inputKey] || 0;
                
                if (currentStock < requiredStock) throw `❌ Stok bahan **${inputKey}** kurang.\nButuh: ${requiredStock.toFixed(2)} unit`;

                factory.inventory[inputKey] -= requiredStock;
                totalOutputWeight = (recipe.batchSize * qty) * recipe.yield * efficiency;
            }

            // 5. Update DB & Queue
            const duration = machineData.cooldown;
            const totalDuration = duration * qty;

            ownerUser.balance -= totalCost;
            workerData.stamina -= totalStamina;
            workerData.lastStaminaUpdate = now;
            
            // Queue Management
            if (!ownerUser.farm) ownerUser.farm = {};
            if (!ownerUser.farm.processing) ownerUser.farm.processing = [];
            
            ownerUser.farm.processing.push({
                machine: requiredMachine, // simpan kode mesin (misal: sapi_1)
                product: recipe.outputCode,
                qty: qty,
                durationPerItem: duration,
                startedAt: now,
                finishAt: now + totalDuration
            });

            factory.exp += (20 * qty);
            while (factory.exp >= factory.level * 100) { factory.exp -= factory.level * 100; factory.level++; }

            const risk = 1 - Math.pow((1 - GLOBAL_CONFIG.breakdownChance), qty);
            let brokenMsg = "";
            if (Math.random() < risk) {
                factory.isBroken = true;
                brokenMsg = "\n💥 *MESIN MELEDAK!* Lapor bos.";
            }

            saveDB(db);

            let txt = `⚙️ *PRODUKSI BERJALAN (${qty}x)*\n`;
            txt += `🏗️ Mesin: ${machineData.name}\n`;
            txt += `📦 Target: ${totalOutputWeight.toFixed(2)} kg ${recipe.outputName}\n`;
            txt += `⏱️ Waktu: ${(totalDuration/60000).toFixed(0)} Menit\n`;
            txt += `⚡ Stamina: -${totalStamina}\n`;
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
        
        // View Karyawan
        if (workerData && workerData.employer) {
            const lastUpdate = workerData.lastStaminaUpdate || now;
            const hoursPassed = (now - lastUpdate) / 3600000;
            if (hoursPassed > 0.5) workerData.stamina = Math.min(GLOBAL_CONFIG.maxStamina, (workerData.stamina || 100) + Math.floor(hoursPassed * 10));
            
            const bossName = db.users[workerData.employer]?.name || "Bos";
            return msg.reply(`👷 *KARTU KARYAWAN*\n👤 Nama: ${user.name}\n🏢 Majikan: ${bossName}\n⚡ Stamina: ${workerData.stamina}/${GLOBAL_CONFIG.maxStamina}\n${createProgressBar(workerData.stamina, GLOBAL_CONFIG.maxStamina)}`);
        }

        // View Owner
        const factory = db.factories[senderId];
        if (!factory) return msg.reply(`❌ Belum punya pabrik.\nKetik: \`!bangunpabrik <hewan> 1\``);
        
        // Incremental Claim Logic
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

        // Display Info
        const nextLvlXp = factory.level * 100;
        let machineCount = factory.activeLines ? factory.activeLines.length : 0;

        let txt = `🏭 *FACTORY COMPLEX* (Lv. ${factory.level})\n`;
        txt += `⚙️ Status: ${factory.isBroken ? '🔴 RUSAK' : '🟢 NORMAL'}\n`;
        txt += `🏗️ Total Mesin: ${machineCount} Unit\n`;
        txt += `📘 XP: ${factory.exp}/${nextLvlXp}\n`;
        txt += `${createProgressBar(factory.exp, nextLvlXp)}\n`;
        
        if (newQueue.length > 0) {
            txt += `\n🔄 *SEDANG DIPROSES:*\n`;
            newQueue.forEach(p => {
                const timeLeft = Math.ceil((p.durationPerItem - (now - p.startedAt)) / 60000);
                let pName = p.product;
                for(let k in RECIPES) if(RECIPES[k].outputCode === p.product) pName = RECIPES[k].outputName;
                txt += `⚙️ ${pName}: Sisa ${p.qty} (Next: ${timeLeft}m)\n`;
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

    // --- COMMAND ---
   
    if (command === 'rekrut') {
        const factory = db.factories[senderId];
        if(!factory) return;
        const rawNum = args[0]?.replace(/[^0-9]/g, '');
        if (!rawNum || rawNum.length < 9) return msg.reply("❌ Tag invalid.");
        const targetId = rawNum + "@s.whatsapp.net";
        if(db.workers[targetId]) return msg.reply("Dia sudah kerja.");
        const maxSlots = 3 + Math.floor(factory.level / 2);
        if (factory.employees.length >= maxSlots) return msg.reply(`❌ Slot Penuh (Max ${maxSlots}).`);
        factory.employees.push(targetId);
        db.workers[targetId] = { employer: senderId, stamina: 100, lastStaminaUpdate: now };
        saveDB(db);
        return msg.reply("✅ Direkrut.");
    }
    if (command === 'ngopi' || command === 'makan') {
        const workerData = db.workers[senderId];
        
        // Cek apakah dia karyawan
        if (!workerData || !workerData.employer) return msg.reply("❌ Kamu bukan karyawan pabrik.");

        // Harga Kopi
        const price = 1_000_000; // Rp 1Jt per cangkir (Mahal, inflasi pabrik 😂)
        const restoreAmount = 50; // Nambah 50 Stamina

        if (user.balance < price) return msg.reply(`❌ Uang kurang. Harga Kopi: Rp ${fmt(price)}.\nMinta bos transfer gaji/uang makan dulu!`);
        
        if (workerData.stamina >= GLOBAL_CONFIG.maxStamina) return msg.reply("⚡ Staminamu masih penuh woi.");

        // Eksekusi
        user.balance -= price;
        workerData.stamina = Math.min(GLOBAL_CONFIG.maxStamina, (workerData.stamina || 0) + restoreAmount);
        workerData.lastStaminaUpdate = now; // Reset waktu regen pasif
        
        saveDB(db);

        return msg.reply(`☕ *Sruput... Segar!* (Rp -${fmt(price)})\n⚡ Stamina: +${restoreAmount} (${workerData.stamina}/${GLOBAL_CONFIG.maxStamina})\nAyo kerja lagi!`);
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
         const total = Math.floor(qty * price * (1 - GLOBAL_CONFIG.taxRate));
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
         if(user.balance < GLOBAL_CONFIG.repairCost) return msg.reply("Uang kurang.");
         user.balance -= GLOBAL_CONFIG.repairCost;
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
