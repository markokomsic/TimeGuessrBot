const db = require('../config/db'); const WEEKLY_POINTS = [250, 180, 150, 120, 100, 80, 60, 40, 20, 10];
async function finalizeWeeklyAwards(weekStart) {
    const { rows } = await db.query(`
    SELECT player_id, total_points, bonus_points, highest_score
    FROM weekly_points
    WHERE week_start = $1
    ORDER BY total_points DESC
    LIMIT 10
`, [weekStart]);

    for (let i = 0; i < rows.length; i++) {
        const player = rows[i];
        const points_awarded = WEEKLY_POINTS[i] || 0;
        const total_points = points_awarded + player.bonus_points;

        await db.query(`
        INSERT INTO weekly_awards (week_start, player_id, rank, points_awarded, bonus_points, total_points, highest_score)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (week_start, player_id) DO UPDATE
        SET rank = EXCLUDED.rank,
            points_awarded = EXCLUDED.points_awarded,
            bonus_points = EXCLUDED.bonus_points,
            total_points = EXCLUDED.total_points,
            highest_score = EXCLUDED.highest_score
    `, [
            weekStart,
            player.player_id,
            i + 1,
            points_awarded,
            player.bonus_points,
            total_points,
            player.highest_score
        ]);
    }
}
module.exports = { finalizeWeeklyAwards };