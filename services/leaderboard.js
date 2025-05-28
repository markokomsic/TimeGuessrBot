const db = require('../config/db');

class Leaderboard {
    static async generate(type = 'weekly') {
        try {
            switch (type) {
                case 'daily':
                    return await this.generateDaily();
                case 'weekly':
                    return await this.generateWeekly();
                default:
                    return 'Invalid leaderboard type';
            }
        } catch (error) {
            console.error('Leaderboard error:', error);
            return '❌ Error generating leaderboard';
        }
    }

    static async generateDaily() {
        const gameNumber = await this.getTodaysGameNumber();
        if (!gameNumber) return 'No daily game found!';

        // Get daily rankings
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

        // Get daily averages
        const avgResult = await db.query(`
            SELECT 
                ROUND(AVG(s.score)) AS avg_score,
                ROUND(AVG(s.percentage)) AS avg_accuracy
            FROM scores s
            WHERE s.game_number = $1
        `, [gameNumber]);

        const averages = avgResult.rows[0];

        // Format results
        return this.formatDailyResults(rows, gameNumber, averages);
    }

    static async generateWeekly() {
        const weekStart = this.getCurrentWeekStart();
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const weekRange = `${new Date(weekStart).toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`;

        // Get weekly rankings
        const { rows } = await db.query(`
            SELECT 
                p.name,
                wp.total_points + wp.bonus_points AS total,
                wp.total_points AS base_points,
                wp.bonus_points,
                wp.daily_wins,
                wp.highest_score,
                (SELECT SUM(score) FROM scores s 
                 WHERE s.player_id = p.id 
                   AND s.created_at BETWEEN $1 AND $1 + interval '6 days'
                ) AS total_daily_scores
            FROM weekly_points wp
            JOIN players p ON wp.player_id = p.id
            WHERE wp.week_start = $1
            ORDER BY total DESC
            LIMIT 10
        `, [weekStart]);

        // Format results
        return this.formatWeeklyResults(rows, weekRange);
    }

    static formatDailyResults(rows, gameNumber, averages) {
        if (rows.length === 0) return `🏆 Daily Leaderboard - Game #${gameNumber}\n\nNo scores recorded!`;

        let message = `🏆 *Daily Leaderboard - Game #${gameNumber}* 🏆\n`;
        message += `📊 Average: ${averages.avg_score.toLocaleString()} pts (${averages.avg_accuracy}%)\n\n`;

        rows.forEach((player, idx) => {
            const rankEmoji = idx === 0 ? '🥇' :
                idx === 1 ? '🥈' :
                    idx === 2 ? '🥉' : `${idx + 1}.`;

            message += `${rankEmoji} *${player.name}*\n`;
            message += `   🎯 ${player.score.toLocaleString()} pts (${player.percentage}%)\n`;
            message += `   ⭐ Points: ${player.points_awarded}\n\n`;
        });

        return message;
    }

    static formatWeeklyResults(rows, weekRange) {
        if (rows.length === 0) return `🏆 Weekly Leaderboard (${weekRange})\n\nNo weekly data available`;

        let message = `🏆 *Weekly Leaderboard (${weekRange})* 🏆\n\n`;

        rows.forEach((player, idx) => {
            const rankEmoji = idx === 0 ? '🥇' :
                idx === 1 ? '🥈' :
                    idx === 2 ? '🥉' : `${idx + 1}.`;

            message += `${rankEmoji} *${player.name}*\n`;
            message += `   🎯 Total Points: ${player.total}\n`;
            message += `   📊 Daily Scores: ${player.total_daily_scores.toLocaleString()} pts\n`;
            message += `   ⚡ Base: ${player.base_points} | ✨ Bonus: ${player.bonus_points}\n`;

            // Show bonus details
            if (player.bonus_points > 0) {
                message += `   🎖️ Bonuses: `;
                const bonuses = [];
                if (player.bonus_points >= 50) bonuses.push(`Most wins (${player.daily_wins}x)`);
                if (player.bonus_points >= 30) bonuses.push(`High score (${player.highest_score.toLocaleString()} pts)`);
                message += bonuses.join(' + ') + '\n';
            }

            message += '\n';
        });

        return message;
    }

    // Helper functions
    static getCurrentWeekStart() {
        const now = new Date();
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(now.setDate(diff)).toISOString().split('T')[0];
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

module.exports = Leaderboard;