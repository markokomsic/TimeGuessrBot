const ScoreService = require('../services/scoreService');
const Leaderboard = require('../services/leaderboard');

class MessageHandler {
    static async handle(message) {
        console.log(`📩 Message from ${message.from}: ${message.body}`);

        try {
            // Handle ping command
            if (message.body === '!ping') {
                await message.reply('TimeGuessr Bot is working! 🎯');
                return;
            }

            // Handle leaderboard command
            if (message.body === '!leaderboard') {
                const leaderboard = await Leaderboard.generate();
                await message.reply(leaderboard);
                return;
            }

            // Process scores
            const result = await ScoreService.processScore(message);
            if (result) {
                const { score, playerName } = result;
                await message.reply(
                    `✅ Score saved for ${playerName}!\n` +
                    `🎯 Game #${score.round_number}: ${score.points.toLocaleString()} points (${score.accuracy}%)`
                );
            }
        } catch (error) {
            console.error('Error handling message:', error);
        }
    }
}

module.exports = MessageHandler;