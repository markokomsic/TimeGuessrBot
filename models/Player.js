class Player {
    static async findOrCreate(waId, name) {
        const { rows } = await require('../config/db').query(
            `INSERT INTO players (wa_id, name) 
       VALUES ($1, $2) 
       ON CONFLICT (wa_id) DO UPDATE SET name = $2 
       RETURNING *`,
            [waId, name]
        );
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
}

module.exports = Player;