// controllers/shareController.js

import Share from "../models/Share.js";
import User from "../models/User.js";
import Post from "../models/Post.js";

export const sharePost = async (req, res) => {
  try {
    const { senderId, receiverId, postId, message } = req.body;

    const sender = await User.findById(senderId);
    const receiver = await User.findById(receiverId);
    const post = await Post.findById(postId);

    if (!sender || !receiver || !post)
      return res.status(404).json({ message: "Invalid data" });

    const link = `${process.env.APP_URL}/post/${postId}`;

    const newShare = new Share({
      sender: senderId,
      receiver: receiverId,
      post: postId,
      message,
      link,
    });

    await newShare.save();

    // 🔴 Real-time share event
    if (req.io) {
      req.io.to(receiverId).emit("receive_share", newShare);
    }

    res.status(201).json({ success: true, share: newShare });
  } catch (error) {
    console.error("Share Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ✅ Get shares RECEIVED by user
export const getReceivedShares = async (req, res) => {
  try {
    const { userId } = req.params;
    const shares = await Share.find({ receiver: userId })
      .populate("sender", "username profilePic")
      .populate("post", "image caption");
    res.status(200).json(shares);
  } catch (error) {
    console.error("Get Shares Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ✅ NEW: Get shares SENT by user
export const getSentShares = async (req, res) => {
  try {
    const { userId } = req.params;
    const shares = await Share.find({ sender: userId })
      .populate("receiver", "username profilePic")
      .populate("post", "image caption");
    res.status(200).json(shares);
  } catch (error) {
    console.error("Get Sent Shares Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
