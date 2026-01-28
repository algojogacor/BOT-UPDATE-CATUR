const yahooFinance = require('yahoo-finance2').default; // Library wajib!
const { saveDB } = require('../helpers/database');

// HELPER FORMAT ANGKA
const fmt = (num) => Math.floor(Number(num)).toLocaleString('id-ID');

// DAFTAR SAHAM (Format Yahoo Finance pakai akhiran .JK untuk Indonesia)
const STOCK_MAPPING = {
    'BBCA': 'BBCA.JK',
    'BBRI': 'BBRI.JK',
    'BMRI': 'BMRI.JK',
    'TLKM': 'TLKM.JK',
    'ASII': 'ASII.JK',
    'UNTR': 'UNTR.JK',
    'GOTO': 'GOTO.JK',
    'ANTM': 'ANTM.JK',
    'ADRO': 'ADRO.JK',
    'BREN': 'BREN.JK' // Tambahan saham hot
};

module.exports = async (command, args, msg, user, db) => {
    // Init Database User
    if (typeof user.balance === 'undefined') user.balance = 0;
    if (typeof user.portfolio === 'undefined') user.portfolio = {};
    
    // Init Database Market (Cache biar ga spamming Yahoo)
    if (!db.stockMarket) db.stockMarket = { prices: {}, lastUpdate: 0 };
    
    const market = db.stockMarket;
    const now = Date.now();
    
    // Update data setiap 1 menit (Real-Time)
    const CACHE_TIME = 60 * 1000; 

    // ============================================================
    // 📡 FETCH REAL DATA (YAHOO FINANCE)
    // ============================================================
    if (now - market.lastUpdate > CACHE_TIME) {
        try {
            // console.log("🔄 Fetching data Yahoo Finance...");
            
            // Kita ambil data satu per satu (Yahoo Finance jarang limit)
            for (const [ticker, symbol] of Object.entries(STOCK_MAPPING)) {
                try {
                    const quote = await yahooFinance.quote(symbol);
                    
                    if (quote) {
                        market.prices[ticker] = {
                            price: quote.regularMarketPrice, // Harga Real-time
                            change: quote.regularMarketChangePercent || 0, // % Perubahan
                            prevClose: quote.regularMarketPreviousClose,
                            name: ticker
                        };
                    }
                } catch (err) {
                    console.error(`⚠️ Gagal fetch ${ticker}: ${err.message}`);
                    // Kalau gagal, biarkan pakai harga lama di database (jangan crash)
                }
            }

            market.lastUpdate = now;
            saveDB(db);
            // console.log("✅ Market Updated!");

        } catch (error) {
            console.error("❌ Yahoo Finance Error:", error.message);
        }
    }

    const validCommands = ['saham', 'stock', 'market', 'belisaham', 'buystock', 'jualsaham', 'sellstock', 'porto', 'dividen', 'claim'];
    if (!validCommands.includes(command)) return;

    // ============================================================
    // COMMANDS
    // ============================================================

    // 1. MARKET UI (REAL TIME)
    if (command === 'saham' || command === 'stock' || command === 'market') {
        const date = new Date();
        const hour = date.getHours(); 
        const day = date.getDay();
        // Bursa buka jam 09:00 - 16:00 WIB (Senin-Jumat)
        // Server biasanya UTC, sesuaikan jam server kamu (+7 untuk WIB)
        // Anggap saja status berdasarkan data Yahoo (kalau ada pergerakan = buka)
        
        let txt = `📈 *BURSA EFEK INDONESIA (IDX)*\n`;
        txt += `Sumber: _Yahoo Finance (Real Data)_\n`;
        txt += `------------------\n`;

        let naik = 0; let turun = 0;

        for (const ticker of Object.keys(STOCK_MAPPING)) {
            const data = market.prices[ticker];
            if (data) {
                const isGreen = data.change >= 0;
                const icon = isGreen ? '🟢' : '🔴';
                const sign = isGreen ? '+' : '';
                
                // Format: 🟢 BBCA: Rp 10.200 (+1.25%)
                txt += `${icon} *${ticker}*: Rp ${fmt(data.price)} (${sign}${data.change.toFixed(2)}%) \n`;

                if(isGreen) naik++; else turun++;
            } else {
                txt += `⚪ *${ticker}*: _Loading data..._\n`;
            }
        }
        
        txt += `------------------\n`;
        txt += `📊 ${naik} Naik, ${turun} Turun\n`;
        txt += `💰 Saldo: Rp ${fmt(user.balance)}\n`;
        txt += `💡 \`!belisaham <kode> <lembar>\``;
        return msg.reply(txt);
    }

    // 2. BELI SAHAM (REAL PRICE)
    if (command === 'belisaham' || command === 'buystock') {
        const ticker = args[0]?.toUpperCase();
        let qtyRaw = args[1];

        if (!STOCK_MAPPING[ticker]) return msg.reply(`❌ Saham tidak terdaftar.\nList: ${Object.keys(STOCK_MAPPING).join(', ')}`);
        
        // Pastikan harga sudah ada
        if (!market.prices[ticker] || !market.prices[ticker].price) {
            // Coba paksa update sekali kalau data kosong
            return msg.reply("⏳ Data pasar sedang diambil... Coba ketik `!saham` dulu lalu ulangi.");
        }
        
        const price = market.prices[ticker].price;
        let qty = parseInt(qtyRaw);

        // Beli Max
        if (qtyRaw === 'max' || qtyRaw === 'all') {
            const maxBuy = Math.floor(user.balance / (price * 1.003)); 
            qty = maxBuy;
        }

        if (isNaN(qty) || qty < 1) return msg.reply("❌ Jumlah lembar salah (Min 1 lembar).");

        const rawCost = price * qty;
        const fee = Math.floor(rawCost * 0.003); // Fee 0.3%
        const total = rawCost + fee;

        if (user.balance < total) return msg.reply(`❌ Uang kurang! Butuh Rp ${fmt(total)}`);

        user.balance -= total;

        if (!user.portfolio[ticker]) user.portfolio[ticker] = { qty: 0, avg: 0 };
        const p = user.portfolio[ticker];
        
        // Average Down Logic
        const oldVal = p.qty * p.avg;
        p.avg = Math.floor((oldVal + rawCost) / (p.qty + qty));
        p.qty += qty;

        saveDB(db);
        return msg.reply(`✅ *ORDER MATCHED*\nEmiten: ${ticker}\nVol: ${fmt(qty)} Lembar\nHarga: Rp ${fmt(price)}\nFee: Rp ${fmt(fee)}\n📉 Total Bayar: Rp ${fmt(total)}`);
    }

    // 3. JUAL SAHAM (REAL PRICE)
    if (command === 'jualsaham' || command === 'sellstock') {
        const ticker = args[0]?.toUpperCase();
        let qty = args[1];

        if (!user.portfolio[ticker] || user.portfolio[ticker].qty <= 0) return msg.reply("❌ Gak punya saham ini.");
        
        const p = user.portfolio[ticker];
        if (qty === 'all') qty = p.qty;
        qty = parseInt(qty);

        if (isNaN(qty) || qty < 1 || qty > p.qty) return msg.reply("❌ Jumlah salah/kurang.");

        // Pastikan harga ada
        if (!market.prices[ticker]) return msg.reply("❌ Gagal ambil harga pasar. Coba lagi nanti.");

        const price = market.prices[ticker].price;
        const gross = price * qty;

        // Pajak Orang Kaya (Progresif)
        let taxRate = 0.05; 
        if (user.balance > 100_000_000_000_000) taxRate = 0.30; 

        const tax = Math.floor(gross * taxRate);
        const net = gross - tax;

        const modal = p.avg * qty;
        const profit = net - modal;
        const pct = ((profit / modal) * 100).toFixed(2);
        const status = profit >= 0 ? '🟢 Cuan' : '🔴 Boncos';

        user.balance += net;
        p.qty -= qty;
        if (p.qty === 0) delete user.portfolio[ticker];

        saveDB(db);
        return msg.reply(`✅ *SELL ORDER DONE*\nEmiten: ${ticker}\nVol: ${fmt(qty)} Lembar\nHarga: Rp ${fmt(price)}\n\n💰 Gross: Rp ${fmt(gross)}\n💸 Tax (${taxRate*100}%): Rp ${fmt(tax)}\n💵 *Net: Rp ${fmt(net)}*\n\n📊 P/L: ${status} Rp ${fmt(profit)} (${pct}%)`);
    }

    // 4. PORTO (REAL VALUATION)
    if (command === 'porto' || command === 'pf') {
        let txt = `💼 *PORTOFOLIO SAHAM*\n`;
        let totalVal = 0;
        let totalGain = 0;
        let hasStock = false;
        let rate = user.balance > 100_000_000_000_000 ? 0.30 : 0.05;

        for (let [ticker, data] of Object.entries(user.portfolio)) {
            if (data.qty > 0) {
                // Gunakan harga market terbaru, atau fallback ke harga beli jika market error
                const currentData = market.prices[ticker];
                const price = currentData ? currentData.price : data.avg;
                
                const gross = price * data.qty;
                const net = gross - (gross * rate); 
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
        
        return msg.reply(txt);
    }

    // 5. DIVIDEN
    if (command === 'dividen' || command === 'claim') {
        const COOLDOWN = 3600000; // 1 Jam
        const diff = now - (user.lastDividend || 0);

        if (diff < COOLDOWN) return msg.reply(`⏳ Tunggu ${Math.ceil((COOLDOWN - diff)/60000)} menit.`);

        let totalAsset = 0;
        for (let [ticker, data] of Object.entries(user.portfolio)) {
            if (data.qty > 0 && market.prices[ticker]) {
                totalAsset += market.prices[ticker].price * data.qty;
            }
        }

        if (totalAsset === 0) return msg.reply("❌ Gak punya saham.");

        const amount = Math.floor(totalAsset * 0.01);
        user.balance += amount;
        user.lastDividend = now;
        saveDB(db);

        return msg.reply(`💸 *DIVIDEN CAIR*\nTotal Aset: Rp ${fmt(totalAsset)}\nYield: 1%\n💵 *Diterima: Rp ${fmt(amount)}*`);
    }
};
