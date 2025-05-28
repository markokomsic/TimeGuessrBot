const Player = require('../models/Player');

class Leaderboard {
    static async generate() {
        const leaderboard = await Player.getLeaderboard();

        let message = "🏆 TimeGuessr Leaderboard 🏆\n\n";
        leaderboard.forEach((player, index) => {
            message += `${index + 1}. ${player.name}\n`;
            message += `   Total: ${player.total_points.toLocaleString()} pts\n`;
            message += `   Avg: ${player.avg_accuracy}% (${player.games_played} games)\n`;
            message += `   Best: ${player.best_score.toLocaleString()} pts\n\n`;
        });

        return message;
    }
}

module.exports = Leaderboard;