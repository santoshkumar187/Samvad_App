const mysql = require('mysql2/promise');
require('dotenv').config();

async function debugConnection() {
  console.log('--- Aiven Debugger (v2) ---');

  const config = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false }
  };

  // If DATABASE_URL exists, try to parse it as well for comparison
  if (process.env.DATABASE_URL) {
    console.log('Detected DATABASE_URL');
    try {
      const url = new URL(process.env.DATABASE_URL);
      config.host = url.hostname;
      config.port = parseInt(url.port) || config.port;
      config.user = decodeURIComponent(url.username);
      config.password = decodeURIComponent(url.password);
      config.database = url.pathname.slice(1);
    } catch (e) {
      console.log('DATABASE_URL is not a valid URL');
    }
  }

  console.log('\nFinal Configuration:');
  console.log('- Host:', config.host);
  console.log('- Port:', config.port);
  console.log('- User:', config.user);
  console.log('- Database:', config.database);
  console.log('- Password length:', config.password ? config.password.length : 0);

  if (!config.host || !config.user || !config.password) {
    console.error('ERROR: Missing required credentials in .env');
    return;
  }

  try {
    console.log('\nAttempting connection with SSL { rejectUnauthorized: false }...');
    const conn = await mysql.createConnection(config);
    console.log('✅ SUCCESS: Connected to Aiven MySQL!');
    
    const [rows] = await conn.query('SELECT user(), current_user(), version()');
    console.log('Session Info:', rows[0]);
    
    await conn.end();
  } catch (err) {
    console.error('\n❌ CONNECTION FAILED');
    console.error('- Message:', err.message);
    console.error('- Code:', err.code);
    console.error('- SQL State:', err.sqlState);
    
    if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('\nTroubleshooting:');
      console.log('1. Aiven Username is usually "avnadmin".');
      console.log('2. Aiven Password must be copied exactly from the console.');
      console.log('3. Ensure "Public Access" is enabled in Aiven.');
    }
  }
}

debugConnection();
