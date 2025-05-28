const { Client, RemoteAuth } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const mongoose = require('mongoose');
const qrcode = require('qrcode-terminal');
require('dotenv').config();
const cron = require('node-cron');

// Database setup
require('./config/db');

// Initialize MongoDB for WhatsApp session
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

    // QR Code generation
    client.on('qr', qr => {
        const data = encodeURIComponent(qr);
        const url = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${data}`;
        console.log('Scan me here:', url);
    });

    // Session saved confirmation
    client.on('remote_session_saved', () => {
        console.log('✅ Session saved to MongoDB!');
    });

    // Bot is ready
    client.on('ready', () => {
        console.log('🚀 Client is ready!');
    });

    // Message handling
    const MessageHandler = require('./handlers/messageHandler');
    client.on('message_create', message => {
        MessageHandler.handle(message).catch(console.error);
    });

    // Start the bot
    client.initialize();


    // Start weekly calculation job
    const WeeklyPoints = require('./services/weeklyPoints');
    cron.schedule('59 23 * * 0', async () => { // Every Sunday at 23:59
        try {
            const weekStart = WeeklyPoints.getCurrentWeekStart();
            console.log(`Calculating weekly points for week starting ${weekStart}`);
            await WeeklyPoints.calculateForWeek(weekStart);
            console.log('Weekly points calculation completed');
        } catch (error) {
            console.error('Weekly points job failed:', error);
        }
    });
}).catch(err => {
    console.error('❌ MongoDB connection error:', err);
});
