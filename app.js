const express = require('express');
const { Client, RemoteAuth } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const mongoose = require('mongoose');
const qrcode = require('qrcode-terminal');
require('dotenv').config();
require('./config/db');


const app = express();
app.use(express.json()); 

// Cron job endpoint
app.post('/api/cron/weekly-points', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || authHeader !== `Bearer ${process.env.CRON_API_KEY}`) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const WeeklyPoints = require('./services/weeklyPoints');
        const WeeklyAwards = require('./services/weeklyAwards');

        // const { weekStart } = require('./services/dateHelper').getCurrentWeekInfo();
        const weekStart = new Date('2025-06-02T00:00:00.000Z');
        
        
        console.log(`Calculating weekly points for week starting ${weekStart}`);

        await WeeklyPoints.calculateForWeek(weekStart);
        console.log('Weekly points calculation completed');

        await WeeklyAwards.finalizeWeeklyAwards(weekStart);
        console.log('Weekly awards finalized and stored');

        res.json({
            success: true,
            message: 'Weekly points calculation completed',
            weekStart: weekStart
        });
    } catch (error) {
        console.error('Weekly points job failed:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Connect to MongoDB and initialize WhatsApp bot
mongoose.connect(process.env.MONGODB_URI).then(() => {
    console.log('Connected to MongoDB!');

    const store = new MongoStore({ mongoose });
    const client = new Client({
        authStrategy: new RemoteAuth({
            store: store,
            backupSyncIntervalMs: 300000,
        }),
        puppeteer: {
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        }
    });

    client.on('qr', qr => {
        const data = encodeURIComponent(qr);
        const url = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${data}`;
        console.log('Scan me here:', url);
    });

    client.on('remote_session_saved', () => {
        console.log('✅ Session saved to MongoDB!');
    });

    client.on('ready', () => {
        console.log('🚀 WhatsApp client is ready!');
    });

    const MessageHandler = require('./handlers/messageHandler');
    client.on('message_create', async message => {
        if (message.from.endsWith('@g.us')) {
            try {
                const chat = await message.getChat();
                if (chat.isGroup) {
                    console.log(`📢 Message from group: "${chat.name}" (ID: ${chat.id._serialized})`);
                    await MessageHandler.handle(message);
                }
            } catch (err) {
                console.error('Error fetching group name:', err);
            }
        }
    });

    client.initialize();
}).catch(err => {
    console.error('❌ MongoDB connection error:', err);
});


const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`✅ Express server running on port ${PORT}`);
});
