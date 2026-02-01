const WebSocket = require('ws');
const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Minecraft Server is Running!');
});

const wss = new WebSocket.Server({ server });

// GAME STATE
let players = {};
let blocks = {}; // Stores changes: "x,y,z": type

wss.on('connection', (ws) => {
    const id = Math.random().toString(36).substring(7);
    console.log(`Player ${id} joined`);

    // 1. Send Initial State (Your ID, World Blocks, Other Players)
    ws.send(JSON.stringify({
        t: 'init', 
        id: id,
        blocks: blocks,
        players: players
    }));

    // 2. Add new player to list
    players[id] = { x: 0, y: 5, z: 0, yaw: 0, pitch: 0, anim: 0 };
    
    // 3. Tell everyone else a new player joined
    broadcast({ t: 'spawn', id: id, x: 0, y: 5, z: 0 });

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            if (data.t === 'move') {
                // Update player state
                if (players[id]) {
                    players[id].x = data.x;
                    players[id].y = data.y;
                    players[id].z = data.z;
                    players[id].yaw = data.yaw;
                    players[id].pitch = data.pitch;
                    players[id].anim = data.anim;
                    
                    // Broadcast movement to others (exclude self)
                    broadcast({ t: 'update', id: id, ...players[id] }, ws);
                }
            }
            else if (data.t === 'block') {
                const key = `${data.x},${data.y},${data.z}`;
                if (data.type === 0) delete blocks[key]; // Air/Break
                else blocks[key] = data.type; // Place
                
                // Tell everyone about the block change
                broadcast(data); // Send to everyone including sender (to confirm)
            }
        } catch (e) { console.error(e); }
    });

    ws.on('close', () => {
        console.log(`Player ${id} left`);
        delete players[id];
        broadcast({ t: 'leave', id: id });
    });
});

function broadcast(msg, excludeWs) {
    const data = JSON.stringify(msg);
    wss.clients.forEach(client => {
        if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    });
}

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// --- ANTI-SLEEP MECHANISM ---
// Pings itself every 10 minutes to stop Render from sleeping
const APP_URL = "https://YOUR-APP-NAME.onrender.com"; // CHANGE THIS AFTER DEPLOYING
setInterval(() => {
    https.get(APP_URL, (res) => {
        console.log(`Ping sent to ${APP_URL}. Status: ${res.statusCode}`);
    }).on('error', (e) => {
        console.error(`Ping failed: ${e.message}`);
    });
}, 600000); // 10 minutes
