const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { initDB, getPool } = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
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

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, uniqueFileName = uniqueSuffix + '-' + file.originalname)
  }
});
const upload = multer({ storage: storage });

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).send({ error: 'No file uploaded.' });
  }
  // Return the file URL
  res.json({ url: `/uploads/${req.file.filename}`, type: req.file.mimetype });
});

app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !password || !email) return res.status(400).json({ error: 'Username, email and password required' });

  try {
    const pool = getPool();
    let [rows] = await pool.query('SELECT * FROM users WHERE username = ? OR email = ?', [username, email]);
    if (rows.length > 0) return res.status(400).json({ error: 'Username or email already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await pool.query('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, hashedPassword]);
    
    const [newRows] = await pool.query('SELECT id, username, email, online, profile_pic, about, last_seen, created_at FROM users WHERE id = ?', [result.insertId]);
    res.json(newRows[0]);
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
    let [rows] = await pool.query('SELECT * FROM users WHERE username = ? OR email = ?', [identifier, identifier]);
    
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    const user = rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password);
    
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    console.error(error);
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
      updateQuery += ', profile_pic = ?';
      params.push(`/uploads/${file.filename}`);
    }
    
    updateQuery += ' WHERE id = ?';
    params.push(id);
    
    await pool.query(updateQuery, params);
    
    const [rows] = await pool.query('SELECT id, username, email, online, profile_pic, about, last_seen, created_at FROM users WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT id, username, online, profile_pic, about, last_seen FROM users ORDER BY username ASC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/messages/:user1/:user2', async (req, res) => {
  const u1 = req.params.user1;
  const u2 = req.params.user2;

  try {
    const pool = getPool();
    const [rows] = await pool.query(`
      SELECT m.*, p.content as parent_content, p.sender_id as parent_sender_id, u.username as parent_sender_name
      FROM messages m
      LEFT JOIN messages p ON m.reply_to = p.id
      LEFT JOIN users u ON p.sender_id = u.id
      WHERE (m.sender_id = ? AND m.receiver_id = ? AND m.deleted_for_sender = false) 
         OR (m.sender_id = ? AND m.receiver_id = ? AND m.deleted_for_receiver = false)
      ORDER BY m.timestamp ASC
    `, [u1, u2, u2, u1]);
    
    res.json(rows);
  } catch (error) {
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

    for (const msg of rows) {
      if (msg.file_url) {
        const filePath = path.join(__dirname, msg.file_url);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
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
      
      if (msg.file_url) {
        const filePath = path.join(__dirname, msg.file_url);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
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
    for (const msg of rows) {
      if (msg.file_url) {
        const filePath = path.join(__dirname, msg.file_url);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
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
const connectedUsers = new Map(); // userId -> socketId

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('join', async (userId) => {
    connectedUsers.set(userId, socket.id);
    socket.userId = userId;

    // Update DB
    try {
      const pool = getPool();
      await pool.query('UPDATE users SET online = true WHERE id = ?', [userId]);
      io.emit('user_status_change', { userId, online: true });
      
      // Update any pending delivered messages to the user if needed (can be handled by mark_messages_read from client)
    } catch(err) {
      console.error(err);
    }
  });

  socket.on('send_message', async (data) => {
    // data: { sender_id, receiver_id, content, type, file_url, correlationId, reply_to, is_forwarded }
    try {
      const pool = getPool();
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

      // Send to receiver if online
      const receiverSocketId = connectedUsers.get(data.receiver_id);
      if (receiverSocketId) {
        // Assume delivered if online
        await pool.query('UPDATE messages SET status = ? WHERE id = ?', ['delivered', result.insertId]);
        newMsg.status = 'delivered';
        io.to(receiverSocketId).emit('receive_message', newMsg);
      } else {
        newMsg.status = 'sent';
      }
      
      // Send back to sender with correlationId for UI sync
      socket.emit('message_sent', {
        ...newMsg,
        correlationId: data.correlationId
      });

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

  socket.on('disconnect', async () => {
    console.log('User disconnected:', socket.id);
    if (socket.userId) {
      connectedUsers.delete(socket.userId);
      try {
        const pool = getPool();
        const now = new Date();
        await pool.query('UPDATE users SET online = false, last_seen = ? WHERE id = ?', [now, socket.userId]);
        io.emit('user_status_change', { userId: socket.userId, online: false, last_seen: now });
      } catch(err) {
        console.error(err);
      }
    }
  });
});

// Catch-all route to serve the frontend index.html for any unknown routes
// This MUST be the last route in your app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

const PORT = process.env.PORT || 3000;
initDB().then(() => {
  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});
