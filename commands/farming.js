const { saveDB } = require('../helpers/database');

// HELPER FORMAT ANGKA
const fmt = (num) => Math.floor(Number(num)).toLocaleString('id-ID');

// ==========================================
// 1. DATA TANAMAN (RE-BALANCED ORDER)
// ==========================================
// Urutan: Padi -> Jagung -> Bawang -> Kopi -> Sawit
const CROPS = {
    'padi': { 
        modal: 2000000,           // 2 Juta
        duration: 20 * 60 * 1000, // 20 Menit
        minSell: 2200000, maxSell: 2500000 
    }, 
    'jagung': { 
        modal: 5000000,           // 5 Juta
        duration: 60 * 60 * 1000, // 1 Jam
        minSell: 6000000, maxSell: 7000000 
    },
    'bawang': { 
        modal: 10000000,          // 10 Juta (Mid Tier)
        duration: 2 * 60 * 60 * 1000, // 2 Jam
        minSell: 13000000, maxSell: 15000000 
    },
    'kopi': { 
        modal: 25000000,          // 25 Juta (High Tier)
        duration: 4 * 60 * 60 * 1000, // 4 Jam
        minSell: 32000000, maxSell: 38000000 
    },
    'sawit': { 
        modal: 50000000,          // 50 Juta (Endgame/Termahal)
        duration: 8 * 60 * 60 * 1000, // 8 Jam (Bisa ditinggal kerja/tidur)
        minSell: 75000000, maxSell: 90000000 
    }
};

// ==========================================
// 2. DATA MESIN & RESEP (DISESUAIKAN)
// ==========================================
const MACHINES = {
    // TIER 1: Padi -> Beras
    'gilingan': {
        name: "🌾 Rice Mill",
        price: 50000000, 
        input: 'padi',   
        output: 'beras', 
        duration: 30 * 60 * 1000, 
        sellPrice: 4500000 
    },

    // TIER 2: Jagung -> Popcorn
    'popcorn_maker': {
        name: "🍿 Popcorn Maker",
        price: 80000000, 
        input: 'jagung',
        output: 'popcorn',
        duration: 45 * 60 * 1000, 
        sellPrice: 12000000 
    },

    // TIER 3: Bawang -> Bawang Goreng (NEW)
    'penggorengan': {
        name: "🥘 Fried Onion Machine",
        price: 150000000, // Modal 150 Juta
        input: 'bawang',
        output: 'bawang_goreng',
        duration: 90 * 60 * 1000, // 1.5 Jam
        sellPrice: 25000000 // Jual 25 Juta
    },

    // TIER 4: Kopi -> Kopi Bubuk
    'roaster': {
        name: "☕ Coffee Roaster",
        price: 300000000, // Modal 300 Juta
        input: 'kopi',
        output: 'kopi_bubuk',
        duration: 3 * 60 * 60 * 1000, // 3 Jam
        sellPrice: 65000000 // Jual 65 Juta
    },

    // TIER 5: Sawit -> Minyak Goreng (ULTIMATE)
    'penyulingan': {
        name: "🛢️ CPO Refinery",
        price: 1000000000, // Modal 1 Miliar (Mesin Sultan)
        input: 'sawit',
        output: 'minyak',
        duration: 6 * 60 * 60 * 1000, // 6 Jam
        sellPrice: 200000000 // Jual 200 Juta (Jackpot!)
    }
};

module.exports = async (command, args, msg, user, db) => {
    const validCommands = ['tanam', 'ladang', 'panen', 'pasar', 'jual', 'toko', 'beli', 'olah', 'pabrik', 'produksi', 'farming', 'farmer', 'tani'];
    if (!validCommands.includes(command)) return;

    // INIT DATABASE
    if (!user.farm) user.farm = { plants: [], inventory: {}, machines: [], processing: [] };
    if (!db.market.commodities) db.market.commodities = {};

    // ============================================================
    // 📘 PANDUAN / TUTORIAL (!farmer)
    // ============================================================
    if (command === 'farming' || command === 'farmer' || command === 'tani') {
        let txt = `🌾 *PANDUAN FARMING & INDUSTRI* 🏭\n`;
        txt += `_Simulasi ekonomi sektor riil: Tanam, Olah, Cuan!_\n\n`;

        txt += `👨‍🌾 *TAHAP 1: BERTANI (Modal Kecil)*\n`;
        txt += `1. \`!tanam <nama>\` : Menanam bibit (Padi/Jagung/Bawang/Kopi/Sawit).\n`;
        txt += `2. \`!ladang\` : Cek umur tanaman & isi gudang.\n`;
        txt += `3. \`!panen\` : Mengambil hasil tanaman yang matang.\n`;
        txt += `4. \`!pasar\` : Cek harga jual bahan mentah.\n\n`;

        txt += `🏭 *TAHAP 2: INDUSTRI (Juragan)*\n`;
        txt += `1. \`!toko\` : Cek harga & fungsi mesin pabrik.\n`;
        txt += `2. \`!beli <mesin>\` : Beli mesin (Investasi).\n`;
        txt += `3. \`!olah <mesin>\` : Proses bahan mentah jadi barang jadi.\n`;
        txt += `4. \`!pabrik\` : Cek status produksi mesin.\n\n`;

        txt += `💰 *TAHAP 3: PENJUALAN*\n`;
        txt += `👉 \`!jual <nama_barang>\`\n`;
        txt += `_Contoh: !jual beras (Jual barang jadi lebih mahal!)_\n\n`;

        txt += `💡 *STRATEGI KAYA:*\n`;
        txt += `Targetkan beli mesin *CPO Refinery* (1 Miliar) untuk mengolah Sawit menjadi Emas Cair!`;

        return msg.reply(txt);
    }
    
    // UPDATE HARGA PASAR (Tiap 10 Menit)
    const now = Date.now();
    if (now - (db.market.lastCommUpdate || 0) > 10 * 60 * 1000) {
        for (let [name, data] of Object.entries(CROPS)) {
            const range = data.maxSell - data.minSell;
            db.market.commodities[name] = data.minSell + Math.floor(Math.random() * range);
        }
        db.market.lastCommUpdate = now;
        saveDB(db);
    }

    // ============================================================
    // 🏪 FITUR TOKO (BELI MESIN)
    // ============================================================
    if (command === 'toko' || command === 'beli') {
        if (!args[0]) {
            let txt = `🏭 *TOKO MESIN INDUSTRI*\n_Beli mesin untuk mengolah hasil panen agar lebih mahal!_\n\n`;
            for (let [code, m] of Object.entries(MACHINES)) {
                const status = user.farm.machines.includes(code) ? "✅ DIMILIKI" : `💰 Rp ${fmt(m.price)}`;
                txt += `🔧 *${m.name}* (${code})\n   Bahan: ${m.input.toUpperCase()} ➡️ ${m.output.toUpperCase()}\n   Harga: ${status}\n\n`;
            }
            txt += `💡 Cara beli: \`!beli gilingan\``;
            return msg.reply(txt);
        }

        const item = args[0].toLowerCase();
        if (!MACHINES[item]) return msg.reply("❌ Mesin tidak ditemukan.");
        if (user.farm.machines.includes(item)) return msg.reply("❌ Kamu sudah punya mesin ini!");

        const price = MACHINES[item].price;
        if (user.balance < price) return msg.reply(`❌ Uang kurang! Butuh Rp ${fmt(price)}`);

        user.balance -= price;
        user.farm.machines.push(item);
        saveDB(db);
        return msg.reply(`✅ *SUKSES MEMBELI MESIN*\n${MACHINES[item].name} siap digunakan!\nKetik \`!olah ${item}\` untuk mulai produksi.`);
    }

    // ============================================================
    // 🏭 FITUR PABRIK (PRODUKSI)
    // ============================================================
    if (command === 'olah' || command === 'produksi') {
        const machineCode = args[0]?.toLowerCase();
        
        if (!machineCode || !MACHINES[machineCode]) return msg.reply("❌ Format: `!olah <nama_mesin>`\nCek nama mesin di `!toko`");
        if (!user.farm.machines.includes(machineCode)) return msg.reply("❌ Kamu belum punya mesin ini. Beli di `!toko`.");

        // Cek apakah mesin sedang dipakai? (1 Mesin = 1 Slot Antrian)
        const isBusy = user.farm.processing.find(p => p.machine === machineCode);
        if (isBusy) return msg.reply(`⏳ Mesin sedang bekerja! Tunggu selesai.`);

        const m = MACHINES[machineCode];
        const inputItem = m.input;

        // Cek Bahan Baku
        if (!user.farm.inventory[inputItem] || user.farm.inventory[inputItem] < 1) {
            return msg.reply(`❌ Bahan baku kurang!\nButuh 1 Ton ${inputItem.toUpperCase()} di gudang.`);
        }

        // Proses
        user.farm.inventory[inputItem] -= 1; // Kurangi stok mentah
        user.farm.processing.push({
            machine: machineCode,
            product: m.output,
            finishAt: now + m.duration
        });

        saveDB(db);
        return msg.reply(`⚙️ *MESIN BERJALAN...*\nMengolah: ${inputItem.toUpperCase()} ➡️ ${m.product || m.output.toUpperCase()}\n⏳ Waktu: ${m.duration/60000} Menit.`);
    }

    // ============================================================
    // 🏭 CEK PABRIK (!pabrik)
    // ============================================================
    if (command === 'pabrik') {
        let txt = `🏭 *STATUS PABRIK*\n\n`;
        
        // Cek status mesin
        if (user.farm.processing.length === 0) {
            txt += "_Semua mesin nganggur._\n";
        } else {
            let completed = [];
            let remaining = [];

            user.farm.processing.forEach(p => {
                if (now >= p.finishAt) {
                    // Selesai -> Masuk Inventory
                    if (!user.farm.inventory[p.product]) user.farm.inventory[p.product] = 0;
                    user.farm.inventory[p.product] += 1;
                    completed.push(p.product);
                } else {
                    const timeLeft = Math.ceil((p.finishAt - now) / 60000);
                    remaining.push(p);
                    txt += `⚙️ ${MACHINES[p.machine].name}: ⏳ ${timeLeft} menit lagi\n`;
                }
            });

            // Update DB jika ada yang selesai
            if (completed.length > 0) {
                user.farm.processing = remaining;
                saveDB(db);
                txt += `\n✅ *PRODUKSI SELESAI:*\n+ ${completed.join(', ').toUpperCase()}\n_(Otomatis masuk gudang)_`;
            }
        }
        return msg.reply(txt);
    }

    // ============================================================
    // 🌱 FITUR LADANG (TANAM - SAMA SEPERTI SEBELUMNYA)
    // ============================================================
    if (command === 'tanam') {
        const cropName = args[0]?.toLowerCase();
        if (!cropName || !CROPS[cropName]) {
            let txt = `🌱 *LIST TANAMAN*\n`;
            for (let [k, v] of Object.entries(CROPS)) {
                txt += `🔹 *${k.toUpperCase()}* (Modal: Rp ${fmt(v.modal)})\n`;
            }
            return msg.reply(txt);
        }
        if (user.farm.plants.length >= 5) return msg.reply("❌ Ladang penuh!");
        if (user.balance < CROPS[cropName].modal) return msg.reply("❌ Uang kurang.");

        user.balance -= CROPS[cropName].modal;
        user.farm.plants.push({ name: cropName, readyAt: now + CROPS[cropName].duration });
        saveDB(db);
        return msg.reply(`✅ Menanam ${cropName}.`);
    }

    if (command === 'ladang') {
        let txt = `🌾 *LADANG*\n`;
        user.farm.plants.forEach((p, i) => {
            const sisa = p.readyAt - now;
            txt += `${i+1}. ${p.name.toUpperCase()}: ${sisa <= 0 ? "✅ SIAP" : Math.ceil(sisa/60000) + " mnt"}\n`;
        });
        
        txt += `\n📦 *GUDANG & PRODUK JADI:*\n`;
        for (let [k, v] of Object.entries(user.farm.inventory)) {
            if (v > 0) txt += `📦 ${k.toUpperCase()}: ${v} Unit\n`;
        }
        return msg.reply(txt);
    }

    if (command === 'panen') {
        let panen = [];
        let sisa = [];
        for (let p of user.farm.plants) {
            if (now >= p.readyAt) {
                if (!user.farm.inventory[p.name]) user.farm.inventory[p.name] = 0;
                user.farm.inventory[p.name] += 1;
                panen.push(p.name);
            } else sisa.push(p);
        }
        if(!panen.length) return msg.reply("❌ Belum ada yang siap panen.");
        user.farm.plants = sisa;
        saveDB(db);
        return msg.reply(`✅ Panen: ${panen.join(', ')}`);
    }

    // ============================================================
    // 💰 JUAL (RAW MATERIAL / PRODUK JADI)
    // ============================================================
    if (command === 'jual') {
        const item = args[0]?.toLowerCase();
        if (!item || !user.farm.inventory[item] || user.farm.inventory[item] <= 0) {
            return msg.reply("❌ Barang kosong di gudang.\nCek `!ladang` untuk lihat stok.");
        }

        let hargaJual = 0;

        // Cek apakah barang mentah?
        if (db.market.commodities[item]) {
            hargaJual = db.market.commodities[item];
        } 
        // Cek apakah barang olahan (Pabrik)?
        else {
            // Cari harga di mesin
            for (let key in MACHINES) {
                if (MACHINES[key].output === item) {
                    hargaJual = MACHINES[key].sellPrice;
                    break;
                }
            }
        }

        if (hargaJual === 0) return msg.reply("❌ Barang tidak laku dijual.");

        const qty = user.farm.inventory[item];
        const total = hargaJual * qty;

        user.balance += total;
        user.farm.inventory[item] = 0;
        saveDB(db);

        return msg.reply(`💰 *TERJUAL*\nBarang: ${item.toUpperCase()} (${qty} Unit)\n💵 Total: Rp ${fmt(total)}`);
    }
    
    // Command !pasar hanya untuk cek harga mentah
    if (command === 'pasar') {
        let txt = `🏪 *PASAR KOMODITAS (BAHAN MENTAH)*\n\n`;
        for (let [k, v] of Object.entries(db.market.commodities)) {
            txt += `🔹 ${k.toUpperCase()}: Rp ${fmt(v)}\n`;
        }
        txt += `\n💡 Tips: Olah barang di \`!pabrik\` agar harga jual naik berkali lipat!`;
        return msg.reply(txt);
    }
};
