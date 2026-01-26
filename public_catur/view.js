export class ChessView {
    constructor(elementId, onClickSquare) {
        this.boardElement = document.getElementById(elementId);
        this.onClickSquare = onClickSquare;
        
        // Simbol Unicode
        this.pieces = {
            'r': '♜', 'n': '♞', 'b': '♝', 'q': '♛', 'k': '♚', 'p': '♟', 
            'R': '♖', 'N': '♘', 'B': '♗', 'Q': '♕', 'K': '♔', 'P': '♙'
        };
    }

    render(grid) {
        this.boardElement.innerHTML = ''; 

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const square = document.createElement('div');
                square.classList.add('square');
                
                // Tentukan Warna Kotak Belang-Belang
                const isWhiteSquare = (r + c) % 2 === 0;
                square.classList.add(isWhiteSquare ? 'white' : 'black');
                
                square.dataset.row = r;
                square.dataset.col = c;
                
                square.addEventListener('click', () => {
                    this.onClickSquare(parseInt(square.dataset.row), parseInt(square.dataset.col));
                });

                // Tampilkan Bidak
                const pieceChar = grid[r][c];
                if (pieceChar) {
                    const pieceSpan = document.createElement('span');
                    pieceSpan.innerText = this.pieces[pieceChar] || pieceChar;
                    
                    // Style Bidak Agar Kontras
                    const isWhitePiece = pieceChar === pieceChar.toUpperCase();
                    
                    // Bidak Putih = Warna Putih + Outline Hitam Tipis
                    // Bidak Hitam = Warna Hitam Total
                    pieceSpan.style.color = isWhitePiece ? '#ffffff' : '#000000';
                    
                    if (isWhitePiece) {
                        // Bayangan hitam biar kelihatan di kotak terang
                        pieceSpan.style.textShadow = '0px 0px 2px #000'; 
                    }
                    
                    square.appendChild(pieceSpan);
                }

                this.boardElement.appendChild(square);
            }
        }
    }

    highlightSquare(row, col, className) {
        const index = row * 8 + col;
        const squares = this.boardElement.children;
        if (squares[index]) {
            squares[index].classList.add(className);
        }
    }
}
