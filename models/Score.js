const db = require('../config/db');

class Score {
    static async create({ playerId, gameNumber, score, maxScore, percentage, roundsData, rawMessage }) {
        const { rows } = await db.query(
            `INSERT INTO scores (
        player_id, game_number, score, max_score, percentage,
        rounds_data, raw_message, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *`,
            [
                playerId,
                gameNumber,
                score,
                maxScore,
                percentage,
                JSON.stringify(roundsData),
                rawMessage
            ]
        );
        return rows[0];
    }

    static async hasSubmittedToday(waId, gameNumber) {
        const { rows } = await db.query(
            `SELECT 1 FROM scores s
       JOIN players p ON s.player_id = p.id
       WHERE p.wa_id = $1 AND s.game_number = $2
       LIMIT 1`,
            [waId, gameNumber]
        );
        return rows.length > 0;
    }
}

module.exports = Score;