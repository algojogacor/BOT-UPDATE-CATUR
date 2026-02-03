require('dotenv').config();
const { MongoClient } = require('mongodb');

// Mengambil URL dari Environment Variable Koyeb
const uri = process.env.MONGODB_URI; 
const client = new MongoClient(uri);

let dbCollection;
let localData = { users: {}, groups: {}, market: {}, settings: {} };

// Fungsi Koneksi ke MongoDB
async function connectToCloud() {
    try {
        console.log("☁️ Menghubungkan ke MongoDB Atlas...");
        await client.connect();
        
        // Pilih database 'whatsapp_bot' dan collection 'bot_data'
        const db = client.db('whatsapp_bot');
        dbCollection = db.collection('game_data');
        
        console.log("✅ Terhubung ke MongoDB Cloud!");

        // Langsung Load Data saat konek
        await loadFromCloud();
    } catch (err) {
        console.error("❌ Gagal Konek MongoDB:", err.message);
    }
}

// Fungsi Load Data dari MongoDB ke RAM
async function loadFromCloud() {
    try {
        // Kita simpan semua data bot dalam satu dokumen dengan ID 'main_data'
        const result = await dbCollection.findOne({ _id: 'main_data' });
        
        if (result) {
            localData = result.content;
            console.log("📥 Data berhasil ditarik dari MongoDB.");
        } else {
            console.log("ℹ️ Dokumen data belum ada. Menggunakan default.");
            localData = { users: {}, groups: {}, market: {}, settings: {} };
        }
    } catch (err) {
        console.error("⚠️ Gagal Load Data:", err.message);
    }
    return localData;
}

// Fungsi Load (Dipanggil index.js) - Sekarang jadi Async
const loadDB = async () => {
    if (Object.keys(localData.users).length === 0) {
        return await loadFromCloud();
    }
    return localData;
};

// Fungsi Save (Push RAM ke MongoDB)
const saveDB = async (data) => {
    if (data) localData = data;
    try {
        // Upsert: Kalau belum ada dibuat, kalau sudah ada diupdate
        await dbCollection.updateOne(
            { _id: 'main_data' },
            { $set: { content: localData } },
            { upsert: true }
        );
        // console.log("☁️ Data tersimpan ke MongoDB.");
    } catch (err) {
        console.error("⚠️ Gagal Save ke MongoDB:", err.message);
    }
};

// Helper Quest
const addQuestProgress = (user, questId) => {
    if (!user.quest || !user.quest.daily) return null;
    const quest = user.quest.daily.find(q => q.id === questId);
    if (quest && !quest.claimed && quest.progress < quest.target) {
        quest.progress++;
        if (quest.progress >= quest.target) {
            return `🎉 Quest *${quest.name}* Selesai! Ketik !daily klaim.`;
        }
    }
    return null;
};

module.exports = { connectToCloud, loadDB, saveDB, addQuestProgress };
