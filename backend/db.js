require('dotenv').config();
const mysql = require('mysql2/promise');

let pool;

async function initDB() {
  const host = process.env.DB_HOST || '127.0.0.1';
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || 'root';
  const database = process.env.DB_NAME || 'chatapp';
  const port = parseInt(process.env.DB_PORT) || 3306;
  const ssl = process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : (process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined);

  try {
    // 1. First, connect without a database to ensure it exists
    console.log(`Checking connection to MySQL at ${host}:${port}...`);
    const connection = await mysql.createConnection({ 
      host, 
      user, 
      password, 
      port,
      ssl: ssl
    });
    
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${database};`);
    await connection.end();
    console.log(`Database "${database}" is ready.`);

    // 2. Initialize the pool with the database
    pool = mysql.createPool({
      host,
      user,
      password,
      database,
      port,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      ssl: ssl
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

    // Ensure columns exist (for migration)
    const [userCols] = await pool.query("SHOW COLUMNS FROM users LIKE 'email'");
    if (userCols.length === 0) {
      await pool.query("ALTER TABLE users ADD COLUMN email VARCHAR(255) NOT NULL UNIQUE AFTER username");
      console.log('Added email column to users table');
    }

    const [msgCols] = await pool.query("SHOW COLUMNS FROM messages LIKE 'is_pinned'");
    if (msgCols.length === 0) {
      await pool.query("ALTER TABLE messages ADD COLUMN is_pinned BOOLEAN DEFAULT false");
      await pool.query("ALTER TABLE messages ADD COLUMN deleted_for_sender BOOLEAN DEFAULT false");
      await pool.query("ALTER TABLE messages ADD COLUMN deleted_for_receiver BOOLEAN DEFAULT false");
      console.log('Added migration columns to messages table');
    }

  } catch (error) {
    console.error('Error initializing database:', error);
    if (error.code === 'ECONNREFUSED' && host === 'localhost') {
      console.log('Detected ECONNREFUSED with "localhost". Trying "127.0.0.1" instead...');
      process.env.DB_HOST = '127.0.0.1';
      return initDB(); // Retry once with IP
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
