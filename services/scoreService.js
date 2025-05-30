const Player = require('../models/Player');
const Score = require('../models/Score');
const db = require('../config/db');

class ScoreService {
    /**
     * Returns the pure phone number of the sender, 
     * whether it’s a 1:1 chat or a group message.
     * Strips off the "@c.us" and ignores the group JID.
     */
    static getSenderNumber(message) {
        const participant = message.participant;
        const from = message.from;

        let jid;
        if (participant && participant.endsWith('@c.us')) {
            jid = participant;
        } else if (from && from.endsWith('@c.us')) {
            jid = from;
        } else {
            return null;
        }

        const number = jid.split('@')[0];
        return number.match(/^\d+$/) ? number : null;
    }

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

        // Extract sender number
        const senderNumber = this.getSenderNumber(message);
        if (!senderNumber) {
            await message.reply(
                'Nije moguće prepoznati tvoj broj. Pošalji rezultat iz privatnog chatu ako si novi igrač.'
            );
            return null;
        }

        // Fetch sender name
        let senderName = 'Unknown Player';
        try {
            const contact = await message.getContact();
            senderName = contact.pushname || contact.name || senderName;
        } catch (err) {
            console.error('Error fetching contact:', err);
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
            const headerMatch = lines[0].match(/TimeGuessr #(\d+)\s+([\d,]+)\/([\d,]+)/);
            if (!headerMatch) return null;

            const gameNumber = parseInt(headerMatch[1], 10);
            const score = parseInt(headerMatch[2].replace(/,/g, ''), 10);
            const maxScore = parseInt(headerMatch[3].replace(/,/g, ''), 10);
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
