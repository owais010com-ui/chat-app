require('dotenv').config();
const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { Server } = require('socket.io');

const { connectDB } = require('./db');
const { verifyToken } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const messageRoutes = require('./routes/messages');
const Message = require('./models/Message');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.set('io', io);
app.use(cors());
app.use(express.json());

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ ok: true, dbState: mongoose.connection.readyState });
});
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);

// Track online users: userId -> count of open tabs/sockets
const onlineCounts = new Map();

function broadcastOnlineUsers() {
  io.emit('online_users', Array.from(onlineCounts.keys()));
}

// Authenticate Socket.io connections using the same JWT token
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error('Authentication required'));
  }
  try {
    socket.user = verifyToken(token);
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  const userId = socket.user.id;

  // Join a personal room named after userId so messages reach all active tabs of that user
  socket.join(userId);
  onlineCounts.set(userId, (onlineCounts.get(userId) || 0) + 1);
  broadcastOnlineUsers();

  socket.on('send_message', async ({ receiverId, text }, callback) => {
    try {
      const cleanText = typeof text === 'string' ? text.trim() : '';
      if (!cleanText || !mongoose.Types.ObjectId.isValid(receiverId)) {
        if (callback) callback({ ok: false, error: 'Invalid message or receiver.' });
        return;
      }

      const saved = await Message.create({
        sender: userId,
        receiver: receiverId,
        text: cleanText,
      });

      const payload = {
        id: saved._id.toString(),
        sender: saved.sender.toString(),
        receiver: saved.receiver.toString(),
        text: saved.text,
        createdAt: saved.createdAt,
      };

      io.to(receiverId).to(userId).emit('receive_message', payload);
      if (callback) callback({ ok: true, message: payload });
    } catch (err) {
      console.error('send_message error:', err);
      if (callback) callback({ ok: false, error: 'Failed to send message.' });
    }
  });

  socket.on('disconnect', () => {
    const count = (onlineCounts.get(userId) || 1) - 1;
    if (count <= 0) {
      onlineCounts.delete(userId);
    } else {
      onlineCounts.set(userId, count);
    }
    broadcastOnlineUsers();
  });
});

// Serve React frontend build in production (e.g., on Railway)
const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
