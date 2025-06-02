const db = require('../config/db');
const DateHelper = require('./dateHelper');

class DailyLeaderboard {
    static async generate() {
        const gameNumber = await this.getTodaysGameNumber();
        if (!gameNumber) return 'Nije pronađena današnja igra!';

        const rankings = await this.getDailyRankings(gameNumber);
        const averages = await this.getDailyAverages(gameNumber);
        const playerStats = await this.getPlayerStats(gameNumber);

        return this.formatResults(rankings, gameNumber, averages, playerStats);
    }

    static async getDailyRankings(gameNumber) {
        const { rows } = await db.query(`
            SELECT 
                p.name,
                dr.rank,
                dr.points_awarded,
                s.score,
                s.percentage
            FROM daily_rankings dr
            JOIN scores s ON dr.game_number = s.game_number AND dr.player_id = s.player_id
            JOIN players p ON dr.player_id = p.id
            WHERE dr.game_number = $1
            ORDER BY dr.rank
            LIMIT 10
        `, [gameNumber]);

        return rows;
    }

    static async getDailyAverages(gameNumber) {
        const { rows } = await db.query(`
            SELECT 
                ROUND(AVG(s.score)) AS avg_score,
                ROUND(AVG(s.percentage)) AS avg_accuracy
            FROM scores s
            WHERE s.game_number = $1
        `, [gameNumber]);

        return rows[0] || { avg_score: 0, avg_accuracy: 0 };
    }

    static async getPlayerStats(gameNumber) {
        const playedResult = await db.query(`
            SELECT COUNT(DISTINCT player_id) AS played_today
            FROM scores
            WHERE game_number = $1
        `, [gameNumber]);

        const totalResult = await db.query(`
            SELECT COUNT(*) AS total_players FROM players
        `);

        return {
            playedToday: playedResult.rows[0]?.played_today || 0,
            totalPlayers: totalResult.rows[0]?.total_players || 0
        };
    }

    static formatResults(rows, gameNumber, averages, playerStats) {
        if (rows.length === 0) {
            return `🏆 Dnevna ljestvica - Igra #${gameNumber}\n\nNema zabilježenih rezultata!`;
        }

        let message = `🏆 *Dnevna ljestvica - Igra #${gameNumber}* 🏆\n`;
        message += `🚴‍ ${playerStats.playedToday}/${playerStats.totalPlayers} igrača je odigralo danas\n`;
        message += `📊 Prosjek: ${averages.avg_score.toLocaleString()} bodova (${averages.avg_accuracy}%)\n\n`;

        rows.forEach((player, idx) => {
            const rankEmoji = this.getRankEmoji(idx);
            message += `${rankEmoji} *${player.name}*\n`;
            message += `   🎯 ${player.score.toLocaleString()} bodova (${player.percentage}%)\n`;
            message += `   ⭐ Bodovi: ${player.points_awarded}\n\n`;
        });

        return message;
    }

    static getRankEmoji(index) {
        return index === 0 ? '🥇' :
            index === 1 ? '🥈' :
                index === 2 ? '🥉' : `${index + 1}.`;
    }

    static async getTodaysGameNumber() {
        const { rows } = await db.query(`
            SELECT MAX(game_number) AS game_number
            FROM scores
            WHERE DATE(created_at) = CURRENT_DATE
        `);
        return rows[0]?.game_number;
    }
}

module.exports = DailyLeaderboard;