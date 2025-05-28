const Player = require('../models/Player');
const Score = require('../models/Score');

class ScoreService {
    static async processScore(message) {
        const text = message.body;
        if (!this.isTimeGuessrMessage(text)) return null;

        const scoreData = this.parseTimeGuessrScore(text);
        if (!scoreData) return null;

        // Get sender info
        const sender = message.from.includes('@c.us') ? message.from : message.author;
        const contact = await message.getContact();
        const playerName = contact.pushname || contact.name || contact.number || 'Unknown Player';

        try {
            const hasSubmitted = await Score.hasSubmittedToday(sender, scoreData.gameNumber);
            if (hasSubmitted) {
                await message.reply(`You've already submitted your score for today!`);
                return null;
            }

            const player = await Player.findOrCreate(sender, playerName);
            const savedScore = await Score.create({
                playerId: player.id,
                gameNumber: scoreData.gameNumber,
                score: scoreData.score,
                maxScore: scoreData.maxScore,
                percentage: scoreData.percentage,
                roundsData: scoreData.rounds,
                rawMessage: text
            });

            return {
                score: savedScore,
                playerName
            };
        } catch (error) {
            console.error('Error saving score:', error);
            return null;
        }
    }

    static isTimeGuessrMessage(text) {
        return text.includes('TimeGuessr #') &&
            text.includes('🌎') &&
            text.includes('📅') &&
            text.includes('timeguessr.com');
    }

    static parseTimeGuessrScore(text) {
        try {
            const lines = text.trim().split('\n');
            const headerMatch = lines[0].match(/TimeGuessr #(\d+)\s+([\d,]+)\/([\d,]+)/);
            if (!headerMatch) return null;

            const gameNumber = parseInt(headerMatch[1], 10);
            const score = parseInt(headerMatch[2].replace(/,/g, ''), 10);
            const maxScore = parseInt(headerMatch[3].replace(/,/g, ''), 10);
            const percentage = parseFloat(((score / maxScore) * 100).toFixed(1));

            // Parse rounds data
            const rounds = [];
            for (let i = 1; i <= 5; i++) {
                if (lines[i]) {
                    const geoMatch = lines[i].match(/🌎([🟩🟨⬛]+)/);
                    const dateMatch = lines[i].match(/📅([🟩🟨⬛]+)/);
                    rounds.push({
                        round: i,
                        geography: geoMatch ? geoMatch[1] : '',
                        date: dateMatch ? dateMatch[1] : ''
                    });
                }
            }

            return {
                gameNumber,
                score,
                maxScore,
                percentage,
                rounds,
                rawMessage: text
            };
        } catch (error) {
            console.error('Error parsing score:', error);
            return null;
        }
    }
}

module.exports = ScoreService;