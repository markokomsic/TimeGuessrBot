const ScoreService = require('../services/scoreService');
const Leaderboard = require('../services/leaderboard');

class MessageHandler {
    static async handle(message) {
        console.log(`📩 Message from ${message.from}: ${message.body}`);

        // Process scores
        const score = await ScoreService.processScore(message);
        if (score) {
            console.log(`✅ Score recorded for round ${score.round_number}`);
        }

        // Handle leaderboard command
        if (message.body === '!leaderboard') {
            const leaderboard = await Leaderboard.generate();
            message.reply(leaderboard);
        }
    }
}

module.exports = MessageHandler;