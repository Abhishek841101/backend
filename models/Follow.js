// import mongoose from "mongoose";

// const FollowSchema = new mongoose.Schema({
//   follower: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
//   followee: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
//   status: { type: String, enum: ["following", "requested"], default: "following" },
//   createdAt: { type: Date, default: Date.now }
// });

// FollowSchema.index({ follower: 1, followee: 1 }, { unique: true });

// export default mongoose.model("Follow", FollowSchema);




import mongoose from "mongoose";

const FollowSchema = new mongoose.Schema(
  {
    follower: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      required: true,
    },
    followee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      required: true,
    },
    status: {
      type: String,
      enum: ["requested", "following"],
      default: "following",
    },
  },
  { timestamps: true }
);

// Prevent duplicate follow rows
FollowSchema.index({ follower: 1, followee: 1 }, { unique: true });

export default mongoose.model("Follow", FollowSchema);
