import User from "../models/User.js";
import Message from "../models/Message.js";
import Wallpaper from "../models/Wallpaper.js";
import Group from "../models/Group.js";

export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user._id } }).select("-password");
    res.status(200).json(users);
  } catch (err) {
    console.error("getAllUsers error:", err);
    res.status(500).json({ message: "Failed to fetch users." });
  }
};
export const getMessagesBetweenUsers = async (req, res) => {
  try {
    const { userId } = req.params;
    const messages = await Message.find({
      $or: [
        { sender: req.user._id, receiver: userId },
        { sender: userId, receiver: req.user._id },
      ],
      deletedFor: { $ne: String(req.user._id) },
    })
      .sort({ createdAt: 1 })
      .populate("sender", "username")
      .populate("receiver", "username");

    const formatted = messages.map(msg => ({
      _id: msg._id,
      sender: String(msg.sender?._id),
      receiver: String(msg.receiver?._id),
      content: msg.content || "",
      image: msg.image || null,
      timestamp: msg.createdAt,
      readBy: (msg.readBy || []).map(u => String(u)),
      reactions: msg.reactions || [],
      edited: msg.edited || false,
      senderUsername: msg.sender?.username || null,
      receiverUsername: msg.receiver?.username || null,
    }));

    res.status(200).json(formatted);
  } catch (err) {
    console.error("getMessagesBetweenUsers error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
// Send message
export const sendMessage = async (req, res) => {
  try {
    const { receiverId, content, image } = req.body;
    if (!receiverId) return res.status(400).json({ message: "receiverId is required" });

    const newMsg = await Message.create({
      sender: req.user._id,
      receiver: receiverId,
      content: content || "",
      image: image || null,
      readBy: [String(req.user._id)],
      reactions: [],
    });

    const populated = await newMsg.populate("sender", "username").populate("receiver", "username");

    res.status(201).json({
      _id: populated._id,
      sender: String(populated.sender._id),
      receiver: String(populated.receiver._id),
      content: populated.content,
      image: populated.image || null,
      timestamp: populated.createdAt,
      readBy: (populated.readBy || []).map(u => String(u)),
      reactions: populated.reactions || [],
      edited: populated.edited || false,
      senderUsername: populated.sender.username,
      receiverUsername: populated.receiver.username,
    });
  } catch (err) {
    console.error("sendMessage error:", err);
    res.status(500).json({ message: "Error sending message", error: err.message });
  }
};

// Edit message
export const editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { newContent } = req.body;
    const userId = String(req.user._id);

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });

    if (String(message.sender) !== userId)
      return res.status(403).json({ message: "You can only edit your own messages" });

    message.content = newContent || message.content;
    message.edited = true;
    message.editedAt = new Date();
    await message.save();

    res.status(200).json({ message: "Message edited", data: message });
  } catch (err) {
    console.error("editMessage error:", err);
    res.status(500).json({ message: "Error editing message", error: err.message });
  }
};

// Toggle reaction
export const toggleReaction = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { reaction } = req.body;
    const userId = String(req.user._id);

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });

    if (!message.reactions) message.reactions = [];

    const existing = message.reactions.find(r => r.userId === userId && r.emoji === reaction);
    if (existing) {
      message.reactions = message.reactions.filter(r => !(r.userId === userId && r.emoji === reaction));
    } else {
      message.reactions.push({ userId, emoji: reaction });
    }

    await message.save();
    res.status(200).json({ message: "Reaction updated", reactions: message.reactions });
  } catch (err) {
    console.error("toggleReaction error:", err);
    res.status(500).json({ message: "Error toggling reaction", error: err.message });
  }
};

// Get unread summary
export const getUnreadSummary = async (req, res) => {
  try {
    const unread = await Message.aggregate([
      { $match: { receiver: req.user._id, readBy: { $ne: req.user._id } } },
      {
        $group: {
          _id: "$sender",
          unreadCount: { $sum: 1 },
          lastMessage: { $last: "$content" },
          lastTimestamp: { $last: "$createdAt" },
        },
      },
    ]);

    const users = await User.find({ _id: { $in: unread.map(u => u._id) } }).select("username");

    const summary = unread.map(u => {
      const user = users.find(usr => String(usr._id) === String(u._id));
      return {
        friendId: String(u._id),
        username: user?.username || "Unknown",
        lastMessage: u.lastMessage || "",
        lastTimestamp: u.lastTimestamp,
        unreadCount: u.unreadCount,
      };
    });

    res.status(200).json(summary);
  } catch (err) {
    console.error("getUnreadSummary error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Mark messages as read
export const markMessagesAsRead = async (req, res) => {
  try {
    const { friendId } = req.params;
    const userId = String(req.user._id);
    if (!friendId) return res.status(400).json({ message: "friendId is required" });

    const result = await Message.updateMany(
      { sender: friendId, receiver: userId, readBy: { $ne: userId } },
      { $addToSet: { readBy: userId } }
    );

    res.status(200).json({
      message: "Messages marked as read",
      updatedCount: result.modifiedCount || result.nModified || 0,
    });
  } catch (err) {
    console.error("markMessagesAsRead error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Delete message for me
export const deleteMessageForMe = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = String(req.user._id);

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });

    if (!message.deletedFor) message.deletedFor = [];
    if (!message.deletedFor.includes(userId)) {
      message.deletedFor.push(userId);
      await message.save();
    }

    res.status(200).json({ message: "Message deleted for you" });
  } catch (err) {
    console.error("deleteMessageForMe error:", err);
    res.status(500).json({ message: "Error deleting message", error: err.message });
  }
};

// Delete message for everyone
export const deleteMessageForEveryone = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = String(req.user._id);

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });
    if (String(message.sender) !== userId)
      return res.status(403).json({ message: "You are not allowed to delete this message" });

    message.content = "[deleted]";
    message.image = null;
    message.deletedFor = [];
    message.deletedForEveryone = true;
    await message.save();

    res.status(200).json({ message: "Message deleted for everyone" });
  } catch (err) {
    console.error("deleteMessageForEveryone error:", err);
    res.status(500).json({ message: "Error deleting message", error: err.message });
  }
};

// Chat wallpaper
export const setChatWallpaper = async (req, res) => {
  try {
    const { friendId } = req.params;
    const { wallpaperUrl } = req.body;
    const userId = req.user._id;

    let wall = await Wallpaper.findOne({ user: userId, friend: friendId });
    if (!wall) wall = await Wallpaper.create({ user: userId, friend: friendId, wallpaperUrl });
    else {
      wall.wallpaperUrl = wallpaperUrl;
      await wall.save();
    }

    res.status(200).json({ message: "Wallpaper updated", data: wall });
  } catch (err) {
    console.error("setChatWallpaper error:", err);
    res.status(500).json({ message: "Error setting wallpaper", error: err.message });
  }
};

export const getChatWallpaper = async (req, res) => {
  try {
    const { friendId } = req.params;
    const wall = await Wallpaper.findOne({ user: req.user._id, friend: friendId });
    res.status(200).json({ wallpaperUrl: wall?.wallpaperUrl || null });
  } catch (err) {
    console.error("getChatWallpaper error:", err);
    res.status(500).json({ message: "Error fetching wallpaper", error: err.message });
  }
};

// =========================
// GROUP CHAT APIS
// =========================

// Create group
export const createGroup = async (req, res) => {
  try {
    const { name, memberIds } = req.body;
    if (!name) return res.status(400).json({ message: "Group name is required" });

    const members = memberIds ? [...new Set(memberIds), String(req.user._id)] : [String(req.user._id)];
    const group = await Group.create({ name, admin: req.user._id, members });
    res.status(201).json({ message: "Group created", data: group });
  } catch (err) {
    console.error("createGroup error:", err);
    res.status(500).json({ message: "Error creating group", error: err.message });
  }
};

// Get all groups
export const getGroups = async (req, res) => {
  try {
    const groups = await Group.find({ members: req.user._id }).populate("members", "username");
    res.status(200).json(groups);
  } catch (err) {
    console.error("getGroups error:", err);
    res.status(500).json({ message: "Error fetching groups", error: err.message });
  }
};

// Get single group
export const getGroup = async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId).populate("members", "username");
    if (!group) return res.status(404).json({ message: "Group not found" });
    res.status(200).json(group);
  } catch (err) {
    console.error("getGroup error:", err);
    res.status(500).json({ message: "Error fetching group", error: err.message });
  }
};

// Get group messages
export const getGroupMessages = async (req, res) => {
  try {
    const { groupId } = req.params;
    const messages = await Message.find({ group: groupId, deletedFor: { $ne: String(req.user._id) } })
      .sort({ createdAt: 1 })
      .populate("sender", "username");

    const formatted = messages.map(msg => ({
      _id: msg._id,
      sender: String(msg.sender?._id),
      content: msg.content || "",
      image: msg.image || null,
      timestamp: msg.createdAt,
      readBy: (msg.readBy || []).map(u => String(u)),
      reactions: msg.reactions || [],
      edited: msg.edited || false,
      senderUsername: msg.sender?.username || null,
      groupId,
    }));

    res.status(200).json(formatted);
  } catch (err) {
    console.error("getGroupMessages error:", err);
    res.status(500).json({ message: "Error fetching group messages", error: err.message });
  }
};

// Send group message
export const sendGroupMessage = async (req, res) => {
  try {
    const { groupId, content, image } = req.body;
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    const newMsg = await Message.create({
      sender: req.user._id,
      group: groupId,
      content: content || "",
      image: image || null,
      readBy: [String(req.user._id)],
      reactions: [],
    });

    const populated = await newMsg.populate("sender", "username");

    res.status(201).json({
      _id: populated._id,
      sender: String(populated.sender._id),
      content: populated.content,
      image: populated.image || null,
      timestamp: populated.createdAt,
      readBy: (populated.readBy || []).map(u => String(u)),
      reactions: populated.reactions || [],
      edited: populated.edited || false,
      senderUsername: populated.sender.username,
      groupId,
    });
  } catch (err) {
    console.error("sendGroupMessage error:", err);
    res.status(500).json({ message: "Error sending message", error: err.message });
  }
};

// Edit group message
export const editGroupMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { newContent } = req.body;
    const userId = String(req.user._id);

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });

    if (String(message.sender) !== userId)
      return res.status(403).json({ message: "You can only edit your own messages" });

    message.content = newContent || message.content;
    message.edited = true;
    message.editedAt = new Date();
    await message.save();

    res.status(200).json({ message: "Message edited", data: message });
  } catch (err) {
    console.error("editGroupMessage error:", err);
    res.status(500).json({ message: "Error editing message", error: err.message });
  }
};

// Toggle reaction in group
export const toggleGroupReaction = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { reaction } = req.body;
    const userId = String(req.user._id);

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });

    if (!message.reactions) message.reactions = [];

    const existing = message.reactions.find(r => r.userId === userId && r.emoji === reaction);
    if (existing) {
      message.reactions = message.reactions.filter(r => !(r.userId === userId && r.emoji === reaction));
    } else {
      message.reactions.push({ userId, emoji: reaction });
    }

    await message.save();
    res.status(200).json({ message: "Reaction updated", reactions: message.reactions });
  } catch (err) {
    console.error("toggleGroupReaction error:", err);
    res.status(500).json({ message: "Error toggling reaction", error: err.message });
  }
};

// Add group member
export const addGroupMember = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userId } = req.body;
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    if (!group.members.includes(userId)) group.members.push(userId);
    await group.save();
    res.status(200).json({ message: "Member added", members: group.members });
  } catch (err) {
    console.error("addGroupMember error:", err);
    res.status(500).json({ message: "Error adding member", error: err.message });
  }
};

// Remove group member
export const removeGroupMember = async (req, res) => {
  try {
    const { groupId, userId } = req.params;
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    group.members = group.members.filter(m => String(m) !== String(userId));
    await group.save();
    res.status(200).json({ message: "Member removed", members: group.members });
  } catch (err) {
    console.error("removeGroupMember error:", err);
    res.status(500).json({ message: "Error removing member", error: err.message });
  }
};

// Set group admin
export const setGroupAdmin = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userId } = req.body;
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    group.admin = userId;
    await group.save();
    res.status(200).json({ message: "Admin updated", admin: group.admin });
  } catch (err) {
    console.error("setGroupAdmin error:", err);
    res.status(500).json({ message: "Error setting admin", error: err.message });
  }
};

// Group unread summary
export const getGroupUnreadSummary = async (req, res) => {
  try {
    const groups = await Group.find({ members: req.user._id });

    const summary = await Promise.all(
      groups.map(async group => {
        const unread = await Message.countDocuments({
          group: group._id,
          readBy: { $ne: String(req.user._id) },
        });
        const lastMsg = await Message.findOne({ group: group._id }).sort({ createdAt: -1 });
        return {
          groupId: String(group._id),
          name: group.name,
          lastMessage: lastMsg?.content || "",
          lastTimestamp: lastMsg?.createdAt || null,
          unreadCount: unread,
        };
      })
    );

    res.status(200).json(summary);
  } catch (err) {
    console.error("getGroupUnreadSummary error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Mark all group messages as read
export const markGroupMessagesAsRead = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = String(req.user._id);

    await Message.updateMany(
      { group: groupId, readBy: { $ne: userId } },
      { $addToSet: { readBy: userId } }
    );

    res.status(200).json({ message: "Group messages marked as read" });
  } catch (err) {
    console.error("markGroupMessagesAsRead error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Set group wallpaper
export const setGroupWallpaper = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { wallpaperUrl } = req.body;

    let wall = await Wallpaper.findOne({ group: groupId });
    if (!wall) wall = await Wallpaper.create({ group: groupId, wallpaperUrl });
    else {
      wall.wallpaperUrl = wallpaperUrl;
      await wall.save();
    }

    res.status(200).json({ message: "Group wallpaper updated", data: wall });
  } catch (err) {
    console.error("setGroupWallpaper error:", err);
    res.status(500).json({ message: "Error setting group wallpaper", error: err.message });
  }
};

export const getGroupWallpaper = async (req, res) => {
  try {
    const { groupId } = req.params;
    const wall = await Wallpaper.findOne({ group: groupId });
    res.status(200).json({ wallpaperUrl: wall?.wallpaperUrl || null });
  } catch (err) {
    console.error("getGroupWallpaper error:", err);
    res.status(500).json({ message: "Error fetching group wallpaper", error: err.message });
  }
};
