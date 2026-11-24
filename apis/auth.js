import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { userModel } from "../model.js";

const router = express.Router();
const SECRET = process.env.JWT_SECRET;

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
};

router.post("/signup", async (req, res) => {
  const { firstName, lastName, email, password } = req.body;
  if (!firstName || !lastName || !email || !password) {
    return res.status(400).send({ message: "Sab fields zaroori hain" });
  }
  try {
    const exists = await userModel.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(400).send({ message: "Email pehle se maujood hai" });

    const hash = await bcrypt.hash(password, 10);
    await userModel.create({ firstName, lastName, email, password: hash });
    res.send({ message: "Signup ho gaya" });
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).send({ message: "Email aur password zaroori hain" });
  }
  try {
    const user = await userModel.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).send({ message: "Email ya password ghalat hai" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).send({ message: "Email ya password ghalat hai" });

    const token = jwt.sign(
      { _id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email },
      SECRET,
      { expiresIn: "24h" }
    );
    res.cookie("Token", token, { ...cookieOptions, maxAge: 24 * 60 * 60 * 1000 });
    res.send({
      message: "Login ho gaya",
      user: { _id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email },
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

// LOGOUT
router.post("/logout", (req, res) => {
  res.clearCookie("Token", cookieOptions);
  res.send({ message: "Logout ho gaya" });
});

// FORGET PASSWORD - 6 digit OTP banata hai
// Basic version: email nahi bhejta, OTP server console mein print hota hai
router.post("/forget-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).send({ message: "Email zaroori hai" });
  try {
    const user = await userModel.findOne({ email: email.toLowerCase() });
    if (user) {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      user.resetOtp = otp;
      user.resetOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
      await user.save();
      console.log(`OTP for ${user.email}: ${otp}`);
    }
    res.send({ message: "Agar email maujood hai to OTP bhej diya gaya (10 min valid)" });
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

// RESET PASSWORD
router.post("/reset-password", async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) {
    return res.status(400).send({ message: "Email, OTP aur new password zaroori hain" });
  }
  try {
    const user = await userModel.findOne({ email: email.toLowerCase() });
    if (!user || user.resetOtp !== otp || !user.resetOtpExpires || user.resetOtpExpires < new Date()) {
      return res.status(400).send({ message: "OTP ghalat ya expire ho gaya" });
    }
    user.password = await bcrypt.hash(newPassword, 10);
    user.resetOtp = undefined;
    user.resetOtpExpires = undefined;
    await user.save();
    res.send({ message: "Password change ho gaya, ab login karo" });
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

export default router;
