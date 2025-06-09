const db = require('../config/db');
class WeeklyPoints {
    static async calculateForWeek(startDate) {
        // Get all daily rankings for the week
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 7);
        const { rows } = await db.query(`
            SELECT 
                dr.player_id,
                SUM(dr.points_awarded) AS total_points,
                COUNT(dr.id) FILTER (WHERE dr.rank = 1) AS daily_wins,
                MAX(s.score) AS highest_score,
                AVG(s.score) AS average_score
            FROM daily_rankings dr
            JOIN scores s ON dr.game_number = s.game_number AND dr.player_id = s.player_id
            WHERE dr.created_at BETWEEN $1 AND $2
            GROUP BY dr.player_id
        `, [startDate, endDate]);

        if (rows.length === 0) return [];

        // Convert to numbers to ensure proper comparison
        const processedRows = rows.map(row => ({
            ...row,
            player_id: parseInt(row.player_id),
            daily_wins: parseInt(row.daily_wins) || 0,
            highest_score: parseInt(row.highest_score) || 0,
            total_points: parseInt(row.total_points) || 0,
            average_score: parseFloat(row.average_score) || 0
        }));

        // Find bonus recipients with tie-breaking
        const mostWins = Math.max(...processedRows.map(r => r.daily_wins));
        const highestScore = Math.max(...processedRows.map(r => r.highest_score));

        // Get candidates for most wins (with tie-breaking)
        const mostWinsCandidates = processedRows.filter(r => r.daily_wins === mostWins);
        mostWinsCandidates.sort((a, b) =>
            b.average_score - a.average_score ||
            b.highest_score - a.highest_score ||
            b.total_points - a.total_points
        );
        const mostWinsWinner = mostWinsCandidates[0]?.player_id;

        // Get candidates for highest score (with tie-breaking)
        const highScoreCandidates = processedRows.filter(r => r.highest_score === highestScore);
        highScoreCandidates.sort((a, b) =>
            b.average_score - a.average_score ||
            b.daily_wins - a.daily_wins ||
            b.total_points - a.total_points
        );
        const highScoreWinner = highScoreCandidates[0]?.player_id;

        // Update weekly points
        for (const player of processedRows) {
            let bonus = 0;

            if (player.player_id === mostWinsWinner) {
                bonus += 50;
            }
            if (player.player_id === highScoreWinner) {
                bonus += 30;
            }

            await db.query(`
                INSERT INTO weekly_points 
                    (week_start, player_id, total_points, daily_wins, highest_score, bonus_points)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (week_start, player_id) DO UPDATE
                SET total_points = EXCLUDED.total_points,
                    daily_wins = EXCLUDED.daily_wins,
                    highest_score = EXCLUDED.highest_score,
                    bonus_points = EXCLUDED.bonus_points
            `, [startDate, player.player_id, player.total_points,
                player.daily_wins, player.highest_score, bonus]);
        }
        return processedRows;
    }
}
module.exports = WeeklyPoints;