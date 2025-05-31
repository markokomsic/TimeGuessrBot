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
    client.on('ready', async () => {
        console.log('🚀 Client is ready!');

        // ─── BEGIN ONCE-OFF MIGRATION SNIPPET ───
        try {
            // Replace this with your actual group JID
            const GROUP_JID = '120363402300964823@g.us';

            // Fetch the GroupChat object
            const chat = await client.getChatById(GROUP_JID);

            if (!chat.isGroup) {
                console.warn(`⚠️  Warning: ${GROUP_JID} was not a group chat.`);
            } else {
                console.log(`\n📋 Group Name: "${chat.name}" (ID: ${GROUP_JID})`);
                console.log(`👥 Total Participants: ${chat.participants.length}\n`);

                // Iterate through each participant and log their id.user
                chat.participants.forEach((gp, idx) => {
                    console.log(`${String(idx + 1).padStart(2, '0')}. ${gp.id.user}`);
                });
                console.log('\n✅ Finished printing all participant IDs.\n');
            }
        } catch (err) {
            console.error('❌ Error fetching group participants:', err);
        }
        // ─── END ONCE-OFF MIGRATION SNIPPET ───
    });

    // Message handling
    const MessageHandler = require('./handlers/messageHandler');
    client.on('message_create', async message => {
        if (message.from.endsWith('@g.us')) {
            try {
                const chat = await message.getChat();
                if (chat.isGroup) {
                    console.log(`📢 Poruka iz grupe: "${chat.name}" (ID: ${chat.id._serialized})`);
                }
            } catch (err) {
                console.error('Greška pri dohvaćanju imena grupe:', err);
            }
        }
        // Continue handling all messages as before
        MessageHandler.handle(message).catch(console.error);
    });

    // Start the bot
    client.initialize();

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
