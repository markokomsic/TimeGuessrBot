class Score {
    static async create(playerId, roundNumber, points, accuracy) {
        const { rows } = await require('../config/db').query(
            `INSERT INTO scores (player_id, round_number, points, accuracy, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
            [playerId, roundNumber, points, accuracy]
        );
        return rows[0];
    }

    static async hasSubmittedToday(waId, roundNumber) {
        const { rows } = await require('../config/db').query(
            `SELECT 1 FROM scores s
       JOIN players p ON s.player_id = p.id
       WHERE p.wa_id = $1 AND s.round_number = $2
       LIMIT 1`,
            [waId, roundNumber]
        );
        return rows.length > 0;
    }
}

module.exports = Score;