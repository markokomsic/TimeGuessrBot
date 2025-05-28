const Player = require('../models/Player');
const Score = require('../models/Score');

class ScoreService {
    static async processScore(message) {
        const groupName = "Izgubljeni u vremenu i prostoru";
        if (message.from !== groupName) return null;

        const text = message.body;
        const scoreMatch = text.match(/TimeGuessr #(\d+) (\d+)\/(\d+)/);
        if (!scoreMatch) return null;

        const roundNumber = parseInt(scoreMatch[1]);
        const points = parseInt(scoreMatch[2].replace(/,/g, ''));
        const maxPoints = parseInt(scoreMatch[3].replace(/,/g, ''));
        const accuracy = Math.round((points / maxPoints) * 100);

        const contact = await message.getContact();
        const player = await Player.findOrCreate(message.author, contact.name || message.author);

        const hasSubmitted = await Score.hasSubmittedToday(message.author, roundNumber);
        if (hasSubmitted) {
            message.reply("You've already submitted your score for today!");
            return null;
        }

        return Score.create(player.id, roundNumber, points, accuracy);
    }
}

module.exports = ScoreService;