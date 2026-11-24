const express = require('express');
const mongoose = require('mongoose');
const Message = require('../models/Message');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Get chat history between logged-in user and :otherUserId
router.get('/:otherUserId', authMiddleware, async (req, res) => {
  try {
    const myId = req.user.id;
    const { otherUserId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
      return res.status(400).json({ message: 'Invalid user ID.' });
    }

    const messages = await Message.find({
      $or: [
        { sender: myId, receiver: otherUserId },
        { sender: otherUserId, receiver: myId },
      ],
    })
      .sort({ createdAt: 1 })
      .lean();

    res.json(
      messages.map((m) => ({
        id: m._id.toString(),
        sender: m.sender.toString(),
        receiver: m.receiver.toString(),
        text: m.text,
        createdAt: m.createdAt,
      }))
    );
  } catch (err) {
    console.error('Messages fetch error:', err);
    res.status(500).json({ message: 'Could not load messages.' });
  }
});

module.exports = router;
