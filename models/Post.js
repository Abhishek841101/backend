
// models/Post.js
import mongoose from "mongoose";

const PostSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

  // ✅ Updated for media support
  media: { type: String, required: true }, // e.g. /uploads/posts/filename.jpg or .mp4
  mediaType: { type: String, enum: ["image", "video"], required: true },

  caption: { type: String, required: true },
  location: String,

  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  likesCount: { type: Number, default: 0 },

  comments: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  }],
  commentsCount: { type: Number, default: 0 },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes for fast queries
PostSchema.index({ owner: 1, createdAt: -1 });
PostSchema.index({ createdAt: -1 });

export default mongoose.model("Post", PostSchema);
