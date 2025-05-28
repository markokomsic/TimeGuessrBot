const ScoreService = require('../services/scoreService');
const Leaderboard = require('../services/leaderboard');

class MessageHandler {
    static async handle(message) {
        console.log(`📩 Message from ${message.from}: ${message.body.substring(0, 50)}...`);

        try {
            // Handle ping command
            if (message.body === '!ping') {
                console.log('Handling ping command');
                await message.reply('TimeGuessr Bot is working! 🎯');
                return;
            }

            // Handle leaderboard command
            if (message.body === '!leaderboard') {
                console.log('Handling leaderboard command');
                const leaderboard = await Leaderboard.generate();
                await message.reply(leaderboard);
                return;
            }

            // Process scores
            console.log('Checking for score pattern...');
            const result = await ScoreService.processScore(message);
            if (result) {
                console.log('Score processed successfully:', result);
                const { score: savedScore, playerName } = result;
                await message.reply(
                    `✅ Score saved for ${playerName}!\n` +
                    `🎯 Game #${savedScore.game_number}: ${savedScore.score.toLocaleString()} points (${savedScore.percentage}%)`
                );
            } else {
                console.log('No score pattern matched or score already submitted');
            }
        } catch (error) {
            console.error('❌ Error handling message:', error);
        }
    }
}

module.exports = MessageHandler;