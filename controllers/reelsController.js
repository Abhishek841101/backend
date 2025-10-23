
// controllers/reelsController.js
import Reel from "../models/Reel.js";

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
    const { reelId } = req.body;
    const reel = await Reel.findById(reelId);
    if (!reel) return res.status(404).json({ message: "Reel not found" });

    reel.likes += 1;
    await reel.save();

    res.status(200).json({ id: reel._id, likes: reel.likes });
  } catch (err) {
    console.error("[LikeReel Error]:", err);
    res.status(500).json({ message: "Error liking reel", error: err.message });
  }
};

// -------------------- Comment on Reel --------------------
export const commentReel = async (req, res) => {
  try {
    const { reelId, comment, username } = req.body;
    const reel = await Reel.findById(reelId);
    if (!reel) return res.status(404).json({ message: "Reel not found" });

    reel.comments.push({ username: username || "Anonymous", comment });
    await reel.save();

    res.status(200).json(reel);
  } catch (err) {
    console.error("[CommentReel Error]:", err);
    res.status(500).json({ message: "Error commenting on reel", error: err.message });
  }
};
