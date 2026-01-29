const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname)); // Serve static files (HTML, CSS, JS)

// Ensure data.json exists
if (!fs.existsSync(DATA_FILE)) {
    const initialData = {
        tasks: [],
        folders: ["기본 업무", "연차 신청"],
        members: ["강민구", "김철수", "이영희"],
        currentFolder: "all"
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
}

// API Routes
app.get('/api/data', (req, res) => {
    fs.readFile(DATA_FILE, 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to read data' });
        }
        res.json(JSON.parse(data));
    });
});

app.post('/api/save', (req, res) => {
    const newData = req.body;
    fs.writeFile(DATA_FILE, JSON.stringify(newData, null, 2), (err) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to save data' });
        }
        res.json({ message: 'Data saved successfully' });
    });
});

// Helper to get local IP
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const devName in interfaces) {
        const iface = interfaces[devName];
        for (let i = 0; i < iface.length; i++) {
            const alias = iface[i];
            if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                return alias.address;
            }
        }
    }
    return '0.0.0.0';
}

// Start Server
app.listen(PORT, '0.0.0.0', () => {
    const localIP = getLocalIP();
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Network access: http://${localIP}:${PORT}`);
});
