const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 2,
      maxlength: 30,
    },
    password: {
      type: String,
      required: true,
    },
  },
  { timestamps: true, collection: 'chat_users' }
);

module.exports = mongoose.model('User', userSchema);
