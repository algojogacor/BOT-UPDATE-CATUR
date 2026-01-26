// --- 1. IMPORT MODUL UTAMA (BAILEYS) ---
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const { exec } = require('child_process');

// Database Lokal
const { connectToCloud, loadDB, saveDB, addQuestProgress } = require('./helpers/database');

// --- IMPORT COMMANDS ---
const economyCmd = require('./commands/economy');     
const propertyCmd = require('./commands/property'); 
const stocksCmd = require('./commands/stocks');
const cryptoCmd = require('./commands/crypto'); 
const bolaCmd = require('./commands/bola');         
const profileCmd = require('./commands/profile');   
const battleCmd = require('./commands/battle');     
const ttsCmd = require('./commands/tts');           
const gameTebakCmd = require('./commands/gameTebak'); 
const nationCmd = require('./commands/nation');
const rouletteCmd = require('./commands/roulette');
const pdfCmd = require('./commands/pdf');           
const robCmd = require('./commands/rob');           
const wikiKnowCmd = require('./commands/WikiKnow'); 
const adminCmd = require('./commands/admin');       
const aiCmd = require('./commands/ai');   
const minesCmd = require('./commands/mines');
const duelCmd = require('./commands/duel');
const toolsCmd = require('./commands/tools');   
const caturCmd = require('./commands/catur');
const imageCmd = require('./commands/image'); 

// --- 2. KONFIGURASI WHITELIST GRUP ---
const ALLOWED_GROUPS = [
    "120363310599817766@g.us",       // Grup Sodara
    "6282140693010-1590052322@g.us", // Grup Keluarga Wonoboyo
    "120363253471284606@g.us",       // Grup Ambarya
    "120363328759898377@g.us",       // Grup Testingbot
    "120363422854499629@g.us"        // Grup English Area
];

// SERVER WEB & API
const express = require('express');
const cors = require('cors'); // Install dulu: npm install cors
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

app.use(cors()); // Biar web bisa akses
app.use(express.json()); // Biar bisa baca data JSON
app.use(express.urlencoded({ extended: true }));

// Folder tempat menyimpan file HTML/JS Catur (Buat folder bernama 'public_catur' nanti)
app.use('/game', express.static(path.join(__dirname, 'public_catur')));

// API: Web lapor hasil game ke sini
app.post('/api/catur-finish', (req, res) => {
    const { user, result, bet } = req.body; // Data dari Web
    
    // Validasi sederhana (Cek apakah user ada di database bot)
    const db = global.db;
    if (!db.users[user]) {
        return res.status(404).json({ status: 'error', message: 'User tidak ditemukan' });
    }

    const userData = db.users[user];
    const taruhan = parseInt(bet) || 0;
    let prize = 0;
    let text = "";

    if (result === 'win') {
        prize = taruhan * 2;
        text = `🎉 SELAMAT! Kamu menang catur lawan AI.\n💰 Koin +${prize}`;
    } else if (result === 'draw') {
        prize = taruhan;
        text = `🤝 Seri! Koin ${prize} dikembalikan.`;
    } else {
        text = `💀 Kamu kalah catur. Koin ${taruhan} hangus.`;
    }

    // Update Database Bot
    userData.balance += prize; 
    saveDB(db); // Simpan database otomatis

    // Kirim respon balik ke Web
    res.json({ status: 'ok', message: text, newBalance: userData.balance });
    
    console.log(`[CATUR] ${user} -> ${result} (Bet: ${taruhan}, Prize: ${prize})`);
});

app.get('/', (req, res) => res.send('<h1>Bot Arya is Running! 🚀</h1>'));
app.listen(port, () => console.log(`Server jalan di port ${port}`));

// --- 3. FUNGSI UTAMA KONEKSI BAILEYS ---
async function startBot() {
    
    // Inisialisasi Database
    try {
        console.log("🔄 Menghubungkan ke Database...");
        await connectToCloud(); 
        global.db = loadDB(); 
        console.log("✅ Database Terhubung!");
    } catch (err) {
        console.log("⚠️ GAGAL KONEK DB: Bot jalan dalam Mode Darurat.");
        global.db = { users: {}, groups: {}, market: {}, settings: {} };
    }

    const { state, saveCreds } = await useMultiFileAuthState('auth_baileys');

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        // ⚠️ WAJIB FALSE: Kita handle manual agar tidak error
        printQRInTerminal: false, 
        auth: state,
        browser: ['Bot Arya', 'Chrome', '1.0.0'],
        syncFullHistory: false,
        generateHighQualityLinkPreview: true,
    });

    // --- EVENT KONEKSI ---
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        // 🔥 FIX QR CODE JADI TEXT PANJANG 🔥
        if (qr) {
            console.log('\n================================================');
            console.log('👇 COPY SEMUA KODE DI BAWAH KE: goqr.me 👇');
            console.log('================================================\n');
            
            // INI AKAN MUNCULKAN TEKS PANJANG (RAW STRING)
            console.log(qr); 
            
            console.log('\n================================================');
            console.log('☝️ COPY KODE DI ATAS, LALU PASTE DI WEB QR GENERATOR ☝️');
            console.log('================================================\n');
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('❌ Koneksi terputus. Mencoba connect ulang...', shouldReconnect);
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('✅ BOT SIAP! 🚀 (Mode: Baileys)');
            console.log('🔒 Mode: Hanya Grup Whitelist');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // --- 4. EVENT MESSAGE ---
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const m = messages[0];
        if (!m.message) return;
        
        try {
            // ADAPTOR PESAN
            const remoteJid = m.key.remoteJid;
            const isGroup = remoteJid.endsWith('@g.us');
            const sender = isGroup ? (m.key.participant || m.participant) : remoteJid;
            const pushName = m.pushName || "Tanpa Nama";
            
            const msgType = Object.keys(m.message)[0];
            const body = m.message.conversation || 
                         m.message.extendedTextMessage?.text || 
                         m.message.imageMessage?.caption || "";
            
            if (body) console.log(`📨 PESAN DARI ${pushName}: ${body.slice(0, 30)}...`);

            const hasMedia = (msgType === 'imageMessage' || msgType === 'videoMessage' || msgType === 'documentMessage');

            // --- CHAT HELPER ---
            const chat = {
                id: { _serialized: remoteJid },
                isGroup: isGroup,
                sendMessage: async (content) => {
                    if (typeof content === 'string') {
                        await sock.sendMessage(remoteJid, { text: content });
                    } else {
                        await sock.sendMessage(remoteJid, content);
                    }
                }
            };

            // --- MSG HELPER ---
            const msg = {
                body: body,
                from: remoteJid,
                author: sender,
                pushName: pushName,
                hasMedia: hasMedia,
                type: msgType,
                getChat: async () => chat,
                react: async (emoji) => await sock.sendMessage(remoteJid, { react: { text: emoji, key: m.key } }),
                reply: async (text) => await sock.sendMessage(remoteJid, { text: text + "" }, { quoted: m }),
                key: m.key,
                message: m.message,
                extendedTextMessage: m.message.extendedTextMessage
            };

            // ==========================================================
            //  SECURITY GATEKEEPER
            // ==========================================================
            if (!chat.isGroup) return; // Hanya respon di grup
            if (msg.body === '!idgrup') return msg.reply(`🆔 *ID GRUP:* \`${chat.id._serialized}\``);
            if (!ALLOWED_GROUPS.includes(chat.id._serialized)) return; 

            // ==========================================================
            //  DATABASE & LOGIKA USER
            // ==========================================================
            const db = global.db; 
            if (!db.users) db.users = {};
            if (!db.market) db.market = {};
            
            const today = new Date().toISOString().split("T")[0];
            const defaultQuest = {
                daily: [
                    { id: "chat", name: "Ngobrol Aktif", progress: 0, target: 10, reward: 200, claimed: false },
                    { id: "game", name: "Main Casino", progress: 0, target: 3, reward: 300, claimed: false },
                    { id: "sticker", name: "Bikin Stiker", progress: 0, target: 2, reward: 150, claimed: false }
                ],
                weekly: { id: "weekly", name: "Weekly Warrior", progress: 0, target: 100, reward: 2000, claimed: false },
                lastReset: today
            };

            if (!db.users[sender]) {
                db.users[sender] = {
                    balance: 1000, xp: 0, level: 1, inv: [], buffs: {}, lastDaily: 0,
                    bolaWin: 0, bolaTotal: 0, bolaProfit: 0, crypto: {}, debt: 0, bank: 0, 
                    quest: JSON.parse(JSON.stringify(defaultQuest))
                };
            }

            const user = db.users[sender];
            if (!user) return; 
            user.lastSeen = Date.now();
            user.name = pushName;

            // Auto-Fix Data User
            if (!user.crypto) user.crypto = {};
            if (typeof user.debt === 'undefined') user.debt = 0;
            if (typeof user.bank === 'undefined') user.bank = 0; 
            if (typeof user.balance === 'undefined') user.balance = 0;
            if (!user.quest) user.quest = JSON.parse(JSON.stringify(defaultQuest));

            // ANTI TOXIC
            const toxicWords = ["anjing", "kontol", "memek", "goblok", "idiot", "babi", "tolol", "ppq", "jembut"];
            if (toxicWords.some(k => body.toLowerCase().includes(k))) return msg.reply("⚠️ Jaga ketikan bro, jangan toxic!");

            // DAILY RESET & BUFF CHECK
            if (user.quest?.lastReset !== today) {
                user.quest.daily.forEach(q => { q.progress = 0; q.claimed = false; });
                user.quest.lastReset = today;
            }
            if (user.buffs) {
                for (let key in user.buffs) {
                    if (user.buffs[key].active && Date.now() >= user.buffs[key].until) user.buffs[key].active = false;
                }
            }

            // XP & LEVELING
            let xpGain = user.buffs?.xp?.active ? 5 : 2; 
            user.xp += xpGain;
            if (user.quest.weekly && !user.quest.weekly.claimed) user.quest.weekly.progress++;
            let nextLvl = Math.floor(user.xp / 100) + 1;
            if (nextLvl > user.level) {
                user.level = nextLvl;
                msg.reply(`🎊 *LEVEL UP!* Sekarang kamu Level *${user.level}*`);
            }
            addQuestProgress(user, "chat");
            
            // PARSE COMMAND
            const isCommand = body.startsWith('!');
            const args = isCommand ? body.slice(1).trim().split(/ +/) : [];
            const command = isCommand ? args.shift().toLowerCase() : "";
            

            // ==========================================================
            //  FITUR STEGANOGRAFI (Path: commands/stegano.py)
            // ==========================================================
            
            // COMMAND: !hide <pesan> (Reply/Kirim Gambar)
            if (command === 'hide') {
                const isImage = (msgType === 'imageMessage');
                const isQuotedImage = m.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;

                if (!isImage && !isQuotedImage) return msg.reply("⚠️ Kirim/Reply gambar dengan caption: !hide pesan rahasia");
                
                const pesanRahasia = args.join(" ");
                if (!pesanRahasia) return msg.reply("⚠️ Mana pesannya? Contoh: !hide Misi Rahasia 007");

                msg.reply("⏳ Sedang menyembunyikan pesan...");

                try {
                    let messageToDownload = m;
                    if (isQuotedImage) {
                        messageToDownload = {
                            key: m.message.extendedTextMessage.contextInfo.stanzaId,
                            message: m.message.extendedTextMessage.contextInfo.quotedMessage
                        };
                    }

                    const buffer = await downloadMediaMessage(
                        messageToDownload,
                        'buffer',
                        {},
                        { logger: pino({ level: 'silent' }) }
                    );

                    const inputPath = `./temp_input_${sender.split('@')[0]}.jpg`;
                    const outputPath = `./temp_output_${sender.split('@')[0]}.png`;

                    fs.writeFileSync(inputPath, buffer);
                    
                    // PERBAIKAN: Menggunakan 'python3' bukan 'python'
                    const cmdPython = `python3 commands/stegano.py hide "${inputPath}" "${pesanRahasia}" "${outputPath}"`;

                    exec(cmdPython, async (error, stdout, stderr) => {
                        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);

                        if (error) {
                            console.error("Stegano Error:", error);
                            // Cek error spesifik jika python3 tidak ditemukan
                            if (error.message.includes("not found")) {
                                return msg.reply("❌ Error: Python3 tidak terinstall di server bot ini.");
                            }
                            return msg.reply("❌ Gagal. Pastikan gambar tidak rusak.");
                        }

                        await sock.sendMessage(remoteJid, { 
                            document: fs.readFileSync(outputPath), 
                            mimetype: 'image/png',
                            fileName: 'RAHASIA.png',
                            caption: '✅ SUKSES! Download file ini (Document) agar pesan aman.'
                        }, { quoted: m });

                        setTimeout(() => {
                            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
                        }, 5000);
                    });

                } catch (err) {
                    console.log(err);
                    msg.reply("Gagal mendownload gambar.");
                }
            }

            // COMMAND: !reveal (Reply Gambar/Dokumen)
            if (command === 'reveal') {
                const quotedMsg = m.message.extendedTextMessage?.contextInfo?.quotedMessage;
                const isQuotedDoc = quotedMsg?.documentMessage;
                const isQuotedImg = quotedMsg?.imageMessage;

                if (!isQuotedDoc && !isQuotedImg) {
                    return msg.reply("⚠️ Reply gambar/dokumen rahasia dengan !reveal");
                }

                msg.reply("🔍 Sedang membaca pesan...");

                try {
                    const messageToDownload = {
                        key: m.message.extendedTextMessage.contextInfo.stanzaId,
                        message: quotedMsg
                    };

                    const buffer = await downloadMediaMessage(
                        messageToDownload,
                        'buffer',
                        {},
                        { logger: pino({ level: 'silent' }) }
                    );

                    const inputPath = `./temp_reveal_${sender.split('@')[0]}.png`;
                    fs.writeFileSync(inputPath, buffer);

                    // PERBAIKAN: Menggunakan 'python3'
                    const cmdPython = `python3 commands/stegano.py reveal "${inputPath}"`;

                    exec(cmdPython, (error, stdout, stderr) => {
                        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);

                        if (error) return msg.reply("❌ Tidak ditemukan pesan rahasia di file ini (atau format salah).");
                        
                        msg.reply(stdout);
                    });

                } catch (e) {
                    console.log(e);
                    msg.reply("Gagal mengambil media.");
                }
            }

            // ==========================================================
            //  COMMAND HANDLER
            // ==========================================================

            // 1. MODUL NON-PREFIX (Interaktif)
            if (command === 'id' || command === 'cekid') {
                return msg.reply(`🆔 *ID INFO*\nChat: \`${remoteJid}\`\nUser: \`${sender}\``);
            }

            if (typeof pdfCmd !== 'undefined') {
                await pdfCmd(command, args, msg, sender, sock).catch(e => console.error("Error PDF:", e.message));
            }
            await gameTebakCmd(command, args, msg, user, db, body).catch(e => console.error("Error Game:", e.message));

            // 2. MODUL PREFIX (!)
            if (!isCommand) return;
            
           
            await toolsCmd(command, args, msg, user, db, sock).catch(e => console.error("Error Tools:", e.message));
            await economyCmd(command, args, msg, user, db).catch(e => console.error("Error Economy:", e.message));
            await stocksCmd(command, args, msg, user, db).catch(e => console.error("Error Stocks:", e.message));
            await cryptoCmd(command, args, msg, user, db).catch(e => console.error("Error Crypto:", e.message));
            await propertyCmd(command, args, msg, user, db).catch(e => console.error("Error Property:", e.message));
            await minesCmd(command, args, msg, user, db).catch(e => console.error("Error Mines:", e.message));
            await duelCmd(command, args, msg, user, db).catch(e => console.error("Error Duel:", e.message));
            await bolaCmd(command, args, msg, user, db, sender).catch(e => console.error("Error Bola:", e.message));
            await nationCmd(command, args, msg, user, db).catch(e => console.error("Error Nation:", e.message));
            await robCmd(command, args, msg, user, db).catch(e => console.error("Error Rob:", e.message));
            await rouletteCmd(command, args, msg, user, db).catch(e => console.error("Error Roulette:", e.message));
            await battleCmd(command, args, msg, user, db).catch(e => console.error("Error Battle:", e.message));
            await ttsCmd(command, args, msg).catch(e => console.error("Error TTS:", e.message));
            await wikiKnowCmd(command, args, msg).catch(e => console.error("Error WikiKnow:", e.message));
            await adminCmd(command, args, msg, user, db).catch(e => console.error("Error Admin:", e.message));
            await aiCmd(command, args, msg, user, db).catch(e => console.error("Error AI:", e.message));
            await caturCmd(command, args, msg, user, db, sock).catch(e => console.error("Error Catur:", e.message));
            await imageCmd(command, args, msg, user, db, sock).catch(e => console.error("Error Image:", e.message));
            
            if (typeof profileCmd !== 'undefined') {
                 await profileCmd(command, args, msg, user, db, chat, sock).catch(e => console.error("Error Profile:", e.message));
            }

            // ==========================================================
            //  FITUR STEGANOGRAFI
            // ==========================================================
            
            // COMMAND: !hide <pesan> (Reply/Kirim Gambar)
            if (command === 'hide') {
                const isImage = (msgType === 'imageMessage');
                const isQuotedImage = m.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;

                if (!isImage && !isQuotedImage) return msg.reply("⚠️ Kirim/Reply gambar dengan caption: !hide pesan rahasia");
                
                const pesanRahasia = args.join(" ");
                if (!pesanRahasia) return msg.reply("⚠️ Mana pesannya? Contoh: !hide Misi Rahasia 007");

                msg.reply("⏳ Sedang menyembunyikan pesan...");

                try {
                    let messageToDownload = m;
                    if (isQuotedImage) {
                        messageToDownload = {
                            key: m.message.extendedTextMessage.contextInfo.stanzaId,
                            message: m.message.extendedTextMessage.contextInfo.quotedMessage
                        };
                    }

                    const buffer = await downloadMediaMessage(
                        messageToDownload,
                        'buffer',
                        {},
                        { logger: pino({ level: 'silent' }) }
                    );

                    const inputPath = `./temp_input_${sender.split('@')[0]}.jpg`;
                    const outputPath = `./temp_output_${sender.split('@')[0]}.png`;

                    fs.writeFileSync(inputPath, buffer);
                    
                    // Pakai 'python3' dan path 'commands/stegano.py'
                    const cmdPython = `python3 commands/stegano.py hide "${inputPath}" "${pesanRahasia}" "${outputPath}"`;

                    exec(cmdPython, async (error, stdout, stderr) => {
                        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);

                        if (error) {
                            console.error("Stegano Error:", error);
                            if (error.message.includes("not found")) {
                                return msg.reply("❌ Error: Python3 tidak terinstall/terdeteksi.");
                            }
                            return msg.reply("❌ Gagal. Pastikan gambar tidak rusak.");
                        }

                        await sock.sendMessage(remoteJid, { 
                            document: fs.readFileSync(outputPath), 
                            mimetype: 'image/png',
                            fileName: 'RAHASIA.png',
                            caption: '✅ SUKSES! Download file ini (Document) agar pesan aman.'
                        }, { quoted: m });

                        setTimeout(() => {
                            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
                        }, 5000);
                    });

                } catch (err) {
                    console.log(err);
                    msg.reply("Gagal mendownload gambar.");
                }
            }

            // COMMAND: !reveal (Reply Gambar/Dokumen)
            if (command === 'reveal') {
                const quotedMsg = m.message.extendedTextMessage?.contextInfo?.quotedMessage;
                const isQuotedDoc = quotedMsg?.documentMessage;
                const isQuotedImg = quotedMsg?.imageMessage;

                if (!isQuotedDoc && !isQuotedImg) {
                    return msg.reply("⚠️ Reply gambar/dokumen rahasia dengan !reveal");
                }

                msg.reply("🔍 Sedang membaca pesan...");

                try {
                    const messageToDownload = {
                        key: m.message.extendedTextMessage.contextInfo.stanzaId,
                        message: quotedMsg
                    };

                    const buffer = await downloadMediaMessage(
                        messageToDownload,
                        'buffer',
                        {},
                        { logger: pino({ level: 'silent' }) }
                    );

                    const inputPath = `./temp_reveal_${sender.split('@')[0]}.png`;
                    fs.writeFileSync(inputPath, buffer);

                    // Pakai 'python3' dan path 'commands/stegano.py'
                    const cmdPython = `python3 commands/stegano.py reveal "${inputPath}"`;

                    exec(cmdPython, (error, stdout, stderr) => {
                        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);

                        if (error) return msg.reply("❌ Tidak ditemukan pesan rahasia di file ini (atau format salah).");
                        
                        msg.reply(stdout);
                    });

                } catch (e) {
                    console.log(e);
                    msg.reply("Gagal mengambil media.");
                }
            }
            

            // MENU UTAMA
            if (command === "menu" || command === "help") {
                const menuText = `📜 *MENU BOT MULTIFUNGSI*

👤 *USER & PROFILE*
• !me | !rank | !inv | !daily | !quest
• !migrasi @akun_asli (Gabung Akun)

🏦 *BANK & KRIMINAL*
• !bank | !depo <jml> | !tarik <jml>
• !rob @user (Maling Dompet)

🚀 *CRYPTO & MINING*
• !market | !pf | !topcrypto
• !buycrypto <koin> <jml>
• !sellcrypto <koin> <jml>
• !mining | !margin | !paydebt

📈 *PASAR SAHAM (STOCK MARKET)*
• !saham        : Cek harga saham Real-time (IHSG)
• !belisaham <kode> <jml> : Beli saham
• !jualsaham <kode> <jml> : Jual saham
• !pf/!porto           : Cek Portofolio Saham & Aset

🏢 *BISNIS & PROPERTI*
• !properti     : Cek katalog & aset kamu
• !beliusaha <id> <jml> : Beli bisnis baru
• !collect      : Panen uang dari bisnis

🎮 *GAMES*
• !gacha (Jackpot 10k!)
• !casino <jml> | !slot <jml> | !tembok (Tebak Hal di Belakang Tembok)
• !tebakgambar | !asahotak | !susunkata
• !duel @user (Russian Roullete) <bet>
• !bom <bet> !stop (Minesweeper)
• !rolet <pilihan> <bet>
• !catur <bet>

⚽ *SPORT BETTING*
• !updatebola | !bola | !topbola | !resultbola

🧠 *AI SUPER TIERS*
• !ai0 <tanya> (Terbaik namun terbatas)
• !ai1 <tanya> (Flagship/Smart)
• !ai2 <tanya> (Roleplay/Asik)
• !ai3 <tanya> (Speed/Cepat)
• !ask <tanya> (Auto-Pilot)
• !sharechat (Buat Link History) 

🏳️ *NEGARA (WAR)*
• !negara : Cek status & infrastruktur
• !buatnegara <nama> : Bikin Negara (Biaya 5 Miliar)
• !bangun <tipe> : Bank(10M)/Benteng(25M)/RS(5M)
• !rekrut <jml> : Beli Tentara (50 Juta/orang)
• !serang @target : Perang Buta (Blind War)
• !pajaknegara : Tarik pajak dari rakyat
• !subsidi <jml> : Transfer Uang Pribadi -> Kas
• !korupsi <jml> : Maling Uang Kas (Awas Kudeta!)
• !topnegara (Leaderboard)

📸 *EDITOR & MEDIA*
• !sticker !toimg (Buat Stiker WA)
• !topdf (Ubah Gambar ke PDF)
• !scan (Gambar B&W) 
• !pdfdone (Selesai & Buat PDF)
• !tts (text to speech)
• !img (Image generator)
• !hide <pesan> (Reply/Kirim Gambar) | !reveal: Munculkan pesan

🛠️ *TOOLS & ADMIN*
• !id (Cek ID Lengkap)
• !idgrup (Cek ID Grup)`;
                return msg.reply(menuText);
            }

        } catch (e) {
            console.error("Critical Error di Index.js:", e.message);
        }
    });

    // AUTO SAVE (5 Detik)
    setInterval(() => {
        if (global.db) saveDB(global.db);
    }, 5000); 
}

startBot();


















