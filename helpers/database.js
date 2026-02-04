require('dotenv').config();
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI; 
// Opsi tambahan agar koneksi lebih stabil
const client = new MongoClient(uri, {
    connectTimeoutMS: 30000,
    socketTimeoutMS: 45000,
});

let dbCollection = null;

// Struktur Data Default (Template jika DB kosong)
let localData = { 
    users: {}, 
    groups: {}, 
    market: { commodities: {} }, 
    settings: {} 
};

// ============================================================
// 1. KONEKSI KE CLOUD
// ============================================================
async function connectToCloud() {
    try {
        if (dbCollection) return dbCollection; // Jika sudah konek, skip

        console.log("☁️ Menghubungkan ke MongoDB Atlas...");
        await client.connect();
        
        const db = client.db('bot_data'); // Nama Database
        dbCollection = db.collection('bot_storage'); // Nama Collection
        
        console.log("✅ Terhubung ke MongoDB Cloud!");
        
        // Langsung load data pertama kali saat konek
        await loadFromCloud();
        return dbCollection;
    } catch (err) {
        console.error("❌ Gagal Konek MongoDB:", err.message);
        return null;
    }
}

// ============================================================
// 2. LOAD DATA (DARI CLOUD KE LOKAL)
// ============================================================
async function loadFromCloud() {
    try {
        if (!dbCollection) await connectToCloud();
        if (!dbCollection) return localData; // Return default jika gagal konek

        // Kita cari dokumen dengan ID 'main_data' agar spesifik
        const result = await dbCollection.findOne({ _id: 'main_data' }); 
        
        if (result && result.data) {
            localData = result.data; 
            console.log("📥 Data berhasil ditarik dari MongoDB.");
        } else {
            console.log("ℹ️ Database kosong. Membuat data baru...");
            await saveDB(localData); // Buat dokumen awal di Cloud
        }
    } catch (err) {
        console.error("⚠️ Gagal Load Data:", err.message);
    }
    return localData;
}

// Wrapper agar bisa dipanggil dari luar
const loadDB = async () => {
    // Jika data lokal masih kosong banget, coba tarik dari cloud
    if (Object.keys(localData.users).length === 0) {
        return await loadFromCloud();
    }
    return localData;
};

// ============================================================
// 3. SAVE DATA (DARI LOKAL KE CLOUD)
// ============================================================
const saveDB = async (data) => {
    try {
        if (data) localData = data; // Update cache lokal

        // Cek koneksi sebelum simpan
        if (!dbCollection) {
            await connectToCloud();
            if (!dbCollection) return; // Menyerah kalau masih gak bisa konek
        }

        // Simpan ke dokumen dengan ID 'main_data'
        await dbCollection.updateOne(
            { _id: 'main_data' }, 
            { $set: { data: localData } }, 
            { upsert: true } // Buat baru jika belum ada
        );
    } catch (err) {
        console.error("⚠️ Gagal Save ke MongoDB:", err.message);
    }
};

// ============================================================
// 4. HELPER LAINNYA
// ============================================================
const addQuestProgress = (user, questId) => {
    if (!user.quest || !user.quest.daily) return null;
    
    const quest = user.quest.daily.find(q => q.id === questId);
    
    if (quest && !quest.claimed && quest.progress < quest.target) {
        quest.progress++;
        
        // Cek apakah baru saja selesai
        if (quest.progress >= quest.target) {
            // Penting: SaveDB harus dipanggil oleh file yang memanggil fungsi ini
            // agar progress tersimpan ke cloud.
            return `🎉 Quest *${quest.name}* Selesai! Ketik !daily klaim.`;
        }
    }
    return null;
};

module.exports = { connectToCloud, loadDB, saveDB, addQuestProgress };
