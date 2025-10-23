
// // server-side: socketHandler.js

// import Message from "./models/Message.js";
// import User from "./models/User.js";
// import Group from "./models/Group.js";
// import Wallpaper from "./models/Wallpaper.js";
// import Post from "./models/Post.js"; // ADDED



// import { verifySocketToken } from "./middlewares/auth-middleware.js";
// import mongoose from "mongoose";

// const onlineUsers = new Map();
// const tempToRealMap = new Map();

// // Helper functions
// const isTempId = (id) => typeof id === 'string' && id.startsWith('temp-');

// const buildChatList = async (uid) => {
//   console.log(`🔍 [buildChatList] Building chat list for user: ${uid}`);
//   try {
//     const messages = await Message.find({
//       $or: [{ sender: uid }, { receiver: uid }],
//       deletedFor: { $ne: uid },
//       deletedForEveryone: { $ne: true }
//     })
//     .sort({ createdAt: -1 })
//     .limit(500)
//     .lean();

//     const map = new Map();
    
//     for (const msg of messages) {
//       const friendId = String(msg.sender) === String(uid) ? String(msg.receiver) : String(msg.sender);

//       if (!friendId || friendId === uid) continue;

//       if (!map.has(friendId)) {
//         map.set(friendId, { friendId, lastMessage: msg, unreadCount: 0 });
//       }

//       if (String(msg.receiver) === String(uid) && !(msg.readBy || []).map(String).includes(String(uid))) {
//         map.get(friendId).unreadCount += 1;
//       }
//     }

//     console.log(`✅ [buildChatList] Chat list built with ${map.size} conversations`);
//     return Array.from(map.values());
//   } catch (error) {
//     console.error(`❌ [buildChatList] Error:`, error);
//     return [];
//   }
// };

// const validateUser = async (userId) => {
//   try {
//     return await User.findById(userId);
//   } catch (error) {
//     return null;
//   }
// };

// const socketHandler = (io) => {
//   // =========================
//   // AUTH MIDDLEWARE
//   // =========================
//   io.use(async (socket, next) => {
//     try {
//       const token = socket.handshake.auth?.token;
//       if (!token) {
//         console.log(`❌ [Auth] No token provided`);
//         return next(new Error("Auth token missing"));
//       }

//       const user = await verifySocketToken(token);
//       if (!user) {
//         console.log(`❌ [Auth] Token verification failed`);
//         return next(new Error("Unauthorized"));
//       }

//       socket.user = { _id: String(user._id), username: user.username };
//       console.log(`✅ [Auth] User authenticated: ${socket.user._id} (${socket.user.username})`);
//       next();
//     } catch (err) {
//       console.error("❌ [Auth] Error:", err.message);
//       next(new Error("Unauthorized"));
//     }
//   });

//   // =========================
//   // CONNECTION
//   // =========================
//   io.on("connection", async (socket) => {
//     const userId = socket.user._id;
//     const username = socket.user.username;
//     console.log(`🟢 [Connection] User connected: ${userId} (${username})`);

//     // Setup user connection
//     if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
//     onlineUsers.get(userId).add(socket.id);
//     socket.join(userId);

//     try {
//       await User.findByIdAndUpdate(userId, { isOnline: true, lastActive: new Date() });
//       io.emit("user-status", { userId, isOnline: true });
//     } catch (error) {
//       console.error(`❌ [Connection] Error marking online:`, error);
//     }

//     // =========================
//     // POST EVENTS - NEWLY ADDED
//     // =========================

//     socket.on("createPost", async ({ caption, location, image, tempId }) => {
//       console.log(`📸 [createPost] User ${userId} creating post`);
      
//       try {
//         if (!caption) {
//           return io.to(socket.id).emit("post-error", { tempId, error: "Caption is required" });
//         }

//         // Create post
//         const post = await Post.create({
//           owner: userId,
//           caption,
//           location: location || "",
//           image: image || null,
//         });

//         // Populate owner info
//         await post.populate('owner', 'username profilePic');

//         // Increment user posts count
//         await User.findByIdAndUpdate(
//           userId,
//           { $inc: { postsCount: 1 } }
//         );

//         const postData = {
//           id: post._id.toString(),
//           user: {
//             id: post.owner._id.toString(),
//             username: post.owner.username,
//             avatar: post.owner.profilePic
//           },
//           image: post.image,
//           caption: post.caption,
//           location: post.location,
//           likes: 0,
//           liked: false,
//           comments: [],
//           createdAt: post.createdAt,
//           _temp: false
//         };

//         if (tempId) {
//           tempToRealMap.set(tempId, post._id.toString());
//         }

//         // Emit to all connected users (like Instagram feed)
//         io.emit("newPost", postData);
//         io.to(socket.id).emit("post-created", { tempId, realId: post._id.toString() });

//         console.log(`✅ [createPost] Post created: ${post._id} by ${userId}`);
//       } catch (err) {
//         console.error("❌ [createPost] ERROR:", err);
//         io.to(socket.id).emit("post-error", { tempId, error: err.message });
//       }
//     });

//     socket.on("likePost", async ({ postId, userId: likerId }) => {
//       console.log(`❤️ [likePost] User ${likerId} liking post ${postId}`);
      
//       try {
//         if (!mongoose.Types.ObjectId.isValid(postId)) {
//           return io.to(socket.id).emit("like-error", { postId, error: "Invalid post ID" });
//         }

//         const post = await Post.findById(postId);
//         if (!post) {
//           return io.to(socket.id).emit("like-error", { postId, error: "Post not found" });
//         }

//         const isLiked = post.likes.some(like => 
//           like._id ? like._id.toString() === likerId : like.toString() === likerId
//         );

//         let updatedPost;
//         if (isLiked) {
//           // Unlike post
//           updatedPost = await Post.findByIdAndUpdate(
//             postId,
//             { 
//               $pull: { likes: likerId },
//               $inc: { likesCount: -1 }
//             },
//             { new: true }
//           ).populate('owner', 'username profilePic');
//         } else {
//           // Like post
//           updatedPost = await Post.findByIdAndUpdate(
//             postId,
//             { 
//               $addToSet: { likes: likerId },
//               $inc: { likesCount: 1 }
//             },
//             { new: true }
//           ).populate('owner', 'username profilePic');
//         }

//         const likeData = {
//           postId,
//           likesCount: updatedPost.likesCount,
//           likedBy: updatedPost.likes,
//           liked: !isLiked
//         };

//         // Emit to all connected users
//         io.emit("postLiked", likeData);

//         console.log(`✅ [likePost] Post ${postId} liked by ${likerId}, likes: ${updatedPost.likesCount}`);
//       } catch (err) {
//         console.error("❌ [likePost] ERROR:", err);
//         io.to(socket.id).emit("like-error", { postId, error: err.message });
//       }
//     });

//     socket.on("commentOnPost", async ({ postId, comment, tempId }) => {
//       console.log(`💬 [commentOnPost] User ${userId} commenting on post ${postId}`);
      
//       try {
//         if (!mongoose.Types.ObjectId.isValid(postId)) {
//           return io.to(socket.id).emit("comment-error", { tempId, error: "Invalid post ID" });
//         }

//         if (!comment || comment.trim() === '') {
//           return io.to(socket.id).emit("comment-error", { tempId, error: "Comment text is required" });
//         }

//         const post = await Post.findById(postId);
//         if (!post) {
//           return io.to(socket.id).emit("comment-error", { tempId, error: "Post not found" });
//         }

//         const newComment = {
//           user: userId,
//           text: comment.trim(),
//           createdAt: new Date()
//         };

//         const updatedPost = await Post.findByIdAndUpdate(
//           postId,
//           { 
//             $push: { comments: newComment },
//             $inc: { commentsCount: 1 }
//           },
//           { new: true }
//         ).populate('owner', 'username profilePic')
//          .populate('comments.user', 'username profilePic');

//         const addedComment = updatedPost.comments[updatedPost.comments.length - 1];

//         const commentData = {
//           id: addedComment._id.toString(),
//           user: {
//             id: addedComment.user._id.toString(),
//             username: addedComment.user.username
//           },
//           text: addedComment.text,
//           createdAt: addedComment.createdAt
//         };

//         if (tempId) {
//           tempToRealMap.set(tempId, addedComment._id.toString());
//         }

//         // Emit to all connected users
//         io.emit("postCommented", {
//           postId,
//           comment: commentData
//         });

//         io.to(socket.id).emit("comment-added", { 
//           tempId, 
//           realId: addedComment._id.toString() 
//         });

//         console.log(`✅ [commentOnPost] Comment added to post ${postId} by ${userId}`);
//       } catch (err) {
//         console.error("❌ [commentOnPost] ERROR:", err);
//         io.to(socket.id).emit("comment-error", { tempId, error: err.message });
//       }
//     });

//     socket.on("deletePost", async ({ postId }) => {
//       console.log(`🗑️ [deletePost] User ${userId} deleting post ${postId}`);
      
//       try {
//         if (!mongoose.Types.ObjectId.isValid(postId)) {
//           return io.to(socket.id).emit("delete-post-error", { postId, error: "Invalid post ID" });
//         }

//         const post = await Post.findById(postId);
//         if (!post) {
//           return io.to(socket.id).emit("delete-post-error", { postId, error: "Post not found" });
//         }

//         // Check if user owns the post
//         if (post.owner.toString() !== userId) {
//           return io.to(socket.id).emit("delete-post-error", { postId, error: "Not authorized to delete this post" });
//         }

//         await Post.findByIdAndDelete(postId);

//         // Decrement user posts count
//         await User.findByIdAndUpdate(
//           userId,
//           { $inc: { postsCount: -1 } }
//         );

//         // Emit to all connected users
//         io.emit("postDeleted", postId);

//         console.log(`✅ [deletePost] Post ${postId} deleted by ${userId}`);
//       } catch (err) {
//         console.error("❌ [deletePost] ERROR:", err);
//         io.to(socket.id).emit("delete-post-error", { postId, error: err.message });
//       }
//     });

//     socket.on("deleteComment", async ({ postId, commentId }) => {
//       console.log(`🗑️ [deleteComment] User ${userId} deleting comment ${commentId} from post ${postId}`);
      
//       try {
//         if (!mongoose.Types.ObjectId.isValid(postId) || !mongoose.Types.ObjectId.isValid(commentId)) {
//           return io.to(socket.id).emit("delete-comment-error", { commentId, error: "Invalid post ID or comment ID" });
//         }

//         const post = await Post.findById(postId);
//         if (!post) {
//           return io.to(socket.id).emit("delete-comment-error", { commentId, error: "Post not found" });
//         }

//         const comment = post.comments.id(commentId);
//         if (!comment) {
//           return io.to(socket.id).emit("delete-comment-error", { commentId, error: "Comment not found" });
//         }

//         // Check if user owns the comment or the post
//         if (comment.user.toString() !== userId && post.owner.toString() !== userId) {
//           return io.to(socket.id).emit("delete-comment-error", { commentId, error: "Not authorized to delete this comment" });
//         }

//         await Post.findByIdAndUpdate(
//           postId,
//           { 
//             $pull: { comments: { _id: commentId } },
//             $inc: { commentsCount: -1 }
//           }
//         );

//         // Emit to all connected users
//         io.emit("commentDeleted", {
//           postId,
//           commentId
//         });

//         console.log(`✅ [deleteComment] Comment ${commentId} deleted from post ${postId}`);
//       } catch (err) {
//         console.error("❌ [deleteComment] ERROR:", err);
//         io.to(socket.id).emit("delete-comment-error", { commentId, error: err.message });
//       }
//     });

//     // =========================
//     // 1-1 CHAT EVENTS
//     // =========================

//     socket.on("fetch-chatlist", async () => {
//       console.log(`📋 [fetch-chatlist] Request from: ${userId}`);
//       try {
//         const chatlist = await buildChatList(userId);
//         io.to(userId).emit("initial-chatlist", chatlist);
//       } catch (err) {
//         console.error("❌ [fetch-chatlist] Error:", err);
//       }
//     });

//     socket.on("send-message", async ({ receiver, content, image, tempId, replyTo }) => {
//       console.log(`📤 [send-message] From ${userId} to ${receiver}`);
      
//       if (!receiver) {
//         return io.to(socket.id).emit("message-error", { tempId, error: "No receiver specified" });
//       }

//       if (receiver === userId) {
//         return io.to(socket.id).emit("message-error", { tempId, error: "Cannot send message to yourself" });
//       }

//       if (!await validateUser(receiver)) {
//         return io.to(socket.id).emit("message-error", { tempId, error: "Receiver not found" });
//       }

//       try {
//         const msgData = {
//           sender: userId,
//           receiver,
//           content: content || "",
//           image: image || null,
//           readBy: [userId],
//         };

//         if (replyTo && mongoose.Types.ObjectId.isValid(replyTo)) {
//           msgData.replyTo = replyTo;
//         }

//         const msg = await Message.create(msgData);
//         await msg.populate("sender", "username");
//         await msg.populate("receiver", "username");
//         if (msgData.replyTo) await msg.populate("replyTo");

//         if (tempId) {
//           tempToRealMap.set(tempId, msg._id.toString());
//         }

//         const messageToEmit = { message: msg, tempId, realId: msg._id.toString() };

//         // Emit to both users
//         io.to(userId).emit("new-message", messageToEmit);
//         io.to(receiver).emit("new-message", messageToEmit);
//         io.to(socket.id).emit("message-sent", { tempId, realId: msg._id });

//         console.log(`✅ [send-message] Message sent: ${msg._id}`);
//       } catch (err) {
//         console.error(`❌ [send-message] Error:`, err);
//         io.to(socket.id).emit("message-error", { tempId, error: err.message });
//       }
//     });

//     // =========================
//     // WALLPAPER EVENTS
//     // =========================

//     socket.on("chat/wallpaper", async ({ friendId, wallpaper }) => {
//       console.log(`🎨 [chat/wallpaper] User ${userId} setting wallpaper for chat with ${friendId}`);
      
//       try {
//         if (!friendId) {
//           return io.to(socket.id).emit("wallpaper-error", { error: "Friend ID is required" });
//         }

//         // Validate friend exists
//         const friend = await User.findById(friendId);
//         if (!friend) {
//           return io.to(socket.id).emit("wallpaper-error", { error: "Friend not found" });
//         }

//         // Upsert wallpaper setting
//         await Wallpaper.findOneAndUpdate(
//           { userId, friendId },
//           { wallpaper, updatedAt: new Date() },
//           { upsert: true, new: true }
//         );

//         // Notify both users
//         io.to(userId).emit("chat-wallpaper-updated", { friendId, wallpaper });
//         io.to(friendId).emit("chat-wallpaper-updated", { friendId: userId, wallpaper });

//         console.log(`✅ [chat/wallpaper] Wallpaper updated for chat between ${userId} and ${friendId}`);
//       } catch (err) {
//         console.error("❌ [chat/wallpaper] ERROR:", err);
//         io.to(socket.id).emit("wallpaper-error", { error: err.message });
//       }
//     });

//     // ... (rest of your existing chat and group events remain the same)

//     // =========================
//     // DISCONNECT
//     // =========================
//     socket.on("disconnect", async () => {
//       console.log(`🔴 [Disconnect] User disconnected: ${userId}`);
//       try {
//         onlineUsers.get(userId)?.delete(socket.id);
//         if (!onlineUsers.get(userId)?.size) {
//           onlineUsers.delete(userId);
//           await User.findByIdAndUpdate(userId, { isOnline: false, lastActive: new Date() });
//           io.emit("user-status", { userId, isOnline: false });
//         }
//       } catch (err) {
//         console.error("❌ [Disconnect] ERROR:", err);
//       }
//     });
//   });

//   console.log(`🎯 Socket handler initialized successfully with POST events`);
// };

// export default socketHandler;























import Message from "./models/Message.js";
import User from "./models/User.js";
import Group from "./models/Group.js";
import Wallpaper from "./models/Wallpaper.js";
import Share from "./models/Share.js";
import Post from "./models/Post.js"; // ADDED
import { verifySocketToken } from "./middlewares/auth-middleware.js";
import mongoose from "mongoose"

// import { verifySocketToken } from "../middlewares/auth-middleware.js";

const onlineUsers = new Map();      // userId => Set(socketIds)
const tempToRealMap = new Map();   // clientTempId => realId

// Helpers
const isTempId = (id) => typeof id === "string" && id.startsWith("temp-");

const validateUser = async (userId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) return null;
    return await User.findById(userId);
  } catch (err) {
    return null;
  }
};

const buildChatList = async (uid) => {
  console.log(`🔍 [buildChatList] Building chat list for user: ${uid}`);
  try {
    const messages = await Message.find({
      $or: [{ sender: uid }, { receiver: uid }],
      deletedFor: { $ne: uid },
      deletedForEveryone: { $ne: true },
    })
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    const map = new Map();

    for (const msg of messages) {
      const friendId = String(msg.sender) === String(uid) ? String(msg.receiver) : String(msg.sender);
      if (!friendId || friendId === uid) continue;

      if (!map.has(friendId)) {
        map.set(friendId, { friendId, lastMessage: msg, unreadCount: 0 });
      }

      if (String(msg.receiver) === String(uid) && !(msg.readBy || []).map(String).includes(String(uid))) {
        map.get(friendId).unreadCount += 1;
      }
    }

    console.log(`✅ [buildChatList] Chat list built with ${map.size} conversations`);
    return Array.from(map.values());
  } catch (error) {
    console.error(`❌ [buildChatList] Error:`, error);
    return [];
  }
};

const socketHandler = (io) => {
  // AUTH middleware for sockets
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        console.log(`❌ [Auth] No token provided`);
        return next(new Error("Auth token missing"));
      }

      const user = await verifySocketToken(token);
      if (!user) {
        console.log(`❌ [Auth] Token verification failed`);
        return next(new Error("Unauthorized"));
      }

      socket.user = { _id: String(user._id), username: user.username };
      console.log(`✅ [Auth] User authenticated: ${socket.user._id} (${socket.user.username})`);
      return next();
    } catch (err) {
      console.error("❌ [Auth] Error:", err?.message || err);
      return next(new Error("Unauthorized"));
    }
  });

  // On connection
  io.on("connection", async (socket) => {
    const userId = socket.user._id;
    const username = socket.user.username;
    console.log(`🟢 [Connection] User connected: ${userId} (${username}) socket:${socket.id}`);

    // Register online socket
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId).add(socket.id);

    // Join room by userId so we can emit to the user easily
    socket.join(userId);

    try {
      await User.findByIdAndUpdate(userId, { isOnline: true, lastActive: new Date() });
      io.emit("user-status", { userId, isOnline: true });
    } catch (error) {
      console.error(`❌ [Connection] Error marking online:`, error);
    }

    // -------------------------
    // POST EVENTS
    // -------------------------
   socket.on("createPost", async ({ caption, location, image, tempId }) => {
      console.log(`📸 [createPost] ${username} creating post`);
      try {
        if (!caption?.trim()) {
          return io.to(socket.id).emit("post-error", { tempId, error: "Caption is required" });
        }

        // Ensure image is relative path, not base64
        if (image && image.startsWith("data:")) {
          return io.to(socket.id).emit("post-error", { tempId, error: "Invalid image format. Use /uploads path." });
        }

        const post = await Post.create({
          owner: userId,
          caption: caption.trim(),
          location: location || "",
          image: image || null, // e.g., "/uploads/abc123.png"
        });

        await post.populate("owner", "username profilePic");

        await User.findByIdAndUpdate(userId, { $inc: { postsCount: 1 } });

        const postData = {
          id: post._id.toString(),
          user: {
            id: post.owner._id.toString(),
            username: post.owner.username,
            avatar: post.owner.profilePic,
          },
          image: post.image,
          caption: post.caption,
          location: post.location,
          likes: 0,
          liked: false,
          comments: [],
          createdAt: post.createdAt,
          _temp: false,
        };

        if (tempId && isTempId(tempId)) {
          tempToRealMap.set(tempId, post._id.toString());
        }

        io.emit("newPost", postData);
        io.to(socket.id).emit("post-created", { tempId, realId: post._id.toString() });

        console.log(`✅ [createPost] Post created: ${post._id} by ${userId}`);
      } catch (err) {
        console.error("❌ [createPost] ERROR:", err);
        io.to(socket.id).emit("post-error", { tempId, error: err.message });
      }
    });

    socket.on("likePost", async ({ postId, userId: likerId }) => {
      console.log(`❤️ [likePost] User ${likerId} liking post ${postId}`);
      try {
        if (!mongoose.Types.ObjectId.isValid(postId)) {
          return io.to(socket.id).emit("like-error", { postId, error: "Invalid post ID" });
        }

        const post = await Post.findById(postId);
        if (!post) {
          return io.to(socket.id).emit("like-error", { postId, error: "Post not found" });
        }

        const isLiked = post.likes.some((like) =>
          like._id ? like._id.toString() === likerId : like.toString() === likerId
        );

        let updatedPost;
        if (isLiked) {
          updatedPost = await Post.findByIdAndUpdate(
            postId,
            { $pull: { likes: likerId }, $inc: { likesCount: -1 } },
            { new: true }
          ).populate("owner", "username profilePic");
        } else {
          updatedPost = await Post.findByIdAndUpdate(
            postId,
            { $addToSet: { likes: likerId }, $inc: { likesCount: 1 } },
            { new: true }
          ).populate("owner", "username profilePic");
        }

        const likeData = {
          postId,
          likesCount: updatedPost.likesCount,
          likedBy: updatedPost.likes,
          liked: !isLiked,
        };

        io.emit("postLiked", likeData);
        console.log(`✅ [likePost] Post ${postId} liked by ${likerId}, likes: ${updatedPost.likesCount}`);
      } catch (err) {
        console.error("❌ [likePost] ERROR:", err);
        io.to(socket.id).emit("like-error", { postId, error: err.message });
      }
    });

    socket.on("commentOnPost", async ({ postId, comment, tempId }) => {
      console.log(`💬 [commentOnPost] User ${userId} commenting on post ${postId}`);
      try {
        if (!mongoose.Types.ObjectId.isValid(postId)) {
          return io.to(socket.id).emit("comment-error", { tempId, error: "Invalid post ID" });
        }
        if (!comment || comment.trim() === "") {
          return io.to(socket.id).emit("comment-error", { tempId, error: "Comment text is required" });
        }

        const post = await Post.findById(postId);
        if (!post) {
          return io.to(socket.id).emit("comment-error", { tempId, error: "Post not found" });
        }

        const newComment = {
          user: userId,
          text: comment.trim(),
          createdAt: new Date(),
        };

        const updatedPost = await Post.findByIdAndUpdate(
          postId,
          { $push: { comments: newComment }, $inc: { commentsCount: 1 } },
          { new: true }
        )
          .populate("owner", "username profilePic")
          .populate("comments.user", "username profilePic");

        const addedComment = updatedPost.comments[updatedPost.comments.length - 1];

        const commentData = {
          id: addedComment._id.toString(),
          user: {
            id: addedComment.user._id.toString(),
            username: addedComment.user.username,
          },
          text: addedComment.text,
          createdAt: addedComment.createdAt,
        };

        if (tempId && isTempId(tempId)) {
          tempToRealMap.set(tempId, addedComment._id.toString());
        }

        io.emit("postCommented", { postId, comment: commentData });
        io.to(socket.id).emit("comment-added", { tempId, realId: addedComment._id.toString() });

        console.log(`✅ [commentOnPost] Comment added to post ${postId} by ${userId}`);
      } catch (err) {
        console.error("❌ [commentOnPost] ERROR:", err);
        io.to(socket.id).emit("comment-error", { tempId, error: err.message });
      }
    });

    socket.on("deletePost", async ({ postId }) => {
      console.log(`🗑️ [deletePost] User ${userId} deleting post ${postId}`);
      try {
        if (!mongoose.Types.ObjectId.isValid(postId)) {
          return io.to(socket.id).emit("delete-post-error", { postId, error: "Invalid post ID" });
        }

        const post = await Post.findById(postId);
        if (!post) {
          return io.to(socket.id).emit("delete-post-error", { postId, error: "Post not found" });
        }

        if (post.owner.toString() !== userId) {
          return io.to(socket.id).emit("delete-post-error", { postId, error: "Not authorized to delete this post" });
        }

        await Post.findByIdAndDelete(postId);
        await User.findByIdAndUpdate(userId, { $inc: { postsCount: -1 } });

        io.emit("postDeleted", postId);
        console.log(`✅ [deletePost] Post ${postId} deleted by ${userId}`);
      } catch (err) {
        console.error("❌ [deletePost] ERROR:", err);
        io.to(socket.id).emit("delete-post-error", { postId, error: err.message });
      }
    });

    socket.on("deleteComment", async ({ postId, commentId }) => {
      console.log(`🗑️ [deleteComment] User ${userId} deleting comment ${commentId} from post ${postId}`);
      try {
        if (!mongoose.Types.ObjectId.isValid(postId) || !mongoose.Types.ObjectId.isValid(commentId)) {
          return io.to(socket.id).emit("delete-comment-error", { commentId, error: "Invalid post ID or comment ID" });
        }

        const post = await Post.findById(postId);
        if (!post) {
          return io.to(socket.id).emit("delete-comment-error", { commentId, error: "Post not found" });
        }

        const comment = post.comments.id(commentId);
        if (!comment) {
          return io.to(socket.id).emit("delete-comment-error", { commentId, error: "Comment not found" });
        }

        if (comment.user.toString() !== userId && post.owner.toString() !== userId) {
          return io.to(socket.id).emit("delete-comment-error", { commentId, error: "Not authorized to delete this comment" });
        }

        await Post.findByIdAndUpdate(postId, { $pull: { comments: { _id: commentId } }, $inc: { commentsCount: -1 } });

        io.emit("commentDeleted", { postId, commentId });
        console.log(`✅ [deleteComment] Comment ${commentId} deleted from post ${postId}`);
      } catch (err) {
        console.error("❌ [deleteComment] ERROR:", err);
        io.to(socket.id).emit("delete-comment-error", { commentId, error: err.message });
      }
    });

    // -------------------------
    // 1-1 CHAT EVENTS
    // -------------------------
    socket.on("fetch-chatlist", async () => {
      console.log(`📋 [fetch-chatlist] Request from: ${userId}`);
      try {
        const chatlist = await buildChatList(userId);
        io.to(userId).emit("initial-chatlist", chatlist);
      } catch (err) {
        console.error("❌ [fetch-chatlist] Error:", err);
      }
    });

    socket.on("send-message", async ({ receiver, content, image, tempId, replyTo }) => {
      console.log(`📤 [send-message] From ${userId} to ${receiver}`);
      if (!receiver) {
        return io.to(socket.id).emit("message-error", { tempId, error: "No receiver specified" });
      }
      if (receiver === userId) {
        return io.to(socket.id).emit("message-error", { tempId, error: "Cannot send message to yourself" });
      }
      if (!(await validateUser(receiver))) {
        return io.to(socket.id).emit("message-error", { tempId, error: "Receiver not found" });
      }

      try {
        const msgData = {
          sender: userId,
          receiver,
          content: content || "",
          image: image || null,
          readBy: [userId],
        };

        if (replyTo && mongoose.Types.ObjectId.isValid(replyTo)) {
          msgData.replyTo = replyTo;
        }

        const msg = await Message.create(msgData);
        await msg.populate("sender", "username");
        await msg.populate("receiver", "username");
        if (msgData.replyTo) await msg.populate("replyTo");

        if (tempId && isTempId(tempId)) tempToRealMap.set(tempId, msg._id.toString());

        const messageToEmit = { message: msg, tempId, realId: msg._id.toString() };

        io.to(userId).emit("new-message", messageToEmit);
        io.to(receiver).emit("new-message", messageToEmit);
        io.to(socket.id).emit("message-sent", { tempId, realId: msg._id });

        console.log(`✅ [send-message] Message sent: ${msg._id}`);
      } catch (err) {
        console.error(`❌ [send-message] Error:`, err);
        io.to(socket.id).emit("message-error", { tempId, error: err.message });
      }
    });

    // -------------------------
    // WALLPAPER EVENTS
    // -------------------------
    socket.on("chat/wallpaper", async ({ friendId, wallpaper }) => {
      console.log(`🎨 [chat/wallpaper] User ${userId} setting wallpaper for chat with ${friendId}`);
      try {
        if (!friendId) return io.to(socket.id).emit("wallpaper-error", { error: "Friend ID is required" });

        const friend = await User.findById(friendId);
        if (!friend) return io.to(socket.id).emit("wallpaper-error", { error: "Friend not found" });

        await Wallpaper.findOneAndUpdate({ userId, friendId }, { wallpaper, updatedAt: new Date() }, { upsert: true, new: true });

        io.to(userId).emit("chat-wallpaper-updated", { friendId, wallpaper });
        io.to(friendId).emit("chat-wallpaper-updated", { friendId: userId, wallpaper });

        console.log(`✅ [chat/wallpaper] Wallpaper updated for chat between ${userId} and ${friendId}`);
      } catch (err) {
        console.error("❌ [chat/wallpaper] ERROR:", err);
        io.to(socket.id).emit("wallpaper-error", { error: err.message });
      }
    });

    // -------------------------
    // SHARE EVENTS (send_share)
    // Saves Share in DB and emits to receiver in real-time
    // -------------------------
    socket.on("join_user", (joinId) => {
      // Allow clients to explicitly join rooms (optional)
      try {
        if (!joinId) return;
        socket.join(joinId);
        console.log(`🔗 [join_user] socket ${socket.id} joined room ${joinId}`);
      } catch (err) {
        console.error("❌ [join_user] ERROR:", err);
      }
    });

    socket.on("send_share", async (data) => {
      console.log(`🔁 [send_share] Received from ${userId}:`, data);
      try {
        const { senderId, receiverId, postId, message } = data;

        if (!senderId || !receiverId || !postId) {
          return io.to(socket.id).emit("share-error", { error: "senderId, receiverId and postId required" });
        }

        if (!mongoose.Types.ObjectId.isValid(senderId) || !mongoose.Types.ObjectId.isValid(receiverId) || !mongoose.Types.ObjectId.isValid(postId)) {
          return io.to(socket.id).emit("share-error", { error: "Invalid IDs provided" });
        }

        if (!(await validateUser(senderId)) || !(await validateUser(receiverId))) {
          return io.to(socket.id).emit("share-error", { error: "Sender or receiver not found" });
        }

        const post = await Post.findById(postId).select("_id caption image owner");
        if (!post) {
          return io.to(socket.id).emit("share-error", { error: "Post not found" });
        }

        const link = `${process.env.APP_URL?.replace(/\/$/, "") || ""}/post/${postId}`;

        const shareDoc = await Share.create({
          sender: senderId,
          receiver: receiverId,
          post: postId,
          message: message || "",
          link,
        });

        // populate minimal fields for real-time payload
        await shareDoc.populate("sender", "username profilePic");
        await shareDoc.populate("post", "caption image");

        // Emit to receiver room (and to receiver sockets)
        io.to(receiverId).emit("receive_share", shareDoc);

        // Acknowledge sender
        io.to(socket.id).emit("share_sent", { share: shareDoc });

        console.log(`✅ [send_share] Share saved ${shareDoc._id} from ${senderId} -> ${receiverId}`);
      } catch (err) {
        console.error("❌ [send_share] ERROR:", err);
        io.to(socket.id).emit("share-error", { error: err.message || "Server error" });
      }
    });

    // Disconnect handling
    socket.on("disconnect", async () => {
      console.log(`🔴 [Disconnect] Socket disconnected: ${socket.id} for user ${userId}`);
      try {
        onlineUsers.get(userId)?.delete(socket.id);
        if (!onlineUsers.get(userId) || onlineUsers.get(userId).size === 0) {
          onlineUsers.delete(userId);
          await User.findByIdAndUpdate(userId, { isOnline: false, lastActive: new Date() });
          io.emit("user-status", { userId, isOnline: false });
        }
      } catch (err) {
        console.error("❌ [Disconnect] ERROR:", err);
      }
    });
  });

  console.log(`🎯 Socket handler initialized successfully with POST & SHARE events`);
};

export default socketHandler;
