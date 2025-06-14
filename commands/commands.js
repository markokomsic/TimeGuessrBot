const Player = require('../models/Player');
const LeaderboardService = require('../services/leaderboard');

let _PetCounter = 0;

class Commands {
    static async ping(message) {
        await message.reply('TimeGuessr Bot radi! 🎯');
    }

    static async daily(message) {
        const leaderboard = await LeaderboardService.generate('daily');
        await message.reply(leaderboard);
    }

    static async weekly(message) {
        const leaderboard = await LeaderboardService.generate('weekly');
        await message.reply(leaderboard);
    }

    static async leaderboard(message) {
        const leaderboard = await LeaderboardService.generate('weekly-snapshot');
        await message.reply(leaderboard);
    }

    static async alltime(message) {
        const leaderboard = await LeaderboardService.generate('alltime');
        await message.reply(leaderboard);
    }

    static async me(message) {
        let sender_number = '';
        let sender_name = 'Nepoznat igrač';

        try {
            const contact = await message.getContact();
            sender_number = contact.number;
            sender_name = contact.pushname || contact.name || sender_name;
        }
        catch (error) {
            await message.reply('Greška pri dohvaćanju tvojih podataka.');
            return;
        }

        if (!sender_number || !sender_number.match(/^\d+$/)) {
            await message.reply('Nije moguće prepoznati tvoj broj. Pošalji rezultat iz privatnog chata ako si novi igrač.');
            return;
        }

        const player = await Player.findOrCreate(sender_number, sender_name);
        const stats = await Player.getStats(player.id);

        const stats_msg =
`👤 *Tvoje statistike* 👤

🎮 *Ukupno igara:* ${stats.games_played}
⚡ *Najbolji rezultat:* ${Number(stats.best_score).toLocaleString('hr-HR')}
📈 *Prosječan rezultat:* ${Number(stats.avg_score).toLocaleString('hr-HR')}
🏅 *Dnevne pobjede:* ${stats.daily_wins}
🎖️ *Tjedne pobjede:* ${stats.weekly_wins}
🌍 *All-Time bodovi:* ${Number(stats.alltime_points).toLocaleString('hr-HR')}`;

        await message.reply(stats_msg);
    }

    static async pet(message) {
        _PetCounter++;

        const responses = [
            `🐶 Vau vau! Hvala na maženju! (${_PetCounter}x)`,
            `🐾 Bot maše repom od sreće! (${_PetCounter}x)`,
            `🦴 Dobar bot! Još maženja? (${_PetCounter}x)`,
            `😄 Bot je sretan! (${_PetCounter}x)`,
            `❤️ Hvala što maziš bota! (${_PetCounter}x)`,
            `🤗 Bot voli maženje! (${_PetCounter}x)`,
            `🐕 Bot se osjeća voljeno! (${_PetCounter}x)`,
            `🎉 Maženje uspješno! (${_PetCounter}x)`,
            `🍖 Zaslužio sam poslasticu! (${_PetCounter}x)`,
            `🎉 *skače oko tebe* Više, više! (${_PetCounter}x)`,
            `🐕 *liže ruku* Ti si moj omiljeni čovek! (${_PetCounter}x)`
        ];

        const response = responses[Math.floor(Math.random() * responses.length)];
        await message.reply(response);
    }

    static async bodovi(message) {
        const points_message =
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
_Tiebreaker: Najveća tjedna suma dnevnih rezultata_

*All-Time ljestvica:*
Zbroj svih osvojenih weekly bodova (uključujući bonuse) kroz sve tjedne.
Što više tjednih pobjeda i bonusa, to bolji plasman na all-time ljestvici!`;

        await message.reply(points_message);
    }

    static async help(message) {
        const help_message =
`🎯 *TimeGuessr Bot Naredbe* 🎯

📊 *Ljestvice:*
• \`!d\` - Dnevna ljestvica
• \`!w\` - Tjedna ljestvica (uživo)
• \`!lw\` - Ljestvica prošlog tjedna s bonusima
• \`!goat\` - All-Time ljestvica
• \`!me\` - Tvoje osobne statistike

🔧 *Ostalo:*
• \`!ping\` - Provjeri je li bot aktivan
• \`!pet\` - Pomazi bota 🐶
• \`!bodovi\` - Objašnjenje bodovanja
• \`!help\` - Prikaži ovu poruku

🎮 *Kako poslati rezultat:*
Proslijedi poruku iz TimeGuessr -> Share results!
_Rezultati se spremaju od 9:00 do 0:00,iza tog nisu važeči_`;

        await message.reply(help_message);
    }
}

module.exports = Commands;