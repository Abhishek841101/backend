import mongoose from "mongoose";

const reelSchema = new mongoose.Schema({
  videoUrl: { type: String, required: true },    // e.g. /uploads/171xxxx.mp4
  username: { type: String, default: "anonymous" },
  likes: { type: Number, default: 0 },
  comments: [
    {
      user: String,
      comment: String,
      createdAt: { type: Date, default: Date.now },
    },
  ],
  createdAt: { type: Date, default: Date.now },
});

const Reel = mongoose.model("Reel", reelSchema);
export default Reel;




// // models/Reel.js
// import mongoose from "mongoose";

// const reelSchema = new mongoose.Schema({
//   videoUrl: { type: String, required: true },
//   userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // 🔑 uploader
//   username: { type: String, default: "anonymous" }, // redundant but useful for quick access
//   likes: { type: Number, default: 0 },
//   comments: [
//     {
//       user: String,
//       comment: String,
//       createdAt: { type: Date, default: Date.now },
//     },
//   ],
//   createdAt: { type: Date, default: Date.now },
// });

// const Reel = mongoose.model("Reel", reelSchema);
// export default Reel;
