// js/main.js

// --- IMPORTS ---
import { Board } from './board.js';
import { ChessView } from './view.js';
import { Rules } from './rules.js';
import { ChessAI } from './ai.js';

// --- 1. SETUP AWAL & BACA URL ---
// Ambil data user dan taruhan dari link yang dikasih bot WA
// Contoh link: domain.com/game/index.html?user=62812345&bet=1000
const urlParams = new URLSearchParams(window.location.search);
const userWA = urlParams.get('user');
const betAmount = urlParams.get('bet');

// Validasi (optional): Peringatkan jika dibuka bukan dari link WA
if (!userWA || !betAmount) {
    console.warn("⚠️ Mode Latihan: Tidak ada data user/taruhan dari URL.");
}

// Inisialisasi Komponen Game
const board = new Board();
const ai = new ChessAI(board);
const view = new ChessView('chessboard', handleSquareClick);

// State Game
let selectedSquare = null;
let possibleMoves = [];
let isGameOver = false;

// --- FUNGSI UTAMA ---

// Memulai game saat halaman dimuat
function initGame() {
    view.render(board.grid);
    updateStatus();
}

// Mengupdate teks status di atas papan
function updateStatus(result = null) {
    const statusEl = document.getElementById('status');
    
    // Jika ada hasil akhir (Mat/Remis), tampilkan merah
    if (result) {
        statusEl.innerText = result;
        statusEl.style.color = 'red';
        statusEl.style.fontWeight = 'bold';
        return;
    }
    
    // Tampilkan status giliran normal
    const inCheck = Rules.isKingInCheck(board, board.turn);
    const turnText = board.turn === 'white' ? 'Putih (Kamu)' : 'Hitam (Bot)';
    // Tampilkan juga counter 50-move rule agar terlihat profesional
    statusEl.innerText = `Giliran: ${turnText} ${inCheck ? '⚠️(SKAK!)' : ''} | 50-Move: ${board.halfMoveClock}/100`;
    statusEl.style.color = inCheck ? 'orange' : '#eee'; // Warna teks terang agar kontras
}

// Menangani klik user pada kotak papan
function handleSquareClick(row, col) {
    // CEGAH KLIK JIKA: Game sudah selesai ATAU sekarang giliran Bot (Hitam)
    if (isGameOver || board.turn === 'black') return;

    const clickedPiece = board.getPiece(row, col);
    
    // Cek apakah yang diklik adalah bidak milik pemain yang sedang jalan (Putih)
    const isWhitePiece = clickedPiece && clickedPiece === clickedPiece.toUpperCase();
    const isOwnPiece = isWhitePiece && board.turn === 'white';

    // SKENARIO 1: MEMILIH BIDAK (Select)
    if (isOwnPiece) {
        selectedSquare = { row, col };
        // Dapatkan hanya langkah yang VALID (aman dari skak)
        possibleMoves = Rules.getValidMoves(board, row, col);
        
        // Update tampilan (Highlight)
        view.render(board.grid);
        view.highlightSquare(row, col, 'selected');
        possibleMoves.forEach(m => view.highlightSquare(m.row, m.col, 'possible-move'));
        return;
    }

    // SKENARIO 2: MELANGKAH (Move)
    if (selectedSquare) {
        // Cek apakah kotak tujuan ada di daftar langkah valid
        const moveData = possibleMoves.find(m => m.row === row && m.col === col);

        if (moveData) {
            // --- PROMOSI PION (User Only) ---
            let promoPiece = null;
            const movingPiece = board.getPiece(selectedSquare.row, selectedSquare.col);
            const isPawn = movingPiece && movingPiece.toLowerCase() === 'p';
            // User (Putih) promosi di baris 0
            const isPromotion = isPawn && row === 0;

            if (isPromotion) {
                // Tanya user mau jadi apa via prompt browser
                let choice = prompt("Promosi! Pilih: Q (Menteri), R (Benteng), B (Gajah), N (Kuda)", "Q") || 'Q';
                choice = choice.toUpperCase();
                // Validasi input, default ke Q jika ngawur
                if (!['Q', 'R', 'B', 'N'].includes(choice)) choice = 'Q';
                promoPiece = choice; // User selalu Putih (huruf besar)
            }

            // EKSEKUSI LANGKAH USER
            executeMove(selectedSquare.row, selectedSquare.col, row, col, moveData, promoPiece);

        } else {
            // Kalau klik sembarang tempat, batalkan pilihan
            resetSelection();
            view.render(board.grid);
        }
    }
}

// Fungsi Sentral untuk Menjalankan Langkah (Dipakai User & Bot)
function executeMove(fromRow, fromCol, toRow, toCol, moveData, promoPiece) {
    // 1. Update data papan secara internal
    board.movePiece(fromRow, fromCol, toRow, toCol, promoPiece);

    // 2. Tangani gerakan khusus
    // Rokade Kanan (King-side)
    if (moveData.isCastling === 'king-side') {
        board.movePiece(toRow, 7, toRow, 5);
        // Perbaiki giliran karena movePiece menukar giliran 2x
        board.turn = (board.turn === 'white') ? 'black' : 'white'; 
    }
    // Rokade Kiri (Queen-side)
    if (moveData.isCastling === 'queen-side') {
        board.movePiece(toRow, 0, toRow, 3);
        board.turn = (board.turn === 'white') ? 'black' : 'white';
    }
    // En Passant (Hapus bidak yang disalip)
    if (moveData.isEnPassant) {
        board.grid[moveData.captureRow][moveData.captureCol] = null;
    }

    // 3. Bersihkan status seleksi & Cek Game Over
    resetSelection();
    checkGameOver();

    // 4. Jika game belum selesai, update tampilan & panggil bot
    if (!isGameOver) {
        view.render(board.grid);
        updateStatus();

        // JIKA SEKARANG GILIRAN HITAM, SURUH BOT JALAN
        if (board.turn === 'black') {
            // Beri delay sedikit agar terasa natural (bot "mikir")
            setTimeout(makeBotMove, 250);
        }
    }
}

// --- LOGIKA BOT (AI) ---
function makeBotMove() {
    if (isGameOver) return;

    // 1. Ambil Level Kesulitan dari Dropdown HTML
    const levelEl = document.getElementById('difficulty');
    // Default level 2 jika elemen tidak ditemukan
    const level = levelEl ? parseInt(levelEl.value) : 2; 

    // Gunakan setTimeout 0ms agar browser sempat me-render UI sebelum thread macet buat mikir
    setTimeout(() => {
        // Minta AI mencari langkah terbaik untuk Hitam ('black')
        const bestMove = ai.getBestMove('black', level);

        if (bestMove) {
            // Bot otomatis promosi jadi Queen (biar simpel)
            let promo = null;
            const isPawn = bestMove.piece.toLowerCase() === 'p';
            // Bot (Hitam) promosi di baris 7
            if (isPawn && bestMove.row === 7) {
                promo = 'q'; // Huruf kecil untuk hitam
            }

            // Eksekusi langkah bot
            executeMove(bestMove.fromRow, bestMove.fromCol, bestMove.row, bestMove.col, bestMove, promo);
        } else {
            // Harusnya tidak terjadi, tapi jika bot buntu, cek game over
            checkGameOver();
        }
    }, 10);
}

// --- LOGIKA CEK GAME OVER (WASIT) ---
function checkGameOver() {
    const nextTurn = board.turn;
    
    // 1. Cek Remis Materi Kurang (Misal: Raja vs Raja)
    if (Rules.isInsufficientMaterial(board)) {
        finishGame("REMIS (Materi Kurang)", "Draw! Bidak yang tersisa tidak cukup untuk skakmat.");
        return;
    }

    // 2. Cek Aturan 50 Langkah
    if (board.halfMoveClock >= 100) {
        finishGame("REMIS (Aturan 50 Langkah)", "Draw! Sudah 50 langkah tanpa ada pion bergerak atau bidak dimakan.");
        return;
    }

    // 3. Cek 3x Pengulangan Posisi
    if (board.getRepetitionCount() >= 3) {
        finishGame("REMIS (3x Pengulangan)", "Draw! Posisi papan yang sama sudah terulang 3 kali.");
        return;
    }

    // 4. Cek Skakmat atau Stalemate
    // Hitung ada berapa langkah valid yang dimiliki pemain berikutnya
    let totalValidMoves = 0;
    for(let r=0; r<8; r++) {
        for(let c=0; c<8; c++) {
            const piece = board.getPiece(r, c);
            // Jika bidak milik pemain yang akan jalan
            if (piece && Rules.getPieceColor(piece) === nextTurn) {
                const moves = Rules.getValidMoves(board, r, c);
                totalValidMoves += moves.length;
            }
        }
    }

    // Jika TIDAK ADA langkah valid tersisa
    if (totalValidMoves === 0) {
        // Cek apakah Rajanya sedang di-skak?
        if (Rules.isKingInCheck(board, nextTurn)) {
            // SKAKMAT! Pemenangnya adalah lawan dari yang kena skak.
            const winner = (nextTurn === 'white') ? 'Hitam (Bot)' : 'Putih (Kamu)';
            finishGame(`SKAKMAT! Pemenang: ${winner}`, `Game Over! Skakmat. Pemenang: ${winner}`);
        } else {
            // STALEMATE! Raja gak di-skak tapi gak bisa gerak kemana-mana.
            finishGame("REMIS (Stalemate)", "Draw (Stalemate)! Raja terjebak tapi tidak sedang di-skak.");
        }
    }
}

// --- FUNGSI PENYELESAIAN GAME & LAPOR KE SERVER ---
function finishGame(statusText, alertText) {
    isGameOver = true;
    view.render(board.grid);
    updateStatus(statusText); // Tampilkan status akhir di UI
    
    // Beri jeda sedikit sebelum alert muncul agar render papan selesai
    setTimeout(() => {
        alert(alertText);

        // --- BAGIAN PENTING: LAPOR KE BOT WA ---
        // Hanya lapor jika ada data user dari URL
        if (userWA && betAmount) {
            
            // Tentukan hasil (win/lose/draw) untuk dikirim ke server
            let result = 'lose'; // Default anggap user kalah
            
            // Jika status teks mengandung "Putih" dan "Pemenang", berarti User Menang
            if (statusText.includes("Putih") && statusText.includes("Pemenang")) {
                result = 'win'; 
            } 
            // Jika status teks mengandung kata-kata remis
            else if (statusText.includes("REMIS") || statusText.includes("Draw") || statusText.includes("Stalemate")) {
                result = 'draw';
            }

            console.log("Melaporkan hasil ke server:", { userWA, result, betAmount });
            
            // Kirim data via Fetch POST ke endpoint API di index.js bot
            fetch('/api/catur-finish', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ 
                    user: userWA, 
                    bet: betAmount, 
                    result: result 
                })
            })
            .then(response => {
                if (!response.ok) throw new Error('Gagal menghubungi server bot');
                return response.json();
            })
            .then(data => {
                // Tampilkan pesan balasan dari server bot (Misal: "Koin +2000")
                if(data.status === 'ok') {
                    alert("✅ Laporan Berhasil!\n\n" + data.message);
                } else {
                    alert("⚠️ Terjadi Masalah: " + data.message);
                }
                // Opsional: Tutup window setelah selesai
                // window.close(); 
            })
            .catch(err => {
                console.error("Error saat lapor ke bot:", err);
                alert("❌ Gagal melaporkan hasil ke bot. Cek koneksi internet atau hubungi admin.");
            });
        }
    }, 100);
}

// --- HELPER FUNCTIONS ---
// Reset variabel seleksi
function resetSelection() { 
    selectedSquare = null; 
    possibleMoves = []; 
}

// Cek apakah bidak milik pemain yang sedang giliran
function isPieceTurnOwner(piece) {
    if (!piece) return false;
    const isWhite = piece === piece.toUpperCase();
    // Putih jalan jika turn 'white', Hitam jalan jika turn 'black'
    return (board.turn === 'white' && isWhite) || (board.turn === 'black' && !isWhite);
}

// JALANKAN GAME!
initGame();