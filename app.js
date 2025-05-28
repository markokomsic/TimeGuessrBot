const { Client, RemoteAuth } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const mongoose = require('mongoose');
const qrcode = require('qrcode-terminal');

// Load MongoDB URI from Railway environment variable
const MONGODB_URI = process.env.MONGODB_URI;

// Connect to MongoDB
mongoose.connect(MONGODB_URI).then(() => {
    console.log('Connected to MongoDB!');

    // Initialize MongoDB session store
    const store = new MongoStore({ mongoose });

    // Create WhatsApp client
    const client = new Client({
        authStrategy: new RemoteAuth({
            store: store,
            backupSyncIntervalMs: 300000, // 5 min backups
        }),
        puppeteer: {
            args: ['--no-sandbox', '--disable-setuid-sandbox'], // Required for Railway
        }
    });

    client.on('qr', qr => {
  const data = encodeURIComponent(qr);
  const url  = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${data}`;
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

    // Reply to !ping
    client.on('message_create', message => {
        if (message.body === '!ping') {
            message.reply('pong');
        }
    });

    // Start the bot
    client.initialize();
}).catch(err => {
    console.error('❌ MongoDB connection error:', err);
});
