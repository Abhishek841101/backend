import Post from "../models/Post.js";
import User from "../models/User.js";
import Follow from "../models/Follow.js";
import Message from "../models/Message.js";
import { sendNotification } from "../utils/sendNotification.js";


// =====================
// GET PROFILE
// =====================
// export const getProfile = async (req, res) => {
//   try {
//     const user = await User.findOne({ username: req.params.username });
//     if (!user) return res.status(404).json({ error: { message: "User not found" } });

//     const isMe = req.user._id.equals(user._id);

//     const following = await Follow.exists({
//       follower: req.user._id,
//       followee: user._id,
//       status: "following",
//     });

//     const requested = await Follow.exists({
//       follower: req.user._id,
//       followee: user._id,
//       status: "requested",
//     });

//     const followedBy = await Follow.exists({
//       follower: user._id,
//       followee: req.user._id,
//       status: "following",
//     });

//     const profileData = {
//       username: user.username,
//       fullName: user.fullName,
//       avatar: user.avatar,
//       bio: user.bio,
//       link: user.link,
//       isPrivate: user.isPrivate,
//       isVerified: user.isVerified,
//       isMe,
//       stats: user.stats || { posts: 0, followers: 0, following: 0 },
//       relationship: {
//         following: !!following,
//         requested: !!requested,
//         followedBy: !!followedBy,
//       },
//       highlights: user.highlights || [],
//     };

//     res.json(profileData);
//   } catch (error) {
//     res.status(500).json({ error: { message: error.message } });
//   }
// };
export const getProfile = async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) return res.status(404).json({ error: { message: "User not found" } });

    const isMe = req.user._id.equals(user._id);

    // ✅ Count user posts
    const postsCount = await Post.countDocuments({ owner: user._id });

    const following = await Follow.exists({
      follower: req.user._id,
      followee: user._id,
      status: "following",
    });

    const requested = await Follow.exists({
      follower: req.user._id,
      followee: user._id,
      status: "requested",
    });

    const followedBy = await Follow.exists({
      follower: user._id,
      followee: req.user._id,
      status: "following",
    });

    const profileData = {
      username: user.username,
      fullName: user.fullName,
      avatar: user.avatar,
      bio: user.bio,
      link: user.link,
      isPrivate: user.isPrivate,
      isVerified: user.isVerified,
      isMe,

      stats: {
        posts: postsCount,
        followers: user.stats?.followers || 0,
        following: user.stats?.following || 0,
      },

      relationship: {
        following: !!following,
        requested: !!requested,
        followedBy: !!followedBy,
      },

      highlights: user.highlights || [],
    };

    // ✅ LOG TO CHECK OUTPUT
    console.log("➡️ Profile Response:", profileData.stats);

    res.json(profileData);
  } catch (error) {
    console.error("❌ getProfile Error:", error);
    res.status(500).json({ error: { message: error.message } });
  }
};



// =====================
// FOLLOW USER
// =====================
export const followUser = async (req, res) => {
  try {
    const target = await User.findOne({ username: req.params.username });
    if (!target) return res.status(404).json({ error: { message: "User not found" } });

    const existingFollow = await Follow.findOne({
      follower: req.user._id,
      followee: target._id,
    });

    if (existingFollow) {
      return res.status(400).json({ error: { message: "Already following or requested" } });
    }

    // 🔒 PRIVATE → request
    if (target.isPrivate) {
      await Follow.create({
        follower: req.user._id,
        followee: target._id,
        status: "requested",
      });

      // ✅ Notification
      await sendNotification({
        senderId: req.user._id,
        receiverId: target._id,
        type: "follow_request",
        message: `${req.user.username} sent you a follow request`,
        io: req.io,
      });

      return res.json({
        relationship: { following: false, requested: true, followedBy: false },
      });
    }

    // ✅ PUBLIC → auto-follow
    await Follow.create({
      follower: req.user._id,
      followee: target._id,
      status: "following",
    });

    await User.findByIdAndUpdate(target._id, { $inc: { "stats.followers": 1 } });
    await User.findByIdAndUpdate(req.user._id, { $inc: { "stats.following": 1 } });

    // ✅ Notification
    await sendNotification({
      senderId: req.user._id,
      receiverId: target._id,
      type: "follow",
      message: `${req.user.username} started following you`,
      io: req.io,
    });

    res.json({
      relationship: { following: true, requested: false, followedBy: false },
    });
  } catch (error) {
    res.status(400).json({ error: { message: error.message } });
  }
};



// =====================
// UNFOLLOW USER
// =====================
export const unfollowUser = async (req, res) => {
  try {
    const target = await User.findOne({ username: req.params.username });
    if (!target) return res.status(404).json({ error: { message: "User not found" } });

    const followRecord = await Follow.findOne({
      follower: req.user._id,
      followee: target._id,
    });

    if (!followRecord) {
      return res.status(400).json({ error: { message: "Not following this user" } });
    }

    await Follow.deleteOne({ _id: followRecord._id });

    if (followRecord.status === "following") {
      await User.findByIdAndUpdate(target._id, { $inc: { "stats.followers": -1 } });
      await User.findByIdAndUpdate(req.user._id, { $inc: { "stats.following": -1 } });
    }

    return res.json({
      relationship: { following: false, requested: false, followedBy: false },
    });
  } catch (error) {
    res.status(400).json({ error: { message: error.message } });
  }
};

// GET ALL USERS
export const getAllUsers = async (req, res) => {
  try {
    const currentUserId = req.user._id;

    const users = await User.find({ _id: { $ne: currentUserId } })
      .select("-password")
      .lean();

    const usersWithExtras = await Promise.all(
      users.map(async (user) => {
        const [isFollowing, isRequested] = await Promise.all([
          Follow.exists({ follower: currentUserId, followee: user._id, status: "following" }),
          Follow.exists({ follower: currentUserId, followee: user._id, status: "requested" }),
        ]);

        const unreadCount = await Message.countDocuments({
          sender: user._id,
          receiver: currentUserId,
          readBy: { $ne: currentUserId },
          deletedFor: { $ne: currentUserId },
          deletedForEveryone: false,
        });

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

    res.status(200).json({
      status: "success",
      message: "Users fetched successfully",
      users: usersWithExtras,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Failed to fetch users.", error: error.message });
  }
};
// DECLINE FOLLOW REQUEST
export const declineFollowRequest = async (req, res) => {
  try {
    const requester = await User.findOne({ username: req.params.username });
    if (!requester) return res.status(404).json({ error: { message: "User not found" } });

    const deleted = await Follow.findOneAndDelete({
      follower: requester._id,
      followee: req.user._id,
      status: "requested",
    });

    if (!deleted) {
      return res.status(400).json({ error: { message: "No pending request" } });
    }

    res.json({
      status: "success",
      message: "Follow request declined",
      relationship: { following: false, requested: false },
    });
  } catch (error) {
    res.status(500).json({ error: { message: error.message } });
  }
};


// ACCEPT FOLLOW REQUEST

export const acceptFollowRequest = async (req, res) => {
  try {
    const requester = await User.findOne({ username: req.params.username });
    if (!requester) return res.status(404).json({ error: { message: "User not found" } });

    const request = await Follow.findOne({
      follower: requester._id,
      followee: req.user._id,
      status: "requested",
    });

    if (!request) {
      return res.status(400).json({ error: { message: "No pending request" } });
    }

    request.status = "following";
    await request.save();

    await User.findByIdAndUpdate(requester._id, { $inc: { "stats.following": 1 } });
    await User.findByIdAndUpdate(req.user._id, { $inc: { "stats.followers": 1 } });

    // ✅ Notification
    await sendNotification({
      senderId: req.user._id,
      receiverId: requester._id,
      type: "follow_request_accepted",
      message: `${req.user.username} accepted your follow request`,
      io: req.io,
    });

    res.json({
      status: "success",
      message: "Follow request accepted",
      relationship: { following: true },
    });
  } catch (error) {
    res.status(500).json({ error: { message: error.message } });
  }
};

// GET PENDING FOLLOW REQUESTS
export const getPendingFollowRequests = async (req, res) => {
  try {
    const requests = await Follow.find({
      followee: req.user._id,
      status: "requested",
    })
      .populate("follower", "username fullName avatar")
      .lean();

    res.status(200).json({
      status: "success",
      count: requests.length,
      requests,
    });
  } catch (error) {
    res.status(500).json({ error: { message: error.message } });
  }
};

// CANCEL SENT FOLLOW REQUEST
export const cancelFollowRequest = async (req, res) => {
  try {
    const target = await User.findOne({ username: req.params.username });
    if (!target) return res.status(404).json({ error: { message: "User not found" } });

    const request = await Follow.findOne({
      follower: req.user._id,
      followee: target._id,
      status: "requested",
    });

    if (!request) {
      return res.status(400).json({ error: { message: "No pending follow request" } });
    }

    await Follow.deleteOne({ _id: request._id });

    // ✅ Notification
    await sendNotification({
      senderId: req.user._id,
      receiverId: target._id,
      type: "follow_request_canceled",
      message: `${req.user.username} cancelled the follow request`,
      io: req.io,
    });

    return res.json({
      status: "success",
      message: "Follow request cancelled",
      relationship: { following: false, requested: false },
    });
  } catch (error) {
    return res.status(500).json({ error: { message: error.message } });
  }
};
