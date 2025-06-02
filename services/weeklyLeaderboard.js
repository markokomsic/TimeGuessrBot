const db = require('../config/db');
const DateHelper = require('./dateHelper');
const BonusCalculator = require('./bonusCalculator');

class WeeklyLeaderboard {
    static async generateLive() {
        const { weekStart, weekEnd, weekRange, queryEndDate } = DateHelper.getCurrentWeekInfo();

        const players = await this.getWeeklyStats(weekStart, queryEndDate);

        if (players.length === 0) {
            return `🏆 Tjedna ljestvica (${weekRange})\n\nNema podataka za ovaj tjedan.`;
        }

        const playersWithBonuses = BonusCalculator.determineBonusWinners(players);
        return this.formatLiveResults(playersWithBonuses, weekRange);
    }

    static async generateSnapshot() {
        const { weekStart, weekEnd, weekRange } = DateHelper.getCurrentWeekInfo();

        const players = await this.getWeeklySnapshot(weekStart);

        if (players.length === 0) {
            return `🏆 Tjedna snimka (${weekRange})\n\n⏰ Tjedna snimka još nije spremljena.`;
        }

        const playersWithBonuses = BonusCalculator.determineBonusWinnersForSnapshot(players);
        return this.formatSnapshotResults(playersWithBonuses, weekRange);
    }

    static async getWeeklyStats(weekStart, queryEndDate) {
        const { rows } = await db.query(`
            SELECT 
                p.name,
                SUM(dr.points_awarded) AS base_points,
                COUNT(dr.id) FILTER (WHERE dr.rank = 1) AS daily_wins,
                MAX(s.score) AS highest_score,
                AVG(s.score) AS average_score,
                SUM(s.score) AS total_daily_scores,
                COUNT(DISTINCT dr.game_number) AS games_played
            FROM daily_rankings dr
            JOIN scores s ON dr.game_number = s.game_number AND dr.player_id = s.player_id
            JOIN players p ON dr.player_id = p.id
            WHERE dr.created_at BETWEEN $1 AND $2
            GROUP BY p.name
            ORDER BY base_points DESC
            LIMIT 10
        `, [weekStart, queryEndDate]);

        return rows;
    }

    static async generateSnapshot() {
        const { weekStart, weekEnd, weekRange, queryEndDate } = DateHelper.getPreviousWeekInfo();

        const { rows } = await db.query(`
    SELECT 
        p.name,
        wa.total_points + wa.bonus_points AS final_total,
        wa.total_points AS base_points,
        wa.bonus_points,
        wa.rank,
        wa.highest_score,
        (SELECT SUM(score) FROM scores s 
         WHERE s.player_id = p.id 
           AND s.created_at BETWEEN $1 AND $2
        ) AS total_daily_scores,
        (SELECT COUNT(DISTINCT game_number) FROM scores s
         WHERE s.player_id = p.id
           AND s.created_at BETWEEN $1 AND $2
        ) AS games_played
    FROM weekly_awards wa
    JOIN players p ON wa.player_id = p.id
    WHERE wa.week_start = $1
    ORDER BY final_total DESC
    LIMIT 10
`, [weekStart, queryEndDate]);

        if (rows.length === 0) {
            return `🏆 Tjedna snimka (${weekRange})\n\n⏰ Tjedna snimka još nije spremljena.`;
        }

        const playersWithBonuses = BonusCalculator.determineBonusWinnersForSnapshot(rows);
        return this.formatSnapshotResults(playersWithBonuses, weekRange);
    }

    static formatLiveResults(players, weekRange) {
        if (players.length === 0) {
            return `🏆 Tjedna ljestvica (${weekRange})\n\nNema podataka`;
        }

        let message = `🏆 *Tjedna ljestvica (${weekRange})* 🔴 *UŽIVO*\n\n`;
        message += "💡 Bonusi nisu uključeni u rezultate\n\n";

        players.forEach((player, idx) => {
            const rankEmoji = this.getRankEmoji(idx);
            message += `${rankEmoji} *${player.name}*\n`;
            message += `   🎯 Tjedni bodovi: ${player.base_points}\n`;
            message += `   📊 Tjedna suma: ${Math.round(player.total_daily_scores).toLocaleString()} bodova\n`;
            message += `   ⭐ Prosjek: ${Math.round(player.average_score).toLocaleString()} bodova\n`;
            message += `   📥 Odigrano dana: ${player.games_played} / 7\n`;

            if (player.bonuses && player.bonuses.length > 0) {
                message += `   🏅 ${player.bonuses.join(' • ')}\n`;
            }
            message += '\n';
        });

        return message;
    }

    static formatSnapshotResults(players, weekRange) {
        if (players.length === 0) {
            return `🏆 Tjedna snimka (${weekRange})\n\nNema podataka`;
        }

        let message = `🏆 *Tjedna snimka (${weekRange})* 📸\n\n`;
        message += "🔒 Konačni rezultati sa bonusima\n\n";

        players.forEach((player, idx) => {
            const rankEmoji = this.getRankEmoji(idx);
            message += `${rankEmoji} *${player.name}*\n`;
            message += `   🎯 Ukupno bodova: ${player.final_total}\n`;
            message += `   ⚡ Osnovno: ${player.base_points} | ✨ Bonus: ${player.bonus_points}\n`;
            message += `   📊 Tjedna suma: ${Math.round(player.total_daily_scores).toLocaleString()} bodova\n`;
            message += `   📥 Odigrano dana: ${player.games_played} / 7\n`;

            if (player.bonuses && player.bonuses.length > 0) {
                message += `   🏅 ${player.bonuses.join(' • ')}\n`;
            }
            message += '\n';
        });

        return message;
    }

    static getRankEmoji(index) {
        return index === 0 ? '🥇' :
            index === 1 ? '🥈' :
                index === 2 ? '🥉' : `${index + 1}.`;
    }
}

module.exports = WeeklyLeaderboard;