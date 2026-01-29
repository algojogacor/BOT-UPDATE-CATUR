const { saveDB } = require('../helpers/database');

// ==========================================
// ⚙️ KONFIGURASI PABRIK & WAKTU
// ==========================================
const CONFIG = {
    // Harga & Cooldown Mesin
    LINES: {
        'ayam':    { name: '🏭 Lini Unggas', cost: 15_000_000, cooldown: 15 * 60 * 1000 },   // 15 Menit
        'gurame':  { name: '🏭 Lini Perikanan', cost: 25_000_000, cooldown: 30 * 60 * 1000 },   // 30 Menit
        'kambing': { name: '🏭 Lini Kambing', cost: 50_000_000, cooldown: 60 * 60 * 1000 },   // 1 Jam
        'sapi':    { name: '🏭 Lini Sapi', cost: 100_000_000, cooldown: 2 * 60 * 60 * 1000 }, // 2 Jam
        'kuda':    { name: '🏭 Lini Kuda', cost: 250_000_000, cooldown: 4 * 60 * 60 * 1000 }, // 4 Jam
        'unta':    { name: '🏭 Lini Sultan', cost: 500_000_000, cooldown: 6 * 60 * 60 * 1000 }  // 6 Jam
    },
    oprCost: 1_000_000,    // Biaya Listrik
    taxRate: 0.05,         // Pajak
    breakdownChance: 0.02, // Risiko Meledak
    repairCost: 5_000_000, 
    staminaCost: 10,       
    maxStamina: 100,
    weekendBonus: 1.10
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
    // 📖 1. PANDUAN / HELP
    // ============================================================
    if (command === 'pabrikhelp' || command === 'panduanpabrik' || (command === 'pabrik' && args[0] === 'help')) {
        let txt = `🏭 *PANDUAN TAIPAN INDUSTRI* 🏭\n`;
        txt += `_Ubah hewan ternak jadi cuan miliaran!_\n\n`;

        txt += `👑 *UNTUK BOS (OWNER)*\n`;
        txt += `1. \`!bangunpabrik\` : Beli pabrik (Modal 50jt).\n`;
        txt += `2. \`!rekrut @tag\` : Cari karyawan (Wajib ada).\n`;
        txt += `3. \`!pecat @tag\` : Pecat karyawan malas.\n`;
        txt += `4. \`!gudang\` : Cek stok hasil olahan.\n`;
        txt += `5. \`!jualproduk <kode>\` : Jual barang ke pasar.\n`;
        txt += `6. \`!service\` : Perbaiki mesin jika meledak.\n`;
        txt += `7. \`!cekpasar\` : Cek harga jual (Naik turun tiap jam).\n\n`;

        txt += `👷 *UNTUK KARYAWAN (BURUH)*\n`;
        txt += `1. \`!olah <nama> [jumlah]\` : Proses produksi (Max 3).\n`;
        txt += `   _Contoh: !olah sapi 3_\n`;
        txt += `   _Stamina -5 per olahan. Regen otomatis._\n`;
        txt += `2. \`!resign\` : Keluar dari pabrik bos.\n\n`;

        txt += `📜 *RESEP TIER 1 (Hewan ➡️ Bahan)*\n`;
        txt += `▪️ Ayam ➡️ Nugget\n▪️ Gurame ➡️ Fillet\n▪️ Kambing ➡️ Daging Giling\n`;
        txt += `▪️ Sapi ➡️ Wagyu\n▪️ Kuda ➡️ Sosis Kuda\n▪️ Unta ➡️ Susu Unta\n\n`;

        txt += `📜 *RESEP TIER 2 (Bahan ➡️ Produk Jadi)*\n`;
        txt += `⭐️ Nugget (5kg) ➡️ Burger\n⭐️ Fillet (5kg) ➡️ Fish & Chips\n`;
        txt += `⭐️ Giling (10kg) ➡️ Kebab\n⭐️ Wagyu (10kg) ➡️ Steak\n`;
        txt += `⭐️ Sosis (5kg) ➡️ Pizza\n⭐️ Susu (2kg) ➡️ Suplemen\n\n`;

        txt += `💡 *TIPS:* Ajak karyawan olah sampai Tier 2 untuk profit maksimal!`;
        return msg.reply(txt);
    }

    // ============================================================
    // 🏗️ 2. BANGUN MESIN
    // ============================================================
    if (command === 'bangunpabrik') {
        const type = args[0]?.toLowerCase();
        
        if (!type || !CONFIG.LINES[type]) {
            let txt = `❌ Tipe mesin salah. Pilih:\n`;
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

        if (factory.activeLines.includes(type)) return msg.reply(`❌ Sudah punya **${CONFIG.LINES[type].name}**.`);
        if (user.balance < machineCost) return msg.reply(`❌ Modal kurang Rp ${fmt(machineCost)}.`);

        user.balance -= machineCost;
        factory.activeLines.push(type);
        saveDB(db);

        return msg.reply(`🎉 *SUKSES*\n${CONFIG.LINES[type].name} dibeli!\nDurasi Produksi: ${CONFIG.LINES[type].cooldown / 60000} Menit/item.`);
    }

    // ============================================================
    // ⚙️ 3. OLAH PRODUK (FIXED LOGIC)
    // ============================================================
    if (command === 'olah') {
        if (db.locks[senderId]) return msg.reply("⏳ Sabar...");
        db.locks[senderId] = true;

        try {
            const workerData = db.workers[senderId];
            if (!workerData || !workerData.employer) throw "Kamu pengangguran.";

            const ownerId = workerData.employer;
            const ownerUser = db.users[ownerId];
            const factory = db.factories[ownerId];

            if (!factory) throw "Pabrik bosmu tutup.";
            if (factory.isBroken) throw "⚙️ MESIN RUSAK! Lapor bos.";

            const inputKey = args[0]?.toLowerCase();
            const recipe = RECIPES[inputKey];
            if (!recipe) throw `❌ Resep salah. Cek \`!pabrik help\`.`;

            const requiredLine = recipe.line; 
            if (!factory.activeLines.includes(requiredLine)) {
                throw `❌ Bos belum punya **${CONFIG.LINES[requiredLine].name}**.`;
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

            if ((workerData.stamina || 100) < totalStaminaCost) throw `😴 Stamina kurang.`;
            if (ownerUser.balance < totalOprCost) throw `❌ Saldo Bos kurang.`;

            // --- LOGIKA PRODUKSI ---
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

            // SETUP QUEUE (TIME BASED)
            const durationPerItem = CONFIG.LINES[requiredLine].cooldown;
            const totalDuration = durationPerItem * qty;

            ownerUser.balance -= totalOprCost;
            workerData.stamina -= totalStaminaCost;
            workerData.lastStaminaUpdate = now;
            
            // Simpan ke Queue Owner
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
                brokenMsg = "\n💥 *MESIN MELEDAK!* Lapor bos.";
            }

            saveDB(db);

            let txt = `⚙️ *PRODUKSI BERJALAN (${qty}x)*\n`;
            txt += `📦 Target: ${totalOutputWeight.toFixed(2)} kg ${recipe.outputName}\n`;
            txt += `⏱️ Waktu: ${(totalDuration/60000).toFixed(0)} Menit\n`;
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
    // 🧱 4. DASHBOARD (INCREMENTAL CLAIM)
    // ============================================================
    if (command === 'pabrik') {
        const workerData = db.workers[senderId];
        
        // View Karyawan
        if (workerData && workerData.employer) {
            // Regen Visual
            const lastUpdate = workerData.lastStaminaUpdate || now;
            const hoursPassed = (now - lastUpdate) / 3600000;
            if (hoursPassed > 0.5) workerData.stamina = Math.min(CONFIG.maxStamina, (workerData.stamina || 100) + Math.floor(hoursPassed * 10));
            
            const bossName = db.users[workerData.employer]?.name || "Bos";
            return msg.reply(`👷 *KARYAWAN*\n👤 Nama: ${user.name}\n🏢 Majikan: ${bossName}\n⚡ Stamina: ${workerData.stamina}/${CONFIG.maxStamina}\n${createProgressBar(workerData.stamina, CONFIG.maxStamina)}`);
        }

        // View Owner
        const factory = db.factories[senderId];
        if (!factory) return msg.reply(`❌ Belum punya pabrik.\nKetik: \`!bangunpabrik\``);
        
        // CLAIM LOGIC
        if (!user.farm) user.farm = {}; // Safety Check
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

        // Display
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

    // --- COMMAND STANDAR ---
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
