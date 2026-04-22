require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function initDB() {
  try {
    // Test connection
    const connection = await pool.getConnection();
    console.log(`Connected to database: ${process.env.DB_NAME}`);
    connection.release();

    // Initialize database tables
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

    console.log('Database initialized successfully (Persistence On)');

  } catch (error) {
    console.error('Error initializing database:', error);
    // If database doesn't exist, we might need to create it (only if environment allows)
    if (error.code === 'ER_BAD_DB_ERROR') {
      console.log(`Database "${process.env.DB_NAME}" not found. Attempting to create...`);
      try {
        const tempConn = await mysql.createConnection({
          host: process.env.DB_HOST,
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
          port: process.env.DB_PORT || 3306
        });
        await tempConn.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME};`);
        await tempConn.end();
        console.log(`Database "${process.env.DB_NAME}" created. Please restart the server.`);
        process.exit(0);
      } catch (createError) {
        console.error('Failed to create database:', createError);
        process.exit(1);
      }
    } else {
      process.exit(1);
    }
  }
}

function getPool() {
  return pool;
}

module.exports = { initDB, getPool };
