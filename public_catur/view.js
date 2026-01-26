import { PIECES } from './constants.js';

export class ChessView {
    constructor(elementId, onClickHandler) {
        this.element = document.getElementById(elementId);
        this.onClickHandler = onClickHandler; // Fungsi yang dipanggil saat diklik
    }

    render(boardGrid) {
        this.element.innerHTML = ''; // Bersihkan papan
        
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const square = document.createElement('div');
                square.classList.add('square');
                square.classList.add((r + c) % 2 === 0 ? 'light' : 'dark');
                
                // Set koordinat data
                square.dataset.row = r;
                square.dataset.col = c;

                // Render Bidak
                const pieceChar = boardGrid[r][c];
                if (pieceChar) {
                    square.textContent = PIECES[pieceChar];
                }

                // Event Klik
                square.addEventListener('click', (e) => {
                    // Panggil fungsi di Main.js
                    this.onClickHandler(r, c);
                });

                this.element.appendChild(square);
            }
        }
    }

    highlightSquare(row, col, className) {
        // Cari elemen div yang sesuai koordinat
        const square = this.element.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        if (square) square.classList.add(className);
    }
}
