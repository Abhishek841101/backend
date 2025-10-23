// import mongoose from "mongoose";

// const groupSchema = new mongoose.Schema(
//   {
//     name: { type: String, required: true },
//     admin: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
//     members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
//     avatar: { type: String, default: null },
//   },
//   { timestamps: true }
// );

// export default mongoose.model("Group", groupSchema);






import mongoose from "mongoose";

const groupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },

    // Who created or is currently the admin
    admin: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // All group members
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // Optional group avatar / display picture
    avatar: { type: String, default: null },

    // Store messages pinned in the group
    pinnedMessages: [{ type: mongoose.Schema.Types.ObjectId, ref: "Message" }],

    // Group settings
    settings: {
      description: { type: String, default: "" },      // About/Description
      isPrivate: { type: Boolean, default: false },    // Private vs public groups
      allowReactions: { type: Boolean, default: true },// Toggle reactions
      onlyAdminsCanPost: { type: Boolean, default: false }, // Announcement groups
    },

    // Wallpapers per group (global for group)
    wallpaper: { type: String, default: null },

    // Track users who left (to avoid re-adding directly)
    leftUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

export default mongoose.model("Group", groupSchema);
