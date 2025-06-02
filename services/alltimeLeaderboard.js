const db = require('../config/db');

class AllTimeLeaderboard {
    static async generate(limit = 10) {
        const players = await this.getAllTimeStats(limit);

        if (players.length === 0) {
            return `🏆 All-Time Leaderboard\n\nNema podataka za all-time ljestvicu.`;
        }

        return this.formatResults(players);
    }

    static async getAllTimeStats(limit) {
        const { rows } = await db.query(`
            SELECT 
                p.name,
                SUM(wa.total_points) AS alltime_points,
                SUM(wa.points_awarded) AS base_points,
                SUM(wa.bonus_points) AS bonus_points,
                MAX(wa.highest_score) AS highest_score
            FROM weekly_awards wa
            JOIN players p ON wa.player_id = p.id
            GROUP BY p.name
            ORDER BY alltime_points DESC
            LIMIT $1
        `, [limit]);

        return rows;
    }

    static formatResults(players) {
        let message = `🏆 *All-Time Leaderboard* 🏆\n\n`;

        players.forEach((player, idx) => {
            const rankEmoji = this.getRankEmoji(idx);
            message += `${rankEmoji} ${player.name}\n`;
            message += `   🎯 Ukupno bodova: ${Number(player.alltime_points).toLocaleString('hr-HR')}\n`;
            message += `   ⚡ Osnovno: ${Number(player.base_points).toLocaleString('hr-HR')} | ✨ Bonus: ${Number(player.bonus_points).toLocaleString('hr-HR')}\n`;
            message += `   ⭐ Najveći rezultat | ${Number(player.highest_score).toLocaleString('hr-HR')}\n\n`;
        });

        return message;
    }

    static getRankEmoji(index) {
        return index === 0 ? '🥇' :
            index === 1 ? '🥈' :
                index === 2 ? '🥉' : `${index + 1}.`;
    }
}

module.exports = AllTimeLeaderboard;