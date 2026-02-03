const { MongoClient } = require('mongodb');

let db = null;

async function connectToDB() {
    if (db) return db; 
    
    try {
        const client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
        
        db = client.db('bot_data'); 
        
        console.log("✅ Terhubung ke MongoDB Atlas");
        return db;
    } catch (e) {
        console.error("❌ Gagal koneksi MongoDB:", e);
        throw e;
    }
}

module.exports = { connectToDB };
