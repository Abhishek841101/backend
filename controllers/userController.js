

// controllers/UserController.js
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import UserModel from "../models/User.js";
import MessageModel from "../models/Message.js";
import transporter from "../config/emailConfig.js"; // optional for reset email

class UserController {

  // ===================== REGISTER =====================
  static userRegistration = async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).send({ status: "failed", message: "All fields are required" });
    }

    try {
      const existingUser = await UserModel.findOne({ email });
      if (existingUser) {
        return res.status(400).send({ status: "failed", message: "Email already exists" });
      }

      const salt = await bcrypt.genSalt(10);
      const hashPassword = await bcrypt.hash(password, salt);

      const newUser = new UserModel({
        username,
        email,
        password: hashPassword,
      });

      // ✅ Mark user online immediately on registration
      newUser.isOnline = true;
      newUser.lastActive = new Date();

      await newUser.save();

      const token = jwt.sign({ userID: newUser._id }, process.env.JWT_SECRET_KEY, { expiresIn: "5d" });

      res.status(201).send({
        status: "success",
        message: "Registration Successful",
        user: {
          _id: newUser._id,
          username: newUser.username,
          email: newUser.email,
          isOnline: newUser.isOnline,
          lastActive: newUser.lastActive,
        },
        token,
      });
    } catch (error) {
      console.error(error);
      res.status(500).send({ status: "failed", message: "Unable to register" });
    }
  };

  // ===================== LOGIN =====================
  static userLogin = async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).send({ status: "failed", message: "All fields are required" });
      }

      const user = await UserModel.findOne({ email });
      if (!user || !user.password) {
        return res.status(400).send({ status: "failed", message: "Invalid email or password" });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).send({ status: "failed", message: "Invalid email or password" });
      }

      // ✅ Mark user online immediately on login
      user.isOnline = true;
      user.lastActive = new Date();
      await user.save();

      const token = jwt.sign({ userID: user._id }, process.env.JWT_SECRET_KEY, { expiresIn: "5d" });

      res.status(200).send({
        status: "success",
        message: "Login successful",
        user: {
          _id: user._id,
          username: user.username,
          email: user.email,
          isOnline: user.isOnline,
          lastActive: user.lastActive,
        },
        token,
      });
    } catch (error) {
      console.error(error);
      res.status(500).send({ status: "failed", message: "Unable to login" });
    }
  };

  // ===================== LOGOUT =====================
  static userLogout = async (req, res) => {
    try {
      const userId = req.user._id;
      await UserModel.findByIdAndUpdate(userId, { isOnline: false, lastActive: new Date() });
      res.status(200).send({ status: "success", message: "Logged out successfully" });
    } catch (error) {
      console.error(error);
      res.status(500).send({ status: "failed", message: "Logout failed" });
    }
  };

  // ===================== CHANGE PASSWORD =====================
  static changeUserPassword = async (req, res) => {
    const { password, password_confirmation } = req.body;

    if (!password || !password_confirmation) {
      return res.status(400).send({ status: "failed", message: "All fields are required" });
    }

    if (password !== password_confirmation) {
      return res.status(400).send({ status: "failed", message: "New password and confirm password do not match" });
    }

    try {
      const salt = await bcrypt.genSalt(10);
      const hashPassword = await bcrypt.hash(password, salt);
      await UserModel.findByIdAndUpdate(req.user._id, { $set: { password: hashPassword } });

      res.status(200).send({ status: "success", message: "Password changed successfully" });
    } catch (error) {
      console.error(error);
      res.status(500).send({ status: "failed", message: "Unable to change password" });
    }
  };

  // ===================== GET LOGGED USER =====================
  static loggedUser = async (req, res) => {
    try {
      const user = await UserModel.findById(req.user._id).select("-password");
      res.send({ status: "success", user });
    } catch (error) {
      console.error(error);
      res.status(500).send({ status: "failed", message: "Unable to fetch user" });
    }
  };

  // ===================== SEND PASSWORD RESET EMAIL =====================
  static sendUserPasswordResetEmail = async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).send({ status: "failed", message: "Email field is required" });

    try {
      const user = await UserModel.findOne({ email });
      if (!user) return res.status(404).send({ status: "failed", message: "Email does not exist" });

      const secret = user._id + process.env.JWT_SECRET_KEY;
      const token = jwt.sign({ userID: user._id }, secret, { expiresIn: "15m" });
      const link = `http://:3000/api/user/reset/${user._id}/${token}`;

      console.log("Reset Link:", link); // replace with transporter.sendMail in production

      res.status(200).send({ status: "success", message: "Password reset email sent. Check your email." });
    } catch (error) {
      console.error(error);
      res.status(500).send({ status: "failed", message: "Unable to send reset email" });
    }
  };

  // ===================== RESET PASSWORD =====================
  static userPasswordReset = async (req, res) => {
    const { password, password_confirmation } = req.body;
    const { id, token } = req.params;

    try {
      const user = await UserModel.findById(id);
      if (!user) return res.status(404).send({ status: "failed", message: "User not found" });

      const secret = user._id + process.env.JWT_SECRET_KEY;
      jwt.verify(token, secret);

      if (!password || !password_confirmation) return res.status(400).send({ status: "failed", message: "All fields are required" });
      if (password !== password_confirmation) return res.status(400).send({ status: "failed", message: "New password and confirm password do not match" });

      const salt = await bcrypt.genSalt(10);
      const hashPassword = await bcrypt.hash(password, salt);
      await UserModel.findByIdAndUpdate(user._id, { $set: { password: hashPassword } });

      res.status(200).send({ status: "success", message: "Password reset successfully" });
    } catch (error) {
      console.error(error);
      res.status(400).send({ status: "failed", message: "Invalid or expired token" });
    }
  };

  // ===================== GET ALL USERS =====================
  // static getAllUsers = async (req, res) => {
  //   try {
  //     const loggedInUserId = req.user._id;

  //     // Find all users except the logged-in user
  //     const users = await UserModel.find(
  //       { _id: { $ne: loggedInUserId } },
  //       "-password"
  //     );

  //     // Fetch last message and unread count for each user
  //     const usersWithLastMessage = await Promise.all(
  //       users.map(async (user) => {
  //         // Last message
  //         const lastMessage = await MessageModel.findOne({
  //           $or: [
  //             { sender: loggedInUserId, receiver: user._id },
  //             { sender: user._id, receiver: loggedInUserId },
  //           ],
  //         })
  //           .sort({ timestamp: -1 })
  //           .limit(1);

  //         // Unread messages count
  //         const unreadCount = await MessageModel.countDocuments({
  //           sender: user._id,
  //           receiver: loggedInUserId,
  //           readBy: { $ne: loggedInUserId },
  //         });

  //         return {
  //           ...user.toObject(),
  //           lastMessage: lastMessage ? lastMessage.content : null,
  //           lastMessageTime: lastMessage ? lastMessage.timestamp : null,
  //           unreadCount,
  //         };
  //       })
  //     );

  //     res.status(200).send({
  //       status: "success",
  //       message: "Users fetched successfully",
  //       users: usersWithLastMessage,
  //     });
  //   } catch (error) {
  //     console.error(error);
  //     res
  //       .status(500)
  //       .send({ status: "failed", message: "Unable to fetch users" });
  //   }
  // };
}

export default UserController;
