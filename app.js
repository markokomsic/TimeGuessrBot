const { Client, RemoteAuth } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const mongoose = require('mongoose');
const qrcode = require('qrcode-terminal');
require('dotenv').config();
console.log('=== ENVIRONMENT VARIABLES DEBUG ===');
console.log('MONGODB_URI:', process.env.MONGODB_URI);
console.log('DATABASE_URL:', process.env.DATABASE_URL);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('All env vars:', Object.keys(process.env).filter(key => key.includes('MONGO') || key.includes('DATABASE')));
console.log('=====================================');
console.log('Resolved MONGO_URL:', process.env.MONGO_URL);
console.log('Resolved DATABASE_URL:', process.env.DATABASE_URL);

const cron = require('node-cron');

// Database setup
require('./config/db');

// Initialize MongoDB for WhatsApp session
const mongoURI = process.env.MONGO_URL || process.env.MONGODB_URI;
mongoose.connect(mongoURI).then(() => {
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

    // Message handling: Only respond to group messages
    const MessageHandler = require('./handlers/messageHandler');
    client.on('message_create', async message => {
        if (message.from.endsWith('@g.us')) {
            try {
                const chat = await message.getChat();
                if (chat.isGroup) {
                    console.log(`📢 Poruka iz grupe: "${chat.name}" (ID: ${chat.id._serialized})`);
                    await MessageHandler.handle(message);
                }
            } catch (err) {
                console.error('Greška pri dohvaćanju imena grupe:', err);
            }
        }
        // Ignore private messages
    });

    // Start the bot
    client.initialize();

    // Start weekly calculation job
    const WeeklyPoints = require('./services/weeklyPoints');
    const WeeklyAwards = require('./services/weeklyAwards');

    cron.schedule('59 23 * * 0', async () => { // Every Sunday at 23:59
        try {
            const weekStart = WeeklyPoints.getCurrentWeekStart();
            console.log(`Calculating weekly points for week starting ${weekStart}`);
            await WeeklyPoints.calculateForWeek(weekStart);
            console.log('Weekly points calculation completed');

            await WeeklyAwards.finalizeWeeklyAwards(weekStart);
            console.log('Weekly awards finalized and stored');
        } catch (error) {
            console.error('Weekly points job failed:', error);
        }
    });
}).catch(err => {
    console.error('❌ MongoDB connection error:', err);
});