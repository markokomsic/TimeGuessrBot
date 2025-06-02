class BonusCalculator {
    static determineBonusWinners(players) {
        const mostWins = Math.max(...players.map(p => parseInt(p.daily_wins) || 0));
        const highestScore = Math.max(...players.map(p => parseInt(p.highest_score) || 0));

        const winsContenders = players.filter(p => (parseInt(p.daily_wins) || 0) === mostWins && mostWins > 0);
        const scoreContenders = players.filter(p => (parseInt(p.highest_score) || 0) === highestScore && highestScore > 0);

        let winsWinner = null;
        if (winsContenders.length === 1) {
            winsWinner = winsContenders[0];
        }

        const scoreWinner = this.applyTiebreaker(scoreContenders, 'total_daily_scores');

        return players.map(player => {
            const bonuses = [];

            if (winsWinner && player.name === winsWinner.name) {
                bonuses.push('👑 Najviše pobjeda');
            }

            if (scoreWinner && player.name === scoreWinner.name) {
                bonuses.push('🚀 Najveći rezultat');
            }

            return { ...player, bonuses };
        });
    }

    static determineBonusWinnersForSnapshot(players) {
        const mostWins = Math.max(...players.map(p => parseInt(p.daily_wins) || 0));
        const winsContenders = players.filter(p => (parseInt(p.daily_wins) || 0) === mostWins && mostWins > 0);

        return players.map(player => {
            const bonuses = [];
            const bonusPoints = parseInt(player.bonus_points) || 0;

            if (mostWins > 0 && winsContenders.length === 1 && player.daily_wins == mostWins && bonusPoints >= 50) {
                bonuses.push(`👑 Najviše pobjeda (${player.daily_wins}x)`);
            }

            if (bonusPoints >= 30) {
                bonuses.push(`🚀 Najveći rezultat (${parseInt(player.highest_score).toLocaleString()} bodova)`);
            }

            return { ...player, bonuses };
        });
    }

    static applyTiebreaker(contenders, tiebreakerField) {
        if (contenders.length === 0) return null;
        if (contenders.length === 1) return contenders[0];

        const maxTiebreakerValue = Math.max(...contenders.map(p => parseInt(p[tiebreakerField]) || 0));
        const tiebreakerWinners = contenders.filter(p => (parseInt(p[tiebreakerField]) || 0) === maxTiebreakerValue);

        return tiebreakerWinners[0];
    }
}

module.exports = BonusCalculator;