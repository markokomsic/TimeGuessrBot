const Player = require('../models/Player');
const Score = require('../models/Score');

class ScoreService {
    static async processScore(message) {
        // Skip if not from the target group
     //   if (!message.from.includes('120363402300964823@g.us')) return null;

        const text = message.body;
        const scoreMatch = text.match(/TimeGuessr #(\d+) (\d+)\/(\d+)/);
        if (!scoreMatch) return null;

        const roundNumber = parseInt(scoreMatch[1]);
        const points = parseInt(scoreMatch[2].replace(/,/g, ''));
        const maxPoints = parseInt(scoreMatch[3].replace(/,/g, ''));
        const accuracy = Math.round((points / maxPoints) * 100);

        // Get sender info (use pushname for user's display name)
        const sender = message.author || message.from;
        const contact = await message.getContact();
        const playerName = contact.pushname || contact.number || 'Unknown Player';

        try {
            const hasSubmitted = await Score.hasSubmittedToday(sender, roundNumber);
            if (hasSubmitted) {
                await message.reply(`You've already submitted your score for today!`);
                return null;
            }

            const player = await Player.findOrCreate(sender, playerName);
            const savedScore = await Score.create(player.id, roundNumber, points, accuracy);

            // Return both the score and player name for the reply
            return {
                score: savedScore,
                playerName: playerName
            };
        } catch (error) {
            console.error('Error saving score:', error);
            return null;
        }
    }
}

module.exports = ScoreService;