


// controllers/reelsController.js
import Reel from "../models/Reel.js";
import { sendNotification } from "./notificationController.js"; // ✅ Import

// -------------------- Upload Reel --------------------
export const uploadReel = async (req, res) => {
  try {
    const { username } = req.body;

    if (!req.file) return res.status(400).json({ message: "No video uploaded" });

    // Correct path including subfolder
    const folder = req.file.destination.replace(/\\/g, "/"); // Windows fix
    const videoUrl = `${req.protocol}://${req.get("host")}/${folder}/${req.file.filename}`;

    const newReel = new Reel({
      videoUrl,
      username: username || "guest",
      likes: 0,
      comments: [],
    });

    const savedReel = await newReel.save();

    // Emit new reel to all users in real-time
    req.app.get("socketio")?.emit("newReel", savedReel);

    res.status(201).json(savedReel);
  } catch (err) {
    console.error("[UploadReel Error]:", err);
    res.status(500).json({ message: "Error uploading reel", error: err.message });
  }
};

// -------------------- Get All Reels --------------------
export const getReels = async (req, res) => {
  try {
    const reels = await Reel.find().sort({ createdAt: -1 });
    res.status(200).json(reels);
  } catch (err) {
    console.error("[GetReels Error]:", err);
    res.status(500).json({ message: "Error fetching reels", error: err.message });
  }
};

// -------------------- Like Reel --------------------
export const likeReel = async (req, res) => {
  try {
    const { reelId, userId } = req.body; // userId from request
    const reel = await Reel.findById(reelId);
    if (!reel) return res.status(404).json({ message: "Reel not found" });

    // Increment like
    reel.likes += 1;
    await reel.save();

    // Emit real-time like
    req.app.get("socketio")?.emit("reelLiked", { reelId, likes: reel.likes });

    // 🔔 Send notification (if user liking their own reel, skip)
    if (userId.toString() !== reel._id.toString()) {
      await sendNotification({
        sender: userId,
        receiver: reel._id, // You can store creator ID in Reel model
        type: "REEL_LIKE",
        reel: reel._id,
        text: `Someone liked your reel`,
      });
    }

    res.status(200).json({ id: reel._id, likes: reel.likes });
  } catch (err) {
    console.error("[LikeReel Error]:", err);
    res.status(500).json({ message: "Error liking reel", error: err.message });
  }
};

// -------------------- Comment on Reel --------------------
export const commentReel = async (req, res) => {
  try {
    const { reelId, comment, userId, username } = req.body;
    const reel = await Reel.findById(reelId);
    if (!reel) return res.status(404).json({ message: "Reel not found" });

    const newComment = { username: username || "Anonymous", comment };
    reel.comments.push(newComment);
    await reel.save();

    // Emit real-time comment
    req.app.get("socketio")?.emit("reelCommented", { reelId, comment: newComment });

    // 🔔 Send notification to reel owner
    if (userId.toString() !== reel._id.toString()) {
      await sendNotification({
        sender: userId,
        receiver: reel._id, // Replace with reel creator's ID
        type: "REEL_COMMENT",
        reel: reel._id,
        text: `${username || "Someone"} commented: "${comment}"`,
      });
    }

    res.status(200).json(reel);
  } catch (err) {
    console.error("[CommentReel Error]:", err);
    res.status(500).json({ message: "Error commenting on reel", error: err.message });
  }
};
