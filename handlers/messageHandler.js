const ScoreService = require('../services/scoreService');
const Leaderboard = require('../services/leaderboard');
const DailyRanking = require('../services/dailyRanking');

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

            // Handle leaderboard commands
            if (message.body.startsWith('!leaderboard')) {
                console.log('Handling leaderboard command');

                // Extract leaderboard type (default to weekly)
                const parts = message.body.split(' ');
                const type = parts.length > 1 ? parts[1] : 'weekly';

                // Validate type
                const validTypes = ['daily', 'weekly'];
                if (!validTypes.includes(type)) {
                    await message.reply(
                        '❌ Invalid leaderboard type. Use:\n' +
                        '• `!leaderboard daily` for daily rankings\n' +
                        '• `!leaderboard weekly` for weekly rankings'
                    );
                    return;
                }

                const leaderboard = await Leaderboard.generate(type);
                await message.reply(leaderboard);
                return;
            }

            // Process scores
            console.log('Checking for score pattern...');
            const result = await ScoreService.processScore(message);
            if (result) {
                console.log('Score processed successfully:', result);
                const { score: savedScore, playerName } = result;

                // Send confirmation to user
                await message.reply(
                    `✅ Score saved for ${playerName}!\n` +
                    `🎯 Game #${savedScore.game_number}: ${savedScore.score.toLocaleString()} points (${savedScore.percentage}%)`
                );

                // Update daily rankings
                try {
                    console.log(`Updating daily rankings for game #${savedScore.game_number}`);
                    await DailyRanking.calculateForGame(savedScore.game_number);
                    console.log('Daily rankings updated successfully');

                    try {
                        // Get updated rankings
                        const rankings = await DailyRanking.getRankingsForGame(savedScore.game_number);
                        const playerRank = rankings.find(r => r.player_id === savedScore.player_id);

                        if (playerRank && playerRank.rank <= 3) {
                            const emoji = playerRank.rank === 1 ? '🥇' :
                                playerRank.rank === 2 ? '🥈' : '🥉';
                            await message.reply(
                                `${emoji} Congratulations! You're #${playerRank.rank} today!\n` +
                                `⭐ You earned ${playerRank.points_awarded} league points!`
                            );
                        }
                    } catch (rankFetchError) {
                        console.error('❌ Error fetching daily rankings:', rankFetchError);
                    }
                } catch (rankingError) {
                    console.error('❌ Error updating daily rankings:', rankingError);
                }
            } else {
                console.log('No score pattern matched or score already submitted');
            }
        } catch (error) {
            console.error('❌ Error handling message:', error);
        }
    }
}

module.exports = MessageHandler;