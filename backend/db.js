const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'root'
};

let pool;

async function initDB() {
  try {
    // Connect without specifying a database first to ensure we can create it
    const connection = await mysql.createConnection(dbConfig);
    
    await connection.query('CREATE DATABASE IF NOT EXISTS chatapp;');
    console.log('Database "chatapp" checked/created.');
    
    // Switch to using the database by creating a pool
    pool = mysql.createPool({
      ...dbConfig,
      database: 'chatapp',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    // Initialize database
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        profile_pic VARCHAR(255),
        about VARCHAR(255),
        online BOOLEAN DEFAULT false,
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (reply_to) REFERENCES messages(id) ON DELETE SET NULL
      );
    `);

    // Ensure is_pinned column exists
    const [cols] = await pool.query("SHOW COLUMNS FROM messages LIKE 'is_pinned'");
    if (cols.length === 0) {
      await pool.query("ALTER TABLE messages ADD COLUMN is_pinned BOOLEAN DEFAULT false");
      console.log('Added is_pinned column to messages table');
    }

    console.log('Database initialized successfully (Persistence On)');

  } catch (error) {
    console.error('Error initializing database:', error);
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
