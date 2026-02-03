require('dotenv').config();
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI; 
const client = new MongoClient(uri);

let dbCollection;
let localData = { users: {}, groups: {}, market: {}, settings: {} };

async function connectToCloud() {
    try {
        console.log("☁️ Menghubungkan ke MongoDB Atlas...");
        await client.connect();
        
        const db = client.db('bot_data');
        dbCollection = db.collection('bot_data');
        
        console.log("✅ Terhubung ke MongoDB Cloud!");
        await loadFromCloud();
    } catch (err) {
        console.error("❌ Gagal Konek MongoDB:", err.message);
    }
}

async function loadFromCloud() {
    try {
       
        const result = await dbCollection.findOne({}); 
        
        if (result) {
            // Kita pisahkan _id agar tidak masuk ke localData
            const { _id, ...content } = result;
            localData = content; 
            console.log("📥 Data berhasil ditarik dari MongoDB.");
        } else {
            console.log("ℹ️ Dokumen belum ada. Menggunakan default.");
            localData = { users: {}, groups: {}, market: {}, settings: {} };
        }
    } catch (err) {
        console.error("⚠️ Gagal Load Data:", err.message);
    }
    return localData;
}

const loadDB = async () => {
    if (Object.keys(localData.users).length === 0) {
        return await loadFromCloud();
    }
    return localData;
};

const saveDB = async (data) => {
    if (data) localData = data;
    try {

        await dbCollection.updateOne(
            {}, 
            { $set: localData }, 
            { upsert: true }
        );
    } catch (err) {
        console.error("⚠️ Gagal Save ke MongoDB:", err.message);
    }
};

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
