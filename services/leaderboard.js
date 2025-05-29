const db = require('../config/db');

class Leaderboard {
    static async generate(type = 'weekly') {
        try {
            switch (type) {
                case 'daily':
                    return await this.generateDaily();
                case 'weekly':
                    return await this.generateWeekly();
                case 'weekly-snapshot': // For end-of-week saved results
                    return await this.generateWeeklySnapshot();
                default:
                    return 'Invalid leaderboard type';
            }
        } catch (error) {
            console.error('Leaderboard error:', error);
            return '❌ Error generating leaderboard';
        }
    }

    static async generateDaily() {
        const gameNumber = await this.getTodaysGameNumber();
        if (!gameNumber) return 'Nije pronađena danas igra!';

        // Get daily rankings
        const { rows } = await db.query(`
            SELECT 
                p.name,
                dr.rank,
                dr.points_awarded,
                s.score,
                s.percentage
            FROM daily_rankings dr
            JOIN scores s ON dr.game_number = s.game_number AND dr.player_id = s.player_id
            JOIN players p ON dr.player_id = p.id
            WHERE dr.game_number = $1
            ORDER BY dr.rank
            LIMIT 10
        `, [gameNumber]);

        // Get daily averages
        const avgResult = await db.query(`
            SELECT 
                ROUND(AVG(s.score)) AS avg_score,
                ROUND(AVG(s.percentage)) AS avg_accuracy
            FROM scores s
            WHERE s.game_number = $1
        `, [gameNumber]);

        const averages = avgResult.rows[0];

        // Format results
        return this.formatDailyResults(rows, gameNumber, averages);
    }

    static async generateWeekly() {
        const weekStart = this.getCurrentWeekStart();
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const weekRange = `${this.formatCroatianDate(weekStart)} - ${this.formatCroatianDate(weekEnd)}`;

        // Calculate real-time weekly rankings from daily_rankings (same logic as your WeeklyPoints service)
        const { rows } = await db.query(`
            WITH weekly_stats AS (
                SELECT 
                    dr.player_id,
                    p.name,
                    SUM(dr.points_awarded) AS total_points,
                    COUNT(dr.id) FILTER (WHERE dr.rank = 1) AS daily_wins,
                    MAX(s.score) AS highest_score,
                    COUNT(DISTINCT dr.game_number) AS games_played,
                    SUM(s.score) AS total_daily_scores,
                    ROUND(AVG(s.score)) AS avg_score,
                    ROUND(AVG(s.percentage)) AS avg_accuracy
                FROM daily_rankings dr
                JOIN scores s ON dr.game_number = s.game_number AND dr.player_id = s.player_id
                JOIN players p ON dr.player_id = p.id
                WHERE dr.created_at BETWEEN $1 AND $2
                GROUP BY dr.player_id, p.name
            ),
            weekly_bonuses AS (
                SELECT 
                    ws.*,
                    -- Bonus calculation (same logic as your WeeklyPoints service)
                    CASE 
                        WHEN ws.daily_wins = (SELECT MAX(daily_wins) FROM weekly_stats) 
                        THEN 50 
                        ELSE 0 
                    END AS win_bonus,
                    CASE 
                        WHEN ws.highest_score = (SELECT MAX(highest_score) FROM weekly_stats)
                        THEN 30 
                        ELSE 0 
                    END AS score_bonus
                FROM weekly_stats ws
            )
            SELECT 
                *,
                (total_points + win_bonus + score_bonus) AS final_total,
                (win_bonus + score_bonus) AS total_bonus
            FROM weekly_bonuses
            ORDER BY final_total DESC, highest_score DESC
            LIMIT 10
        `, [weekStart, weekEnd]);

        // Format results
        return this.formatWeeklyResults(rows, weekRange, true); // true for real-time
    }

    static async generateWeeklySnapshot() {
        const weekStart = this.getCurrentWeekStart();
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const weekRange = `${this.formatCroatianDate(weekStart)} - ${this.formatCroatianDate(weekEnd)}`;

        // Get saved weekly rankings from weekly_points table (your existing structure)
        const { rows } = await db.query(`
            SELECT 
                p.name,
                wp.total_points + wp.bonus_points AS final_total,
                wp.total_points,
                wp.bonus_points AS total_bonus,
                wp.daily_wins,
                wp.highest_score,
                (SELECT SUM(score) FROM scores s 
                 WHERE s.player_id = p.id 
                   AND s.created_at BETWEEN $1 AND $2
                ) AS total_daily_scores
            FROM weekly_points wp
            JOIN players p ON wp.player_id = p.id
            WHERE wp.week_start = $1
            ORDER BY final_total DESC
            LIMIT 10
        `, [weekStart, weekEnd]);

        if (rows.length === 0) {
            return `🏆 Tjedna snimka (${weekRange})\n\n⏰ Tjedna snimka još nije spremljena. Koristite tjednu ljestvicu za trenutne rezultate.`;
        }

        // Format results
        return this.formatWeeklyResults(rows, weekRange, false); // false for snapshot
    }

    static formatDailyResults(rows, gameNumber, averages) {
        if (rows.length === 0) return `🏆 Dnevna ljestvica - Igra #${gameNumber}\n\nNema zabilježenih rezultata!`;

        let message = `🏆 *Dnevna ljestvica - Igra #${gameNumber}* 🏆\n`;
        message += `📊 Prosjek: ${averages.avg_score.toLocaleString()} bodova (${averages.avg_accuracy}%)\n\n`;

        rows.forEach((player, idx) => {
            const rankEmoji = idx === 0 ? '🥇' :
                idx === 1 ? '🥈' :
                    idx === 2 ? '🥉' : `${idx + 1}.`;

            message += `${rankEmoji} *${player.name}*\n`;
            message += `   🎯 ${player.score.toLocaleString()} bodova (${player.percentage}%)\n`;
            message += `   ⭐ Bodovi: ${player.points_awarded}\n\n`;
        });

        return message;
    }

    static formatWeeklyResults(rows, weekRange, isRealTime = true) {
        if (rows.length === 0) {
            return `🏆 Tjedna ljestvica (${weekRange})\n\nNema tjednih podataka`;
        }

        const typeIndicator = isRealTime ? '🔴 *UŽIVO*' : '📸 *SNIMKA*';
        let message = `🏆 *Tjedna ljestvica (${weekRange})* ${typeIndicator}\n\n`;

        rows.forEach((player, idx) => {
            const rankEmoji = idx === 0 ? '🥇' :
                idx === 1 ? '🥈' :
                    idx === 2 ? '🥉' : `${idx + 1}.`;

            message += `${rankEmoji} *${player.name}*\n`;
            message += `   🎯 Ukupno bodova: ${player.final_total}\n`;

            if (isRealTime) {
                message += `   📊 Dnevni rezultati: ${player.total_daily_scores?.toLocaleString() || 0} bodova (${player.games_played} igara)\n`;
                message += `   ⚡ Osnovno: ${player.total_points} | ✨ Bonus: ${player.total_bonus}\n`;
                message += `   📈 Prosjek: ${player.avg_score?.toLocaleString() || 0} bodova (${player.avg_accuracy || 0}%)\n`;
            } else {
                message += `   📊 Dnevni rezultati: ${player.total_daily_scores?.toLocaleString() || 0} bodova\n`;
                message += `   ⚡ Osnovno: ${player.total_points} | ✨ Bonus: ${player.total_bonus}\n`;
            }

            // Show bonus details
            if (player.total_bonus > 0) {
                message += `   🎖️ Bonusi: `;
                const bonuses = [];

                if (isRealTime) {
                    if (player.win_bonus > 0) bonuses.push(`Najviše pobjeda (${player.daily_wins}x)`);
                    if (player.score_bonus > 0) bonuses.push(`Najveći rezultat (${player.highest_score?.toLocaleString() || 0} bodova)`);
                } else {
                    // For snapshots, reconstruct bonus info from total
                    if (player.total_bonus >= 50) bonuses.push(`Najviše pobjeda (${player.daily_wins}x)`);
                    if (player.total_bonus === 30 || player.total_bonus === 80) bonuses.push(`Najveći rezultat (${player.highest_score?.toLocaleString() || 0} bodova)`);
                }

                message += bonuses.join(' + ') + '\n';
            }

            message += '\n';
        });

        return message;
    }

    // Helper functions (matching your existing logic)
    static getCurrentWeekStart() {
        const now = new Date();
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        const weekStart = new Date(now.setDate(diff));
        weekStart.setHours(0, 0, 0, 0);
        return weekStart;
    }

    // Croatian date formatting
    static formatCroatianDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('hr-HR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    static async getTodaysGameNumber() {
        const { rows } = await db.query(`
            SELECT MAX(game_number) AS game_number 
            FROM scores 
            WHERE DATE(created_at) = CURRENT_DATE 
        `);
        return rows[0]?.game_number;
    }
}

module.exports = Leaderboard;