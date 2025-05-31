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
                await message.reply('TimeGuessr Bot radi! 🎯');
                return;
            }

            // Handle daily leaderboard command (!d)
            if (message.body === '!d') {
                const leaderboard = await Leaderboard.generate('daily');
                await message.reply(leaderboard);
                return;
            }

            // Handle weekly real-time leaderboard command (!w)
            if (message.body === '!w') {
                const leaderboard = await Leaderboard.generate('weekly');
                await message.reply(leaderboard);
                return;
            }

            // Handle leaderboard command (weekly snapshot)
            if (message.body === '!leaderboard') {
                const leaderboard = await Leaderboard.generate('weekly-snapshot');
                await message.reply(leaderboard);
                return;
            }

            // Handle all-time leaderboard command
            if (message.body === '!alltime') {
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
                    senderNumber = contact.number;
                    senderName = contact.pushname || contact.name || senderName;
                } catch (error) {
                    await message.reply('Greška pri dohvaćanju tvojih podataka.');
                    return;
                }

                if (!senderNumber || !senderNumber.match(/^\d+$/)) {
                    await message.reply('Nije moguće prepoznati tvoj broj. Pošalji rezultat iz privatnog chata ako si novi igrač.');
                    return;
                }

                const player = await Player.findOrCreate(senderNumber, senderName);
                const stats = await Player.getStats(player.id);

                const statsMsg =
                    `👤 *Tvoje statistike* 👤

🎮 *Ukupno igara:* ${stats.games_played}
🏆 *Najbolji rezultat:* ${Number(stats.best_score).toLocaleString('hr-HR')}
📈 *Prosječan rezultat:* ${Number(stats.avg_score).toLocaleString('hr-HR')}
🏅 *Dnevne pobjede:* ${stats.daily_wins}
🎖️ *Tjedne pobjede:* ${stats.weekly_wins}
🌟 *All-Time bodovi:* ${Number(stats.alltime_points).toLocaleString('hr-HR')}`;

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
                const response = responses[Math.floor(Math.random() * responses.length)];
                await message.reply(response);
                return;
            }

            // Handle points explanation command
            if (message.body === '!bodovi') {
                const pointsMessage =
                    `📋 *Objašnjenje bodovanja TimeGuessr*

*Dnevni bodovi* (služe za tjedni poredak):
 🥇 10 - 8 - 7 - 6 - 5 - 4 - 3 - 2 - 1 - 0

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
  _Tiebreakeri se rješavaju prema najvećoj tjednom sumi dnevnih rezultata._

*All-Time ljestvica:*
  Zbroj svih osvojenih weekly bodova (uključujući bonuse) kroz sve tjedne.
  Što više tjednih pobjeda i bonusa, to bolji plasman na all-time ljestvici!`;
                await message.reply(pointsMessage);
                return;
            }

            // Handle help command
            if (message.body === '!help') {
                const helpMessage = `🎯 *TimeGuessr Bot Naredbe* 🎯

📊 *Ljestvice:*
• \`!d\` - Dnevna ljestvica
• \`!w\` - Tjedna ljestvica (uživo)
• \`!leaderboard\` - Tjedna snimka
• \`!alltime\` - All-Time ljestvica
• \`!me\` - Tvoje osobne statistike

🔧 *Ostalo:*
• \`!ping\` - Provjeri je li bot aktivan
• \`!pet\` - Pomazi bota 🐶
• \`!bodovi\` - Objašnjenje bodovanja
• \`!help\` - Prikaži ovu poruku

🎮 *Kako poslati rezultat:*
Proslijedi poruku iz TimeGuessr igre koja sadrži tvoj rezultat!`;

                await message.reply(helpMessage);
                return;
            }

            // Process scores
            const result = await ScoreService.processScore(message);

            if (result) {
                const { score: savedScore } = result;

                // Update daily rankings
                try {
                    await DailyRanking.calculateForGame(savedScore.game_number);

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
            }
        } catch (error) {
            console.error('❌ Error handling message:', error);
        }
    }
}

module.exports = MessageHandler;