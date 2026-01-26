import { Rules } from './rules.js';

export class ChessAI {
    constructor(board) {
        this.board = board;
        // PENTING: Tabel Nilai Posisi (Piece-Square Tables)
        // Bot jadi tahu kalau Kuda bagus di tengah, tapi Pion bagus kalau maju.
        this.pst = {
            p: [ // Pion lebih suka maju
                [0,  0,  0,  0,  0,  0,  0,  0],
                [50, 50, 50, 50, 50, 50, 50, 50],
                [10, 10, 20, 30, 30, 20, 10, 10],
                [5,  5, 10, 25, 25, 10,  5,  5],
                [0,  0,  0, 20, 20,  0,  0,  0],
                [5, -5,-10,  0,  0,-10, -5,  5],
                [5, 10, 10,-20,-20, 10, 10,  5],
                [0,  0,  0,  0,  0,  0,  0,  0]
            ],
            n: [ // Kuda (Knight) suka di tengah (Centralize)
                [-50,-40,-30,-30,-30,-30,-40,-50],
                [-40,-20,  0,  0,  0,  0,-20,-40],
                [-30,  0, 10, 15, 15, 10,  0,-30],
                [-30,  5, 15, 20, 20, 15,  5,-30],
                [-30,  0, 15, 20, 20, 15,  0,-30],
                [-30,  5, 10, 15, 15, 10,  5,-30],
                [-40,-20,  0,  5,  5,  0,-20,-40],
                [-50,-40,-30,-30,-30,-30,-40,-50]
            ],
            // (Bisa ditambahkan untuk gajah/benteng, tapi Pion & Kuda paling krusial buat strategi awal)
        };
    }

    getBestMove(color, level) {
        // LEVEL 1: MUDAH (Random Move)
        if (level === 1) {
            const moves = this.getAllValidMoves(this.board, color);
            return moves[Math.floor(Math.random() * moves.length)];
        }

        // LEVEL 2: SEDANG (Depth 2 - Cukup jeli tapi tidak strategis)
        if (level === 2) {
            return this.minimaxRoot(2, color, true);
        }

        // LEVEL 3: SULIT (Depth 3 + Strategi Posisi)
        // Menggunakan Alpha-Beta Pruning biar mikirnya cepat
        if (level === 3) {
            return this.minimaxRoot(3, color, true);
        }
    }

    // Fungsi Akar Minimax (Langkah Awal)
    minimaxRoot(depth, color, isMaximizing) {
        const moves = this.getAllValidMoves(this.board, color);
        let bestMove = null;
        let bestValue = isMaximizing ? -Infinity : Infinity;

        // Kita acak urutan moves biar bot gak monoton kalau nilainya sama
        moves.sort(() => Math.random() - 0.5);

        for (const move of moves) {
            const tempBoard = this.board.clone();
            const promo = (move.piece.toLowerCase() === 'p' && (move.row===0 || move.row===7)) ? 'q' : null;
            tempBoard.movePiece(move.fromRow, move.fromCol, move.row, move.col, promo);

            // Panggil Minimax Rekursif
            // Alpha: -Infinity, Beta: Infinity
            const value = this.minimax(tempBoard, depth - 1, -Infinity, Infinity, !isMaximizing, color);

            if (isMaximizing) {
                if (value > bestValue) { bestValue = value; bestMove = move; }
            } else {
                if (value < bestValue) { bestValue = value; bestMove = move; }
            }
        }
        return bestMove;
    }

    // Algoritma Minimax dengan Alpha-Beta Pruning
    minimax(board, depth, alpha, beta, isMaximizing, myColor) {
        // Base Case: Kalau kedalaman 0, hitung skor papan saat ini
        if (depth === 0) {
            return this.evaluateBoard(board, myColor);
        }

        const turnColor = isMaximizing ? myColor : (myColor === 'white' ? 'black' : 'white');
        const moves = this.getAllValidMoves(board, turnColor);

        // Kalau Skakmat / Remis
        if (moves.length === 0) {
            if (Rules.isKingInCheck(board, turnColor)) {
                return isMaximizing ? -9999 : 9999; // Skakmat nilainya gede banget
            }
            return 0; // Remis
        }

        if (isMaximizing) {
            let maxEval = -Infinity;
            for (const move of moves) {
                const tempBoard = board.clone();
                const promo = (move.piece.toLowerCase() === 'p' && (move.row===0 || move.row===7)) ? 'q' : null;
                tempBoard.movePiece(move.fromRow, move.fromCol, move.row, move.col, promo);

                const evalVal = this.minimax(tempBoard, depth - 1, alpha, beta, false, myColor);
                maxEval = Math.max(maxEval, evalVal);
                
                // Alpha-Beta Pruning (Potong cabang yang gak guna)
                alpha = Math.max(alpha, evalVal);
                if (beta <= alpha) break; 
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (const move of moves) {
                const tempBoard = board.clone();
                const promo = (move.piece.toLowerCase() === 'p' && (move.row===0 || move.row===7)) ? 'q' : null;
                tempBoard.movePiece(move.fromRow, move.fromCol, move.row, move.col, promo);

                const evalVal = this.minimax(tempBoard, depth - 1, alpha, beta, true, myColor);
                minEval = Math.min(minEval, evalVal);
                
                beta = Math.min(beta, evalVal);
                if (beta <= alpha) break;
            }
            return minEval;
        }
    }

    getAllValidMoves(board, color) {
        let moves = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = board.getPiece(r, c);
                if (piece && Rules.getPieceColor(piece) === color) {
                    const validMoves = Rules.getValidMoves(board, r, c);
                    validMoves.forEach(m => {
                        m.fromRow = r; m.fromCol = c; m.piece = piece;
                        moves.push(m);
                    });
                }
            }
        }
        return moves;
    }

    evaluateBoard(board, myColor) {
        let score = 0;
        const pieceVal = { 'p': 100, 'n': 320, 'b': 330, 'r': 500, 'q': 900, 'k': 20000 };

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = board.getPiece(r, c);
                if (piece) {
                    const type = piece.toLowerCase();
                    const isWhite = piece === piece.toUpperCase();
                    
                    // 1. Nilai Material (Bidak)
                    let value = pieceVal[type] || 0;

                    // 2. Nilai Posisi (PST) - Hanya dipakai di Level 3 ke atas
                    // Kita cek apakah ada tabel strategi untuk bidak ini
                    if (this.pst[type]) {
                        // Kalau putih, pakai tabel normal. Kalau hitam, tabel harus dibalik (mirror)
                        if (isWhite) {
                            value += this.pst[type][r][c];
                        } else {
                            value += this.pst[type][7-r][c]; // Balik baris untuk hitam
                        }
                    }

                    if (isWhite) score += value;
                    else score -= value;
                }
            }
        }
        return (myColor === 'white') ? score : -score;
    }
}