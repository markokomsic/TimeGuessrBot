const Player = require('../models/Player');
const Score = require('../models/Score');

class ScoreService {
    static async processScore(message) {
        const text = message.body;
        if (!this.isTimeGuessrMessage(text)) return null;

        const scoreData = this.parseTimeGuessrScore(text);
        if (!scoreData) return null;

        // Get sender info
        let senderNumber = '';
        let senderName = 'Unknown Player';

        try {
            const contact = await message.getContact();
            senderName = contact.pushname || contact.name || 'Unknown Player';

            // Determine sender number based on message context
            if (message.from.endsWith('@g.us')) {
                // Group message - use message.author
                senderNumber = message.author.replace('@c.us', '');
            } else {
                // Private message - use message.from
                senderNumber = message.from.replace('@c.us', '');
            }
        } catch (error) {
            console.error('Error getting contact:', error);
            return null;
        }

        try {
            const hasSubmitted = await Score.hasSubmittedToday(senderNumber, scoreData.gameNumber);
            if (hasSubmitted) {
                await message.reply(`Već si poslao rezultat za danas, ohladi malo!`);
                return null;
            }

            const player = await Player.findOrCreate(senderNumber, senderName);
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
                playerName: senderName
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