const { Client, RemoteAuth } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const mongoose = require('mongoose');
const qrcode = require('qrcode-terminal');
require('dotenv').config();

// Database setup
require('./config/db');
// After all other imports
require('./schedules/weeklyJob');

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
        qrcode.generate(qr, { small: true });
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
}).catch(err => {
    console.error('❌ MongoDB connection error:', err);
});
