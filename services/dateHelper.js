class DateHelper {
    static getCurrentWeekInfo() {
        const weekStart = this.getCurrentWeekStart();
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6); // Display Sunday
        const weekRange = `${this.formatCroatianDate(weekStart)} - ${this.formatCroatianDate(weekEnd)}`;
        // For SQL query - need to include the full Sunday, so add one more day
        const queryEndDate = new Date(weekEnd);
        queryEndDate.setDate(queryEndDate.getDate() + 1); 
        return { weekStart, weekEnd, weekRange, queryEndDate };
    }

    static getPreviousWeekInfo() {
        const weekStart = this.getPreviousWeekStart();
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6); // Display Sunday
        const weekRange = `${this.formatCroatianDate(weekStart)} - ${this.formatCroatianDate(weekEnd)}`;
        // For SQL query - need to include the full Sunday, so add one more day
        const queryEndDate = new Date(weekEnd);
        queryEndDate.setDate(queryEndDate.getDate() + 1); 
        return { weekStart, weekEnd, weekRange, queryEndDate };
    }

    static getCurrentWeekStart() {
        const now = new Date();
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        const weekStart = new Date(now.setDate(diff));
        weekStart.setHours(0, 0, 0, 0);
        return weekStart.toISOString().split('T')[0];
    }

    static getPreviousWeekStart() {
        const now = new Date();
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1) - 7; 
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
}

module.exports = DateHelper;