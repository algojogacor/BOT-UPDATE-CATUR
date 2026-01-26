const { saveDB } = require('../helpers/database');

// FEE BROKER (3%)
const FEE_BUY = 0.03; 

// INTERVAL UPDATE HARGA (5 MENIT)
const MARKET_INTERVAL = 5 * 60 * 1000; 

// HELPER FORMAT ANGKA
const fmt = (num) => Math.floor(Number(num)).toLocaleString('id-ID');

// KONFIGURASI SAHAM
const STOCKS = {
    // TIER 1: RECEH
    GOTO: { name: "GOTO", base: 10_000_000, volatility: 0.15 }, 
    FREN: { name: "FREN", base: 5_000_000, volatility: 0.15 },

    // TIER 2: BLUE CHIP
    TLKM: { name: "TLKM", base: 400_000_000, volatility: 0.05 },
    BBCA: { name: "BCA", base: 950_000_000, volatility: 0.03 }, 
    BMRI: { name: "BMRI", base: 600_000_000, volatility: 0.04 },

    // TIER 3: HIGH CLASS
    GGRM: { name: "GGRM", base: 2_500_000_000, volatility: 0.08 },
    UNTR: { name: "UNTR", base: 2_800_000_000, volatility: 0.07 },
    
    // TIER 4: SULTAN ONLY
    IHSG: { name: "IHSG", base: 75_000_000_000, volatility: 0.02 }, 
    BTC: { name: "BTC", base: 500_000_000_000, volatility: 0.20 } 
};

// --- LOGIKA PASAR (DETERMINISTIC / STABIL) ---
const getStockData = (ticker) => {
    const stock = STOCKS[ticker];
    const now = Date.now();
    
    // Gunakan waktu per blok 5 menit
    const timeSeed = Math.floor(now / MARKET_INTERVAL); 

    // Generate angka acak namun konsisten berdasarkan timeSeed
    // Fungsi sin(seed) akan selalu menghasilkan angka yang sama untuk seed yang sama
    const uniqueVal = Math.sin(timeSeed + stock.name.length * 11); 
    const trendVal = Math.sin(timeSeed / 5); // Tren jangka panjang (naik turun pelan)

    // Gabungkan Tren + Noise Unik
    const movement = (trendVal * 0.2) + (uniqueVal * stock.volatility);

    // Hitung Harga
    let changeAmount = stock.base * movement;
    let currentPrice = Math.floor(stock.base + changeAmount);

    // KRISIS: Cek setiap 4 jam 
    // Menggunakan Math.abs
    const isCrash = (timeSeed % 48 === 0) && (Math.abs(uniqueVal) > 0.5); 
    
    if (isCrash) {
        currentPrice = Math.floor(currentPrice * 0.7); // Diskon 30%
    }

    return {
        price: Math.max(1000, currentPrice),
        isCrash: isCrash
    };
};

module.exports = async (command, args, msg, user, db) => {
    const validCommands = ['saham', 'stock', 'market', 'belisaham', 'buystock', 'jualsaham', 'sellstock', 'porto', 'dividen', 'claim'];
    if (!validCommands.includes(command)) return;

    if (!user.portfolio) user.portfolio = {};

    // 1. MARKET
    if (command === 'saham' || command === 'stock' || command === 'market') {
        const now = Date.now();
        // Hitung sisa waktu ke update berikutnya
        const nextTime = Math.ceil(now / MARKET_INTERVAL) * MARKET_INTERVAL;
        const diff = nextTime - now;
        const m = Math.floor(diff / 60000);
        const s = Math.floor((diff % 60000) / 1000);

        const { isCrash } = getStockData('IHSG');

        let txt = isCrash 
            ? `🚨 *MARKET CRASH* (Semua Anjlok) 🚨\n`
            : `📈 *BURSA EFEK (BEI)* 📉\n`;
        
        txt += `⏳ Next Update: ${m}m ${s}s\n`; // Countdown
        txt += `------------------\n`;

        for (let [ticker, data] of Object.entries(STOCKS)) {
            const { price } = getStockData(ticker);
            // Tampilan Polos
            txt += `🔹 *${ticker}*: Rp ${fmt(price)}\n`;
        }
        
        txt += `\n💡 \`!belisaham <code> <qty>\``;
        return msg.reply(txt);
    }

    // 2. BUY
    if (command === 'belisaham' || command === 'buystock') {
        const ticker = args[0]?.toUpperCase();
        let qtyRaw = args[1];

        if (!STOCKS[ticker]) return msg.reply("❌ Kode saham salah.");
        
        let qty = parseInt(qtyRaw);
        const { price } = getStockData(ticker);

        if (qtyRaw === 'max' || qtyRaw === 'all') {
            qty = Math.floor(user.balance / (price * (1 + FEE_BUY)));
            if (qty < 1) return msg.reply(`❌ Uang tidak cukup.`);
        }

        if (isNaN(qty) || qty < 1) return msg.reply("❌ Jumlah salah.");

        const rawCost = price * qty;
        const fee = Math.floor(rawCost * FEE_BUY);
        const total = rawCost + fee;

        if (user.balance < total) return msg.reply(`❌ Uang kurang Rp ${fmt(total - user.balance)}`);

        user.balance -= total;

        if (!user.portfolio[ticker]) user.portfolio[ticker] = { qty: 0, avg: 0 };
        const p = user.portfolio[ticker];
        
        // Average Down Logic
        p.avg = Math.floor(((p.qty * p.avg) + rawCost) / (p.qty + qty));
        p.qty += qty;

        saveDB(db);
        return msg.reply(`✅ *BUY SUKSES*\nCode: ${ticker}\nVol: ${fmt(qty)}\nPrice: ${fmt(price)}\nFee (3%): ${fmt(fee)}\n📉 Total: ${fmt(total)}`);
    }

    // 3. SELL
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
        let rate = 0.05; 
        if (user.balance > 100_000_000_000_000) rate = 0.50; 
        else if (user.balance > 10_000_000_000_000) rate = 0.20; 

        const tax = Math.floor(gross * rate);
        const net = gross - tax;

        const profit = net - (p.avg * qty);
        const pct = ((profit / (p.avg * qty)) * 100).toFixed(2);
        const status = profit >= 0 ? '🟢' : '🔴';

        user.balance += net;
        p.qty -= qty;
        if (p.qty === 0) delete user.portfolio[ticker];

        saveDB(db);
        return msg.reply(`✅ *SELL SUKSES*\nCode: ${ticker}\nVol: ${fmt(qty)}\nPrice: ${fmt(price)}\n\n💰 Gross: ${fmt(gross)}\n💸 Tax (${rate*100}%): ${fmt(tax)}\n💵 *Net: ${fmt(net)}*\n\n📊 P/L: ${status} ${fmt(profit)} (${pct}%)`);
    }

    // 4. PORTO
    if (command === 'porto' || command === 'pf') {
        let txt = `💼 *PORTOFOLIO*\n`;
        let totalVal = 0;
        let totalGain = 0;
        let hasStock = false;

        // Est. Tax Rate Display
        let rate = 0.05;
        if (user.balance > 100_000_000_000_000) rate = 0.50;
        else if (user.balance > 10_000_000_000_000) rate = 0.20;

        for (let [ticker, data] of Object.entries(user.portfolio)) {
            if (data.qty > 0) {
                const { price } = getStockData(ticker); 
                
                const gross = price * data.qty;
                const net = gross - (gross * rate);
                const gain = net - (data.avg * data.qty);
                const pct = ((gain / (data.avg * data.qty)) * 100).toFixed(1);
                
                txt += `📜 *${ticker}* (${fmt(data.qty)})\n`;
                txt += `   Avg: ${fmt(data.avg)} | Now: ${fmt(price)}\n`;
                txt += `   ${gain >= 0 ? '🟢' : '🔴'} P/L: ${fmt(gain)} (${pct}%)\n\n`;

                totalVal += net;
                totalGain += gain;
                hasStock = true;
            }
        }

        if (!hasStock) return msg.reply("💼 Kosong.");

        txt += `━━━━━━━━━━\n`;
        txt += `💰 Net Asset: ${fmt(totalVal)}\n`;
        txt += `${totalGain >= 0 ? '📈' : '📉'} Floating P/L: ${fmt(totalGain)}`;
        txt += `\n_(After Tax ${rate*100}%)_`;

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
            if (data.qty > 0) totalAsset += getStockData(ticker).price * data.qty;
        }

        if (totalAsset === 0) return msg.reply("❌ Gak punya saham.");

        const amount = Math.floor(totalAsset * 0.03); // 3%
        user.balance += amount;
        user.lastDividend = now;
        saveDB(db);

        return msg.reply(`💸 *DIVIDEN CAIR*\nAsset: ${fmt(totalAsset)}\nYield: 3%\n💵 *Diterima: ${fmt(amount)}*`);
    }
};
