import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true },
  },
  { timestamps: true }
);

const mediaSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    type: { type: String, enum: ["podcast", "video", "live"], default: "video" },
    fileUrl: { type: String, required: true },
    thumbnail: { type: String },
    description: { type: String },
    duration: { type: Number }, 
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    comments: [commentSchema],
  },
  { timestamps: true }
);

export default mongoose.model("Media", mediaSchema);
