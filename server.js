const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const os = require('os');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI;

if (MONGODB_URI) {
    mongoose.connect(MONGODB_URI)
        .then(() => console.log('Connected to MongoDB Atlas'))
        .catch(err => console.error('MongoDB connection error:', err));
} else {
    console.warn('MONGODB_URI is not defined. Data will not be persisted to cloud.');
}

// Define Schema
const DashboardSchema = new mongoose.Schema({
    tasks: Array,
    folders: Array,
    members: Array,
    currentFolder: String
}, { timestamps: true });

const Dashboard = mongoose.model('Dashboard', DashboardSchema);

const multer = require('multer');

// Configure Multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Prevent file name collision
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Serve uploaded files

// File Upload Route
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    // Return the accessible URL of the uploaded file
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({
        url: fileUrl,
        filename: req.file.originalname,
        savedName: req.file.filename,
        size: req.file.size
    });
});

// API Routes
app.get('/api/data', async (req, res) => {
    try {
        if (MONGODB_URI) {
            const dashboardData = await Dashboard.findOne().sort({ updatedAt: -1 });
            if (dashboardData) {
                return res.json(dashboardData);
            }
        }

        // Fallback to local file if no DB data
        fs.readFile(DATA_FILE, 'utf8', (err, data) => {
            if (err) return res.status(500).json({ error: 'Failed to read data' });
            res.json(JSON.parse(data));
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/save', async (req, res) => {
    try {
        const newData = req.body;

        if (MONGODB_URI) {
            // Update the existing document or create a new one
            await Dashboard.findOneAndUpdate({}, newData, { upsert: true, new: true });
        }

        // Still write to local file as backup (optional)
        fs.writeFile(DATA_FILE, JSON.stringify(newData, null, 2), (err) => {
            if (err) console.error("Local save failed:", err);
        });

        res.json({ message: 'Data saved successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save data' });
    }
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
