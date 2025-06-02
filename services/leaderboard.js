const DailyLeaderboard = require('./dailyLeaderboard');
const WeeklyLeaderboard = require('./weeklyLeaderboard');
const AllTimeLeaderboard = require('./alltimeLeaderboard');

class LeaderboardService {
    static async generate(type = 'weekly') {
        try {
            switch (type) {
                case 'daily':
                    return await DailyLeaderboard.generate();
                case 'weekly':
                    return await WeeklyLeaderboard.generateLive();
                case 'weekly-snapshot':
                    return await WeeklyLeaderboard.generateSnapshot();
                case 'alltime':
                    return await AllTimeLeaderboard.generate();
                default:
                    return 'Neispravan tip ljestvice';
            }
        } catch (error) {
            console.error('Greška u ljestvici:', error);
            return '❌ Greška pri generiranju ljestvice';
        }
    }
}

module.exports = LeaderboardService;