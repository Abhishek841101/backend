

// models/Post.js
import mongoose from "mongoose";

const PostSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  image: { type: String, required: true }, // e.g. /uploads/171xxxx.jpg
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

PostSchema.index({ owner: 1, createdAt: -1 });
PostSchema.index({ createdAt: -1 });

export default mongoose.model("Post", PostSchema);