const { saveDB } = require('../helpers/database');

// FEE BROKER (3%)
const FEE_BUY = 0.03; 

// INTERVAL UPDATE (5 MENIT - BIAR STABIL)
const MARKET_INTERVAL = 5 * 60 * 1000; 

// HELPER FORMAT ANGKA
const fmt = (num) => Math.floor(Number(num)).toLocaleString('id-ID');

// KONFIGURASI SAHAM (REAL WORLD PARAMETERS)
// beta: Sensitivitas terhadap IHSG (1.0 = Ikut arus, >1.5 = Liar/Gorengan)
const STOCKS = {
    // TIER 1: GORENGAN (High Risk, High Beta)
    GOTO: { name: "GoTo", base: 10_000_000, beta: 2.5 }, 
    FREN: { name: "Smartfren", base: 5_000_000, beta: 3.0 },

    // TIER 2: BLUE CHIP (Penggerak IHSG)
    TLKM: { name: "Telkom", base: 400_000_000, beta: 1.1 },
    BBCA: { name: "BCA", base: 950_000_000, beta: 1.0 }, 
    BMRI: { name: "Mandiri", base: 600_000_000, beta: 1.2 },

    // TIER 3: CYCLICAL (Tergantung Komoditas)
    GGRM: { name: "G.Garam", base: 2_500_000_000, beta: 0.8 },
    UNTR: { name: "U.Tractors", base: 2_800_000_000, beta: 1.5 },
    
    // INDUKS (Market Maker)
    IHSG: { name: "IHSG", base: 75_000_000_000, beta: 1.0 }, 
    BTC:  { name: "BTC ETF", base: 500_000_000_000, beta: 0.2 } // Tidak peduli IHSG (Uncorrelated)
};

// BERITA PASAR INDONESIA
const NEWS_POOL = [
    { txt: "🇮🇩 BI menahan suku bunga acuan. IHSG Stabil.", sent: 0.0 },
    { txt: "📈 Investor Asing 'Net Buy' Triliunan Rupiah!", sent: 0.02 },
    { txt: "📉 Rupiah melemah ke Rp 16.000/USD. Market lesu.", sent: -0.015 },
    { txt: "🔴 Inflasi Indonesia naik di atas ekspektasi.", sent: -0.02 },
    { txt: "🚀 Laporan keuangan BBCA & BMRI mencetak rekor!", sent: 0.025 },
    { txt: "☠️ Isu Gagal Bayar emiten konstruksi BUMN.", sent: -0.03 },
    { txt: "🥬 Harga komoditas Batubara & CPO anjlok.", sent: -0.01 },
    { txt: "🏢 Window Dressing akhir tahun dimulai!", sent: 0.03 }
];

// --- LOGIKA PASAR (IHSG DRIVEN) ---
const getStockData = (ticker) => {
    const config = STOCKS[ticker];
    const now = Date.now();
    
    // Seed Waktu (Berubah tiap 5 menit)
    // Harga KUNCI selama 5 menit agar tidak ada slippage
    const timeSeed = Math.floor(now / MARKET_INTERVAL); 

    // 1. Tentukan Sentimen IHSG (Pasar Global)
    // Menggunakan random yang konsisten berdasarkan timeSeed
    const rng = Math.sin(timeSeed * 999); // Angka acak -1 s/d 1
    const newsIndex = Math.abs(timeSeed) % NEWS_POOL.length;
    const activeNews = NEWS_POOL[newsIndex];

    // Pergerakan Dasar IHSG (Sentiment + Random Noise)
    const ihsgMove = activeNews.sent + (rng * 0.005); 

    // 2. Tentukan Pergerakan Saham Spesifik
    let stockMove = 0;

    if (ticker === 'BTC') {
        // BTC jalan sendiri (Crypto correlation)
        stockMove = Math.sin(timeSeed * 123) * 0.05; 
    } else {
        // Saham mengikuti IHSG dikali Beta + Faktor Unik Gorengan
        const uniqueNoise = Math.cos(timeSeed * config.name.length) * 0.01;
        stockMove = (ihsgMove * config.beta) + uniqueNoise;
    }

    // 3. Hitung Harga Final
    let currentPrice = Math.floor(config.base * (1 + stockMove));

    // KRISIS MONETER (Jarang terjadi: Tiap 100 blok / ~8 jam)
    const isCrisis = (timeSeed % 100 === 0);
    if (isCrisis) currentPrice = Math.floor(currentPrice * 0.8); // Diskon 20%

    // Tentukan Warna
    let icon = '➡️'; // Sideways
    if (stockMove > 0.01) icon = '🚀';
    else if (stockMove > 0) icon = '🟢';
    else if (stockMove < -0.01) icon = '🩸';
    else if (stockMove < 0) icon = '🔴';

    return {
        price: Math.max(1000, currentPrice),
        trend: icon,
        news: activeNews.txt,
        change: (stockMove * 100).toFixed(2),
        isCrisis: isCrisis
    };
};

module.exports = async (command, args, msg, user, db) => {
    const validCommands = ['saham', 'stock', 'market', 'belisaham', 'buystock', 'jualsaham', 'sellstock', 'porto', 'dividen', 'claim'];
    if (!validCommands.includes(command)) return;

    if (!user.portfolio) user.portfolio = {};

    // 1. MARKET (TAMPILAN REALISTIS)
    if (command === 'saham' || command === 'stock' || command === 'market') {
        const now = Date.now();
        const nextTime = Math.ceil(now / MARKET_INTERVAL) * MARKET_INTERVAL;
        const diff = nextTime - now;
        const m = Math.floor(diff / 60000);
        const s = Math.floor((diff % 60000) / 1000);

        // Ambil Data IHSG untuk Berita Utama
        const ihsgData = getStockData('IHSG');

        let txt = ihsgData.isCrisis 
            ? `🚨 *KRISIS MONETER (IHSG ANJLOK)* 🚨\n`
            : `📈 *BURSA EFEK INDONESIA (BEI)* 📉\n`;
        
        txt += `📰 "${ihsgData.news}"\n`;
        txt += `⏳ Update: ${m}m ${s}s (Harga Terkunci)\n`;
        txt += `------------------\n`;

        for (let [ticker, data] of Object.entries(STOCKS)) {
            const { price, trend, change } = getStockData(ticker);
            // Tampilan: Icon KODE: Harga (Persen)
            txt += `${trend} *${ticker}*: Rp ${fmt(price)} (${change}%)\n`;
        }
        
        txt += `\n💰 Saldo: Rp ${fmt(user.balance)}`;
        txt += `\n💡 \`!belisaham <code> <qty>\``;
        return msg.reply(txt);
    }

    // 2. BUY (BELI LEMBAR)
    if (command === 'belisaham' || command === 'buystock') {
        const ticker = args[0]?.toUpperCase();
        let qtyRaw = args[1];

        if (!STOCKS[ticker]) return msg.reply("❌ Kode emiten salah.");
        
        let qty = parseInt(qtyRaw);
        const { price } = getStockData(ticker);

        if (qtyRaw === 'max' || qtyRaw === 'all') {
            qty = Math.floor(user.balance / (price * (1 + FEE_BUY)));
            if (qty < 1) return msg.reply(`❌ Uang tidak cukup.`);
        }

        if (isNaN(qty) || qty < 1) return msg.reply("❌ Jumlah lembar salah.");

        const rawCost = price * qty;
        const fee = Math.floor(rawCost * FEE_BUY);
        const total = rawCost + fee;

        if (user.balance < total) return msg.reply(`❌ Uang kurang Rp ${fmt(total - user.balance)}`);

        user.balance -= total;

        if (!user.portfolio[ticker]) user.portfolio[ticker] = { qty: 0, avg: 0 };
        const p = user.portfolio[ticker];
        
        // Average Down Calculator
        p.avg = Math.floor(((p.qty * p.avg) + rawCost) / (p.qty + qty));
        p.qty += qty;

        saveDB(db);
        return msg.reply(`✅ *BUY ORDER MATCHED*\nEmiten: ${ticker}\nVol: ${fmt(qty)} Lot\nPrice: Rp ${fmt(price)}\nFee (3%): Rp ${fmt(fee)}\n📉 Total: Rp ${fmt(total)}`);
    }

    // 3. SELL (PAJAK PROGRESIF SULTAN)
    if (command === 'jualsaham' || command === 'sellstock') {
        const ticker = args[0]?.toUpperCase();
        let qty = args[1];

        if (!user.portfolio[ticker] || user.portfolio[ticker].qty <= 0) return msg.reply("❌ Gak punya saham ini.");

        const p = user.portfolio[ticker];
        if (qty === 'all') qty = p.qty;
        qty = parseInt(qty);

        if (isNaN(qty) || qty < 1 || qty > p.qty) return msg.reply("❌ Jumlah salah/kurang.");

        const { price } = getStockData(ticker);
        const gross = price * qty;

        // --- PAJAK PROGRESIF ---
        let rate = 0.05; // 5% Standard
        if (user.balance > 100_000_000_000_000) rate = 0.50; // >100T Pajak 50%
        else if (user.balance > 10_000_000_000_000) rate = 0.20; // >10T Pajak 20%

        const tax = Math.floor(gross * rate);
        const net = gross - tax;

        const profit = net - (p.avg * qty);
        const pct = ((profit / (p.avg * qty)) * 100).toFixed(2);
        const status = profit >= 0 ? '🟢 Cuan' : '🔴 Boncos';

        user.balance += net;
        p.qty -= qty;
        if (p.qty === 0) delete user.portfolio[ticker];

        saveDB(db);
        return msg.reply(`✅ *SELL ORDER MATCHED*\nEmiten: ${ticker}\nVol: ${fmt(qty)} Lot\nPrice: Rp ${fmt(price)}\n\n💰 Gross: Rp ${fmt(gross)}\n💸 Tax (${rate*100}%): Rp ${fmt(tax)}\n💵 *Net: Rp ${fmt(net)}*\n\n📊 P/L: ${status} Rp ${fmt(profit)} (${pct}%)`);
    }

    // 4. PORTO (VALUASI REAL-TIME)
    if (command === 'porto' || command === 'pf') {
        let txt = `💼 *PORTOFOLIO EFEK*\n`;
        let totalVal = 0;
        let totalGain = 0;
        let hasStock = false;

        // Estimasi Pajak di Display
        let rate = 0.05;
        if (user.balance > 100_000_000_000_000) rate = 0.50;
        else if (user.balance > 10_000_000_000_000) rate = 0.20;

        for (let [ticker, data] of Object.entries(user.portfolio)) {
            if (data.qty > 0) {
                const { price } = getStockData(ticker); 
                
                const gross = price * data.qty;
                const net = gross - (gross * rate); // Nilai bersih setelah pajak
                const gain = net - (data.avg * data.qty);
                const pct = ((gain / (data.avg * data.qty)) * 100).toFixed(1);
                
                txt += `📜 *${ticker}* (${fmt(data.qty)})\n`;
                txt += `   Avg: Rp ${fmt(data.avg)} | Now: Rp ${fmt(price)}\n`;
                txt += `   ${gain >= 0 ? '🟢' : '🔴'} P/L: Rp ${fmt(gain)} (${pct}%)\n\n`;

                totalVal += net;
                totalGain += gain;
                hasStock = true;
            }
        }

        if (!hasStock) return msg.reply("💼 Portofolio kosong.");

        txt += `━━━━━━━━━━\n`;
        txt += `💰 Aset Bersih: Rp ${fmt(totalVal)}\n`;
        txt += `${totalGain >= 0 ? '📈' : '📉'} Floating P/L: Rp ${fmt(totalGain)}`;
        txt += `\n_(Valuasi bersih setelah estimasi pajak ${rate*100}%)_`;

        return msg.reply(txt);
    }

    // 5. DIVIDEN
    if (command === 'dividen' || command === 'claim') {
        const COOLDOWN = 3600000; 
        const now = Date.now();
        const diff = now - (user.lastDividend || 0);

        if (diff < COOLDOWN) return msg.reply(`⏳ Tunggu ${Math.ceil((COOLDOWN - diff)/60000)} menit.`);

        let totalAsset = 0;
        for (let [ticker, data] of Object.entries(user.portfolio)) {
            if (data.qty > 0) {
                // Gunakan harga dasar (base) untuk perhitungan dividen agar stabil
                totalAsset += STOCKS[ticker].base * data.qty;
            }
        }

        if (totalAsset === 0) return msg.reply("❌ Gak punya saham.");

        const amount = Math.floor(totalAsset * 0.03); // Yield 3%
        user.balance += amount;
        user.lastDividend = now;
        saveDB(db);

        return msg.reply(`💸 *DIVIDEN CAIR*\nBasis Aset: Rp ${fmt(totalAsset)}\nYield: 3%\n💵 *Diterima: Rp ${fmt(amount)}*`);
    }
};
