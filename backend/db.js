require('dotenv').config();
const mysql = require('mysql2/promise');

let pool;

async function initDB() {
  const config = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'chatapp',
    ssl: { rejectUnauthorized: false }
  };

  // Skip SSL for local development unless explicitly requested
  if (config.host === '127.0.0.1' || config.host === 'localhost') {
    if (process.env.DB_SSL !== 'true') delete config.ssl;
  }

  // Support for single Connection String (Render/Cloud)
  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    config.host = url.hostname;
    config.port = parseInt(url.port) || 3306;
    config.user = decodeURIComponent(url.username);
    config.password = decodeURIComponent(url.password);
    config.database = url.pathname.slice(1);
    config.ssl = { rejectUnauthorized: false };
  }

  try {
    // 1. Connection test
    console.log(`Attempting to connect to database at ${config.host}...`);
    const connection = await mysql.createConnection(config);
    console.log("Connected to Aiven MySQL!");
    await connection.end();

    // 2. Initialize the pool (Required for the app to function)
    pool = mysql.createPool({
      ...config,
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
        samvad_id VARCHAR(50) UNIQUE,
        profile_pic VARCHAR(255),
        about VARCHAR(255),
        online BOOLEAN DEFAULT false,
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS friends (
        user_id INT,
        friend_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, friend_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`groups\` (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        avatar VARCHAR(255) DEFAULT NULL,
        creator_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS group_members (
        group_id INT,
        user_id INT,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (group_id, user_id),
        FOREIGN KEY (group_id) REFERENCES \`groups\`(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS pinned_chats (
        user_id INT,
        pinned_user_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, pinned_user_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (pinned_user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS pinned_groups (
        user_id INT,
        group_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, group_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (group_id) REFERENCES \`groups\`(id) ON DELETE CASCADE
      );
    `);

    console.log('Database tables initialized successfully.');

    // Migration checks
    const [userCols] = await pool.query("SHOW COLUMNS FROM users LIKE 'samvad_id'");
    if (userCols.length === 0) {
      console.log('Migrating: Adding samvad_id column...');
      await pool.query("ALTER TABLE users ADD COLUMN samvad_id VARCHAR(50) UNIQUE AFTER password");
      
      // Generate samvad_id for existing users
      const [users] = await pool.query("SELECT id, username FROM users WHERE samvad_id IS NULL");
      for (const user of users) {
        const sid = `${user.username.toLowerCase()}#${Math.floor(1000 + Math.random() * 9000)}`;
        await pool.query("UPDATE users SET samvad_id = ? WHERE id = ?", [sid, user.id]);
      }
      console.log(`Migrated ${users.length} users with new samvad_id.`);
    }

    const [msgCols] = await pool.query("SHOW COLUMNS FROM messages LIKE 'is_pinned'");
    if (msgCols.length === 0) {
      await pool.query("ALTER TABLE messages ADD COLUMN is_pinned BOOLEAN DEFAULT false");
      await pool.query("ALTER TABLE messages ADD COLUMN deleted_for_sender BOOLEAN DEFAULT false");
      await pool.query("ALTER TABLE messages ADD COLUMN deleted_for_receiver BOOLEAN DEFAULT false");
    }

    const [msgGroupCols] = await pool.query("SHOW COLUMNS FROM messages LIKE 'group_id'");
    if (msgGroupCols.length === 0) {
      console.log('Migrating: Adding group_id column to messages...');
      await pool.query("ALTER TABLE messages ADD COLUMN group_id INT NULL DEFAULT NULL AFTER receiver_id");
      await pool.query("ALTER TABLE messages ADD CONSTRAINT fk_messages_group FOREIGN KEY (group_id) REFERENCES \`groups\`(id) ON DELETE CASCADE");
      console.log('Migrated: Added group_id and constraint to messages.');
    }

    // Migration: Add security columns to users table
    const [securityQuestionCols] = await pool.query("SHOW COLUMNS FROM users LIKE 'security_question'");
    if (securityQuestionCols.length === 0) {
      console.log('Migrating: Adding security_question column to users...');
      await pool.query("ALTER TABLE users ADD COLUMN security_question VARCHAR(255) NULL");
    }
    const [securityAnswerCols] = await pool.query("SHOW COLUMNS FROM users LIKE 'security_answer'");
    if (securityAnswerCols.length === 0) {
      console.log('Migrating: Adding security_answer column to users...');
      await pool.query("ALTER TABLE users ADD COLUMN security_answer VARCHAR(255) NULL");
    }

    // Seed AI Assistant user
    const [aiExists] = await pool.query("SELECT * FROM users WHERE samvad_id = 'ai#9999'");
    if (aiExists.length === 0) {
      console.log("Seeding AI Assistant user...");
      const hashedPassword = 'ai_assistant_secure_inactive_password_hash';
      await pool.query(
        "INSERT INTO users (username, email, password, samvad_id, profile_pic, about, online) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          "Samvad AI Assistant", 
          "ai@samvad.app", 
          hashedPassword, 
          "ai#9999", 
          "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT4cTHq4A3nxYnx117GVvP9vsp7sogn7RdR7w&s", 
          "Your personal AI companion. Ready to answer questions, translate, or chat!", 
          true
        ]
      );
      console.log("AI Assistant user seeded successfully.");
    } else {
      // Ensure the existing entry uses the beautiful custom avatar!
      await pool.query(
        "UPDATE users SET profile_pic = ? WHERE samvad_id = ?",
        ["https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT4cTHq4A3nxYnx117GVvP9vsp7sogn7RdR7w&s", "ai#9999"]
      );
      console.log("AI Assistant profile picture updated successfully in the database.");
    }

  } catch (error) {
    console.error("Error initializing database:", error.message);
    if (error.code === 'ENOTFOUND') {
      console.error(`DNS Error: Could not resolve host "${config.host}".`);
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
