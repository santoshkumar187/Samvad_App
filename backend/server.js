const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v2: cloudinary } = require('cloudinary');
const { initDB, getPool } = require('./db');
const { getAssistantReply, getSmartSuggestions, translateText, summarizeConversation } = require('./ai');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const JWT_SECRET = process.env.JWT_SECRET || 'samvad_secret_key_2024';

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Enforce JWT verification on connection
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication error: Token missing'));
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return next(new Error('Authentication error: Invalid token'));
    socket.userId = decoded.id;
    socket.username = decoded.username;
    next();
  });
});

app.use(cors());
app.use(express.json());
// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve static frontend files from the 'frontend/dist' directory
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Root route moved after static middleware if needed, but we'll use a catch-all instead.
// app.get('/', (req, res) => {
//   res.send('Hello! The Samvad App Server is working.');
// });

// Multer: store files in memory, then stream to Cloudinary
const upload = multer({ storage: multer.memoryStorage() });

// Helper: upload a buffer to Cloudinary
const uploadToCloudinary = (buffer, options) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
    stream.end(buffer);
  });
};

app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send({ error: 'No file uploaded.' });
  }
  try {
    let folder = 'samvad/files';
    let resourceType = 'auto';
    const mime = req.file.mimetype;
    if (mime.startsWith('image/')) folder = 'samvad/images';
    else if (mime.startsWith('video/')) folder = 'samvad/videos';
    else if (mime.startsWith('audio/')) folder = 'samvad/audio';

    const result = await uploadToCloudinary(req.file.buffer, {
      folder,
      resource_type: resourceType,
      public_id: `${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9.]/g, '_')}`
    });
    res.json({ url: result.secure_url, type: mime });
  } catch (err) {
    console.error('Cloudinary upload error:', err);
    res.status(500).json({ error: 'Upload failed.' });
  }
});

app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !password || !email) return res.status(400).json({ error: 'Username, email and password required' });

  try {
    const pool = getPool();
    let [rows] = await pool.query('SELECT * FROM users WHERE username = ? OR email = ?', [username, email]);
    if (rows.length > 0) return res.status(400).json({ error: 'Username or email already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    // Generate unique samvad_id
    const samvadId = `${username.toLowerCase()}#${Math.floor(1000 + Math.random() * 9000)}`;
    
    const [result] = await pool.query(
      'INSERT INTO users (username, email, password, samvad_id) VALUES (?, ?, ?, ?)', 
      [username, email, hashedPassword, samvadId]
    );
    
    const [newRows] = await pool.query('SELECT id, username, email, samvad_id, online, profile_pic, about, last_seen, created_at FROM users WHERE id = ?', [result.insertId]);
    const user = newRows[0];
    
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
    res.json({ user, token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/login', async (req, res) => {
  const { identifier, password } = req.body; // identifier can be username or email
  if (!identifier || !password) return res.status(400).json({ error: 'Username/Email and password required' });

  try {
    const pool = getPool();
    let [rows] = await pool.query('SELECT * FROM users WHERE username = ? OR email = ? OR samvad_id = ?', [identifier, identifier, identifier]);
    
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid identifier or password' });
    }
    
    const user = rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password);
    
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid identifier or password' });
    }
    
    const { password: _, ...userWithoutPassword } = user;
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
    res.json({ user: userWithoutPassword, token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT id, username, email, samvad_id, online, profile_pic, about, last_seen, created_at FROM users WHERE id = ?', [req.user.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/users/:id/profile', upload.single('profile_pic'), async (req, res) => {
  const { id } = req.params;
  const { about } = req.body;
  const file = req.file;
  
  try {
    const pool = getPool();
    let updateQuery = 'UPDATE users SET about = ?';
    let params = [about || 'Available'];
    
    if (file) {
      // Upload buffer to Cloudinary
      const result = await uploadToCloudinary(file.buffer, {
        folder: 'samvad/profiles',
        resource_type: 'image',
        public_id: `profile_${id}_${Date.now()}`
      });
      updateQuery += ', profile_pic = ?';
      params.push(result.secure_url);
    }
    
    updateQuery += ' WHERE id = ?';
    params.push(id);
    
    await pool.query(updateQuery, params);
    
    const [rows] = await pool.query('SELECT id, username, email, samvad_id, online, profile_pic, about, last_seen, created_at FROM users WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT id, username, samvad_id, online, profile_pic, about, last_seen FROM users ORDER BY username ASC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/search', authenticateToken, async (req, res) => {
  const { samvadId } = req.query;
  if (!samvadId) return res.status(400).json({ error: 'samvadId required' });

  try {
    const pool = getPool();
    const [rows] = await pool.query(
      'SELECT id, username, samvad_id, profile_pic, about, online FROM users WHERE samvad_id = ?', 
      [samvadId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/friends', authenticateToken, async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(`
      SELECT u.id, u.username, u.samvad_id, u.online, u.profile_pic, u.about, u.last_seen 
      FROM users u
      JOIN friends f ON (u.id = f.friend_id AND f.user_id = ?) OR (u.id = f.user_id AND f.friend_id = ?)
      WHERE u.id != ?
      GROUP BY u.id
    `, [req.user.id, req.user.id, req.user.id]);
    
    // Auto-append Samvad AI Assistant
    const [aiRows] = await pool.query('SELECT id, username, samvad_id, online, profile_pic, about, last_seen FROM users WHERE samvad_id = ?', ['ai#9999']);
    if (aiRows.length > 0) {
      aiRows[0].online = true; // AI is always online
      rows.unshift(aiRows[0]); // Put AI at the top
    }
    
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// AI smart replies suggestions
app.get('/api/ai/suggestions', authenticateToken, async (req, res) => {
  const { receiverId } = req.query;
  if (!receiverId) return res.status(400).json({ error: 'receiverId required' });
  try {
    const pool = getPool();
    const [rows] = await pool.query(`
      SELECT sender_id, receiver_id, content, timestamp 
      FROM messages 
      WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
      ORDER BY timestamp DESC LIMIT 5
    `, [req.user.id, receiverId, receiverId, req.user.id]);
    
    const history = rows.reverse().map(m => ({
      sender: Number(m.sender_id) === Number(req.user.id) ? 'You' : 'Friend',
      content: m.content
    }));
    
    const suggestions = await getSmartSuggestions(history);
    res.json(suggestions);
  } catch (err) {
    console.error('Suggestions error:', err);
    res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
});

// AI Translation endpoint
app.post('/api/ai/translate', authenticateToken, async (req, res) => {
  const { text, targetLang } = req.body;
  if (!text || !targetLang) return res.status(400).json({ error: 'Text and targetLang required' });
  try {
    const translation = await translateText(text, targetLang);
    res.json({ translation });
  } catch (err) {
    console.error('Translation error:', err);
    res.status(500).json({ error: 'Failed to translate' });
  }
});

// AI Summarize Chat endpoint
app.get('/api/ai/summarize', authenticateToken, async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  try {
    const pool = getPool();
    const [rows] = await pool.query(`
      SELECT sender_id, content, timestamp 
      FROM messages 
      WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
      ORDER BY timestamp ASC LIMIT 30
    `, [req.user.id, userId, userId, req.user.id]);
    
    const [userRow] = await pool.query('SELECT username FROM users WHERE id = ?', [userId]);
    const friendName = userRow[0]?.username || 'Friend';
    
    const history = rows.map(m => ({
      sender: Number(m.sender_id) === Number(req.user.id) ? 'You' : friendName,
      content: m.content
    }));
    
    const summary = await summarizeConversation(history);
    res.json({ summary });
  } catch (err) {
    console.error('Summarization error:', err);
    res.status(500).json({ error: 'Failed to summarize chat' });
  }
});

app.post('/api/friends/add', authenticateToken, async (req, res) => {
  const { friendId } = req.body;
  if (!friendId) return res.status(400).json({ error: 'friendId required' });

  try {
    const pool = getPool();
    // Check if already friends
    const [existing] = await pool.query('SELECT * FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)', 
      [req.user.id, friendId, friendId, req.user.id]);
    
    if (existing.length > 0) return res.status(400).json({ error: 'Already friends' });

    await pool.query('INSERT INTO friends (user_id, friend_id) VALUES (?, ?)', [req.user.id, friendId]);
    res.json({ message: 'Friend added' });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/messages/:user1/:user2', async (req, res) => {
  const u1 = req.params.user1;
  const u2 = req.params.user2;
  const beforeId = req.query.beforeId ? parseInt(req.query.beforeId) : null;
  const limit = req.query.limit ? parseInt(req.query.limit) : 30;

  try {
    const pool = getPool();
    let query = `
      SELECT m.*, p.content as parent_content, p.sender_id as parent_sender_id, u.username as parent_sender_name
      FROM messages m
      LEFT JOIN messages p ON m.reply_to = p.id
      LEFT JOIN users u ON p.sender_id = u.id
      WHERE ((m.sender_id = ? AND m.receiver_id = ? AND m.deleted_for_sender = false) 
         OR (m.sender_id = ? AND m.receiver_id = ? AND m.deleted_for_receiver = false))
    `;
    const params = [u1, u2, u2, u1];

    if (beforeId) {
      query += ` AND m.id < ?`;
      params.push(beforeId);
    }

    query += ` ORDER BY m.id DESC LIMIT ?`;
    params.push(limit);

    const [rows] = await pool.query(query, params);
    
    // Reverse back to ascending time order
    res.json(rows.reverse());
  } catch (error) {
    console.error('Paginated query failed:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/api/messages/:user1/:user2', async (req, res) => {
  const { user1, user2 } = req.params;
  try {
    const pool = getPool();
    // 1. Find all messages with files to delete physical files
    const [rows] = await pool.query(
      'SELECT file_url FROM messages WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)',
      [user1, user2, user2, user1]
    );

    const uploadsDir = path.resolve(__dirname, 'uploads');
    for (const msg of rows) {
      if (msg.file_url && !msg.file_url.startsWith('http')) {
        const safeFilePath = path.resolve(uploadsDir, path.basename(msg.file_url));
        if (safeFilePath.startsWith(uploadsDir) && fs.existsSync(safeFilePath)) {
          fs.unlinkSync(safeFilePath);
        }
      }
    }

    // 2. Delete from DB
    await pool.query(
      'DELETE FROM messages WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)',
      [user1, user2, user2, user1]
    );
    res.json({ message: 'Chat history cleared' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/messages/:id/delete', async (req, res) => {
  const { id } = req.params;
  const { userId, type } = req.body; // type: 'me' or 'everyone'
  
  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM messages WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Message not found' });
    
    const msg = rows[0];

    if (type === 'everyone') {
      // Hard delete (only if requester is sender)
      if (msg.sender_id !== userId) return res.status(403).json({ error: 'Only sender can delete for everyone' });
      
      if (msg.file_url && !msg.file_url.startsWith('http')) {
        const uploadsDir = path.resolve(__dirname, 'uploads');
        const safeFilePath = path.resolve(uploadsDir, path.basename(msg.file_url));
        if (safeFilePath.startsWith(uploadsDir) && fs.existsSync(safeFilePath)) {
          fs.unlinkSync(safeFilePath);
        }
      }
      await pool.query('DELETE FROM messages WHERE id = ?', [id]);
      io.emit('message_deleted', { messageId: parseInt(id), sender_id: msg.sender_id, receiver_id: msg.receiver_id });
    } else {
      // Delete for me (soft delete)
      if (msg.sender_id === userId) {
        await pool.query('UPDATE messages SET deleted_for_sender = true WHERE id = ?', [id]);
      } else {
        await pool.query('UPDATE messages SET deleted_for_receiver = true WHERE id = ?', [id]);
      }
    }
    
    res.json({ message: 'Message deleted' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const pool = getPool();
    
    // 1. Fetch all messages involving this user to delete physical files
    const [rows] = await pool.query('SELECT file_url FROM messages WHERE sender_id = ? OR receiver_id = ?', [id, id]);
    const uploadsDir = path.resolve(__dirname, 'uploads');
    for (const msg of rows) {
      if (msg.file_url && !msg.file_url.startsWith('http')) {
        const safeFilePath = path.resolve(uploadsDir, path.basename(msg.file_url));
        if (safeFilePath.startsWith(uploadsDir) && fs.existsSync(safeFilePath)) {
          fs.unlinkSync(safeFilePath);
        }
      }
    }

    // 2. Delete all messages for this user from DB
    await pool.query('DELETE FROM messages WHERE sender_id = ? OR receiver_id = ?', [id, id]);
    // 3. Delete the user
    await pool.query('DELETE FROM users WHERE id = ?', [id]);
    
    // Notify all clients to remove this user from their lists
    io.emit('user_deleted', { userId: parseInt(id) });
    
    res.json({ message: 'Account deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Socket.io logic
const connectedUsersMap = new Map();
const connectedUsers = {
  set(userId, socketId) {
    if (userId !== undefined && userId !== null) {
      connectedUsersMap.set(Number(userId), socketId);
    }
  },
  get(userId) {
    if (userId !== undefined && userId !== null) {
      return connectedUsersMap.get(Number(userId));
    }
    return undefined;
  },
  delete(userId) {
    if (userId !== undefined && userId !== null) {
      return connectedUsersMap.delete(Number(userId));
    }
    return false;
  },
  has(userId) {
    if (userId !== undefined && userId !== null) {
      return connectedUsersMap.has(Number(userId));
    }
    return false;
  }
};

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('join', async (userId) => {
    // Secure verification check
    if (Number(userId) !== Number(socket.userId)) {
      console.error(`Blocked unauthorized join: socket user ${socket.userId} attempted to join as user ${userId}`);
      return;
    }
    connectedUsers.set(userId, socket.id);

    // Update DB
    try {
      const pool = getPool();
      await pool.query('UPDATE users SET online = true WHERE id = ?', [userId]);
      
      // Get friends to notify
      const [friends] = await pool.query(`
        SELECT CASE WHEN user_id = ? THEN friend_id ELSE user_id END as friend_id 
        FROM friends WHERE user_id = ? OR friend_id = ?
      `, [userId, userId, userId]);

      friends.forEach(f => {
        const friendSocketId = connectedUsers.get(f.friend_id);
        if (friendSocketId) {
          io.to(friendSocketId).emit('user_status_change', { userId, online: true });
        }
      });
      
    } catch(err) {
      console.error(err);
    }
  });

  socket.on('send_message', async (data) => {
    // data: { sender_id, receiver_id, content, type, file_url, correlationId, reply_to, is_forwarded }
    try {
      const pool = getPool();
      
      // Save sender's message in DB
      const [result] = await pool.query(
        'INSERT INTO messages (sender_id, receiver_id, content, type, file_url, reply_to, is_forwarded) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [data.sender_id, data.receiver_id, data.content, data.type || 'text', data.file_url || null, data.reply_to || null, data.is_forwarded || false]
      );
      
      // Fetch full message with parent info if it's a reply
      let parentInfo = {};
      if (data.reply_to) {
        const [pRows] = await pool.query('SELECT m.content, u.username FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.id = ?', [data.reply_to]);
        if (pRows.length > 0) {
          parentInfo = {
            parent_content: pRows[0].content,
            parent_sender_name: pRows[0].username
          }
        }
      }

      const newMsg = {
        id: result.insertId,
        ...data,
        ...parentInfo,
        timestamp: new Date()
      };

      // Send back to sender with correlationId for UI sync immediately
      socket.emit('message_sent', {
        ...newMsg,
        correlationId: data.correlationId
      });

      // Detect if receiver is the persistent AI chatbot assistant
      const [aiUser] = await pool.query('SELECT id FROM users WHERE samvad_id = ?', ['ai#9999']);
      const aiId = aiUser[0]?.id;

      if (aiId && Number(data.receiver_id) === Number(aiId)) {
        // Trigger simulated typing indicator from the AI assistant
        socket.emit('user_typing', { userId: aiId });

        // Retrieve last 5 messages for context
        const [historyRows] = await pool.query(`
          SELECT sender_id, content FROM messages 
          WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
          ORDER BY timestamp DESC LIMIT 6
        `, [data.sender_id, aiId, aiId, data.sender_id]);

        const history = historyRows.reverse().map(m => ({
          is_ai: Number(m.sender_id) === Number(aiId),
          content: m.content
        }));

        // Generate response with natural 1-1.5s delay
        setTimeout(async () => {
          try {
            const replyText = await getAssistantReply(history, data.content);
            
            // Insert AI message into database
            const [aiResult] = await pool.query(
              'INSERT INTO messages (sender_id, receiver_id, content, type, status) VALUES (?, ?, ?, ?, ?)',
              [aiId, data.sender_id, replyText, 'text', 'read']
            );
            
            const aiMsg = {
              id: aiResult.insertId,
              sender_id: aiId,
              receiver_id: data.sender_id,
              content: replyText,
              type: 'text',
              status: 'read',
              timestamp: new Date()
            };
            
            // Stop typing and push bot message to sender
            socket.emit('user_stopped_typing', { userId: aiId });
            socket.emit('receive_message', aiMsg);
          } catch (aiErr) {
            console.error('AI chatbot generation error:', aiErr);
            socket.emit('user_stopped_typing', { userId: aiId });
          }
        }, 1200);

        return;
      }

      // Standard message delivery for real users
      const receiverSocketId = connectedUsers.get(data.receiver_id);
      if (receiverSocketId) {
        await pool.query('UPDATE messages SET status = ? WHERE id = ?', ['delivered', result.insertId]);
        newMsg.status = 'delivered';
        io.to(receiverSocketId).emit('receive_message', newMsg);
      } else {
        newMsg.status = 'sent';
      }

    } catch (err) {
      console.error('Error saving message:', err);
    }
  });

  socket.on('react_message', async (data) => {
    try {
      const pool = getPool();
      const reactorId = data.reaction ? socket.userId : null;
      await pool.query('UPDATE messages SET reaction = ?, react_user_id = ? WHERE id = ?', [data.reaction, reactorId, data.messageId]);
      
      const reactionData = {
        messageId: data.messageId,
        reaction: data.reaction,
        react_user_id: reactorId
      };
      
      const receiverSocketId = connectedUsers.get(data.receiver_id);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('message_reaction', reactionData);
      }
      
      socket.emit('message_reaction', reactionData);
    } catch (err) {
      console.error('Error adding reaction:', err);
    }
  });

  socket.on('pin_message', async (data) => {
    try {
      const pool = getPool();
      await pool.query('UPDATE messages SET is_pinned = ? WHERE id = ?', [data.isPinned, data.messageId]);
      
      const pinData = {
        messageId: data.messageId,
        isPinned: data.isPinned
      };
      
      const receiverSocketId = connectedUsers.get(data.receiver_id);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('message_pinned', pinData);
      }
      socket.emit('message_pinned', pinData);
    } catch (err) {
      console.error('Error pinning message:', err);
    }
  });

  socket.on('typing', (data) => {
    // data: { receiver_id }
    const receiverSocketId = connectedUsers.get(data.receiver_id);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('user_typing', { userId: socket.userId });
    }
  });

  socket.on('stop_typing', (data) => {
    const receiverSocketId = connectedUsers.get(data.receiver_id);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('user_stopped_typing', { userId: socket.userId });
    }
  });

  socket.on('mark_messages_read', async (data) => {
    // data: { sender_id, receiver_id }
    // sender_id is the person who originally sent the message, receiver_id is the one reading it right now.
    try {
      const pool = getPool();
      await pool.query(
        'UPDATE messages SET status = ? WHERE sender_id = ? AND receiver_id = ? AND status != ?',
        ['read', data.sender_id, data.receiver_id, 'read']
      );
      
      const senderSocketId = connectedUsers.get(data.sender_id);
      if (senderSocketId) {
        io.to(senderSocketId).emit('messages_read', { receiver_id: data.receiver_id });
      }
    } catch (err) {
      console.error('Error marking read:', err);
    }
  });

  // ── WebRTC Call Signaling ──────────────────────────────────────
  socket.on('call_user', ({ to, signal, callType }) => {
    const receiverSocketId = connectedUsers.get(to);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('incoming_call', {
        from: socket.userId,
        signal,
        callType
      });
    }
  });

  socket.on('accept_call', ({ to, signal }) => {
    const callerSocketId = connectedUsers.get(to);
    if (callerSocketId) {
      io.to(callerSocketId).emit('call_accepted', { signal });
    }
  });

  socket.on('reject_call', ({ to }) => {
    const callerSocketId = connectedUsers.get(to);
    if (callerSocketId) {
      io.to(callerSocketId).emit('call_rejected');
    }
  });

  socket.on('end_call', ({ to }) => {
    const otherSocketId = connectedUsers.get(to);
    if (otherSocketId) {
      io.to(otherSocketId).emit('call_ended');
    }
  });

  socket.on('ice_candidate', ({ to, candidate }) => {
    const otherSocketId = connectedUsers.get(to);
    if (otherSocketId) {
      io.to(otherSocketId).emit('ice_candidate', { candidate });
    }
  });
  // ──────────────────────────────────────────────────────────────

  socket.on('disconnect', async () => {
    console.log('User disconnected:', socket.id);
    if (socket.userId) {
      const userId = socket.userId;
      connectedUsers.delete(userId);
      try {
        const pool = getPool();
        const now = new Date();
        await pool.query('UPDATE users SET online = false, last_seen = ? WHERE id = ?', [now, userId]);
        
        // Get friends to notify
        const [friends] = await pool.query(`
          SELECT CASE WHEN user_id = ? THEN friend_id ELSE user_id END as friend_id 
          FROM friends WHERE user_id = ? OR friend_id = ?
        `, [userId, userId, userId]);

        friends.forEach(f => {
          const friendSocketId = connectedUsers.get(f.friend_id);
          if (friendSocketId) {
            io.to(friendSocketId).emit('user_status_change', { userId, online: false, last_seen: now });
          }
        });
      } catch(err) {
        console.error(err);
      }
    }
  });
});

// Catch-all route to serve the frontend index.html for any unknown routes
// This MUST be the last route in your app
app.get('*any', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

const PORT = process.env.PORT || 3000;
initDB().then(() => {
  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});
