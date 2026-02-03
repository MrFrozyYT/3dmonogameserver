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

    // FIX 1: Send 'id' instead of 'init' to match C# client
    ws.send(JSON.stringify({
        t: 'id', 
        id: id,
        blocks: blocks, // Send current world blocks to new player
        players: players
    }));

    // Default state
    players[id] = { x: 0, y: 10, z: 0, yaw: 0, pitch: 0, anim: 0, name: "Player" + id, crouching: false };
    
    // Notify others
    broadcast({ t: 'move', id: id, x: 0, y: 10, z: 0, name: players[id].name });

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
                    // FIX 2: Handle Crouching
                    if (data.crouching !== undefined) players[id].crouching = data.crouching;
                    if (data.name) players[id].name = data.name;
                    if (data.held !== undefined) players[id].held = data.held;

                    // FIX 3: Broadcast 'move' instead of 'update' to match C# client
                    broadcast({ t: 'move', id: id, ...players[id] }, ws);
                }
            }
            else if (data.t === 'block') {
                const key = `${data.x},${data.y},${data.z}`;
                if (data.type === 0) delete blocks[key]; 
                else blocks[key] = data.type; 
                broadcast(data); 
            }
            else if (data.t === 'swing') {
                broadcast({ t: 'swing', id: id }, ws);
            }
            else if (data.t === 'chat') {
                console.log(`Chat: ${data.msg}`);
                broadcast({ t: 'chat', id: id, name: players[id].name, msg: data.msg });
            }
        } catch (e) { console.error(e); }
    });

    ws.on('close', () => {
        delete players[id];
        // FIX 4: Broadcast 'left' instead of 'leave'
        broadcast({ t: 'left', id: id });
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

const APP_URL = "https://threedmonogameserver.onrender.com"; 
setInterval(() => {
    https.get(APP_URL, (res) => {}).on('error', (e) => {});
}, 600000);
