const { Client } = require('pg');

async function initDatabase() {
  const client = new Client({
    connectionString: process.env.PG_SUPERUSER_URL || process.env.DATABASE_URL.replace(/\/[^/]+$/, '/postgres'),
  });

  try {
    await client.connect();
    const res = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = 'yt_analytics'"
    );
    if (res.rowCount === 0) {
      await client.query('CREATE DATABASE yt_analytics');
      console.log('Database yt_analytics created');
    } else {
      console.log('Database yt_analytics already exists');
    }
  } catch (err) {
    // If database already exists (race condition), that's fine
    if (err.code === '42P04') {
      console.log('Database yt_analytics already exists');
    } else {
      throw err;
    }
  } finally {
    await client.end();
  }
}

module.exports = initDatabase;
