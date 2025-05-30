const db = require('../config/db');

class Leaderboard {
    static async generate(type = 'weekly') {
        try {
            switch (type) {
                case 'daily':
                    return await this.generateDaily();
                case 'weekly':
                    return await this.generateWeekly();
                case 'weekly-snapshot': 
                    return await this.generateWeeklySnapshot();
                default:
                    return 'Neispravan tip ljestvice';
            }
        } catch (error) {
            console.error('Greška u ljestvici:', error);
            return '❌ Greška pri generiranju ljestvice';
        }
    }

    static async generateDaily() {
        const gameNumber = await this.getTodaysGameNumber();
        if (!gameNumber) return 'Nije pronađena današnja igra!';

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

        const averages = avgResult.rows[0] || { avg_score: 0, avg_accuracy: 0 };

        // Format results
        return this.formatDailyResults(rows, gameNumber, averages);
    }

    static async generateWeekly() {
        const weekStart = this.getCurrentWeekStart();
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const weekRange = `${this.formatCroatianDate(weekStart)} - ${this.formatCroatianDate(weekEnd)}`;

        // Get weekly stats without bonuses
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
        `, [weekStart, weekEnd]);

        if (rows.length === 0) {
            return `🏆 Tjedna ljestvica (${weekRange})\n\nNema podataka za ovaj tjedan.`;
        }

        // Apply tiebreakers and determine bonuses
        const playersWithContenders = this.determineBonusWinners(rows);

        // Format results
        return this.formatWeeklyResults(playersWithContenders, weekRange);
    }

    static async generateWeeklySnapshot() {
        const weekStart = this.getCurrentWeekStart();
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const weekRange = `${this.formatCroatianDate(weekStart)} - ${this.formatCroatianDate(weekEnd)}`;

        // Get saved weekly rankings
        const { rows } = await db.query(`
            SELECT 
                p.name,
                wp.total_points + wp.bonus_points AS final_total,
                wp.total_points AS base_points,
                wp.bonus_points,
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
            return `🏆 Tjedna snimka (${weekRange})\n\n⏰ Tjedna snimka još nije spremljena.`;
        }

        // Apply tiebreakers to determine which players actually won bonuses
        const playersWithActualBonuses = this.determineBonusWinnersForSnapshot(rows);

        // Format results
        return this.formatWeeklySnapshotResults(playersWithActualBonuses, weekRange);
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

    static formatWeeklyResults(players, weekRange) {
        if (players.length === 0) {
            return `🏆 Tjedna ljestvica (${weekRange})\n\nNema podataka`;
        }

        let message = `🏆 *Tjedna ljestvica (${weekRange})* 🔴 *UŽIVO*\n\n`;
        message += "💡 Bonusi nisu uključeni u rezultate\n\n";

        players.forEach((player, idx) => {
            const rankEmoji = idx === 0 ? '🥇' :
                idx === 1 ? '🥈' :
                    idx === 2 ? '🥉' : `${idx + 1}.`;

            message += `${rankEmoji} *${player.name}*\n`;
            message += `   🎯 Tjedni bodovi: ${player.base_points}\n`;
            message += `   📊 Tjedna suma: ${Math.round(player.total_daily_scores).toLocaleString()} bodova\n`;
            message += `   ⭐ Prosjek: ${Math.round(player.average_score).toLocaleString()} bodova\n`;

            if (player.bonuses.length > 0) {
                message += `   🏅 ${player.bonuses.join(' • ')}\n`;
            }

            message += '\n';
        });

        return message;
    }

    static formatWeeklySnapshotResults(players, weekRange) {
        if (players.length === 0) {
            return `🏆 Tjedna snimka (${weekRange})\n\nNema podataka`;
        }

        let message = `🏆 *Tjedna snimka (${weekRange})* 📸\n\n`;
        message += "🔒 Konačni rezultati sa bonusima\n\n";

        players.forEach((player, idx) => {
            const rankEmoji = idx === 0 ? '🥇' :
                idx === 1 ? '🥈' :
                    idx === 2 ? '🥉' : `${idx + 1}.`;

            message += `${rankEmoji} *${player.name}*\n`;
            message += `   🎯 Ukupno bodova: ${player.final_total}\n`;
            message += `   ⚡ Osnovno: ${player.base_points} | ✨ Bonus: ${player.bonus_points}\n`;
            message += `   📊 Tjedna suma: ${Math.round(player.total_daily_scores).toLocaleString()} bodova\n`;

            if (player.bonuses && player.bonuses.length > 0) {
                message += `   🏅 ${player.bonuses.join(' • ')}\n`;
            }

            message += '\n';
        });

        return message;
    }

    // Helper functions
    static determineBonusWinners(players) {
        // Find candidates for each bonus
        const mostWins = Math.max(...players.map(p => parseInt(p.daily_wins) || 0));
        const highestScore = Math.max(...players.map(p => parseInt(p.highest_score) || 0));

        // Get all players tied for most wins
        const winsContenders = players.filter(p => (parseInt(p.daily_wins) || 0) === mostWins && mostWins > 0);

        // Get all players tied for highest score
        const scoreContenders = players.filter(p => (parseInt(p.highest_score) || 0) === highestScore && highestScore > 0);

        // Apply tiebreaker: highest Tjedna suma (total_daily_scores)
        const winsWinner = this.applyTiebreaker(winsContenders, 'total_daily_scores');
        const scoreWinner = this.applyTiebreaker(scoreContenders, 'total_daily_scores');

        // Assign bonuses to players
        return players.map(player => {
            const bonuses = [];

            if (winsWinner && player.name === winsWinner.name) {
                bonuses.push('👑 Najviše pobjeda');
            }

            if (scoreWinner && player.name === scoreWinner.name) {
                bonuses.push('🚀 Najveći rezultat');
            }

            return {
                ...player,
                bonuses
            };
        });
    }

    static determineBonusWinnersForSnapshot(players) {
        // For snapshots, we need to reverse-engineer who actually won the bonuses
        // based on their bonus_points values
        return players.map(player => {
            const bonuses = [];
            const bonusPoints = parseInt(player.bonus_points) || 0;

            // Check if player has bonus points indicating they won bonuses
            if (bonusPoints >= 50) { 
                bonuses.push(`👑 Najviše pobjeda (${player.daily_wins}x)`);
            }
            if (bonusPoints >= 30) { 
                bonuses.push(`🚀 Najveći rezultat (${parseInt(player.highest_score).toLocaleString()} bodova)`);
            }

            return {
                ...player,
                bonuses
            };
        });
    }

    static applyTiebreaker(contenders, tiebreakerField) {
        if (contenders.length === 0) return null;
        if (contenders.length === 1) return contenders[0];

        // Find the highest value for the tiebreaker field
        const maxTiebreakerValue = Math.max(...contenders.map(p => parseInt(p[tiebreakerField]) || 0));

        // Get all players tied for the highest tiebreaker value
        const tiebreakerWinners = contenders.filter(p => (parseInt(p[tiebreakerField]) || 0) === maxTiebreakerValue);

        // If still tied after tiebreaker, return the first one 
        return tiebreakerWinners[0];
    }

    static getCurrentWeekStart() {
        const now = new Date();
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        const weekStart = new Date(now.setDate(diff));
        weekStart.setHours(0, 0, 0, 0);
        return weekStart.toISOString().split('T')[0];
    }

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