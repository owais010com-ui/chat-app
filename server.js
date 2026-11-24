import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server as SocketIo } from "socket.io";
import { userModel, messageModel } from "./model.js";
import authApis from "./apis/auth.js";
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 5000;
const SECRET = process.env.JWT_SECRET;

const app = express();
app.set("trust proxy", 1);
app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: true, credentials: true }));
app.use(express.static(path.join(__dirname, "public")));

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log(err));

// Public APIs: signup, login, logout, forget-password, reset-password
app.use("/api/v1", authApis);

// Token check - iske baad ki sab APIs protected hain
app.use("/api/v1", (req, res, next) => {
  const token = req.cookies?.Token;
  if (!token) return res.status(401).send({ message: "Unauthorized" });

  jwt.verify(token, SECRET, (err, decoded) => {
    if (err) {
      res.clearCookie("Token");
      return res.status(401).send({ message: "Token invalid ya expire" });
    }
    req.user = { _id: decoded._id, firstName: decoded.firstName, lastName: decoded.lastName, email: decoded.email };
    next();
  });
});

app.get("/api/v1/me", (req, res) => {
  res.send({ user: req.user });
});

app.get("/api/v1/users", async (req, res) => {
  try {
    const users = await userModel.find({ _id: { $ne: req.user._id } }, "firstName lastName email");
    res.send({ users });
  } catch (error) {
    res.status(500).send({ message: "Internal Server Error" });
  }
});

app.post("/api/v1/chat/:id", async (req, res) => {
  const receiverId = req.params.id;
  const senderId = req.user._id;
  const text = req.body?.message?.trim();
  if (!text) return res.status(400).send({ message: "Message likho" });

  try {
    const created = await messageModel.create({ from: senderId, to: receiverId, message: text });
    const chat = await messageModel
      .findById(created._id)
      .populate({ path: "from", select: "firstName lastName email" })
      .populate({ path: "to", select: "firstName lastName email" });

    io.to(receiverId).emit("message", chat); // samne wale ko live
    io.to(senderId).emit("message", chat); // apni dusri tabs ko bhi
    res.send({ message: "Message Sent", chat });
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

// Purani chat (reload par bhi wapas aa jati hai)
app.get("/api/v1/conversation/:id", async (req, res) => {
  const otherId = req.params.id;
  const myId = req.user._id;
  try {
    const conversations = await messageModel
      .find({
        $or: [
          { from: otherId, to: myId },
          { from: myId, to: otherId },
        ],
      })
      .sort({ createdOn: 1 })
      .populate({ path: "from", select: "firstName lastName email" })
      .populate({ path: "to", select: "firstName lastName email" });
    res.send({ conversations });
  } catch (error) {
    res.status(500).send({ message: "Internal Server Error" });
  }
});

const server = createServer(app);
const io = new SocketIo(server, { cors: { origin: true, credentials: true } });

// Socket par bhi token check, phir user apne room mein join
io.use((socket, next) => {
  const cookie = socket.handshake.headers.cookie || "";
  const match = cookie.match(/Token=([^;]+)/);
  if (!match) return next(new Error("Unauthorized"));
  jwt.verify(match[1], SECRET, (err, decoded) => {
    if (err) return next(new Error("Unauthorized"));
    socket.userId = decoded._id;
    next();
  });
});

io.on("connection", (socket) => {
  socket.join(socket.userId);
});

server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
