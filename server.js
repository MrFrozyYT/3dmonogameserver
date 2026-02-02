const WebSocket = require('ws');
const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Minecraft Server Running!');
});

const wss = new WebSocket.Server({ server });

let players = {};
let blocks = {}; 

wss.on('connection', (ws) => {
    const id = Math.random().toString(36).substring(7);
    console.log(`Player ${id} joined`);

    // Send Init Packet
    ws.send(JSON.stringify({
        t: 'init', 
        id: id,
        blocks: blocks,
        players: players
    }));

    // Default state
    players[id] = { x: 0, y: 10, z: 0, yaw: 0, pitch: 0, anim: 0, name: "Player" + id };
    
    // Notify others
    broadcast({ t: 'spawn', id: id, x: 0, y: 10, z: 0, name: players[id].name });

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            if (data.t === 'move') {
                if (players[id]) {
                    players[id].x = data.x;
                    players[id].y = data.y;
                    players[id].z = data.z;
                    players[id].yaw = data.yaw;
                    players[id].pitch = data.pitch;
                    players[id].anim = data.anim;
                    // If client sends a name update, save it
                    if (data.name) players[id].name = data.name;
                    // If client sends held block, save it
                    if (data.held !== undefined) players[id].held = data.held;

                    broadcast({ t: 'update', id: id, ...players[id] }, ws);
                }
            }
            else if (data.t === 'block') {
                const key = `${data.x},${data.y},${data.z}`;
                if (data.type === 0) delete blocks[key]; 
                else blocks[key] = data.type; 
                broadcast(data); 
            }
            else if (data.t === 'swing') {
                // Relay the swing event to all other players (exclude sender)
                broadcast({ t: 'swing', id: id }, ws);
            }
        } catch (e) { console.error(e); }
    });

    ws.on('close', () => {
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

server.listen(PORT, () => console.log(`Server on port ${PORT}`));

// Keep-Alive Ping
const APP_URL = "https://threedmonogameserver.onrender.com"; 
setInterval(() => {
    https.get(APP_URL, (res) => {}).on('error', (e) => {});
}, 600000);
