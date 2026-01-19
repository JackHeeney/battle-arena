const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// Serve static files from the client folder
app.use(express.static(path.join(__dirname, '../client')));

// Serve index.html for the root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

const players = {};
// Add game states for matchmaking
const gameStates = new Map();

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);
    players[socket.id] = { x: 0, y: 1, z: 0, yaw: 0 };

    socket.emit('currentPlayers', players);
    socket.broadcast.emit('newPlayer', { id: socket.id, ...players[socket.id] });

    // Add matchmaking functionality
    socket.on('startMatchmaking', (data) => {
        console.log('Player starting matchmaking:', data);

        // Immediately match with a dummy player
        const dummyClass = ['Mage', 'Hunter', 'Warrior'][Math.floor(Math.random() * 3)];
        console.log('Creating dummy match with class:', dummyClass);

        // Create game state
        const gameId = `game_${Date.now()}`;
        gameStates.set(gameId, {
            players: {},
            countdown: 20,
            canMove: false
        });

        // Track this player in the game state
        gameStates.get(gameId).players[socket.id] = false;

        // Emit match found event with dummy match data
        socket.emit('matchFound', {
            class: data.class,
            isDummyMatch: true,
            dummyClass: dummyClass,
            gameId: gameId
        });
    });

    // Add game ready functionality
    socket.on('gameReady', (data) => {
        console.log('Player ready:', socket.id, 'Game ID:', data.gameId);
        const gameState = gameStates.get(data.gameId);

        if (gameState) {
            gameState.players[socket.id] = true;
            console.log('Game state updated:', gameState);

            // If all players are ready, start the countdown
            if (Object.values(gameState.players).every(ready => ready)) {
                console.log('All players ready, starting countdown');
                startGameCountdown(data.gameId);
            }
        }
    });

    socket.on('playerMove', data => {
        if (players[socket.id]) {
            players[socket.id] = data;
            socket.broadcast.emit('updatePlayer', { id: socket.id, ...data });
        }
    });

    socket.on('spellCast', data => {
        socket.broadcast.emit('spellCast', { id: socket.id, ...data });
    });

    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        delete players[socket.id];
        socket.broadcast.emit('removePlayer', socket.id);
    });
});

// Add game countdown function
function startGameCountdown(gameId) {
    const gameState = gameStates.get(gameId);
    if (!gameState) return;

    gameState.countdown = 20;
    gameState.countdownInterval = setInterval(() => {
        gameState.countdown--;
        console.log('Countdown:', gameState.countdown);

        // Update all players in the game
        Object.keys(gameState.players).forEach(playerId => {
            const playerSocket = io.sockets.sockets.get(playerId);
            if (playerSocket) {
                playerSocket.emit('countdownUpdate', {
                    countdown: gameState.countdown,
                    canMove: gameState.countdown <= 5 // Allow movement in last 5 seconds
                });
            }
        });

        if (gameState.countdown <= 0) {
            clearInterval(gameState.countdownInterval);
            console.log('Countdown finished, starting game');

            // Start the game for all players
            Object.keys(gameState.players).forEach(playerId => {
                const playerSocket = io.sockets.sockets.get(playerId);
                if (playerSocket) {
                    playerSocket.emit('gameStart');
                }
            });
        }
    }, 1000);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
