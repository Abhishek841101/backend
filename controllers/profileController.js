


import User from "../models/User.js";
import Follow from "../models/Follow.js";
import Message from "../models/Message.js";
// import Post from "../models/Post.js";
// =====================
// GET PROFILE
// =====================
export const getProfile = async (req, res) => {
  try {
    console.log("getProfile called for username:", req.params.username);

    const user = await User.findOne({ username: req.params.username });
    if (!user) {
      console.log("User not found:", req.params.username);
      return res.status(404).json({ error: { message: "User not found" } });
    }

    const isMe = req.user._id.equals(user._id);
    console.log("isMe:", isMe);

    const following = await Follow.exists({
      follower: req.user._id,
      followee: user._id,
      status: "following",
    });
    console.log("following:", !!following);

    const requested = await Follow.exists({
      follower: req.user._id,
      followee: user._id,
      status: "requested",
    });
    console.log("requested:", !!requested);

    const followedBy = await Follow.exists({
      follower: user._id,
      followee: req.user._id,
      status: "following",
    });
    console.log("followedBy:", !!followedBy);

    const profileData = {
      username: user.username,
      fullName: user.fullName,
      avatar: user.avatar,
      bio: user.bio,
      link: user.link,
      isPrivate: user.isPrivate,
      isVerified: user.isVerified,
      isMe,
      stats: user.stats || { posts: 0, followers: 0, following: 0 },
      relationship: {
        following: !!following,
        requested: !!requested,
        followedBy: !!followedBy,
      },
      highlights: user.highlights || [],
    };

    console.log("Profile data to send:", profileData);
    res.json(profileData);
  } catch (error) {
    console.error("getProfile error:", error);
    res.status(500).json({ error: { message: error.message } });
  }
};





// =====================
// FOLLOW USER
// =====================
export const followUser = async (req, res) => {
  try {
    console.log("followUser called for username:", req.params.username);

    const target = await User.findOne({ username: req.params.username });
    if (!target) {
      console.log("Target user not found:", req.params.username);
      return res.status(404).json({ error: { message: "User not found" } });
    }

    const existingFollow = await Follow.findOne({
      follower: req.user._id,
      followee: target._id,
    });
    console.log("existingFollow:", existingFollow);

    if (existingFollow) {
      console.log("Already following or requested");
      return res.status(400).json({ error: { message: "Already following or requested" } });
    }

    if (target.isPrivate) {
      await Follow.create({ follower: req.user._id, followee: target._id, status: "requested" });
      console.log("Follow request sent to private user:", target.username);
      return res.json({
        relationship: { following: false, requested: true, followedBy: false },
      });
    } else {
      await Follow.create({ follower: req.user._id, followee: target._id, status: "following" });
      await User.findByIdAndUpdate(target._id, { $inc: { "stats.followers": 1 } });
      await User.findByIdAndUpdate(req.user._id, { $inc: { "stats.following": 1 } });
      console.log("Successfully followed user:", target.username);
      return res.json({
        relationship: { following: true, requested: false, followedBy: false },
      });
    }
  } catch (error) {
    console.error("followUser error:", error);
    res.status(400).json({ error: { message: error.message } });
  }
};

// =====================
// UNFOLLOW USER
// =====================
export const unfollowUser = async (req, res) => {
  try {
    console.log("unfollowUser called for username:", req.params.username);

    const target = await User.findOne({ username: req.params.username });
    if (!target) {
      console.log("Target user not found:", req.params.username);
      return res.status(404).json({ error: { message: "User not found" } });
    }

    const follow = await Follow.findOne({
      follower: req.user._id,
      followee: target._id,
    });
    console.log("follow document found:", follow);

    if (!follow) {
      console.log("Not following this user");
      return res.status(400).json({ error: { message: "Not following this user" } });
    }

    await Follow.deleteOne({ _id: follow._id });
    console.log("Follow deleted:", follow._id);

    if (follow.status === "following") {
      await User.findByIdAndUpdate(target._id, { $inc: { "stats.followers": -1 } });
      await User.findByIdAndUpdate(req.user._id, { $inc: { "stats.following": -1 } });
      console.log("Stats decremented for both users");
    }

    res.json({
      relationship: { following: false, requested: false, followedBy: false },
    });
  } catch (error) {
    console.error("unfollowUser error:", error);
    res.status(400).json({ error: { message: error.message } });
  }
};


export const getAllUsers = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ status: "error", message: "User not authenticated" });
    }

    const currentUserId = req.user._id;
    console.log("getAllUsers called by user:", req.user.username);

    // Fetch all users except current user
    const users = await User.find({ _id: { $ne: currentUserId } })
      .select("-password")
      .lean();
    console.log("Users fetched from DB:", users.map((u) => u.username));

    const usersWithExtras = await Promise.all(
      users.map(async (user) => {
        // Follow status
        const [isFollowing, isRequested] = await Promise.all([
          Follow.exists({ follower: currentUserId, followee: user._id, status: "following" }),
          Follow.exists({ follower: currentUserId, followee: user._id, status: "requested" }),
        ]);

        // Unread messages count
        const unreadCount = await Message.countDocuments({
          sender: user._id,
          receiver: currentUserId,
          readBy: { $ne: currentUserId },
          deletedFor: { $ne: currentUserId },
          deletedForEveryone: false,
        });

        // Last message between users
        const lastMsg = await Message.findOne({
          $or: [
            { sender: currentUserId, receiver: user._id },
            { sender: user._id, receiver: currentUserId },
          ],
        })
          .sort({ createdAt: -1 })
          .lean();

        return {
          ...user,
          isFollowing: !!isFollowing,
          isRequested: !!isRequested,
          lastMessage: lastMsg
            ? {
                content: lastMsg.content || null,
                image: lastMsg.image || null,
                timestamp: lastMsg.createdAt,
              }
            : null,
          unreadCount,
        };
      })
    );

    console.log(
      "Final users list to send:",
      usersWithExtras.map((u) => ({
        username: u.username,
        unreadCount: u.unreadCount,
        lastMessage: u.lastMessage,
        isFollowing: u.isFollowing,
        isRequested: u.isRequested,
      }))
    );

    res.status(200).json({
      status: "success",
      message: "Users fetched successfully",
      users: usersWithExtras,
    });
  } catch (error) {
    console.error("getAllUsers error:", error);
    res
      .status(500)
      .json({ status: "error", message: "Failed to fetch users.", error: error.message });
  }
};




