const ScoreService = require('../services/scoreService');
const Leaderboard = require('../services/leaderboard');
const DailyRanking = require('../services/dailyRanking');
const Player = require('../models/Player');

// Simple in-memory pet counter (resets on restart)
let petCounter = 0;

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

            // Handle leaderboard command (weekly snapshot)
            if (message.body === '!leaderboard') {
                console.log('Handling leaderboard snapshot command');
                const leaderboard = await Leaderboard.generate('weekly-snapshot');
                await message.reply(leaderboard);
                return;
            }

            // Handle all-time leaderboard command
            if (message.body === '!alltime') {
                console.log('Handling all-time leaderboard command');
                const leaderboard = await Leaderboard.generate('alltime');
                await message.reply(leaderboard);
                return;
            }

            // Handle !me command
            if (message.body === '!me') {
                let senderNumber = '';
                let senderName = 'Nepoznat igrač';
                try {
                    const contact = await message.getContact();
                    senderName = contact.pushname || contact.name || 'Nepoznat igrač';

                    if (message.from.endsWith('@g.us')) {
                        // Always use message.participant in groups
                        if (message.participant && message.participant.endsWith('@c.us')) {
                            senderNumber = message.participant.replace('@c.us', '');
                        }
                    } else if (message.from.endsWith('@c.us')) {
                        // Private chat
                        senderNumber = message.from.replace('@c.us', '');
                    }
                } catch (error) {
                    await message.reply('Greška pri dohvaćanju tvojih podataka.');
                    return;
                }

                if (!senderNumber.match(/^\d+$/)) {
                    await message.reply('Nije moguće prepoznati tvoj broj. Pošalji rezultat iz privatnog chata ako si novi igrač.');
                    return;
                }

                // Find player
                const player = await Player.findOrCreate(senderNumber, senderName);
                const stats = await Player.getStats(player.id);

                const statsMsg =
                    `👤 *Tvoje statistike:*

• Ukupno odigranih igara: ${stats.games_played}
• Najbolji rezultat: ${Number(stats.best_score).toLocaleString('hr-HR')}
• Prosječan rezultat: ${Number(stats.avg_score).toLocaleString('hr-HR')}
• Broj dnevnih pobjeda: ${stats.daily_wins}
• Broj tjednih pobjeda: ${stats.weekly_wins}
• All-Time bodovi: ${Number(stats.alltime_points).toLocaleString('hr-HR')}`;

                await message.reply(statsMsg);
                return;
            }

            // Handle pet command
            if (message.body === '!pet') {
                petCounter++;
                const responses = [
                    `🐶 Vau vau! Hvala na maženju! (${petCounter}x)`,
                    `🐾 Bot maše repom od sreće! (${petCounter}x)`,
                    `🦴 Dobar bot! Još maženja? (${petCounter}x)`,
                    `😄 Bot je sretan! (${petCounter}x)`
                ];
                // Pick a random response
                const response = responses[Math.floor(Math.random() * responses.length)];
                await message.reply(response);
                return;
            }

            // Handle points explanation command
            if (message.body === '!bodovi') {
                const pointsMessage =
                    `📋 *Objašnjenje bodovanja TimeGuessr*

*Dnevni bodovi* (služe za tjedni poredak):
  🥇 10, 🥈 8, 🥉 7, 4., 6, 5., 5, 6., 4, 7., 3, 8., 2, 9., 1

*Weekly bodovi* (dodjeljuju se prema tjednom poretku, ne zbrajaju se dnevni bodovi!):
  1. mjesto: 250
  2. mjesto: 180
  3. mjesto: 150
  4. mjesto: 120
  5. mjesto: 100
  6. mjesto: 80
  7. mjesto: 60
  8. mjesto: 40
  9. mjesto: 20
  10. mjesto: 10

*Weekly bonusi:*
  +50 bodova za najviše dnevnih pobjeda u tjednu
  +30 bodova za najveći dnevni rezultat u tjednu

*All-Time ljestvica:*
  Zbroj svih osvojenih weekly bodova (uključujući bonuse) kroz sve tjedne.
  Što više tjednih pobjeda i bonusa, to bolji plasman na all-time ljestvici!`;
                await message.reply(pointsMessage);
                return;
            }

            // Handle help command
            if (message.body === '!help') {
                console.log('Handling help command');
                const helpMessage = `🎯 *TimeGuessr Bot Naredbe* 🎯\n\n` +
                    `📊 *Ljestvice:*\n` +
                    `• \`!d\` - Dnevna ljestvica\n` +
                    `• \`!w\` - Tjedna ljestvica (uživo)\n` +
                    `• \`!leaderboard\` - Tjedna snimka\n` +
                    `• \`!alltime\` - All-Time ljestvica\n\n` +
                    `• \`!me\` - Tvoje osobne statistike\n\n` +
                    `🔧 *Ostalo:*\n` +
                    `• \`!ping\` - Provjeri je li bot aktivan\n` +
                    `• \`!pet\` - Pomazi bota 🐶\n` +
                    `• \`!bodovi\` - Objašnjenje bodovanja\n` +
                    `• \`!help\` - Prikaži ovu poruku\n\n` +
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