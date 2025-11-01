// controllers/mediaController.js
import fs from "fs";
import path from "path";
import Media from "../models/Media.js";
import Follow from "../models/Follow.js";
import User from "../models/User.js";
import { sendNotification } from "../utils/sendNotification.js";

/**
 * Helper: safely delete a file (if exists)
 */
const safeUnlink = (filePath) => {
  if (!filePath) return;
  const abs = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  fs.unlink(abs, (err) => {
    if (err && err.code !== "ENOENT") console.error("Failed to delete file:", abs, err);
  });
};


const notifyFollowersAboutNewMedia = async (req, uploaderId, payload) => {
  try {
    // get followers - adjust query to your Follow schema
    const followers = await Follow.find({ following: uploaderId }).select("follower");
    const followerIds = followers.map((f) => f.follower.toString());

    // send push/DB notifications using your util
    for (const fid of followerIds) {
      // sendNotification assumed: (toUserId, payload)
      try {
        await sendNotification(fid, {
          title: `${payload.uploaderName || "Someone"} uploaded ${payload.type}`,
          body: payload.title,
          data: {
            mediaId: payload.mediaId,
            type: payload.type,
            fileUrl: payload.fileUrl,
          },
        });
      } catch (err) {
        console.error("sendNotification error for", fid, err);
      }
    }

    // Real-time via socket.io (emit to follower rooms)
    // Assumes socket clients join a room named `user_<userId>`
    const io = req.app.get("io");
    if (io && followerIds.length) {
      followerIds.forEach((fid) => {
        io.to(`user_${fid}`).emit("new_media", {
          uploader: payload.uploaderName,
          title: payload.title,
          mediaId: payload.mediaId,
          fileUrl: payload.fileUrl,
          thumbnail: payload.thumbnail,
          type: payload.type,
          createdAt: new Date(),
        });
      });
    }
  } catch (err) {
    console.error("notifyFollowersAboutNewMedia error:", err);
  }
};

// ===============================
// Upload Media (media + optional thumbnail)
export const uploadMedia = async (req, res) => {
  try {
      const { title, type = "video", description, duration } = req.body;
    const userId = req.user?._id;

    // accept file from single/multiple fields
    const fileObj =
      req.file ||
      req.files?.media?.[0] ||
      req.files?.video?.[0];

    if (!fileObj) {
      return res.status(400).json({ message: "Media file is required" });
    }

    const fileUrl = fileObj.path.replace(/\\/g, "/");

    // thumbnail (optional)
    let thumbnailPath = null;
    if (req.files?.thumbnail?.length > 0) {
      thumbnailPath = req.files.thumbnail[0].path.replace(/\\/g, "/");
    } else if (req.body.thumbnail) {
      thumbnailPath = req.body.thumbnail;
    }

    // Save DB
    const media = await Media.create({
      title,
      type,
      description,
      duration: duration ? Number(duration) : undefined,
      fileUrl,
      thumbnail: thumbnailPath,
      userId,
    });

    const uploader = await User.findById(userId).select("name");

    // Notify followers
    notifyFollowersAboutNewMedia(req, userId, {
      title,
      type,
      mediaId: media._id,
      fileUrl,
      thumbnail: thumbnailPath,
      uploaderName: uploader?.name || "Someone",
    });

    // socket broadcast (optional)
    const io = req.app.get("io");
    if (io) {
      io.emit("feed_new_media", {
        mediaId: media._id,
        title: media.title,
        type: media.type,
        fileUrl: media.fileUrl,
        thumbnail: media.thumbnail,
        uploader: uploader?.name,
        createdAt: media.createdAt,
      });
    }

    return res.status(201).json({
      message: "Media uploaded successfully",
      media,
    });
  } catch (error) {
    console.error("❌ uploadMedia error:", error);
    return res.status(500).json({ message: error.message });
  }
};
// Get All Media (with pagination + optional type filter)
export const getAllMedia = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 20);
    const skip = (page - 1) * limit;
    const filter = {};

    if (req.query.type) filter.type = req.query.type; // podcast | video | live
    if (req.query.userId) filter.userId = req.query.userId;

    const [items, total] = await Promise.all([
      Media.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Media.countDocuments(filter),
    ]);

    return res.status(200).json({
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      items,
    });
  } catch (error) {
    console.error("getAllMedia error:", error);
    return res.status(500).json({ message: error.message });
  }
};
// Get Single Media (and increment view count)
export const getMediaById = async (req, res) => {
  try {
    const media = await Media.findById(req.params.id);
    if (!media) return res.status(404).json({ message: "Media not found" });

    // increment viewCount if field exists (add if not)
    try {
      media.views = (media.views || 0) + 1;
      await media.save();
    } catch (e) {
      console.warn("Could not increment view count", e);
    }

    return res.status(200).json(media);
  } catch (error) {
    console.error("getMediaById error:", error);
    return res.status(500).json({ message: error.message });
  }
};
// Update Media metadata (not files)
export const updateMedia = async (req, res) => {
  try {
    const { title, description, type, duration } = req.body;
    const media = await Media.findById(req.params.id);
    if (!media) return res.status(404).json({ message: "Media not found" });

    // optional: restrict update to owner or admin
    const requester = req.user;
    if (!requester) return res.status(401).json({ message: "Unauthorized" });
    if (media.userId?.toString() !== requester._id.toString() && requester.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    media.title = title ?? media.title;
    media.description = description ?? media.description;
    media.type = type ?? media.type;
    media.duration = duration !== undefined ? Number(duration) : media.duration;

    await media.save();
    return res.status(200).json(media);
  } catch (error) {
    console.error("updateMedia error:", error);
    return res.status(500).json({ message: error.message });
  }
};
// Delete Media (auth check + remove files)
export const deleteMedia = async (req, res) => {
  try {
    const media = await Media.findById(req.params.id);
    if (!media) return res.status(404).json({ message: "Media not found" });

    const requester = req.user;
    if (!requester) return res.status(401).json({ message: "Unauthorized" });

    if (media.userId?.toString() !== requester._id.toString() && requester.role !== "admin") {
      return res.status(403).json({ message: "Forbidden: cannot delete this media" });
    }

    // Remove files from disk if local path (do not touch external URLs)
    if (media.fileUrl && !media.fileUrl.startsWith("http")) {
      safeUnlink(media.fileUrl);
    }
    if (media.thumbnail && !media.thumbnail.startsWith("http")) {
      safeUnlink(media.thumbnail);
    }

    await media.remove();

    // Real-time notify deletion (optional)
    const io = req.app.get("io");
    if (io) {
      io.emit("media_deleted", { mediaId: req.params.id });
    }

    return res.status(200).json({ message: "Media deleted successfully" });
  } catch (error) {
    console.error("deleteMedia error:", error);
    return res.status(500).json({ message: error.message });
  }
};
// Start Live Stream (create live media and broadcast start event)
export const startLiveStream = async (req, res) => {
  try {
    const { title, description } = req.body;
    const userId = req.user?._id;

    // create DB entry for live
    const liveMedia = await Media.create({
      title,
      type: "live",
      description,
      fileUrl: null, // will be updated with HLS url later
      userId,
    });

    // Optionally generate a streamKey (simple random token) — replace with real auth later
    const streamKey = `${liveMedia._id.toString()}:${Math.random().toString(36).slice(2, 10)}`;

    // Broadcast to followers/global feed
    const io = req.app.get("io");
    if (io) {
      io.emit("live_started", {
        mediaId: liveMedia._id,
        title: liveMedia.title,
        uploaderId: userId,
        createdAt: liveMedia.createdAt,
      });
    }

    return res.status(201).json({
      message: "Live created",
      live: liveMedia,
      streamKey,
    });
  } catch (error) {
    console.error("startLiveStream error:", error);
    return res.status(500).json({ message: error.message });
  }
};


export const likeMedia = async (req, res) => {
  try {
    const { mediaId } = req.params;
    const userId = req.user._id;

    const media = await Media.findById(mediaId);
    if (!media) return res.status(404).json({ message: "Media not found" });

    const alreadyLiked = media.likes.includes(userId);

    if (alreadyLiked) {
      media.likes.pull(userId);
      await media.save();
      return res.status(200).json({ message: "Unliked successfully", likesCount: media.likes.length });
    } else {
      media.likes.push(userId);
      await media.save();
      return res.status(200).json({ message: "Liked successfully", likesCount: media.likes.length });
    }
  } catch (error) {
    console.error("likeMedia Error:", error);
    return res.status(500).json({ message: "Server error", error });
  }
};

export const commentMedia = async (req, res) => {
  try {
    const { mediaId } = req.params;
    const { text } = req.body;
    const userId = req.user._id;

    if (!text) return res.status(400).json({ message: "Comment text required" });

    const media = await Media.findById(mediaId);
    if (!media) return res.status(404).json({ message: "Media not found" });

    media.comments.push({ userId, text });
    await media.save();

    return res.status(200).json({
      message: "Comment added",
      commentsCount: media.comments.length,
      media,
    });
  } catch (error) {
    console.error("commentMedia Error:", error);
    return res.status(500).json({ message: "Server error", error });
  }
};


export const getMyMedia = async (req, res) => {
  try {
    const userId = req.user._id;

    const media = await Media.find({ userId })
      .populate("likes", "username profilePic")
      .populate("comments.userId", "username profilePic")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      message: "My media fetched successfully",
      data: media,
    });
  } catch (error) {
    console.error("getMyMedia Error:", error);
    return res.status(500).json({ message: "Server error", error });
  }
};
