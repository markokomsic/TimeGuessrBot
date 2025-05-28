const db = require('../config/db');

class Leaderboard {
    static async generate() {
        try {
            const { rows } = await db.query(`
        SELECT
          p.name,
          COUNT(*) AS games_played,
          SUM(s.score) AS total_score,
          ROUND(AVG(s.percentage)::numeric, 1) AS avg_percentage,
          MAX(s.score) AS best_score
        FROM players p
        JOIN scores s ON p.id = s.player_id
        GROUP BY p.id, p.name
        ORDER BY total_score DESC
        LIMIT 10
      `);

            if (rows.length === 0) return 'No scores recorded yet!';

            let message = '🏆 *TimeGuessr Leaderboard* 🏆\n\n';
            rows.forEach((player, idx) => {
                const medal = idx === 0 ? '🥇' :
                    idx === 1 ? '🥈' :
                        idx === 2 ? '🥉' : `${idx + 1}.`;

                message += `${medal} *${player.name}*\n`;
                message += `   🎯 Total: ${player.total_score.toLocaleString()} pts\n`;
                message += `   📊 ${player.avg_percentage}% avg (${player.games_played} games)\n`;
                message += `   🚀 Best: ${player.best_score.toLocaleString()} pts\n\n`;
            });

            return message;
        } catch (error) {
            console.error('Database error in leaderboard:', error);
            return '❌ Error generating leaderboard. Please try again later.';
        }
    }
}

module.exports = Leaderboard;