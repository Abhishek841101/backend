// import mongoose from "mongoose";

// const reelSchema = new mongoose.Schema({
//   videoUrl: { type: String, required: true },    // e.g. /uploads/171xxxx.mp4
//   username: { type: String, default: "anonymous" },
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



import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    username: String,
    comment: String,
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const reelSchema = new mongoose.Schema(
  {
    videoUrl: {
      type: String,
      required: true,
    },

    // ✅ Who uploaded
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    username: {
      type: String,
      required: true,
    },

    likes: {
      type: Number,
      default: 0,
    },

    // ✅ MUST HAVE THIS FOR LIKE SYSTEM
    likedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    comments: [commentSchema],
  },
  { timestamps: true }
);

reelSchema.virtual("reelId").get(function () {
  return this._id.toHexString();
});

reelSchema.set("toJSON", {
  virtuals: true,
});

const Reel = mongoose.model("Reel", reelSchema);
export default Reel;
