const axios = require('axios'); 
const { saveDB } = require('../helpers/database');

// HELPER FORMAT ANGKA
const fmt = (num) => Math.floor(Number(num)).toLocaleString('id-ID');

// DAFTAR SAHAM (TIKER IDX)
// Kamu bisa tambah emiten lain sesuka hati
const STOCK_LIST = [
    'BBCA', 'BBRI', 'BMRI', 'TLKM', 'ASII', 
    'UNTR', 'GOTO', 'FREN', 'ANTM', 'ADRO'
];

module.exports = async (command, args, msg, user, db) => {
    // Init User Database
    if (typeof user.balance === 'undefined') user.balance = 0;
    if (typeof user.portfolio === 'undefined') user.portfolio = {};

    // Init Market Database
    if (!db.stockMarket) db.stockMarket = { prices: {}, lastUpdate: 0 };
    
    const market = db.stockMarket;
    const now = Date.now();
    
    // Update tiap 1 menit
    const CACHE_TIME = 60 * 1000; 

    // ============================================================
    // 📡 FETCH REAL DATA (IDX INDONESIA)
    // ============================================================
    if (now - market.lastUpdate > CACHE_TIME) {
        try {
            // Kita ambil data per ticker
            for (const ticker of STOCK_LIST) {
        
                const url = `https://api.goapi.id/v1/stock/idx/${ticker}`;
                
            
                await new Promise(r => setTimeout(r, 500)); 

                const response = await axios.get(url, {
                    headers: { 'accept': 'application/json' }
                
                    // 'X-API-KEY': 'YOUR_API_KEY
                });

                const data = response.data.data;
                
                if (data) {
                    market.prices[ticker] = {
                        price: data.last_price || data.close_price, // Harga Terakhir
                        change: data.change_percent || 0, // Persentase Perubahan
                        name: data.company_name
                    };
                }
            }

            market.lastUpdate = now;
            saveDB(db);
            // console.log("✅ Stock Market Data Updated");

        } catch (error) {
            console.error("❌ Gagal update saham (Mungkin Market Tutup/Limit):", error.message);
            // Bot akan pakai harga terakhir di database
        }
    }

    const validCommands = ['saham', 'stock', 'market', 'belisaham', 'buystock', 'jualsaham', 'sellstock', 'porto', 'dividen', 'claim'];
    if (!validCommands.includes(command)) return;

    // ============================================================
    // COMMANDS
    // ============================================================

    // 1. MARKET UI (REAL TIME)
    if (command === 'saham' || command === 'stock' || command === 'market') {
        // Cek Jam Bursa (Senin-Jumat, 09:00 - 16:00 WIB)
        const date = new Date();
        const hour = date.getHours() + 7; // WIB
        const day = date.getDay();
        const isMarketOpen = (day >= 1 && day <= 5) && (hour >= 9 && hour < 16);
        
        let statusPasar = isMarketOpen ? '🟢 BUKA' : '🔴 TUTUP';

        let txt = `📈 *BURSA EFEK INDONESIA (IDX)*\n`;
        txt += `Status: ${statusPasar} (Real-Time Data)\n`;
        txt += `------------------\n`;

        let naik = 0; let turun = 0;

        for (const ticker of STOCK_LIST) {
            const data = market.prices[ticker];
            if (data) {
                const isGreen = data.change >= 0;
                const icon = isGreen ? '🟢' : '🔴';
                const sign = isGreen ? '+' : '';
                
                // Format: 🟢 BBCA: Rp 10.200 (+1.5%)
                txt += `${icon} *${ticker}*: Rp ${fmt(data.price)} (${sign}${data.change}%) \n`;

                if(isGreen) naik++; else turun++;
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

        if (!STOCK_LIST.includes(ticker)) return msg.reply(`❌ Saham tidak terdaftar. List: ${STOCK_LIST.join(', ')}`);
        if (!market.prices[ticker]) return msg.reply("❌ Data harga sedang loading... coba lagi.");
        
        const price = market.prices[ticker].price;
        let qty = parseInt(qtyRaw);

        // Fitur beli Max
        if (qtyRaw === 'max' || qtyRaw === 'all') {
            // Fee Broker 0.3%
            const maxBuy = Math.floor(user.balance / (price * 1.003)); 
            qty = maxBuy;
        }

        if (isNaN(qty) || qty < 1) return msg.reply("❌ Jumlah lembar salah (Min 1 lembar).");

        const rawCost = price * qty;
        const fee = Math.floor(rawCost * 0.003); // Fee Broker 0.3%
        const total = rawCost + fee;

        if (user.balance < total) return msg.reply(`❌ Uang kurang! Butuh Rp ${fmt(total)}`);

        user.balance -= total;

        if (!user.portfolio[ticker]) user.portfolio[ticker] = { qty: 0, avg: 0 };
        const p = user.portfolio[ticker];
        
        // Rumus Average Down
        // (Total Nilai Lama + Total Beli Baru) / Total Lembar Baru
        const oldVal = p.qty * p.avg;
        p.avg = Math.floor((oldVal + rawCost) / (p.qty + qty));
        p.qty += qty;

        saveDB(db);
        return msg.reply(`✅ *ORDER MATCHED*\nEmiten: ${ticker}\nVol: ${fmt(qty)} Lembar\nHarga: Rp ${fmt(price)}\nFee: Rp ${fmt(fee)}\n📉 Total Bayar: Rp ${fmt(total)}`);
    }

    // 3. JUAL SAHAM (REAL PRICE + PAJAK)
    if (command === 'jualsaham' || command === 'sellstock') {
        const ticker = args[0]?.toUpperCase();
        let qty = args[1];

        if (!user.portfolio[ticker] || user.portfolio[ticker].qty <= 0) return msg.reply("❌ Gak punya saham ini.");
        
        const p = user.portfolio[ticker];
        if (qty === 'all') qty = p.qty;
        qty = parseInt(qty);

        if (isNaN(qty) || qty < 1 || qty > p.qty) return msg.reply("❌ Jumlah salah/kurang.");

        const price = market.prices[ticker].price;
        const gross = price * qty;

        // PAJAK PROGRESIF
        let taxRate = 0.05; // 5% Standard
        if (user.balance > 100_000_000_000_000) taxRate = 0.30; // 30% 

        const tax = Math.floor(gross * taxRate);
        const net = gross - tax;

        // Hitung Profit/Loss
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

    // 4. PORTO (VALUASI REAL-TIME)
    if (command === 'porto' || command === 'pf') {
        let txt = `💼 *PORTOFOLIO SAHAM*\n`;
        let totalVal = 0;
        let totalGain = 0;
        let hasStock = false;

        // Estimasi Pajak di Display
        let rate = 0.05;
        if (user.balance > 100_000_000_000_000) rate = 0.30;

        for (let [ticker, data] of Object.entries(user.portfolio)) {
            if (data.qty > 0) {
                // Cek harga terkini, kalau error pakai harga beli (avg)
                const currentData = market.prices[ticker];
                const price = currentData ? currentData.price : data.avg;
                
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
