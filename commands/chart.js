const axios = require('axios');

// MAPPING ID (Harus sama dengan di crypto.js)
const COIN_IDS = {
    btc: 'bitcoin',
    eth: 'ethereum',
    sol: 'solana',
    bnb: 'binancecoin',
    doge: 'dogecoin',
    pepe: 'pepe',
    shib: 'shiba-inu',
    xrp: 'ripple',
    ada: 'cardano',
    trx: 'tron'
};

module.exports = async (command, args, msg, user, db, sock) => {
    // Validasi Command
    if (command !== 'chart' && command !== 'grafik') return;

    const ticker = args[0]?.toLowerCase();
    if (!ticker || !COIN_IDS[ticker]) {
        return msg.reply(`❌ Masukkan nama koin.\nContoh: \`!chart btc\`\n\nList: ${Object.keys(COIN_IDS).join(', ')}`);
    }

    const coinId = COIN_IDS[ticker];
    
    // Kirim pesan loading
    await msg.reply("⏳ _Sedang membuat grafik..._");

    try {
        // 1. AMBIL DATA HISTORI DARI COINGECKO (24 Jam Terakhir)
        // vs_currency=idr, days=1 (1 hari)
        const urlData = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=idr&days=1`;
        const { data } = await axios.get(urlData);
        
        // Data format: [[timestamp, price], [timestamp, price], ...]
        const prices = data.prices;

        // Kita ambil sampel biar URL gak kepanjangan (Ambil tiap data ke-10)
        // QuickChart punya limit panjang URL
        const labels = [];
        const dataPoints = [];

        for (let i = 0; i < prices.length; i += 5) { // Ambil setiap 5 titik data
            const timestamp = prices[i][0];
            const price = prices[i][1];
            
            // Ubah timestamp jadi Jam (HH:mm)
            const date = new Date(timestamp);
            const timeStr = `${date.getHours()}:${date.getMinutes() < 10 ? '0' : ''}${date.getMinutes()}`;
            
            labels.push(timeStr);
            dataPoints.push(price);
        }

        // Tentukan Warna Grafik (Hijau kalau naik, Merah kalau turun dari awal)
        const isGreen = dataPoints[dataPoints.length - 1] >= dataPoints[0];
        const color = isGreen ? 'rgb(0, 200, 0)' : 'rgb(255, 50, 50)';
        const bgColor = isGreen ? 'rgba(0, 200, 0, 0.1)' : 'rgba(255, 50, 50, 0.1)';

        // 2. KONFIGURASI CHART.JS (LEWAT QUICKCHART)
        const chartConfig = {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: `${ticker.toUpperCase()} (IDR - 24h)`,
                    data: dataPoints,
                    borderColor: color,
                    backgroundColor: bgColor,
                    borderWidth: 2,
                    fill: true,
                    pointRadius: 0 
                }]
            },
            options: {
                title: { display: true, text: `Grafik Harga ${ticker.toUpperCase()} - 24 Jam` },
                scales: {
                    yAxes: [{ ticks: { callback: (val) => val.toLocaleString('id-ID') } }] // Format Rupiah di sumbu Y
                }
            }
        };

        // Encode ke URL
        const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&w=500&h=300`;

        // 3. KIRIM GAMBAR KE WA
        // Menggunakan sock (socket) langsung untuk kirim media
        await sock.sendMessage(msg.from, { 
            image: { url: chartUrl }, 
            caption: `📈 *Grafik ${ticker.toUpperCase()} (24 Jam)*\nHarga Sekarang: Rp ${dataPoints[dataPoints.length-1].toLocaleString('id-ID')}`
        }, { quoted: msg.key });

    } catch (e) {
        console.error("Chart Error:", e);
        msg.reply("❌ Gagal membuat grafik. (API CoinGecko mungkin sedang sibuk)");
    }
};
