const Player = require('../models/Player');
const Score = require('../models/Score');
const db = require('../config/db');

class ScoreService {
    static async getGameNumberForDate(dateString) {
        const { rows } = await db.query(
            `SELECT MAX(game_number) AS game_number FROM scores WHERE DATE(created_at) = $1`,
            [dateString]
        );
        return rows[0]?.game_number ? parseInt(rows[0].game_number, 10) : null;
    }

    static async processScore(message) {
        const text = message.body;
        if (!this.isTimeGuessrMessage(text)) return null;
        const scoreData = this.parseTimeGuessrScore(text);
        if (!scoreData) return null;

        let senderNumber = '';
        let senderName = 'Unknown Player';
        try {
            const contact = await message.getContact();
            senderNumber = contact.number;
            senderName = contact.pushname || contact.name || senderName;
        } catch {
            await message.reply('Nije moguće prepoznati tvoj broj. Pošalji rezultat iz privatnog chata ako si novi igrač.');
            return null;
        }
        if (!senderNumber || !/^\d+$/.test(senderNumber)) {
            await message.reply('Nije moguće prepoznati tvoj broj. Pošalji rezultat iz privatnog chata ako si novi igrač.');
            return null;
        }

        const now = new Date();
        const fmt = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Europe/Sarajevo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: 'numeric',
            hour12: false
        });
        const parts = fmt.formatToParts(now);
        let year, month, day, hour;
        for (const p of parts) {
            if (p.type === 'year') year = parseInt(p.value, 10);
            if (p.type === 'month') month = parseInt(p.value, 10);
            if (p.type === 'day') day = parseInt(p.value, 10);
            if (p.type === 'hour') hour = parseInt(p.value, 10);
        }
        const sarajevoDate = new Date(Date.UTC(year, month - 1, day));
        let refDateObj = new Date(sarajevoDate);
        if (hour < 9) {
            refDateObj.setUTCDate(refDateObj.getUTCDate() - 1);
        }
        const yyyy = refDateObj.getUTCFullYear();
        const mm = String(refDateObj.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(refDateObj.getUTCDate()).padStart(2, '0');
        const referenceDateString = `${yyyy}-${mm}-${dd}`;

        const gameNumberForDate = await this.getGameNumberForDate(referenceDateString);
        if (!gameNumberForDate) {
            await message.reply(`Još nije postavljen krug za datum ${referenceDateString}. Pokušaj kasnije.`);
            return null;
        }
        if (scoreData.gameNumber !== gameNumberForDate) {
            await message.reply(`Možeš poslati rezultat samo za krug #${gameNumberForDate} (datum: ${referenceDateString}).`);
            return null;
        }

        const { rows } = await db.query(
            `SELECT 1 FROM scores s JOIN players p ON s.player_id = p.id
             WHERE p.phone = $1 AND s.game_number = $2 AND DATE(s.created_at) = $3 LIMIT 1`,
            [senderNumber, scoreData.gameNumber, referenceDateString]
        );
        if (rows.length) {
            await message.reply('Već si poslao rezultat za ovaj krug, ohladi malo!');
            return null;
        }

        try {
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
            return { score: savedScore, playerName: senderName };
        } catch (error) {
            console.error('Error saving score:', error);
            return null;
        }
    }

    static isTimeGuessrMessage(text) {
        return text.includes('TimeGuessr #') && text.includes('🌎') && text.includes('📅') && text.includes('timeguessr.com');
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
        } catch {
            return null;
        }
    }
}

module.exports = ScoreService;
