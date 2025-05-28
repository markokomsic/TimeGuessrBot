const db = require('../config/db');

class DailyRanking {
    static async calculateForGame(gameNumber) {
        // Get all scores for this game
        const { rows } = await db.query(`
            SELECT 
                s.player_id, 
                s.score,
                p.name
            FROM scores s
            JOIN players p ON s.player_id = p.id
            WHERE s.game_number = $1
            ORDER BY s.score DESC
        `, [gameNumber]);

        if (rows.length === 0) return [];

        // Award points based on rank
        const pointStructure = { 1: 10, 2: 8, 3: 7, 4: 6, 5: 5, 6: 4, 7: 3, 8: 2, 9: 1 };
        const rankings = rows.map((player, index) => {
            const rank = index + 1;
            return {
                player_id: player.player_id,
                rank,
                points: pointStructure[rank] || 0
            };
        });

        // Save to database
        for (const ranking of rankings) {
            await db.query(`
                INSERT INTO daily_rankings 
                    (game_number, player_id, rank, points_awarded)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (game_number, player_id) DO UPDATE
                SET rank = EXCLUDED.rank,
                    points_awarded = EXCLUDED.points_awarded
            `, [gameNumber, ranking.player_id, ranking.rank, ranking.points]);
        }

        return rankings;
    }
}

module.exports = DailyRanking;