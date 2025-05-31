const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test the connection immediately
pool.query('SELECT NOW()')
    .then(() => console.log('✅ PostgreSQL connected successfully'))
    .catch(err => console.error('❌ PostgreSQL connection error:', err));

module.exports = {
    query: (text, params) => {
        console.log('Executing query:', text, params);
        return pool.query(text, params);
    },
    close: () => pool.end()
};