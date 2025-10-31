
// import Message from "./models/Message.js";
// import User from "./models/User.js";
// import Group from "./models/Group.js";
// import Wallpaper from "./models/Wallpaper.js";
// import Share from "./models/Share.js";
// import Post from "./models/Post.js"; // ADDED
// import { verifySocketToken } from "./middlewares/auth-middleware.js";
// import mongoose from "mongoose"

// // import { verifySocketToken } from "../middlewares/auth-middleware.js";

// const onlineUsers = new Map();      // userId => Set(socketIds)
// const tempToRealMap = new Map();   // clientTempId => realId

// // Helpers
// const isTempId = (id) => typeof id === "string" && id.startsWith("temp-");

// const validateUser = async (userId) => {
//   try {
//     if (!mongoose.Types.ObjectId.isValid(userId)) return null;
//     return await User.findById(userId);
//   } catch (err) {
//     return null;
//   }
// };

// const buildChatList = async (uid) => {
//   console.log(`🔍 [buildChatList] Building chat list for user: ${uid}`);
//   try {
//     const messages = await Message.find({
//       $or: [{ sender: uid }, { receiver: uid }],
//       deletedFor: { $ne: uid },
//       deletedForEveryone: { $ne: true },
//     })
//       .sort({ createdAt: -1 })
//       .limit(500)
//       .lean();

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

// const socketHandler = (io) => {
//   // AUTH middleware for sockets
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
//       return next();
//     } catch (err) {
//       console.error("❌ [Auth] Error:", err?.message || err);
//       return next(new Error("Unauthorized"));
//     }
//   });

//   // On connection
//   io.on("connection", async (socket) => {
//     const userId = socket.user._id;
//     const username = socket.user.username;
//     console.log(`🟢 [Connection] User connected: ${userId} (${username}) socket:${socket.id}`);

//     // Register online socket
//     if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
//     onlineUsers.get(userId).add(socket.id);

//     // Join room by userId so we can emit to the user easily
//     socket.join(userId);

//     try {
//       await User.findByIdAndUpdate(userId, { isOnline: true, lastActive: new Date() });
//       io.emit("user-status", { userId, isOnline: true });
//     } catch (error) {
//       console.error(`❌ [Connection] Error marking online:`, error);
//     }

//     // -------------------------
//     // POST EVENTS
//     // -------------------------
//    socket.on("createPost", async ({ caption, location, image, tempId }) => {
//       console.log(`📸 [createPost] ${username} creating post`);
//       try {
//         if (!caption?.trim()) {
//           return io.to(socket.id).emit("post-error", { tempId, error: "Caption is required" });
//         }

//         // Ensure image is relative path, not base64
//         if (image && image.startsWith("data:")) {
//           return io.to(socket.id).emit("post-error", { tempId, error: "Invalid image format. Use /uploads path." });
//         }

//         const post = await Post.create({
//           owner: userId,
//           caption: caption.trim(),
//           location: location || "",
//           image: image || null, // e.g., "/uploads/abc123.png"
//         });

//         await post.populate("owner", "username profilePic");

//         await User.findByIdAndUpdate(userId, { $inc: { postsCount: 1 } });

//         const postData = {
//           id: post._id.toString(),
//           user: {
//             id: post.owner._id.toString(),
//             username: post.owner.username,
//             avatar: post.owner.profilePic,
//           },
//           image: post.image,
//           caption: post.caption,
//           location: post.location,
//           likes: 0,
//           liked: false,
//           comments: [],
//           createdAt: post.createdAt,
//           _temp: false,
//         };

//         if (tempId && isTempId(tempId)) {
//           tempToRealMap.set(tempId, post._id.toString());
//         }

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

//         const isLiked = post.likes.some((like) =>
//           like._id ? like._id.toString() === likerId : like.toString() === likerId
//         );

//         let updatedPost;
//         if (isLiked) {
//           updatedPost = await Post.findByIdAndUpdate(
//             postId,
//             { $pull: { likes: likerId }, $inc: { likesCount: -1 } },
//             { new: true }
//           ).populate("owner", "username profilePic");
//         } else {
//           updatedPost = await Post.findByIdAndUpdate(
//             postId,
//             { $addToSet: { likes: likerId }, $inc: { likesCount: 1 } },
//             { new: true }
//           ).populate("owner", "username profilePic");
//         }

//         const likeData = {
//           postId,
//           likesCount: updatedPost.likesCount,
//           likedBy: updatedPost.likes,
//           liked: !isLiked,
//         };

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
//         if (!comment || comment.trim() === "") {
//           return io.to(socket.id).emit("comment-error", { tempId, error: "Comment text is required" });
//         }

//         const post = await Post.findById(postId);
//         if (!post) {
//           return io.to(socket.id).emit("comment-error", { tempId, error: "Post not found" });
//         }

//         const newComment = {
//           user: userId,
//           text: comment.trim(),
//           createdAt: new Date(),
//         };

//         const updatedPost = await Post.findByIdAndUpdate(
//           postId,
//           { $push: { comments: newComment }, $inc: { commentsCount: 1 } },
//           { new: true }
//         )
//           .populate("owner", "username profilePic")
//           .populate("comments.user", "username profilePic");

//         const addedComment = updatedPost.comments[updatedPost.comments.length - 1];

//         const commentData = {
//           id: addedComment._id.toString(),
//           user: {
//             id: addedComment.user._id.toString(),
//             username: addedComment.user.username,
//           },
//           text: addedComment.text,
//           createdAt: addedComment.createdAt,
//         };

//         if (tempId && isTempId(tempId)) {
//           tempToRealMap.set(tempId, addedComment._id.toString());
//         }

//         io.emit("postCommented", { postId, comment: commentData });
//         io.to(socket.id).emit("comment-added", { tempId, realId: addedComment._id.toString() });

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

//         if (post.owner.toString() !== userId) {
//           return io.to(socket.id).emit("delete-post-error", { postId, error: "Not authorized to delete this post" });
//         }

//         await Post.findByIdAndDelete(postId);
//         await User.findByIdAndUpdate(userId, { $inc: { postsCount: -1 } });

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

//         if (comment.user.toString() !== userId && post.owner.toString() !== userId) {
//           return io.to(socket.id).emit("delete-comment-error", { commentId, error: "Not authorized to delete this comment" });
//         }

//         await Post.findByIdAndUpdate(postId, { $pull: { comments: { _id: commentId } }, $inc: { commentsCount: -1 } });

//         io.emit("commentDeleted", { postId, commentId });
//         console.log(`✅ [deleteComment] Comment ${commentId} deleted from post ${postId}`);
//       } catch (err) {
//         console.error("❌ [deleteComment] ERROR:", err);
//         io.to(socket.id).emit("delete-comment-error", { commentId, error: err.message });
//       }
//     });

//     // -------------------------
//     // 1-1 CHAT EVENTS
//     // -------------------------
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
//       if (!(await validateUser(receiver))) {
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

//         if (tempId && isTempId(tempId)) tempToRealMap.set(tempId, msg._id.toString());

//         const messageToEmit = { message: msg, tempId, realId: msg._id.toString() };

//         io.to(userId).emit("new-message", messageToEmit);
//         io.to(receiver).emit("new-message", messageToEmit);
//         io.to(socket.id).emit("message-sent", { tempId, realId: msg._id });

//         console.log(`✅ [send-message] Message sent: ${msg._id}`);
//       } catch (err) {
//         console.error(`❌ [send-message] Error:`, err);
//         io.to(socket.id).emit("message-error", { tempId, error: err.message });
//       }
//     });

//     // -------------------------
//     // WALLPAPER EVENTS
//     // -------------------------
//     socket.on("chat/wallpaper", async ({ friendId, wallpaper }) => {
//       console.log(`🎨 [chat/wallpaper] User ${userId} setting wallpaper for chat with ${friendId}`);
//       try {
//         if (!friendId) return io.to(socket.id).emit("wallpaper-error", { error: "Friend ID is required" });

//         const friend = await User.findById(friendId);
//         if (!friend) return io.to(socket.id).emit("wallpaper-error", { error: "Friend not found" });

//         await Wallpaper.findOneAndUpdate({ userId, friendId }, { wallpaper, updatedAt: new Date() }, { upsert: true, new: true });

//         io.to(userId).emit("chat-wallpaper-updated", { friendId, wallpaper });
//         io.to(friendId).emit("chat-wallpaper-updated", { friendId: userId, wallpaper });

//         console.log(`✅ [chat/wallpaper] Wallpaper updated for chat between ${userId} and ${friendId}`);
//       } catch (err) {
//         console.error("❌ [chat/wallpaper] ERROR:", err);
//         io.to(socket.id).emit("wallpaper-error", { error: err.message });
//       }
//     });

//     // -------------------------
//     // SHARE EVENTS (send_share)
//     // Saves Share in DB and emits to receiver in real-time
//     // -------------------------
//     socket.on("join_user", (joinId) => {
//       // Allow clients to explicitly join rooms (optional)
//       try {
//         if (!joinId) return;
//         socket.join(joinId);
//         console.log(`🔗 [join_user] socket ${socket.id} joined room ${joinId}`);
//       } catch (err) {
//         console.error("❌ [join_user] ERROR:", err);
//       }
//     });

//     socket.on("send_share", async (data) => {
//       console.log(`🔁 [send_share] Received from ${userId}:`, data);
//       try {
//         const { senderId, receiverId, postId, message } = data;

//         if (!senderId || !receiverId || !postId) {
//           return io.to(socket.id).emit("share-error", { error: "senderId, receiverId and postId required" });
//         }

//         if (!mongoose.Types.ObjectId.isValid(senderId) || !mongoose.Types.ObjectId.isValid(receiverId) || !mongoose.Types.ObjectId.isValid(postId)) {
//           return io.to(socket.id).emit("share-error", { error: "Invalid IDs provided" });
//         }

//         if (!(await validateUser(senderId)) || !(await validateUser(receiverId))) {
//           return io.to(socket.id).emit("share-error", { error: "Sender or receiver not found" });
//         }

//         const post = await Post.findById(postId).select("_id caption image owner");
//         if (!post) {
//           return io.to(socket.id).emit("share-error", { error: "Post not found" });
//         }

//         const link = `${process.env.APP_URL?.replace(/\/$/, "") || ""}/post/${postId}`;

//         const shareDoc = await Share.create({
//           sender: senderId,
//           receiver: receiverId,
//           post: postId,
//           message: message || "",
//           link,
//         });

//         // populate minimal fields for real-time payload
//         await shareDoc.populate("sender", "username profilePic");
//         await shareDoc.populate("post", "caption image");

//         // Emit to receiver room (and to receiver sockets)
//         io.to(receiverId).emit("receive_share", shareDoc);

//         // Acknowledge sender
//         io.to(socket.id).emit("share_sent", { share: shareDoc });

//         console.log(`✅ [send_share] Share saved ${shareDoc._id} from ${senderId} -> ${receiverId}`);
//       } catch (err) {
//         console.error("❌ [send_share] ERROR:", err);
//         io.to(socket.id).emit("share-error", { error: err.message || "Server error" });
//       }
//     });

//     // Disconnect handling
//     socket.on("disconnect", async () => {
//       console.log(`🔴 [Disconnect] Socket disconnected: ${socket.id} for user ${userId}`);
//       try {
//         onlineUsers.get(userId)?.delete(socket.id);
//         if (!onlineUsers.get(userId) || onlineUsers.get(userId).size === 0) {
//           onlineUsers.delete(userId);
//           await User.findByIdAndUpdate(userId, { isOnline: false, lastActive: new Date() });
//           io.emit("user-status", { userId, isOnline: false });
//         }
//       } catch (err) {
//         console.error("❌ [Disconnect] ERROR:", err);
//       }
//     });
//   });

//   console.log(`🎯 Socket handler initialized successfully with POST & SHARE events`);
// };

// export default socketHandler;







// import Message from "./models/Message.js";
// import User from "./models/User.js";
// import Group from "./models/Group.js";
// import Wallpaper from "./models/Wallpaper.js";
// import Share from "./models/Share.js";
// import Post from "./models/Post.js"; // ADDED
// import { verifySocketToken } from "./middlewares/auth-middleware.js";


// import Notification from "./models/Notification.js"; // ADDED
// // import { verifySocketToken } from "./middlewares/auth-middleware.js";
// import mongoose from "mongoose"

// const onlineUsers = new Map();      // userId => Set(socketIds)
// const tempToRealMap = new Map();   // clientTempId => realId

// // Helpers
// const isTempId = (id) => typeof id === "string" && id.startsWith("temp-");

// const validateUser = async (userId) => {
//   try {
//     if (!mongoose.Types.ObjectId.isValid(userId)) return null;
//     return await User.findById(userId);
//   } catch (err) {
//     return null;
//   }
// };

// // NEW: Notification helper functions
// const createNotification = async (data) => {
//   try {
//     const { 
//       type, 
//       fromUser, 
//       toUser, 
//       postId, 
//       messageId, 
//       shareId, 
//       commentId,
//       reelId,
//       extraData = {} 
//     } = data;

//     if (!type || !fromUser || !toUser) {
//       console.error("❌ [createNotification] Missing required fields");
//       return null;
//     }

//     // Don't create notification if user is notifying themselves
//     if (String(fromUser) === String(toUser)) {
//       return null;
//     }

//     const notification = await Notification.create({
//       type,
//       sender: fromUser,
//       receiver: toUser,
//       post: postId,
//       message: messageId,
//       share: shareId,
//       comment: commentId,
//       reel: reelId,
//       text: extraData.text || "",
//       read: false
//     });

//     await notification.populate("sender", "username profilePic");
//     if (postId) await notification.populate("post", "caption image");
//     if (messageId) await notification.populate("message", "content");
//     if (shareId) await notification.populate("share", "message");
//     if (commentId) await notification.populate("comment", "text");
//     if (reelId) await notification.populate("reel", "caption video");

//     return notification;
//   } catch (error) {
//     console.error("❌ [createNotification] Error:", error);
//     return null;
//   }
// };

// // NEW: Emit notification to user
// const emitNotification = async (io, notification, toUserId) => {
//   try {
//     if (!notification) return;

//     const notificationData = {
//       id: notification._id.toString(),
//       type: notification.type,
//       sender: {
//         id: notification.sender._id.toString(),
//         username: notification.sender.username,
//         avatar: notification.sender.profilePic,
//       },
//       receiver: notification.receiver.toString(),
//       post: notification.post ? {
//         id: notification.post._id.toString(),
//         caption: notification.post.caption,
//         image: notification.post.image,
//       } : null,
//       message: notification.message ? {
//         id: notification.message._id.toString(),
//         content: notification.message.content,
//       } : null,
//       share: notification.share ? {
//         id: notification.share._id.toString(),
//         message: notification.share.message,
//       } : null,
//       comment: notification.comment ? {
//         id: notification.comment._id.toString(),
//         text: notification.comment.text,
//       } : null,
//       reel: notification.reel ? {
//         id: notification.reel._id.toString(),
//         caption: notification.reel.caption,
//       } : null,
//       text: notification.text || "",
//       read: notification.read,
//       createdAt: notification.createdAt,
//     };

//     // Emit to specific user
//     io.to(toUserId).emit("new-notification", notificationData);
    
//     // Also update notification count
//     const unreadCount = await Notification.countDocuments({ 
//       receiver: toUserId, 
//       read: false 
//     });
    
//     io.to(toUserId).emit("notification-count", { count: unreadCount });

//     console.log(`🔔 [emitNotification] Notification sent to ${toUserId}: ${notification.type}`);
//   } catch (error) {
//     console.error("❌ [emitNotification] Error:", error);
//   }
// };

// const buildChatList = async (uid) => {
//   console.log(`🔍 [buildChatList] Building chat list for user: ${uid}`);
//   try {
//     const messages = await Message.find({
//       $or: [{ sender: uid }, { receiver: uid }],
//       deletedFor: { $ne: uid },
//       deletedForEveryone: { $ne: true },
//     })
//       .sort({ createdAt: -1 })
//       .limit(500)
//       .lean();

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

// const socketHandler = (io) => {
//   // AUTH middleware for sockets
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
//       return next();
//     } catch (err) {
//       console.error("❌ [Auth] Error:", err?.message || err);
//       return next(new Error("Unauthorized"));
//     }
//   });

//   // On connection
//   io.on("connection", async (socket) => {
//     const userId = socket.user._id;
//     const username = socket.user.username;
//     console.log(`🟢 [Connection] User connected: ${userId} (${username}) socket:${socket.id}`);

//     // Register online socket
//     if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
//     onlineUsers.get(userId).add(socket.id);

//     // Join room by userId so we can emit to the user easily
//     socket.join(userId);

//     // Send initial notification count
//     try {
//       const unreadCount = await Notification.countDocuments({ 
//         receiver: userId, 
//         read: false 
//       });
//       io.to(userId).emit("notification-count", { count: unreadCount });
//     } catch (error) {
//       console.error("❌ [Connection] Error fetching notification count:", error);
//     }

//     try {
//       await User.findByIdAndUpdate(userId, { isOnline: true, lastActive: new Date() });
//       io.emit("user-status", { userId, isOnline: true });
//     } catch (error) {
//       console.error(`❌ [Connection] Error marking online:`, error);
//     }

//     // -------------------------
//     // NOTIFICATION EVENTS
//     // -------------------------
//     socket.on("fetch-notifications", async () => {
//       console.log(`📋 [fetch-notifications] Request from: ${userId}`);
//       try {
//         const notifications = await Notification.find({ receiver: userId })
//           .populate("sender", "username profilePic")
//           .populate("post", "caption image")
//           .populate("reel", "caption video")
//           .populate("comment", "text")
//           .sort({ createdAt: -1 })
//           .limit(50)
//           .lean();

//         const formattedNotifications = notifications.map(notif => ({
//           id: notif._id.toString(),
//           type: notif.type,
//           sender: {
//             id: notif.sender._id.toString(),
//             username: notif.sender.username,
//             avatar: notif.sender.profilePic,
//           },
//           post: notif.post ? {
//             id: notif.post._id.toString(),
//             caption: notif.post.caption,
//             image: notif.post.image,
//           } : null,
//           reel: notif.reel ? {
//             id: notif.reel._id.toString(),
//             caption: notif.reel.caption,
//           } : null,
//           comment: notif.comment ? {
//             id: notif.comment._id.toString(),
//             text: notif.comment.text,
//           } : null,
//           text: notif.text,
//           read: notif.read,
//           createdAt: notif.createdAt,
//         }));

//         io.to(userId).emit("notifications-list", formattedNotifications);
//       } catch (err) {
//         console.error("❌ [fetch-notifications] Error:", err);
//       }
//     });

//     socket.on("mark-notification-read", async ({ notificationId }) => {
//       console.log(`📖 [mark-notification-read] User ${userId} marking notification ${notificationId} as read`);
//       try {
//         await Notification.findByIdAndUpdate(notificationId, { read: true });
        
//         // Update count
//         const unreadCount = await Notification.countDocuments({ 
//           receiver: userId, 
//           read: false 
//         });
//         io.to(userId).emit("notification-count", { count: unreadCount });
        
//         io.to(userId).emit("notification-marked-read", { notificationId });
//       } catch (err) {
//         console.error("❌ [mark-notification-read] Error:", err);
//       }
//     });

//     socket.on("mark-all-notifications-read", async () => {
//       console.log(`📖 [mark-all-notifications-read] User ${userId} marking all as read`);
//       try {
//         await Notification.updateMany(
//           { receiver: userId, read: false },
//           { read: true }
//         );
        
//         io.to(userId).emit("notification-count", { count: 0 });
//         io.to(userId).emit("all-notifications-marked-read");
//       } catch (err) {
//         console.error("❌ [mark-all-notifications-read] Error:", err);
//       }
//     });

//     // -------------------------
//     // POST EVENTS WITH NOTIFICATIONS
//     // -------------------------
//     socket.on("createPost", async ({ caption, location, image, tempId }) => {
//       console.log(`📸 [createPost] ${username} creating post`);
//       try {
//         if (!caption?.trim()) {
//           return io.to(socket.id).emit("post-error", { tempId, error: "Caption is required" });
//         }

//         // Ensure image is relative path, not base64
//         if (image && image.startsWith("data:")) {
//           return io.to(socket.id).emit("post-error", { tempId, error: "Invalid image format. Use /uploads path." });
//         }

//         const post = await Post.create({
//           owner: userId,
//           caption: caption.trim(),
//           location: location || "",
//           image: image || null,
//         });

//         await post.populate("owner", "username profilePic");

//         await User.findByIdAndUpdate(userId, { $inc: { postsCount: 1 } });

//         const postData = {
//           id: post._id.toString(),
//           user: {
//             id: post.owner._id.toString(),
//             username: post.owner.username,
//             avatar: post.owner.profilePic,
//           },
//           image: post.image,
//           caption: post.caption,
//           location: post.location,
//           likes: 0,
//           liked: false,
//           comments: [],
//           createdAt: post.createdAt,
//           _temp: false,
//         };

//         if (tempId && isTempId(tempId)) {
//           tempToRealMap.set(tempId, post._id.toString());
//         }

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

//         const post = await Post.findById(postId).populate("owner");
//         if (!post) {
//           return io.to(socket.id).emit("like-error", { postId, error: "Post not found" });
//         }

//         const isLiked = post.likes.some((like) =>
//           like._id ? like._id.toString() === likerId : like.toString() === likerId
//         );

//         let updatedPost;
//         if (isLiked) {
//           updatedPost = await Post.findByIdAndUpdate(
//             postId,
//             { $pull: { likes: likerId }, $inc: { likesCount: -1 } },
//             { new: true }
//           ).populate("owner", "username profilePic");
//         } else {
//           updatedPost = await Post.findByIdAndUpdate(
//             postId,
//             { $addToSet: { likes: likerId }, $inc: { likesCount: 1 } },
//             { new: true }
//           ).populate("owner", "username profilePic");
//         }

//         const likeData = {
//           postId,
//           likesCount: updatedPost.likesCount,
//           likedBy: updatedPost.likes,
//           liked: !isLiked,
//         };

//         io.emit("postLiked", likeData);

//         // 🔔 SEND NOTIFICATION FOR LIKE
//         if (!isLiked && String(post.owner._id) !== String(likerId)) {
//           const likerUser = await User.findById(likerId);
//           const notification = await createNotification({
//             type: "LIKE_POST",
//             fromUser: likerId,
//             toUser: post.owner._id,
//             postId: postId,
//             extraData: {
//               text: `${likerUser.username} liked your post`
//             }
//           });
//           await emitNotification(io, notification, post.owner._id.toString());
//         }

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
//         if (!comment || comment.trim() === "") {
//           return io.to(socket.id).emit("comment-error", { tempId, error: "Comment text is required" });
//         }

//         const post = await Post.findById(postId).populate("owner");
//         if (!post) {
//           return io.to(socket.id).emit("comment-error", { tempId, error: "Post not found" });
//         }

//         const newComment = {
//           user: userId,
//           text: comment.trim(),
//           createdAt: new Date(),
//         };

//         const updatedPost = await Post.findByIdAndUpdate(
//           postId,
//           { $push: { comments: newComment }, $inc: { commentsCount: 1 } },
//           { new: true }
//         )
//           .populate("owner", "username profilePic")
//           .populate("comments.user", "username profilePic");

//         const addedComment = updatedPost.comments[updatedPost.comments.length - 1];

//         const commentData = {
//           id: addedComment._id.toString(),
//           user: {
//             id: addedComment.user._id.toString(),
//             username: addedComment.user.username,
//           },
//           text: addedComment.text,
//           createdAt: addedComment.createdAt,
//         };

//         if (tempId && isTempId(tempId)) {
//           tempToRealMap.set(tempId, addedComment._id.toString());
//         }

//         io.emit("postCommented", { postId, comment: commentData });
//         io.to(socket.id).emit("comment-added", { tempId, realId: addedComment._id.toString() });

//         // 🔔 SEND NOTIFICATION FOR COMMENT
//         if (String(post.owner._id) !== String(userId)) {
//           const notification = await createNotification({
//             type: "COMMENT_POST",
//             fromUser: userId,
//             toUser: post.owner._id,
//             postId: postId,
//             commentId: addedComment._id,
//             extraData: {
//               text: `${username} commented: "${comment.trim()}"`
//             }
//           });
//           await emitNotification(io, notification, post.owner._id.toString());
//         }

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

//         if (post.owner.toString() !== userId) {
//           return io.to(socket.id).emit("delete-post-error", { postId, error: "Not authorized to delete this post" });
//         }

//         await Post.findByIdAndDelete(postId);
//         await User.findByIdAndUpdate(userId, { $inc: { postsCount: -1 } });

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

//         if (comment.user.toString() !== userId && post.owner.toString() !== userId) {
//           return io.to(socket.id).emit("delete-comment-error", { commentId, error: "Not authorized to delete this comment" });
//         }

//         await Post.findByIdAndUpdate(postId, { $pull: { comments: { _id: commentId } }, $inc: { commentsCount: -1 } });

//         io.emit("commentDeleted", { postId, commentId });
//         console.log(`✅ [deleteComment] Comment ${commentId} deleted from post ${postId}`);
//       } catch (err) {
//         console.error("❌ [deleteComment] ERROR:", err);
//         io.to(socket.id).emit("delete-comment-error", { commentId, error: err.message });
//       }
//     });

//     // -------------------------
//     // 1-1 CHAT EVENTS WITH NOTIFICATIONS
//     // -------------------------
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
//       if (!(await validateUser(receiver))) {
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

//         if (tempId && isTempId(tempId)) tempToRealMap.set(tempId, msg._id.toString());

//         const messageToEmit = { message: msg, tempId, realId: msg._id.toString() };

//         io.to(userId).emit("new-message", messageToEmit);
//         io.to(receiver).emit("new-message", messageToEmit);
//         io.to(socket.id).emit("message-sent", { tempId, realId: msg._id });

//         // 🔔 SEND NOTIFICATION FOR MESSAGE
//         const notification = await createNotification({
//           type: "MESSAGE",
//           fromUser: userId,
//           toUser: receiver,
//           messageId: msg._id,
//           extraData: {
//             text: `${username} sent you a message`
//           }
//         });
//         await emitNotification(io, notification, receiver);

//         console.log(`✅ [send-message] Message sent: ${msg._id}`);
//       } catch (err) {
//         console.error(`❌ [send-message] Error:`, err);
//         io.to(socket.id).emit("message-error", { tempId, error: err.message });
//       }
//     });

//     // -------------------------
//     // FOLLOW EVENTS WITH NOTIFICATIONS
//     // -------------------------
//     socket.on("follow-user", async ({ targetUserId }) => {
//       console.log(`👥 [follow-user] User ${userId} following ${targetUserId}`);
//       try {
//         if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
//           return io.to(socket.id).emit("follow-error", { error: "Invalid user ID" });
//         }

//         if (userId === targetUserId) {
//           return io.to(socket.id).emit("follow-error", { error: "Cannot follow yourself" });
//         }

//         const targetUser = await User.findById(targetUserId);
//         if (!targetUser) {
//           return io.to(socket.id).emit("follow-error", { error: "User not found" });
//         }

//         const currentUser = await User.findById(userId);

//         // Check if already following
//         const isFollowing = currentUser.following.includes(targetUserId);
        
//         if (isFollowing) {
//           // Unfollow
//           await User.findByIdAndUpdate(userId, { $pull: { following: targetUserId } });
//           await User.findByIdAndUpdate(targetUserId, { $pull: { followers: userId } });
          
//           io.emit("user-unfollowed", { followerId: userId, targetUserId });
//         } else {
//           // Follow
//           await User.findByIdAndUpdate(userId, { $addToSet: { following: targetUserId } });
//           await User.findByIdAndUpdate(targetUserId, { $addToSet: { followers: userId } });
          
//           io.emit("user-followed", { followerId: userId, targetUserId });

//           // 🔔 SEND NOTIFICATION FOR FOLLOW
//           const notification = await createNotification({
//             type: "FOLLOW_REQUEST",
//             fromUser: userId,
//             toUser: targetUserId,
//             extraData: {
//               text: `${username} started following you`
//             }
//           });
//           await emitNotification(io, notification, targetUserId);
//         }

//         console.log(`✅ [follow-user] ${isFollowing ? 'Unfollowed' : 'Followed'} ${targetUserId}`);
//       } catch (err) {
//         console.error("❌ [follow-user] ERROR:", err);
//         io.to(socket.id).emit("follow-error", { error: err.message });
//       }
//     });

//     // -------------------------
//     // REEL EVENTS WITH NOTIFICATIONS
//     // -------------------------
//     socket.on("likeReel", async ({ reelId, userId: likerId }) => {
//       console.log(`❤️ [likeReel] User ${likerId} liking reel ${reelId}`);
//       try {
//         // Assuming you have a Reel model similar to Post
//         // const reel = await Reel.findById(reelId).populate("owner");
        
//         // For now, we'll emit a placeholder event
//         io.emit("reelLiked", { reelId, likerId });

//         // 🔔 SEND NOTIFICATION FOR REEL LIKE (placeholder)
//         // const notification = await createNotification({
//         //   type: "REEL_LIKE",
//         //   fromUser: likerId,
//         //   toUser: reel.owner._id,
//         //   reelId: reelId,
//         //   extraData: {
//         //     text: `${username} liked your reel`
//         //   }
//         // });
//         // await emitNotification(io, notification, reel.owner._id.toString());

//         console.log(`✅ [likeReel] Reel ${reelId} liked by ${likerId}`);
//       } catch (err) {
//         console.error("❌ [likeReel] ERROR:", err);
//         io.to(socket.id).emit("reel-like-error", { reelId, error: err.message });
//       }
//     });

//     socket.on("commentOnReel", async ({ reelId, comment, tempId }) => {
//       console.log(`💬 [commentOnReel] User ${userId} commenting on reel ${reelId}`);
//       try {
//         // Assuming you have a Reel model with comments
//         // const reel = await Reel.findById(reelId).populate("owner");
        
//         // For now, we'll emit a placeholder event
//         const commentData = {
//           id: tempId || new mongoose.Types.ObjectId().toString(),
//           user: { id: userId, username: username },
//           text: comment,
//           createdAt: new Date(),
//         };

//         io.emit("reelCommented", { reelId, comment: commentData });
//         io.to(socket.id).emit("reel-comment-added", { tempId, realId: commentData.id });

//         // 🔔 SEND NOTIFICATION FOR REEL COMMENT (placeholder)
//         // const notification = await createNotification({
//         //   type: "REEL_COMMENT",
//         //   fromUser: userId,
//         //   toUser: reel.owner._id,
//         //   reelId: reelId,
//         //   extraData: {
//         //     text: `${username} commented on your reel`
//         //   }
//         // });
//         // await emitNotification(io, notification, reel.owner._id.toString());

//         console.log(`✅ [commentOnReel] Comment added to reel ${reelId} by ${userId}`);
//       } catch (err) {
//         console.error("❌ [commentOnReel] ERROR:", err);
//         io.to(socket.id).emit("reel-comment-error", { tempId, error: err.message });
//       }
//     });

//     // -------------------------
//     // WALLPAPER EVENTS
//     // -------------------------
//     socket.on("chat/wallpaper", async ({ friendId, wallpaper }) => {
//       console.log(`🎨 [chat/wallpaper] User ${userId} setting wallpaper for chat with ${friendId}`);
//       try {
//         if (!friendId) return io.to(socket.id).emit("wallpaper-error", { error: "Friend ID is required" });

//         const friend = await User.findById(friendId);
//         if (!friend) return io.to(socket.id).emit("wallpaper-error", { error: "Friend not found" });

//         await Wallpaper.findOneAndUpdate({ userId, friendId }, { wallpaper, updatedAt: new Date() }, { upsert: true, new: true });

//         io.to(userId).emit("chat-wallpaper-updated", { friendId, wallpaper });
//         io.to(friendId).emit("chat-wallpaper-updated", { friendId: userId, wallpaper });

//         console.log(`✅ [chat/wallpaper] Wallpaper updated for chat between ${userId} and ${friendId}`);
//       } catch (err) {
//         console.error("❌ [chat/wallpaper] ERROR:", err);
//         io.to(socket.id).emit("wallpaper-error", { error: err.message });
//       }
//     });

//     // -------------------------
//     // SHARE EVENTS WITH NOTIFICATIONS
//     // -------------------------
//     socket.on("join_user", (joinId) => {
//       try {
//         if (!joinId) return;
//         socket.join(joinId);
//         console.log(`🔗 [join_user] socket ${socket.id} joined room ${joinId}`);
//       } catch (err) {
//         console.error("❌ [join_user] ERROR:", err);
//       }
//     });

//     socket.on("send_share", async (data) => {
//       console.log(`🔁 [send_share] Received from ${userId}:`, data);
//       try {
//         const { senderId, receiverId, postId, message } = data;

//         if (!senderId || !receiverId || !postId) {
//           return io.to(socket.id).emit("share-error", { error: "senderId, receiverId and postId required" });
//         }

//         if (!mongoose.Types.ObjectId.isValid(senderId) || !mongoose.Types.ObjectId.isValid(receiverId) || !mongoose.Types.ObjectId.isValid(postId)) {
//           return io.to(socket.id).emit("share-error", { error: "Invalid IDs provided" });
//         }

//         if (!(await validateUser(senderId)) || !(await validateUser(receiverId))) {
//           return io.to(socket.id).emit("share-error", { error: "Sender or receiver not found" });
//         }

//         const post = await Post.findById(postId).select("_id caption image owner");
//         if (!post) {
//           return io.to(socket.id).emit("share-error", { error: "Post not found" });
//         }

//         const link = `${process.env.APP_URL?.replace(/\/$/, "") || ""}/post/${postId}`;

//         const shareDoc = await Share.create({
//           sender: senderId,
//           receiver: receiverId,
//           post: postId,
//           message: message || "",
//           link,
//         });

//         // populate minimal fields for real-time payload
//         await shareDoc.populate("sender", "username profilePic");
//         await shareDoc.populate("post", "caption image");

//         // Emit to receiver room (and to receiver sockets)
//         io.to(receiverId).emit("receive_share", shareDoc);

//         // Acknowledge sender
//         io.to(socket.id).emit("share_sent", { share: shareDoc });

//         // 🔔 SEND NOTIFICATION FOR SHARE
//         const notification = await createNotification({
//           type: "MENTION", // Using MENTION for shares
//           fromUser: senderId,
//           toUser: receiverId,
//           shareId: shareDoc._id,
//           postId: postId,
//           extraData: {
//             text: `${username} shared a post with you`
//           }
//         });
//         await emitNotification(io, notification, receiverId);

//         console.log(`✅ [send_share] Share saved ${shareDoc._id} from ${senderId} -> ${receiverId}`);
//       } catch (err) {
//         console.error("❌ [send_share] ERROR:", err);
//         io.to(socket.id).emit("share-error", { error: err.message || "Server error" });
//       }
//     });

//     // Disconnect handling
//     socket.on("disconnect", async () => {
//       console.log(`🔴 [Disconnect] Socket disconnected: ${socket.id} for user ${userId}`);
//       try {
//         onlineUsers.get(userId)?.delete(socket.id);
//         if (!onlineUsers.get(userId) || onlineUsers.get(userId).size === 0) {
//           onlineUsers.delete(userId);
//           await User.findByIdAndUpdate(userId, { isOnline: false, lastActive: new Date() });
//           io.emit("user-status", { userId, isOnline: false });
//         }
//       } catch (err) {
//         console.error("❌ [Disconnect] ERROR:", err);
//       }
//     });
//   });

//   console.log(`🎯 Socket handler initialized successfully with REAL-TIME NOTIFICATIONS for all events`);
// };

// export default socketHandler;









// socketHandler.js
import Message from "./models/Message.js";
import User from "./models/User.js";
import Group from "./models/Group.js";
import Wallpaper from "./models/Wallpaper.js";
import Share from "./models/Share.js";
import Post from "./models/Post.js";
import Follow from "./models/Follow.js";
import Notification from "./models/Notification.js";
import { verifySocketToken } from "./middlewares/auth-middleware.js";
import mongoose from "mongoose";

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

// Normalize notification type to lowercase variant used in schema
const normalizeNotifType = (type) => {
  if (!type) return null;
  return String(type).trim().toLowerCase();
};

// Create notification and populate sender/refs where possible
const createNotification = async (data) => {
  try {
    const {
      type,
      fromUser,
      toUser,
      postId,
      messageId,
      shareId,
      commentId,
      reelId,
      followId,
      extraData = {},
    } = data;

    const notifType = normalizeNotifType(type);
    if (!notifType || !fromUser || !toUser) {
      console.error("❌ [createNotification] Missing required fields");
      return null;
    }

    // don't notify self
    if (String(fromUser) === String(toUser)) return null;

    const payload = {
      type: notifType,
      sender: fromUser,
      receiver: toUser,
      text: extraData.text || "",
      read: false,
    };

    if (postId) payload.post = postId;
    if (reelId) payload.reel = reelId;
    if (followId) payload.follow = followId;
    if (messageId) payload.messageRef = messageId;
    if (shareId) payload.share = shareId;
    if (commentId) payload.comment = commentId;

    const notification = await Notification.create(payload);

    // populate common refs for emission
    await notification.populate("sender", "username avatar profilePic");
    if (notification.post) await notification.populate("post", "caption image owner");
    if (notification.reel) await notification.populate("reel", "caption video owner");
    if (notification.comment) await notification.populate("comment", "text user");
    if (notification.share) await notification.populate("share", "message sender");
    if (notification.messageRef) await notification.populate("messageRef", "content sender receiver");
    if (notification.follow) await notification.populate("follow", "follower followee status");

    return notification;
  } catch (error) {
    console.error("❌ [createNotification] Error:", error);
    return null;
  }
};

// Emit notification and update unread count
const emitNotification = async (io, notification, toUserId) => {
  try {
    if (!notification) return;

    const notif = notification; // already populated in createNotification

    const notificationData = {
      id: notif._id.toString(),
      type: notif.type,
      sender: notif.sender
        ? {
            id: notif.sender._id?.toString(),
            username: notif.sender.username,
            avatar: notif.sender.avatar || notif.sender.profilePic || null,
          }
        : null,
      receiver: notif.receiver?.toString ? notif.receiver.toString() : notif.receiver,
      post: notif.post
        ? { id: notif.post._id.toString(), caption: notif.post.caption, image: notif.post.image }
        : null,
      reel: notif.reel ? { id: notif.reel._id.toString(), caption: notif.reel.caption } : null,
      comment: notif.comment ? { id: notif.comment._id.toString(), text: notif.comment.text } : null,
      share: notif.share ? { id: notif.share._id.toString(), message: notif.share.message } : null,
      message: notif.messageRef ? { id: notif.messageRef._id.toString(), content: notif.messageRef.content } : null,
      follow: notif.follow ? { id: notif.follow._id.toString(), status: notif.follow.status } : null,
      text: notif.text || "",
      read: !!notif.read,
      createdAt: notif.createdAt,
    };

    // Emit single notification payload
    io.to(toUserId).emit("new-notification", notificationData);

    // Update and emit unread count
    const unreadCount = await Notification.countDocuments({ receiver: toUserId, read: false });
    io.to(toUserId).emit("notification-count", { count: unreadCount });

    console.log(`🔔 [emitNotification] Sent ${notif.type} to ${toUserId}`);
  } catch (error) {
    console.error("❌ [emitNotification] Error:", error);
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
    console.log(`🟢 [Connection] ${username} connected (${userId}) socket:${socket.id}`);

    // Track sockets per user
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId).add(socket.id);
    socket.join(userId); // join personal room

    // Send initial unread notification count
    try {
      const unreadCount = await Notification.countDocuments({ receiver: userId, read: false });
      io.to(userId).emit("notification-count", { count: unreadCount });
    } catch (err) {
      console.error("❌ [Connection] Error fetching notification count:", err);
    }

    // mark online
    try {
      await User.findByIdAndUpdate(userId, { isOnline: true, lastActive: new Date() });
      io.emit("user-status", { userId, isOnline: true });
    } catch (error) {
      console.error(`❌ [Connection] Error marking online:`, error);
    }

    // -------------------------
    // NOTIFICATION EVENTS
    // -------------------------
    socket.on("fetch-notifications", async () => {
      try {
        const notifications = await Notification.find({ receiver: userId })
          .populate("sender", "username profilePic avatar")
          .populate("post", "caption image owner")
          .populate("reel", "caption video owner")
          .populate("comment", "text user")
          .populate("share", "message sender")
          .populate("messageRef", "content sender receiver")
          .sort({ createdAt: -1 })
          .limit(50)
          .lean();

        const formatted = notifications.map((notif) => ({
          id: notif._id.toString(),
          type: notif.type,
          sender: notif.sender
            ? { id: notif.sender._id.toString(), username: notif.sender.username, avatar: notif.sender.profilePic || notif.sender.avatar || null }
            : null,
          post: notif.post ? { id: notif.post._id.toString(), caption: notif.post.caption, image: notif.post.image } : null,
          reel: notif.reel ? { id: notif.reel._id.toString(), caption: notif.reel.caption } : null,
          comment: notif.comment ? { id: notif.comment._id.toString(), text: notif.comment.text } : null,
          share: notif.share ? { id: notif.share._id.toString(), message: notif.share.message } : null,
          message: notif.messageRef ? { id: notif.messageRef._id.toString(), content: notif.messageRef.content } : null,
          text: notif.text,
          read: notif.read,
          createdAt: notif.createdAt,
        }));

        io.to(userId).emit("notifications-list", formatted);
      } catch (err) {
        console.error("❌ [fetch-notifications] Error:", err);
      }
    });

    socket.on("mark-notification-read", async ({ notificationId }) => {
      try {
        if (!mongoose.Types.ObjectId.isValid(notificationId)) return;
        await Notification.findByIdAndUpdate(notificationId, { read: true });
        const unreadCount = await Notification.countDocuments({ receiver: userId, read: false });
        io.to(userId).emit("notification-count", { count: unreadCount });
        io.to(userId).emit("notification-marked-read", { notificationId });
      } catch (err) {
        console.error("❌ [mark-notification-read] Error:", err);
      }
    });

    socket.on("mark-all-notifications-read", async () => {
      try {
        await Notification.updateMany({ receiver: userId, read: false }, { read: true });
        io.to(userId).emit("notification-count", { count: 0 });
        io.to(userId).emit("all-notifications-marked-read");
      } catch (err) {
        console.error("❌ [mark-all-notifications-read] Error:", err);
      }
    });

    // -------------------------
    // POST EVENTS
    // -------------------------
    socket.on("createPost", async ({ caption, location, image, tempId }) => {
      try {
        if (!caption?.trim()) {
          return io.to(socket.id).emit("post-error", { tempId, error: "Caption is required" });
        }

        if (image && image.startsWith("data:")) {
          return io.to(socket.id).emit("post-error", { tempId, error: "Invalid image format. Use /uploads path." });
        }

        const post = await Post.create({
          owner: userId,
          caption: caption.trim(),
          location: location || "",
          image: image || null,
        });

        await post.populate("owner", "username profilePic avatar");
        await User.findByIdAndUpdate(userId, { $inc: { postsCount: 1 } });

        const postData = {
          id: post._id.toString(),
          user: { id: post.owner._id.toString(), username: post.owner.username, avatar: post.owner.profilePic || post.owner.avatar || null },
          image: post.image,
          caption: post.caption,
          location: post.location,
          likes: 0,
          liked: false,
          comments: [],
          createdAt: post.createdAt,
          _temp: false,
        };

        if (tempId && isTempId(tempId)) tempToRealMap.set(tempId, post._id.toString());

        io.emit("newPost", postData);
        io.to(socket.id).emit("post-created", { tempId, realId: post._id.toString() });
      } catch (err) {
        console.error("❌ [createPost] ERROR:", err);
        io.to(socket.id).emit("post-error", { tempId, error: err.message });
      }
    });

    socket.on("likePost", async ({ postId, userId: likerId }) => {
      try {
        if (!mongoose.Types.ObjectId.isValid(postId)) {
          return io.to(socket.id).emit("like-error", { postId, error: "Invalid post ID" });
        }

        const post = await Post.findById(postId).populate("owner");
        if (!post) return io.to(socket.id).emit("like-error", { postId, error: "Post not found" });

        const likedBefore = post.likes?.some((like) =>
          like._id ? like._id.toString() === likerId : like.toString() === likerId
        );

        let updatedPost;
        if (likedBefore) {
          updatedPost = await Post.findByIdAndUpdate(postId, { $pull: { likes: likerId }, $inc: { likesCount: -1 } }, { new: true }).populate("owner", "username profilePic");
        } else {
          updatedPost = await Post.findByIdAndUpdate(postId, { $addToSet: { likes: likerId }, $inc: { likesCount: 1 } }, { new: true }).populate("owner", "username profilePic");
        }

        const likeData = {
          postId,
          likesCount: updatedPost.likesCount,
          likedBy: updatedPost.likes,
          liked: !likedBefore,
        };

        io.emit("postLiked", likeData);

        // notification on new like
        if (!likedBefore && String(post.owner._id) !== String(likerId)) {
          const likerUser = await User.findById(likerId);
          const notification = await createNotification({
            type: "like_post",
            fromUser: likerId,
            toUser: post.owner._id,
            postId,
            extraData: { text: `${likerUser?.username || "Someone"} liked your post` },
          });
          await emitNotification(io, notification, post.owner._id.toString());
        }
      } catch (err) {
        console.error("❌ [likePost] ERROR:", err);
        io.to(socket.id).emit("like-error", { postId: err.postId, error: err.message });
      }
    });

    socket.on("commentOnPost", async ({ postId, comment, tempId }) => {
      try {
        if (!mongoose.Types.ObjectId.isValid(postId)) {
          return io.to(socket.id).emit("comment-error", { tempId, error: "Invalid post ID" });
        }
        if (!comment || comment.trim() === "") {
          return io.to(socket.id).emit("comment-error", { tempId, error: "Comment text is required" });
        }

        const post = await Post.findById(postId).populate("owner");
        if (!post) return io.to(socket.id).emit("comment-error", { tempId, error: "Post not found" });

        const newComment = { user: userId, text: comment.trim(), createdAt: new Date() };

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
          user: { id: addedComment.user._id.toString(), username: addedComment.user.username },
          text: addedComment.text,
          createdAt: addedComment.createdAt,
        };

        if (tempId && isTempId(tempId)) tempToRealMap.set(tempId, addedComment._id.toString());

        io.emit("postCommented", { postId, comment: commentData });
        io.to(socket.id).emit("comment-added", { tempId, realId: addedComment._id.toString() });

        // notification for comment
        if (String(post.owner._id) !== String(userId)) {
          const notification = await createNotification({
            type: "comment_post",
            fromUser: userId,
            toUser: post.owner._id,
            postId,
            commentId: addedComment._id,
            extraData: { text: `${username} commented: "${comment.trim()}"` },
          });
          await emitNotification(io, notification, post.owner._id.toString());
        }
      } catch (err) {
        console.error("❌ [commentOnPost] ERROR:", err);
        io.to(socket.id).emit("comment-error", { tempId, error: err.message });
      }
    });

    socket.on("deletePost", async ({ postId }) => {
      try {
        if (!mongoose.Types.ObjectId.isValid(postId)) {
          return io.to(socket.id).emit("delete-post-error", { postId, error: "Invalid post ID" });
        }

        const post = await Post.findById(postId);
        if (!post) return io.to(socket.id).emit("delete-post-error", { postId, error: "Post not found" });
        if (post.owner.toString() !== userId) return io.to(socket.id).emit("delete-post-error", { postId, error: "Not authorized" });

        await Post.findByIdAndDelete(postId);
        await User.findByIdAndUpdate(userId, { $inc: { postsCount: -1 } });
        io.emit("postDeleted", postId);
      } catch (err) {
        console.error("❌ [deletePost] ERROR:", err);
        io.to(socket.id).emit("delete-post-error", { postId, error: err.message });
      }
    });

    socket.on("deleteComment", async ({ postId, commentId }) => {
      try {
        if (!mongoose.Types.ObjectId.isValid(postId) || !mongoose.Types.ObjectId.isValid(commentId)) {
          return io.to(socket.id).emit("delete-comment-error", { commentId, error: "Invalid IDs" });
        }

        const post = await Post.findById(postId);
        if (!post) return io.to(socket.id).emit("delete-comment-error", { commentId, error: "Post not found" });

        const comment = post.comments.id(commentId);
        if (!comment) return io.to(socket.id).emit("delete-comment-error", { commentId, error: "Comment not found" });

        if (comment.user.toString() !== userId && post.owner.toString() !== userId) {
          return io.to(socket.id).emit("delete-comment-error", { commentId, error: "Not authorized" });
        }

        await Post.findByIdAndUpdate(postId, { $pull: { comments: { _id: commentId } }, $inc: { commentsCount: -1 } });
        io.emit("commentDeleted", { postId, commentId });
      } catch (err) {
        console.error("❌ [deleteComment] ERROR:", err);
        io.to(socket.id).emit("delete-comment-error", { commentId, error: err.message });
      }
    });

    // -------------------------
    // CHAT EVENTS
    // -------------------------
    socket.on("fetch-chatlist", async () => {
      try {
        const chatlist = await buildChatList(userId);
        io.to(userId).emit("initial-chatlist", chatlist);
      } catch (err) {
        console.error("❌ [fetch-chatlist] Error:", err);
      }
    });

    socket.on("send-message", async ({ receiver, content, image, tempId, replyTo }) => {
      try {
        if (!receiver) return io.to(socket.id).emit("message-error", { tempId, error: "No receiver specified" });
        if (receiver === userId) return io.to(socket.id).emit("message-error", { tempId, error: "Cannot send message to yourself" });
        if (!(await validateUser(receiver))) return io.to(socket.id).emit("message-error", { tempId, error: "Receiver not found" });

        const msgData = { sender: userId, receiver, content: content || "", image: image || null, readBy: [userId] };
        if (replyTo && mongoose.Types.ObjectId.isValid(replyTo)) msgData.replyTo = replyTo;

        const msg = await Message.create(msgData);
        await msg.populate("sender", "username");
        await msg.populate("receiver", "username");
        if (msgData.replyTo) await msg.populate("replyTo");

        if (tempId && isTempId(tempId)) tempToRealMap.set(tempId, msg._id.toString());

        const messageToEmit = { message: msg, tempId, realId: msg._id.toString() };
        io.to(userId).emit("new-message", messageToEmit);
        io.to(receiver).emit("new-message", messageToEmit);
        io.to(socket.id).emit("message-sent", { tempId, realId: msg._id });

        // notification for message
        const notification = await createNotification({
          type: "message",
          fromUser: userId,
          toUser: receiver,
          messageId: msg._id,
          extraData: { text: `${username} sent you a message` },
        });
        await emitNotification(io, notification, receiver);
      } catch (err) {
        console.error(`❌ [send-message] Error:`, err);
        io.to(socket.id).emit("message-error", { tempId, error: err.message });
      }
    });

    // -------------------------
    // FOLLOW EVENTS (uses Follow collection)
    // -------------------------
    socket.on("follow-user", async ({ targetUserId }) => {
      try {
        if (!mongoose.Types.ObjectId.isValid(targetUserId)) return io.to(socket.id).emit("follow-error", { error: "Invalid user ID" });
        if (String(userId) === String(targetUserId)) return io.to(socket.id).emit("follow-error", { error: "Cannot follow yourself" });

        const targetUser = await User.findById(targetUserId);
        if (!targetUser) return io.to(socket.id).emit("follow-error", { error: "User not found" });

        // check existing follow record
        const existing = await Follow.findOne({ follower: userId, followee: targetUserId });

        if (existing) {
          // If already requested/following -> unfollow (delete)
          await Follow.deleteOne({ _id: existing._id });

          // if it was following, decrement stats
          if (existing.status === "following") {
            await User.findByIdAndUpdate(targetUserId, { $inc: { "stats.followers": -1 } });
            await User.findByIdAndUpdate(userId, { $inc: { "stats.following": -1 } });
          }

          io.emit("user-unfollowed", { followerId: userId, targetUserId });
          return;
        }

        // not existing -> create request or follow based on privacy
        if (targetUser.isPrivate) {
          const newReq = await Follow.create({ follower: userId, followee: targetUserId, status: "requested" });

          // send notification for follow request
          const notification = await createNotification({
            type: "follow_request",
            fromUser: userId,
            toUser: targetUserId,
            followId: newReq._id,
            extraData: { text: `${username} sent you a follow request` },
          });
          await emitNotification(io, notification, targetUserId);

          io.emit("follow-request-sent", { from: userId, to: targetUserId });
        } else {
          // public profile -> create "following"
          const newFollow = await Follow.create({ follower: userId, followee: targetUserId, status: "following" });

          // update stats
          await User.findByIdAndUpdate(targetUserId, { $inc: { "stats.followers": 1 } });
          await User.findByIdAndUpdate(userId, { $inc: { "stats.following": 1 } });

          io.emit("user-followed", { followerId: userId, targetUserId });

          // notification for follow
          const notification = await createNotification({
            type: "follow",
            fromUser: userId,
            toUser: targetUserId,
            followId: newFollow._id,
            extraData: { text: `${username} started following you` },
          });
          await emitNotification(io, notification, targetUserId);
        }
      } catch (err) {
        console.error("❌ [follow-user] ERROR:", err);
        io.to(socket.id).emit("follow-error", { error: err.message });
      }
    });

    // Accept follow request (socket-driven)
    socket.on("accept-follow-request", async ({ followerId }) => {
      try {
        if (!mongoose.Types.ObjectId.isValid(followerId)) return;
        const reqRecord = await Follow.findOne({ follower: followerId, followee: userId, status: "requested" });
        if (!reqRecord) return io.to(socket.id).emit("accept-error", { error: "No request found" });

        reqRecord.status = "following";
        await reqRecord.save();

        await User.findByIdAndUpdate(followerId, { $inc: { "stats.following": 1 } });
        await User.findByIdAndUpdate(userId, { $inc: { "stats.followers": 1 } });

        io.emit("follow-request-accepted", { followerId, followeeId: userId });

        const notification = await createNotification({
          type: "follow_accepted",
          fromUser: userId,
          toUser: followerId,
          followId: reqRecord._id,
          extraData: { text: `${username} accepted your follow request` },
        });
        await emitNotification(io, notification, followerId);
      } catch (err) {
        console.error("❌ [accept-follow-request] ERROR:", err);
        io.to(socket.id).emit("accept-error", { error: err.message });
      }
    });

    socket.on("decline-follow-request", async ({ followerId }) => {
      try {
        if (!mongoose.Types.ObjectId.isValid(followerId)) return;
        const deleted = await Follow.findOneAndDelete({ follower: followerId, followee: userId, status: "requested" });
        if (!deleted) return io.to(socket.id).emit("decline-error", { error: "No request found" });
        io.emit("follow-request-declined", { followerId, followeeId: userId });
      } catch (err) {
        console.error("❌ [decline-follow-request] ERROR:", err);
        io.to(socket.id).emit("decline-error", { error: err.message });
      }
    });

    // -------------------------
    // REEL EVENTS (placeholders)
    // -------------------------
    socket.on("likeReel", async ({ reelId, userId: likerId }) => {
      try {
        io.emit("reelLiked", { reelId, likerId });
        // placeholder notification example:
        // const notification = await createNotification({...});
        // await emitNotification(io, notification, reelOwnerId);
      } catch (err) {
        console.error("❌ [likeReel] ERROR:", err);
        io.to(socket.id).emit("reel-like-error", { reelId, error: err.message });
      }
    });

    socket.on("commentOnReel", async ({ reelId, comment, tempId }) => {
      try {
        const commentData = { id: tempId || new mongoose.Types.ObjectId().toString(), user: { id: userId, username }, text: comment, createdAt: new Date() };
        io.emit("reelCommented", { reelId, comment: commentData });
        io.to(socket.id).emit("reel-comment-added", { tempId, realId: commentData.id });
      } catch (err) {
        console.error("❌ [commentOnReel] ERROR:", err);
        io.to(socket.id).emit("reel-comment-error", { tempId, error: err.message });
      }
    });

    // -------------------------
    // WALLPAPER EVENTS
    // -------------------------
    socket.on("chat/wallpaper", async ({ friendId, wallpaper }) => {
      try {
        if (!friendId) return io.to(socket.id).emit("wallpaper-error", { error: "Friend ID is required" });
        const friend = await User.findById(friendId);
        if (!friend) return io.to(socket.id).emit("wallpaper-error", { error: "Friend not found" });

        await Wallpaper.findOneAndUpdate({ userId, friendId }, { wallpaper, updatedAt: new Date() }, { upsert: true, new: true });

        io.to(userId).emit("chat-wallpaper-updated", { friendId, wallpaper });
        io.to(friendId).emit("chat-wallpaper-updated", { friendId: userId, wallpaper });
      } catch (err) {
        console.error("❌ [chat/wallpaper] ERROR:", err);
        io.to(socket.id).emit("wallpaper-error", { error: err.message });
      }
    });

    // -------------------------
    // SHARE EVENTS
    // -------------------------
    socket.on("join_user", (joinId) => {
      try {
        if (!joinId) return;
        socket.join(joinId);
      } catch (err) {
        console.error("❌ [join_user] ERROR:", err);
      }
    });

    socket.on("send_share", async (data) => {
      try {
        const { senderId, receiverId, postId, message } = data;
        if (!senderId || !receiverId || !postId) return io.to(socket.id).emit("share-error", { error: "senderId, receiverId and postId required" });
        if (!mongoose.Types.ObjectId.isValid(senderId) || !mongoose.Types.ObjectId.isValid(receiverId) || !mongoose.Types.ObjectId.isValid(postId)) {
          return io.to(socket.id).emit("share-error", { error: "Invalid IDs provided" });
        }
        if (!(await validateUser(senderId)) || !(await validateUser(receiverId))) return io.to(socket.id).emit("share-error", { error: "Sender or receiver not found" });

        const post = await Post.findById(postId).select("_id caption image owner");
        if (!post) return io.to(socket.id).emit("share-error", { error: "Post not found" });

        const link = `${process.env.APP_URL?.replace(/\/$/, "") || ""}/post/${postId}`;

        const shareDoc = await Share.create({ sender: senderId, receiver: receiverId, post: postId, message: message || "", link });
        await shareDoc.populate("sender", "username profilePic");

        io.to(receiverId).emit("receive_share", shareDoc);
        io.to(socket.id).emit("share_sent", { share: shareDoc });

        // notification for share (use 'mention' or 'share' - choose 'mention' here)
        const notification = await createNotification({
          type: "mention",
          fromUser: senderId,
          toUser: receiverId,
          shareId: shareDoc._id,
          postId,
          extraData: { text: `${username} shared a post with you` },
        });
        await emitNotification(io, notification, receiverId);
      } catch (err) {
        console.error("❌ [send_share] ERROR:", err);
        io.to(socket.id).emit("share-error", { error: err.message || "Server error" });
      }
    });

    // -------------------------
    // DISCONNECT
    // -------------------------
    socket.on("disconnect", async () => {
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

  console.log("🎯 Socket handler initialized with real-time notifications & follow flow");
};

export default socketHandler;
