const db = require('../config/db');

class Player {
    static async findOrCreate(phoneNumber, name) {
        console.log(`Finding or creating player: ${phoneNumber}, ${name}`);

        const { rows } = await db.query(
            `INSERT INTO players (phone_number, name) 
             VALUES ($1, $2) 
             ON CONFLICT (phone_number) DO UPDATE SET 
                 name = EXCLUDED.name
             RETURNING *`,
            [phoneNumber, name]
        );

        console.log(`Player operation result:`, rows[0]);
        return rows[0];
    }

    static async getLeaderboard() {
        const { rows } = await require('../config/db').query(`
      SELECT 
        p.id, p.name, 
        COUNT(s.id) as games_played,
        SUM(s.points) as total_points,
        ROUND(AVG(s.accuracy), 1) as avg_accuracy,
        MAX(s.points) as best_score
      FROM players p
      JOIN scores s ON p.id = s.player_id
      GROUP BY p.id
      ORDER BY total_points DESC
      LIMIT 10
    `);
        return rows;
    }

    static async getStats(playerId) {
        // Total games, best score, average score
        const scoreRes = await db.query(`
            SELECT 
                COUNT(*) AS games_played,
                MAX(score) AS best_score,
                ROUND(AVG(score)) AS avg_score
            FROM scores
            WHERE player_id = $1
        `, [playerId]);

        // Daily wins
        const dailyRes = await db.query(`
            SELECT COUNT(*) AS daily_wins
            FROM daily_rankings
            WHERE player_id = $1 AND rank = 1
        `, [playerId]);

        // Weekly wins
        const weeklyRes = await db.query(`
            SELECT COUNT(*) AS weekly_wins
            FROM weekly_awards
            WHERE player_id = $1 AND rank = 1
        `, [playerId]);

        // All-time points
        const allTimeRes = await db.query(`
            SELECT COALESCE(SUM(total_points),0) AS alltime_points
            FROM weekly_awards
            WHERE player_id = $1
        `, [playerId]);

        return {
            games_played: parseInt(scoreRes.rows[0].games_played) || 0,
            best_score: parseInt(scoreRes.rows[0].best_score) || 0,
            avg_score: parseInt(scoreRes.rows[0].avg_score) || 0,
            daily_wins: parseInt(dailyRes.rows[0].daily_wins) || 0,
            weekly_wins: parseInt(weeklyRes.rows[0].weekly_wins) || 0,
            alltime_points: parseInt(allTimeRes.rows[0].alltime_points) || 0
        };
    }


}

module.exports = Player;