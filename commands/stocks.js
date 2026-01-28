const axios = require('axios');
const cheerio = require('cheerio'); 
const { saveDB } = require('../helpers/database');

// HELPER FORMAT ANGKA
const fmt = (num) => Math.floor(Number(num)).toLocaleString('id-ID');

// DAFTAR SAHAM
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
    'BREN': 'BREN.JK'
};

module.exports = async (command, args, msg, user, db) => {
    // Init Database
    if (typeof user.balance === 'undefined') user.balance = 0;
    if (typeof user.portfolio === 'undefined') user.portfolio = {};
    if (!db.stockMarket) db.stockMarket = { prices: {}, lastUpdate: 0 };
    
    const market = db.stockMarket;
    const now = Date.now();
    
    // Update data setiap 1 detik
    const CACHE_TIME = 1 * 1000; 

    // ============================================================
    // 📡 FETCH REAL DATA
    // ============================================================
    if (now - market.lastUpdate > CACHE_TIME) {
        try {
            
            // Header Palsu (Agar dikira Browser Manusia)
            const headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            };

            for (const [ticker, symbol] of Object.entries(STOCK_MAPPING)) {
                try {
                    // Request HTML Halaman Saham
                    const url = `https://finance.yahoo.com/quote/${symbol}`;
                    const { data } = await axios.get(url, { headers });
                    
                    // Parsing HTML dengan Cheerio
                    const $ = cheerio.load(data);
                    
                    // Yahoo menaruh harga di tag <fin-streamer>
                    // Kita ambil value dari atributnya
                    const priceRaw = $('fin-streamer[data-field="regularMarketPrice"]').attr('value');
                    const changeRaw = $('fin-streamer[data-field="regularMarketChangePercent"]').attr('value');
                    
                    if (priceRaw) {
                        market.prices[ticker] = {
                            price: parseFloat(priceRaw),
                            change: parseFloat(changeRaw) || 0,
                            name: ticker
                        };
                    } 
                } catch (err) {
                    console.error(`⚠️ Gagal scrape ${ticker}: ${err.message}`);
                    // Biarkan pakai harga lama di cache kalau gagal
                }
            }

            market.lastUpdate = now;
            saveDB(db);

        } catch (error) {
            console.error("❌ Stock Scraping Error:", error.message);
        }
    }

    const validCommands = ['saham', 'stock', 'market', 'belisaham', 'buystock', 'jualsaham', 'sellstock', 'porto', 'dividen', 'claim'];
    if (!validCommands.includes(command)) return;

    // ============================================================
    // COMMANDS
    // ============================================================

    // 1. MARKET UI
    if (command === 'saham' || command === 'stock' || command === 'market') {
        const date = new Date();
        const hour = date.getHours() + 7; // WIB Estimasi
        const day = date.getDay();
        const isMarketOpen = (day >= 1 && day <= 5) && (hour >= 9 && hour < 16);
        let statusPasar = isMarketOpen ? '🟢 BUKA' : '🔴 TUTUP';

        let txt = `📈 *BURSA EFEK INDONESIA (IDX)*\n`;
        txt += `Status: ${statusPasar} _(Real-Time)_\n`;
        txt += `------------------\n`;

        let naik = 0; let turun = 0;

        for (const ticker of Object.keys(STOCK_MAPPING)) {
            const data = market.prices[ticker];
            if (data) {
                const isGreen = data.change >= 0;
                const icon = isGreen ? '🟢' : '🔴';
                const sign = isGreen ? '+' : '';
                
                txt += `${icon} *${ticker}*: Rp ${fmt(data.price)} (${sign}${data.change.toFixed(2)}%) \n`;

                if(isGreen) naik++; else turun++;
            } else {
                txt += `⚪ *${ticker}*: _Loading..._\n`;
            }
        }
        
        txt += `------------------\n`;
        txt += `📊 ${naik} Naik, ${turun} Turun\n`;
        txt += `💰 Saldo: Rp ${fmt(user.balance)}\n`;
        txt += `💡 \`!belisaham <kode> <lembar>\``;
        return msg.reply(txt);
    }

    // 2. BELI SAHAM
    if (command === 'belisaham' || command === 'buystock') {
        const ticker = args[0]?.toUpperCase();
        let qtyRaw = args[1];

        if (!STOCK_MAPPING[ticker]) return msg.reply(`❌ Saham tidak terdaftar.\nList: ${Object.keys(STOCK_MAPPING).join(', ')}`);
        if (!market.prices[ticker] || !market.prices[ticker].price) return msg.reply("⏳ Sedang mengambil data pasar... Coba 5 detik lagi.");
        
        const price = market.prices[ticker].price;
        let qty = parseInt(qtyRaw);

        if (qtyRaw === 'max' || qtyRaw === 'all') {
            const maxBuy = Math.floor(user.balance / (price * 1.003)); 
            qty = maxBuy;
        }

        if (isNaN(qty) || qty < 1) return msg.reply("❌ Jumlah lembar salah.");

        const rawCost = price * qty;
        const fee = Math.floor(rawCost * 0.003);
        const total = rawCost + fee;

        if (user.balance < total) return msg.reply(`❌ Uang kurang! Butuh Rp ${fmt(total)}`);

        user.balance -= total;

        if (!user.portfolio[ticker]) user.portfolio[ticker] = { qty: 0, avg: 0 };
        const p = user.portfolio[ticker];
        
        const oldVal = p.qty * p.avg;
        p.avg = Math.floor((oldVal + rawCost) / (p.qty + qty));
        p.qty += qty;

        saveDB(db);
        return msg.reply(`✅ *ORDER MATCHED*\nEmiten: ${ticker}\nVol: ${fmt(qty)} Lembar\nHarga: Rp ${fmt(price)}\nFee: Rp ${fmt(fee)}\n📉 Total Bayar: Rp ${fmt(total)}`);
    }

    // 3. JUAL SAHAM
    if (command === 'jualsaham' || command === 'sellstock') {
        const ticker = args[0]?.toUpperCase();
        let qty = args[1];

        if (!user.portfolio[ticker] || user.portfolio[ticker].qty <= 0) return msg.reply("❌ Gak punya saham ini.");
        
        const p = user.portfolio[ticker];
        if (qty === 'all') qty = p.qty;
        qty = parseInt(qty);

        if (isNaN(qty) || qty < 1 || qty > p.qty) return msg.reply("❌ Jumlah salah.");
        if (!market.prices[ticker]) return msg.reply("❌ Data pasar belum siap.");

        const price = market.prices[ticker].price;
        const gross = price * qty;

        let taxRate = user.balance > 100_000_000_000_000 ? 0.30 : 0.05; 
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
        return msg.reply(`✅ *SELL ORDER DONE*\nEmiten: ${ticker}\nVol: ${fmt(qty)} Lembar\nHarga: Rp ${fmt(price)}\n\n💰 Gross: Rp ${fmt(gross)}\n💸 Tax: Rp ${fmt(tax)}\n💵 *Net: Rp ${fmt(net)}*\n\n📊 P/L: ${status} Rp ${fmt(profit)} (${pct}%)`);
    }

    // 4. PORTO
    if (command === 'porto' || command === 'pf') {
        let txt = `💼 *PORTOFOLIO SAHAM*\n`;
        let totalVal = 0;
        let totalGain = 0;
        let hasStock = false;
        let rate = user.balance > 100_000_000_000_000 ? 0.30 : 0.05;

        for (let [ticker, data] of Object.entries(user.portfolio)) {
            if (data.qty > 0) {
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
        const COOLDOWN = 3600000; 
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
