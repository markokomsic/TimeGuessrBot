const ScoreService = require('../services/scoreService');
const DailyRanking = require('../services/dailyRanking');
const Commands = require('../commands/commands');

class MessageHandler {
    static async handle(message) {
        console.log(`📩 Message from ${message.author}: ${message.body.substring(0, 50)}...`);

        try {
            const command = message.body.toLowerCase();

            switch (command) {
                case '!ping':
                    await Commands.ping(message);
                    return;

                case '!d':
                    await Commands.daily(message);
                    return;

                case '!w':
                    await Commands.weekly(message);
                    return;

                case '!leaderboard':
                    await Commands.leaderboard(message);
                    return;

                case '!alltime':
                    await Commands.alltime(message);
                    return;

                case '!me':
                    await Commands.me(message);
                    return;

                case '!pet':
                    await Commands.pet(message);
                    return;

                case '!bodovi':
                    await Commands.bodovi(message);
                    return;

                case '!help':
                    await Commands.help(message);
                    return;

                default:
                    // Process scores for non-command messages
                    await MessageHandler.processScore(message);
                    break;
            }
        } catch (error) {
            console.error('❌ Error handling message:', error);
        }
    }

    static async processScore(message) {
        const result = await ScoreService.processScore(message);

        if (result) {
            const { score: savedScore } = result;

            try {
                await DailyRanking.calculateForGame(savedScore.game_number);

                try {
                    const rankings = await DailyRanking.getRankingsForGame(savedScore.game_number);
                    const playerRank = rankings.find(r => r.player_id === savedScore.player_id);

                    if (playerRank) {
                        const getRankEmoji = (rank) => {
                            switch (rank) {
                                case 1: return '🥇';
                                case 2: return '🥈';
                                case 3: return '🥉';
                                case 4: return '4️⃣';
                                case 5: return '5️⃣';
                                case 6: return '6️⃣';
                                case 7: return '7️⃣';
                                case 8: return '8️⃣';
                                case 9: return '9️⃣';
                                case 10: return '🔟';
                                default: return `${rank}️⃣`;
                            }
                        };

                        const emoji = getRankEmoji(playerRank.rank);

                        await message.reply(
                            `Rezultat spremljen! ${emoji} ste danas!\n` +
                            `⭐ Zaradili ste ${playerRank.points_awarded} ligaških bodova!`
                        );
                    }
                } catch (rankFetchError) {
                    console.error('❌ Error fetching daily rankings:', rankFetchError);
                }
            } catch (rankingError) {
                console.error('❌ Error updating daily rankings:', rankingError);
            }
        }
    }
}

module.exports = MessageHandler;