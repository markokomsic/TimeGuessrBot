const Player = require('../models/Player');
const Score = require('../models/Score');
const db = require('../config/db');

class ScoreService {
    static async getTodaysGameNumber() {
        const { rows } = await db.query(`
            SELECT MAX(game_number) AS game_number
            FROM scores
            WHERE DATE(created_at) = CURRENT_DATE
        `);
        return rows[0]?.game_number ? parseInt(rows[0].game_number, 10) : null;
    }



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
            senderNumber = contact.number;
            senderName = contact.pushname || contact.name || senderName;
        } catch (error) {
            console.error('Error getting contact:', error);
            await message.reply('Nije moguće prepoznati tvoj broj. Pošalji rezultat iz privatnog chata ako si novi igrač.');
            return null;
        }

        if (!senderNumber || !senderNumber.match(/^\d+$/)) {
            await message.reply('Nije moguće prepoznati tvoj broj. Pošalji rezultat iz privatnog chata ako si novi igrač.');
            return null;
        }

		// Check if the message was sent before 9 AM Sarajevo time
        const now = new Date();
        const currentHour = parseInt(now.toLocaleString('en-US', {
            timeZone: 'Europe/Sarajevo',
            hour: 'numeric',
            hour12: false
        }));

        if (currentHour < 9) {
            const currentMinute = parseInt(now.toLocaleString('en-US', {
                timeZone: 'Europe/Sarajevo',
                minute: 'numeric'
            }));
            await message.reply(`Nova runda počinje u 9:00 ujutru. Trenutno je ${currentHour}:${currentMinute.toString().padStart(2, '0')} . Pokušaj ponovo nakon 9:00!`);
            return null;
        }
        
        // Validate game number
        const todaysGameNumber = await this.getTodaysGameNumber();
        if (todaysGameNumber && scoreData.gameNumber !== todaysGameNumber) {
            await message.reply(
                `Možeš poslati rezultat samo za današnji krug (#${todaysGameNumber}).`
            );
            return null;
        }

        try {
            const hasSubmitted = await Score.hasSubmittedToday(
                senderNumber,
                scoreData.gameNumber
            );
            if (hasSubmitted) {
                await message.reply('Već si poslao rezultat za danas, ohladi malo!');
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
        return (
            text.includes('TimeGuessr #') &&
            text.includes('🌎') &&
            text.includes('📅') &&
            text.includes('timeguessr.com')
        );
    }

    static parseTimeGuessrScore(text) {
        try {
            const lines = text.trim().split('\n');
            
            const headerMatch = lines[0].match(/TimeGuessr #(\d+)\s+([\d,.]+)\/([\d,.]+)/);
            if (!headerMatch) return null;

            const gameNumber = parseInt(headerMatch[1], 10);
           
            const score = parseInt(headerMatch[2].replace(/[,.]/g, ''), 10);
            const maxScore = parseInt(headerMatch[3].replace(/[,.]/g, ''), 10);
            const percentage = parseFloat(((score / maxScore) * 100).toFixed(1));

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

            return { gameNumber, score, maxScore, percentage, rounds };
        } catch (error) {
            console.error('Error parsing score:', error);
            return null;
        }
    }
}

module.exports = ScoreService;