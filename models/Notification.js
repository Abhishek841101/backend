import mongoose from "mongoose";


const NotificationSchema = new mongoose.Schema({
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  // type defines what kind of notification it is
  type: {
    type: String,
    enum: [
      "LIKE_POST",
      "COMMENT_POST",
      "FOLLOW_REQUEST",
      "FOLLOW_ACCEPTED",
      "MESSAGE",
      "MENTION",
      "REEL_LIKE",
      "REEL_COMMENT",
    ],
    required: true,
  },

  // Optional references for dynamic linking
  post: { type: mongoose.Schema.Types.ObjectId, ref: "Post" },
  reel: { type: mongoose.Schema.Types.ObjectId, ref: "Reel" },
  follow: { type: mongoose.Schema.Types.ObjectId, ref: "Follow" },
  messageRef: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },

  text: { type: String, default: "" },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Notification", NotificationSchema);
