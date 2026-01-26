const { saveDB } = require('../helpers/database');

// HELPER FORMAT ANGKA
const fmt = (num) => Math.floor(Number(num)).toLocaleString('id-ID');

// --- KONFIGURASI PASAR (SETTING DUNIA NYATA) ---
// basePrice: Harga awal
// beta: Seberapa sensitif koin ini terhadap pergerakan BTC (1.0 = Sama, 2.0 = 2x lebih liar)
// supply: Total stok koin di pasar (Mempengaruhi kelangkaan)
const COIN_CONFIG = {
    btc:  { name: "Bitcoin",   base: 1_500_000_000, beta: 1.0, supply: 100 }, // King of Market
    eth:  { name: "Ethereum",  base: 50_000_000,    beta: 1.3, supply: 500 }, // Follower kuat
    sol:  { name: "Solana",    base: 2_500_000,     beta: 1.8, supply: 2000 }, // High Performance
    doge: { name: "Dogecoin",  base: 5_000,         beta: 2.5, supply: 10000 }, // Meme Volatile
    pepe: { name: "Pepe",      base: 500,           beta: 4.0, supply: 50000 }  // Sangat Liar (High Risk)
};

// BERITA EKONOMI (SENTIMEN NYATA)
const NEWS_POOL = [
    // BAD NEWS (BEARISH)
    { txt: "🚨 The Fed menaikkan suku bunga! Pasar panik.", sentiment: -0.05 },
    { txt: "📉 SEC menggugat Binance! Investor tarik dana.", sentiment: -0.08 },
    { txt: "🇨🇳 China kembali melarang transaksi Crypto.", sentiment: -0.04 },
    { txt: "🩸 Mt. Gox mulai mendistribusikan sisa BTC.", sentiment: -0.06 },
    
    // GOOD NEWS (BULLISH)
    { txt: "🟢 BlackRock ETF Bitcoin disetujui SEC!", sentiment: 0.08 },
    { txt: "🚀 Elon Musk menambahkan pembayaran DOGE di X.", sentiment: 0.05 },
    { txt: "🏦 Bank Sentral memangkas suku bunga, aset resiko naik.", sentiment: 0.04 },
    { txt: "🐳 MicroStrategy memborong 10.000 BTC lagi.", sentiment: 0.03 },

    // NEUTRAL / SIDEWAYS
    { txt: "📊 Market konsolidasi, volume perdagangan rendah.", sentiment: 0.00 },
    { txt: "⚖️ Trader menunggu data inflasi AS (CPI).", sentiment: -0.01 }
];

module.exports = async (command, args, msg, user, db) => {
    // Init User
    if (typeof user.balance === 'undefined') user.balance = 0;
    if (typeof user.crypto === 'undefined') user.crypto = {};
    if (typeof user.debt === 'undefined') user.debt = 0;

    // --- INIT DATABASE MARKET ---
    if (!db.market || !db.market.prices) {
        db.market = {
            lastUpdate: 0,
            prices: { btc: COIN_CONFIG.btc.base, eth: COIN_CONFIG.eth.base, sol: COIN_CONFIG.sol.base, doge: COIN_CONFIG.doge.base, pepe: COIN_CONFIG.pepe.base },
            trend: 0, // Tren Global (-1 s/d 1)
            news: NEWS_POOL[0]
        };
        saveDB(db);
    }

    const market = db.market;
    const now = Date.now();
    const INTERVAL = 15 * 60 * 1000; // Update Realistis: 15 Menit (Candle M15)

    // ============================================================
    // 🧠 MESIN EKONOMI REALISTIS (ALGORITMA BETA)
    // ============================================================
    if (now - market.lastUpdate > INTERVAL) {
        
        // 1. Ambil Berita Baru
        const news = NEWS_POOL[Math.floor(Math.random() * NEWS_POOL.length)];
        market.news = news;

        // 2. Tentukan Pergerakan BTC (Induk Pasar)
        // BTC bergerak berdasarkan Sentiment Berita + Sedikit Random (Noise)
        const noise = (Math.random() - 0.5) * 0.03; // Noise pasar +/- 1.5%
        const btcMove = news.sentiment + noise; 

        // Simpan tren untuk referensi
        market.trend = btcMove;

        // 3. Gerakkan Koin Lain Mengikuti BTC (Korelasi & Beta)
        for (let k in market.prices) {
            const cfg = COIN_CONFIG[k];
            const oldPrice = market.prices[k];

            // RUMUS REALISTIS: Pergerakan BTC * Beta Koin + Random Unik Koin
            // Contoh: Jika BTC naik 2%, dan Beta Pepe 4.0, maka Pepe naik sekitar 8%
            let coinMove = (btcMove * cfg.beta) + ((Math.random() - 0.5) * 0.02);

            // Batas Kewajaran (Circuit Breaker)
            if (coinMove > 0.30) coinMove = 0.30; // Max naik 30% per 15 menit
            if (coinMove < -0.30) coinMove = -0.30; // Max turun 30%

            let newPrice = Math.floor(oldPrice * (1 + coinMove));
            
            // Floor Price (Gak boleh 0)
            if (newPrice < 10) newPrice = 10; 

            market.prices[k] = newPrice;
        }

        // LIKUIDASI MARGIN (REALISTIS)
        // Jika hutang > 85% dari total aset, kena Margin Call (Sita Aset)
        Object.keys(db.users).forEach(id => {
            let u = db.users[id];
            if (u.debt > 0) {
                let totalAsset = 0;
                if (u.crypto) for (let [k, v] of Object.entries(u.crypto)) totalAsset += v * (market.prices[k] || 0);
                const collateral = totalAsset + (u.balance || 0);
                
                if (u.debt > (collateral * 0.85)) { 
                    u.crypto = {}; u.balance = 0; u.debt = 0; // Bangkrut
                }
            }
        });

        market.lastUpdate = now;
        saveDB(db);
    }

    // ============================================================
    // COMMANDS
    // ============================================================

    // 1. MARKET UI
    if (command === 'market' || command === 'crypto') {
        const nextUpdate = Math.ceil((INTERVAL - (now - market.lastUpdate)) / 60000);
        
        let trendIcon = '➡️';
        if (market.trend > 0.02) trendIcon = '🚀 Bullish';
        else if (market.trend > 0) trendIcon = '🟢 Hijau';
        else if (market.trend < -0.02) trendIcon = '🩸 Crash';
        else if (market.trend < 0) trendIcon = '🔴 Merah';

        let txt = `📊 *GLOBAL CRYPTO MARKET*\n`;
        txt += `sentimen: ${trendIcon}\n`;
        txt += `📰 "${market.news.txt}"\n`;
        txt += `⏱️ Candle M15: ${nextUpdate} min lagi\n`;
        txt += `--------------------------\n`;

        for (let k in market.prices) {
            let price = market.prices[k];
            // Hitung perubahan dummy (vs harga base) untuk visualisasi
            // (Dalam sistem real, ini harusnya vs harga candle open, tapi ini simplifikasi)
            let base = COIN_CONFIG[k].base;
            
            // Tampilkan Harga
            txt += `🔸 *${k.toUpperCase()}*: Rp ${fmt(price)}\n`;
        }
        
        txt += `\n💰 Saldo: Rp ${fmt(user.balance)}`;
        txt += `\n💡 Beli: \`!buycrypto <koin> <rupiah>\``;
        return msg.reply(txt);
    }

    // 2. BUY (BELI PAKAI RUPIAH - LEBIH REALISTIS)
    // Di dunia nyata orang beli "Beli BTC senilai 1 Juta", bukan "Beli 0.0001 BTC"
    if (command === 'buycrypto') {
        const koin = args[0]?.toLowerCase();
        const nominal = parseInt(args[1]); // Input dalam Rupiah

        if (!COIN_CONFIG[koin]) return msg.reply("❌ Koin tidak ada di exchange.");
        if (isNaN(nominal) || nominal <= 0) return msg.reply("❌ Format: `!buycrypto btc 100000` (Nominal Rupiah)");

        if (user.balance < nominal) return msg.reply(`❌ Uang kurang! Saldo: Rp ${fmt(user.balance)}`);

        const price = market.prices[koin];
        const fee = Math.floor(nominal * 0.01); // Fee 1% (Standar Exchange)
        const bersih = nominal - fee;
        const dapatKoin = bersih / price;

        user.balance -= nominal;
        user.crypto[koin] = (user.crypto[koin] || 0) + dapatKoin;
        saveDB(db);

        return msg.reply(`✅ *BUY ORDER EXECUTED*\nPair: ${koin.toUpperCase()}/IDR\nNominal: Rp ${fmt(nominal)}\nFee (1%): Rp ${fmt(fee)}\nPrice: Rp ${fmt(price)}\n📦 *Dapat: ${dapatKoin.toFixed(8)} ${koin.toUpperCase()}*`);
    }

    // 3. SELL (JUAL SEMUA / JUMLAH KOIN)
    if (command === 'sellcrypto') {
        const koin = args[0]?.toLowerCase();
        let amount = args[1];

        if (!user.crypto[koin] || user.crypto[koin] <= 0) return msg.reply("❌ Dompet kosong.");

        if (amount === 'all') amount = user.crypto[koin];
        else amount = parseFloat(amount);

        if (isNaN(amount) || amount <= 0 || amount > user.crypto[koin]) return msg.reply("❌ Jumlah salah.");

        const price = market.prices[koin];
        const gross = amount * price;

        // PAJAK SULTAN (REALISTIS: PAJAK PROGRESIF)
        let taxRate = 0.05; // 5%
        if (user.balance > 100_000_000_000_000) taxRate = 0.35; // 35% untuk Ultra Kaya

        const fee = Math.floor(gross * 0.01); // Fee Exchange 1%
        const tax = Math.floor(gross * taxRate); // Pajak Negara
        const net = Math.floor(gross - fee - tax);

        user.crypto[koin] -= amount;
        user.balance += net;
        
        // Hapus kalau 0 (biar bersih)
        if (user.crypto[koin] <= 0.00000001) delete user.crypto[koin];

        saveDB(db);
        return msg.reply(`✅ *SELL ORDER EXECUTED*\nJual: ${amount.toFixed(8)} ${koin.toUpperCase()}\nRate: Rp ${fmt(price)}\n\n💰 Total: Rp ${fmt(gross)}\n💸 Fee (1%): Rp ${fmt(fee)}\n🏛️ Tax (${taxRate*100}%): Rp ${fmt(tax)}\n💵 *Terima: Rp ${fmt(net)}*`);
    }

    // 4. PORTFOLIO
    if (command === 'pf' || command === 'portofolio') {
        let txt = `💼 *DOMPET KRIPTO*\n`;
        let totalAsset = 0;
        
        const safeCrypto = user.crypto || {};
        let hasAsset = false;

        for (let [k, v] of Object.entries(safeCrypto)) {
            if (v > 0.00000001 && market.prices[k]) {
                let val = Math.floor(v * market.prices[k]);
                totalAsset += val;
                txt += `🔹 ${k.toUpperCase()}: ${v.toFixed(6)} (≈Rp ${fmt(val)})\n`;
                hasAsset = true;
            }
        }

        if (!hasAsset) txt += "_Dompet kosong_\n";

        const netWorth = totalAsset + user.balance - user.debt;
        txt += `--------------------------\n`;
        txt += `💵 Tunai: Rp ${fmt(user.balance)}\n`;
        if (user.debt > 0) txt += `⚠️ Margin: Rp ${fmt(user.debt)}\n`;
        txt += `📊 *Net Worth: Rp ${fmt(netWorth)}*`;

        return msg.reply(txt);
    }

    // 5. MARGIN (PINJAMAN LEVERAGE)
    if (command === 'margin') {
        const koin = args[0]?.toLowerCase();
        const nominal = parseInt(args[1]); // Pinjam dalam Rupiah

        if (!COIN_CONFIG[koin]) return msg.reply("❌ Koin salah.");
        if (isNaN(nominal) || nominal <= 0) return msg.reply("❌ Format: `!margin btc 1000000`");

        // Limit Margin: 3x dari Saldo Tunai
        const maxLoan = user.balance * 3;
        if ((user.debt + nominal) > maxLoan) return msg.reply(`❌ Margin Call Risk! Limit hutangmu sisa Rp ${fmt(maxLoan - user.debt)}`);

        const price = market.prices[koin];
        const dapatKoin = nominal / price;

        user.debt += nominal;
        user.crypto[koin] = (user.crypto[koin] || 0) + dapatKoin;
        saveDB(db);

        return msg.reply(`⚠️ *MARGIN BUY SUKSES*\nBerhutang Rp ${fmt(nominal)} untuk membeli ${dapatKoin.toFixed(6)} ${koin.toUpperCase()}.\n_Hati-hati likuidasi!_`);
    }

    // 6. PAY DEBT
    if (command === 'paydebt') {
        const amt = parseInt(args[0]);
        const bayar = amt ? Math.min(amt, user.debt) : user.debt; // Kalau kosong bayar semua

        if (bayar <= 0) return msg.reply("❌ Tidak ada hutang.");
        if (user.balance < bayar) return msg.reply("❌ Uang tidak cukup.");

        user.balance -= bayar;
        user.debt -= bayar;
        saveDB(db);
        return msg.reply(`✅ Hutang dibayar Rp ${fmt(bayar)}. Sisa: Rp ${fmt(user.debt)}`);
    }
};
