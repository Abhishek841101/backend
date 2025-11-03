


import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // 1-1 chat
    group: { type: mongoose.Schema.Types.ObjectId, ref: "Group" },   // for group chat

    content: { type: String, default: "" },
    image: { type: String, default: null },
 audio: { type: String, default: null },
    edited: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },

    deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    deletedForEveryone: { type: Boolean, default: false },

    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    reactions: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        emoji: { type: String },
      },
    ],

    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// ✅ Validation before save
messageSchema.pre("save", function (next) {
  if (!this.content && !this.image) {
    return next(new Error("Message must have content or image"));
  }
  next();
});

// ✅ Proper indexes (safe)
messageSchema.index({ receiver: 1 });
messageSchema.index({ readBy: 1 });
messageSchema.index({ deletedFor: 1 });
messageSchema.index({ deletedForEveryone: 1 });
messageSchema.index({ createdAt: -1 });

export default mongoose.model("Message", messageSchema);
