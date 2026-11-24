import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  resetOtp: String,
  resetOtpExpires: Date,
  createdOn: { type: Date, default: Date.now },
});

const messageSchema = new mongoose.Schema({
  from: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
  to: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
  message: { type: String, required: true },
  createdOn: { type: Date, default: Date.now },
});

export const userModel = mongoose.model("users", userSchema);
export const messageModel = mongoose.model("messages", messageSchema);
