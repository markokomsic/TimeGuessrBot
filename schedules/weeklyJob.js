const cron = require('node-cron');
const WeeklyPoints = require('../services/weeklyPoints');

// Run every Sunday at 23:59
cron.schedule('59 23 * * 0', async () => {
    try {
        const weekStart = WeeklyPoints.getCurrentWeekStart();
        console.log(`Calculating weekly points for week starting ${weekStart}`);
        await WeeklyPoints.calculateForWeek(weekStart);
        console.log('Weekly points calculation completed');
    } catch (error) {
        console.error('Weekly points job failed:', error);
    }
});