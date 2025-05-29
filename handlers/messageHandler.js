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
                await message.reply('TimeGuessr Bot radi! 🎯');
                return;
            }

            // Handle daily leaderboard command (!d)
            if (message.body === '!d') {
                console.log('Handling daily leaderboard command');
                const leaderboard = await Leaderboard.generate('daily');
                await message.reply(leaderboard);
                return;
            }

            // Handle weekly real-time leaderboard command (!w)
            if (message.body === '!w') {
                console.log('Handling weekly real-time leaderboard command');
                const leaderboard = await Leaderboard.generate('weekly');
                await message.reply(leaderboard);
                return;
            }

            // Handle leaderboard command (for snapshots - can be used for all-time later)
            if (message.body.startsWith('!leaderboard')) {
                console.log('Handling leaderboard snapshot command');
                // For now, show weekly snapshot. Later you can add all-time here
                const leaderboard = await Leaderboard.generate('weekly-snapshot');
                await message.reply(leaderboard);
                return;
            }

            // Handle help command
            if (message.body === '!help' || message.body === '!pomoć') {
                console.log('Handling help command');
                const helpMessage = `🎯 *TimeGuessr Bot Naredbe* 🎯\n\n` +
                    `📊 *Ljestvice:*\n` +
                    `• \`!d\` - Dnevna ljestvica\n` +
                    `• \`!w\` - Tjedna ljestvica (uživo)\n` +
                    `• \`!leaderboard\` - Tjedna snimka\n\n` +
                    `🔧 *Ostalo:*\n` +
                    `• \`!ping\` - Provjeri je li bot aktivan\n` +
                    `• \`!pomoć\` - Prikaži ovu poruku\n\n` +
                    `🎮 *Kako poslati rezultat:*\n` +
                    `Proslijedi poruku iz TimeGuessr igre koja sadrži tvoj rezultat!`;

                await message.reply(helpMessage);
                return;
            }

            // Process scores
            console.log('Checking for score pattern...');
            const result = await ScoreService.processScore(message);

            if (result) {
                console.log('Score processed successfully:', result);
                const { score: savedScore, playerName } = result;

                // Send confirmation to user (in Croatian)
                await message.reply(
                    `✅ Rezultat spremljen za ${playerName}!\n` +
                    `🎯 Igra #${savedScore.game_number}: ${savedScore.score.toLocaleString()} bodova (${savedScore.percentage}%)`
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

                            const rankText = playerRank.rank === 1 ? 'prvi' :
                                playerRank.rank === 2 ? 'drugi' : 'treći';

                            await message.reply(
                                `${emoji} Čestitamo! ${rankText} ste danas!\n` +
                                `⭐ Zaradili ste ${playerRank.points_awarded} ligaških bodova!`
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