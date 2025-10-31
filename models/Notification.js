
import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema(
  {
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    type: {
      type: String,
     enum: [
  "like_post",
  "comment_post",
  "follow_request",
  "follow_accepted",
  "message",
  "mention",
  "reel_like",
  "reel_comment",
  "reel_upload",
],
      required: true,
    },

    post: { type: mongoose.Schema.Types.ObjectId, ref: "Post" },
    reel: { type: mongoose.Schema.Types.ObjectId, ref: "Reel" },
    follow: { type: mongoose.Schema.Types.ObjectId, ref: "Follow" },
    messageRef: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },

    text: { type: String, default: "" },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("Notification", NotificationSchema);
