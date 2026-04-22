async function initDB() {
  const databaseUrl = process.env.DATABASE_URL;
  const host = process.env.DB_HOST || '127.0.0.1';
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || 'root';
  const database = process.env.DB_NAME || 'chatapp';
  const port = parseInt(process.env.DB_PORT) || 3306;
  const ssl = process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined;

  let connectionConfig;

  if (databaseUrl) {
    try {
      const url = new URL(databaseUrl);
      connectionConfig = {
        host: url.hostname,
        port: parseInt(url.port) || 3306,
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        database: url.pathname.slice(1),
        ssl: ssl
      };
    } catch (e) {
      console.error('Invalid DATABASE_URL provided. Falling back to individual variables.');
    }
  }

  if (!connectionConfig) {
    connectionConfig = { host, user, password, database, port, ssl };
  }

  try {
    // 1. Check if database is reachable/ready
    console.log(`Attempting to connect to database at ${connectionConfig.host}...`);
    const connection = await mysql.createConnection({
      host: connectionConfig.host,
      port: connectionConfig.port,
      user: connectionConfig.user,
      password: connectionConfig.password,
      ssl: connectionConfig.ssl
    });

    if (!databaseUrl) {
      await connection.query(`CREATE DATABASE IF NOT EXISTS ${connectionConfig.database};`);
    }
    await connection.end();
    console.log('Database check successful.');

    // 2. Initialize the pool
    pool = mysql.createPool({
      ...connectionConfig,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    // 3. Initialize tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        profile_pic VARCHAR(255),
        about VARCHAR(255),
        online BOOLEAN DEFAULT false,
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sender_id INT,
        receiver_id INT,
        content TEXT,
        type ENUM('text', 'image', 'video', 'audio', 'file') DEFAULT 'text',
        file_url VARCHAR(255),
        status ENUM('sent', 'delivered', 'read') DEFAULT 'sent',
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reply_to INT DEFAULT NULL,
        is_forwarded BOOLEAN DEFAULT false,
        reaction VARCHAR(50) DEFAULT NULL,
        react_user_id INT DEFAULT NULL,
        is_pinned BOOLEAN DEFAULT false,
        deleted_for_sender BOOLEAN DEFAULT false,
        deleted_for_receiver BOOLEAN DEFAULT false,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (reply_to) REFERENCES messages(id) ON DELETE SET NULL
      );
    `);

    console.log('Database tables initialized successfully.');

    // Migration checks (email column, etc.)
    const [userCols] = await pool.query("SHOW COLUMNS FROM users LIKE 'email'");
    if (userCols.length === 0) {
      await pool.query("ALTER TABLE users ADD COLUMN email VARCHAR(255) NOT NULL UNIQUE AFTER username");
    }

    const [msgCols] = await pool.query("SHOW COLUMNS FROM messages LIKE 'is_pinned'");
    if (msgCols.length === 0) {
      await pool.query("ALTER TABLE messages ADD COLUMN is_pinned BOOLEAN DEFAULT false");
      await pool.query("ALTER TABLE messages ADD COLUMN deleted_for_sender BOOLEAN DEFAULT false");
      await pool.query("ALTER TABLE messages ADD COLUMN deleted_for_receiver BOOLEAN DEFAULT false");
    }

  } catch (error) {
    console.error('Error initializing database:', error.message);
    if (error.code === 'ENOTFOUND') {
      console.error(`DNS Error: Could not resolve host "${connectionConfig.host}". Please check your DATABASE_URL.`);
    }
    if (!databaseUrl && error.code === 'ECONNREFUSED' && host === 'localhost') {
      console.log('Detected ECONNREFUSED with "localhost". Trying "127.0.0.1" instead...');
      process.env.DB_HOST = '127.0.0.1';
      return initDB();
    }
    process.exit(1);
  }
}

function getPool() {
  if (!pool) {
    throw new Error('Database pool has not been initialized. Call initDB first.');
  }
  return pool;
}

module.exports = { initDB, getPool };
