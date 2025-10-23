import mongoose from "mongoose";

const wallpaperSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  friend: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  wallpaperUrl: String,
}, { timestamps: true });

export default mongoose.model("Wallpaper", wallpaperSchema);
