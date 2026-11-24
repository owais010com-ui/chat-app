const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { signToken, authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Register a new user
router.post('/register', async (req, res) => {
  try {
    const username = (req.body.username || '').trim();
    const password = req.body.password || '';

    if (username.length < 2) {
      return res.status(400).json({ message: 'Username must be at least 2 characters.' });
    }
    if (password.length < 4) {
      return res.status(400).json({ message: 'Password must be at least 4 characters.' });
    }

    const existing = await User.findOne({ username });
    if (existing) {
      return res.status(409).json({ message: 'Username already taken. Try logging in.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ username, password: hashedPassword });

    const userData = { id: user._id.toString(), username: user.username };
    const token = signToken(user);

    // Notify connected clients so the new user appears in their chat list right away
    const io = req.app.get('io');
    if (io) {
      io.emit('user_registered', userData);
    }

    res.status(201).json({ token, user: userData });
  } catch (err) {
    console.error('Register error:', err);
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Username already taken. Try logging in.' });
    }
    res.status(500).json({ message: `Could not register user: ${err.message}` });
  }
});

// Login an existing user
router.post('/login', async (req, res) => {
  try {
    const username = (req.body.username || '').trim();
    const password = req.body.password || '';

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required.' });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    const userData = { id: user._id.toString(), username: user.username };
    const token = signToken(user);

    res.json({ token, user: userData });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Could not log in.' });
  }
});

// Get all other users so the logged-in user can pick someone to chat with
router.get('/users', authMiddleware, async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user.id } })
      .select('_id username')
      .sort({ username: 1 })
      .lean();

    res.json(
      users.map((u) => ({
        id: u._id.toString(),
        username: u.username,
      }))
    );
  } catch (err) {
    console.error('Users fetch error:', err);
    res.status(500).json({ message: 'Could not load users.' });
  }
});

module.exports = router;
