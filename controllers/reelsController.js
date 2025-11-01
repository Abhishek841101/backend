
// controllers/reelsController.js

import Reel from "../models/Reel.js";
import Follow from "../models/Follow.js";
import User from "../models/User.js";
import { sendNotification } from "../utils/sendNotification.js";

// ---------------------- UPLOAD REEL ----------------------
export const uploadReel = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(400).json({ message: "Auth required" });
    if (!req.file) return res.status(400).json({ message: "No video uploaded" });

    const folder = req.file.destination.replace(/\\/g, "/");
    const videoUrl = `${req.protocol}://${req.get("host")}/${folder}/${req.file.filename}`;

    const uploader = await User.findById(user._id).select("username");
    if (!uploader) return res.status(404).json({ message: "User not found" });

    const newReel = await Reel.create({
      videoUrl,
      userId: user._id,
      username: uploader.username,
    });

    // ✅ socket realtime
    const io = req.app.get("socketio");
    io?.emit("newReel", newReel);

    // ✅ notify followers
    const followers = await Follow.find({ followee: user._id, status: "following" }).select("follower");

    for (let f of followers) {
      await sendNotification({
        senderId: user._id,
        receiverId: f.follower,
        type: "reel_upload",
        reelId: newReel._id,
        message: `${uploader.username} uploaded a new reel`,
        io,
      });
    }

    return res.status(201).json(newReel);
  } catch (err) {
    console.error("[UploadReel Error]:", err);
    res.status(500).json({ message: "Error uploading reel", error: err.message });
  }
};

// ---------------------- GET ALL REELS ----------------------
export const getReels = async (req, res) => {
  try {
    const reels = await Reel.find()
      .sort({ createdAt: -1 })
      .populate("userId", "username profilePic");

    res.status(200).json(reels);
  } catch (err) {
    console.error("[GetReels Error]:", err);
    res.status(500).json({ message: "Error fetching reels", error: err.message });
  }
};

// ---------------------- LIKE / UNLIKE ----------------------
export const likeReel = async (req, res) => {
  try {
    const userId = req.user._id;
    const reelId = req.params.id;

    const reel = await Reel.findById(reelId);
    if (!reel) return res.status(404).json({ message: "Reel not found" });

    const io = req.app.get("socketio");
    let liked;

    if (reel.likedBy.includes(userId)) {
      reel.likedBy.pull(userId);
      liked = false;
    } else {
      reel.likedBy.push(userId);
      liked = true;

      if (userId.toString() !== reel.userId.toString()) {
        await sendNotification({
          senderId: userId,
          receiverId: reel.userId,
          type: "reel_like",
          reelId: reel._id,
          message: "Someone liked your reel",
          io,
        });
      }
    }

    reel.likes = reel.likedBy.length;
    await reel.save();

    io?.emit("reelLiked", { reelId, likes: reel.likes });

    res.status(200).json({ id: reel._id, likes: reel.likes, liked });
  } catch (err) {
    console.error("[LikeReel Error]:", err);
    res.status(500).json({ message: "Error liking reel", error: err.message });
  }
};
export const unlikeReel = async (req, res) => {
  try {
    const userId = req.user._id;
    const reelId = req.params.id;

    const reel = await Reel.findById(reelId);
    if (!reel) return res.status(404).json({ message: "Reel not found" });

    const isLiked = reel.likedBy.includes(userId);
    if (isLiked) {
      reel.likedBy.pull(userId);
    }

    reel.likes = reel.likedBy.length;
    await reel.save();

    req.app.get("socketio")?.emit("reelUnliked", { reelId, likes: reel.likes });

    res.status(200).json({ id: reel._id, likes: reel.likes });
  } catch (err) {
    console.error("[UnlikeReel Error]:", err);
    res.status(500).json({ message: "Error unliking reel", error: err.message });
  }
};

// ---------------------- COMMENT ----------------------
export const commentReel = async (req, res) => {
  try {
    const userId = req.user._id;
    const { comment } = req.body;
    const reelId = req.params.id;

    const io = req.app.get("socketio");

    const user = await User.findById(userId).select("username");
    if (!user) return res.status(404).json({ message: "User not found" });

    const reel = await Reel.findById(reelId);
    if (!reel) return res.status(404).json({ message: "Reel not found" });

    const newComment = {
      userId,
      username: user.username,
      comment,
      createdAt: new Date(),
    };

    reel.comments.push(newComment);
    reel.commentCount = reel.comments.length;
    await reel.save();

    io?.emit("reelCommented", {
      reelId,
      comment: newComment,
      commentCount: reel.commentCount,
    });

    if (userId.toString() !== reel.userId.toString()) {
      await sendNotification({
        senderId: userId,
        receiverId: reel.userId,
        type: "reel_comment",
        reelId: reel._id,
        message: `${user.username} commented: "${comment}"`,
        io,
      });
    }

    res.status(200).json(reel);
  } catch (err) {
    console.error("[CommentReel Error]:", err);
    res.status(500).json({ message: "Error commenting", error: err.message });
  }
};

// ---------------------- SHARE ----------------------
export const shareReel = async (req, res) => {
  try {
    const userId = req.user._id;
    const reelId = req.params.id;

    const reel = await Reel.findById(reelId);
    if (!reel) return res.status(404).json({ message: "Reel not found" });

    reel.shares += 1;
    await reel.save();

    const io = req.app.get("socketio");
    io?.emit("reelShared", { reelId, shares: reel.shares });

    if (userId.toString() !== reel.userId.toString()) {
      await sendNotification({
        senderId: userId,
        receiverId: reel.userId,
        type: "reel_share",
        reelId: reel._id,
        message: "Someone shared your reel",
        io,
      });
    }

    res.status(200).json({ id: reel._id, shares: reel.shares });
  } catch (err) {
    console.error("[Share Reel Error]:", err);
    res.status(500).json({ message: "Error sharing reel", error: err.message });
  }
};

// ---------------------- DELETE REEL ----------------------
export const deleteReel = async (req, res) => {
  try {
    const userId = req.user._id;
    const reelId = req.params.id;

    const reel = await Reel.findById(reelId);
    if (!reel) return res.status(404).json({ message: "Reel not found" });

    if (reel.userId.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Not allowed to delete this reel" });
    }

    await reel.deleteOne();

    const io = req.app.get("socketio");
    io?.emit("reelDeleted", { reelId });

    res.status(200).json({ message: "Reel deleted successfully" });
  } catch (err) {
    console.error("[DeleteReel Error]:", err);
    res.status(500).json({ message: "Error deleting reel", error: err.message });
  }
};

// ---------------------- SAVE / UNSAVE REEL ----------------------
export const saveReel = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { savedReels: req.params.id },
    });
    res.status(200).json({ message: "Reel saved" });
  } catch (err) {
    console.error("[SaveReel Error]:", err);
    res.status(500).json({ message: "Error saving reel", error: err.message });
  }
};

export const unsaveReel = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { savedReels: req.params.id },
    });
    res.status(200).json({ message: "Reel unsaved" });
  } catch (err) {
    console.error("[UnsaveReel Error]:", err);
    res.status(500).json({ message: "Error unsaving reel", error: err.message });
  }
};

export const getSavedReels = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate({
      path: "savedReels",
      populate: {
        path: "userId",
        select: "username profilePic",
      },
    });

    res.status(200).json(user.savedReels);
  } catch (err) {
    console.error("[GetSavedReels Error]:", err);
    res.status(500).json({ message: "Error fetching saved reels", error: err.message });
  }
};
// -------------------- PAGINATION --------------------
export const getReelsPaginated = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const reels = await Reel.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("userId", "username profilePic");

    const total = await Reel.countDocuments();

    res.status(200).json({
      total,
      page,
      pages: Math.ceil(total / limit),
      reels,
    });
  } catch (err) {
    console.error("[GetReelsPaginated Error]:", err);
    res.status(500).json({ message: "Error fetching reels", error: err.message });
  }
};

// -------------------- MY REELS --------------------
export const getMyReels = async (req, res) => {
  try {
    const userId = req.user._id;

    const reels = await Reel.find({ userId })
      .sort({ createdAt: -1 })
      .populate("userId", "username profilePic");

    res.status(200).json(reels);
  } catch (err) {
    console.error("[GetMyReels Error]:", err);
    res.status(500).json({ message: "Error fetching reels", error: err.message });
  }
};