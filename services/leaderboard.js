const db = require('../config/db');

class Leaderboard {
    static async generate(type = 'weekly') {
        try {
            let query, title;

            switch (type) {
                case 'daily':
                    // Get today's game number (you'll need to implement this)
                    const gameNumber = await this.getTodaysGameNumber();
                    title = '🏆 Daily Leaderboard 🏆';
                    query = `
            SELECT p.name, dr.rank, dr.points_awarded AS points
            FROM daily_rankings dr
            JOIN players p ON dr.player_id = p.id
            WHERE dr.game_number = $1
            ORDER BY dr.rank
            LIMIT 10
          `;
                    return this.formatResults(await db.query(query, [gameNumber]), title);

                case 'weekly':
                    // Get current week start (Monday)
                    const weekStart = this.getCurrentWeekStart();
                    title = '🏆 Weekly Leaderboard 🏆';
                    query = `
            SELECT 
              p.name,
              wp.total_points + wp.bonus_points AS total,
              wp.total_points AS base_points,
              wp.bonus_points,
              wp.daily_wins,
              wp.highest_score
            FROM weekly_points wp
            JOIN players p ON wp.player_id = p.id
            WHERE wp.week_start = $1
            ORDER BY total DESC
            LIMIT 10
          `;
                    return this.formatResults(await db.query(query, [weekStart]), title);

                default:
                    return 'Invalid leaderboard type';
            }
        } catch (error) {
            console.error('Leaderboard error:', error);
            return '❌ Error generating leaderboard';
        }
    }

    static formatResults({ rows }, title) {
        if (rows.length === 0) return `${title}\n\nNo data available`;

        let message = `${title}\n\n`;
        rows.forEach((player, idx) => {
            const medal = idx < 3 ? ['🥇', '🥈', '🥉'][idx] : `${idx + 1}.`;

            message += `${medal} *${player.name}*\n`;
            message += `   📊 Points: ${player.total || player.points}\n`;

            if (player.base_points !== undefined) {
                message += `   ⚡ Base: ${player.base_points} | ✨ Bonus: ${player.bonus_points}\n`;
                message += `   🏅 Wins: ${player.daily_wins} | 🚀 High Score: ${player.highest_score}\n`;
            }

            message += '\n';
        });

        return message;
    }

    // Helper functions
    static getCurrentWeekStart() {
        const now = new Date();
        const day = now.getDay(); // 0 = Sunday, 1 = Monday, ...
        const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
        return new Date(now.setDate(diff)).toISOString().split('T')[0];
    }

    static async getTodaysGameNumber() {
        // Implement based on your game schedule
        // This might query the most recent game number
        const { rows } = await db.query(`
      SELECT game_number 
      FROM scores 
      WHERE DATE(created_at) = CURRENT_DATE 
      LIMIT 1
    `);
        return rows[0]?.game_number;
    }
}

module.exports = Leaderboard;