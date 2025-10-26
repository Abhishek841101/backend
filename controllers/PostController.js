
// controllers/PostController.js
import Post from "../models/Post.js";
import User from "../models/User.js";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";

// ---------------- Helper ----------------
const getMediaType = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  if ([".jpg", ".jpeg", ".png"].includes(ext)) return "image";
  if ([".mp4", ".mkv", ".avi"].includes(ext)) return "video";
  return null;
};



// ================= Upload Post =================
// const uploadPost = async (req, res) => {
//   try {
//       console.log("📌 [uploadPost] Request received");
//     console.log("📌 [uploadPost] req.body:", req.body);
//     console.log("📌 [uploadPost] req.file:", req.file); // <- critical for Multer debug

//     const { caption, location } = req.body;

//     if (!caption || caption.trim() === "") {
//       return res.status(400).json({ success: false, message: "Caption is required" });
//     }

//     const baseUrl = `${req.protocol}://${req.get("host")}`;

//     let mediaUrl = null;
//     let mediaType = null;

//     if (req.file) {
//       mediaUrl = `/uploads/posts/${req.file.filename}`;
//       mediaType = getMediaType(req.file.filename);

//       console.log(`📌 [uploadPost] Media uploaded: ${req.file.filename}`);
//       console.log(`📌 [uploadPost] Detected media type: ${mediaType}`);
//     } else {
//       console.log("📌 [uploadPost] No media uploaded, this is a text-only post");
//     }

//     const post = await Post.create({
//       owner: req.user._id,
//       caption: caption.trim(),
//       location: location || "",
//       media: mediaUrl,
//       mediaType,
//     });

//     await post.populate("owner", "username profilePic");
//     await User.findByIdAndUpdate(req.user._id, { $inc: { postsCount: 1 } });

//     const responsePost = {
//       id: post._id.toString(),
//       user: {
//         id: post.owner._id.toString(),
//         username: post.owner.username,
//         avatar: post.owner.profilePic,
//       },
//       media: mediaUrl ? `${baseUrl}${mediaUrl}` : null,
//       mediaType,
//       caption: post.caption,
//       location: post.location,
//       likes: 0,
//       liked: false,
//       comments: [],
//       createdAt: post.createdAt,
//       _temp: false,
//     };

//     console.log("✅ [uploadPost] Post created successfully:", {
//       id: post._id.toString(),
//       media: responsePost.media,
//       mediaType,
//     });

//     req.app.get("socketio")?.emit("newPost", responsePost);

//     res.status(201).json({
//       success: true,
//       message: "Post uploaded successfully",
//       post: responsePost,
//     });
//   } catch (error) {
//     console.error("❌ [uploadPost] Error:", error);
//     res.status(500).json({ success: false, message: "Failed to upload post" });
//   }
// };




// ================= Get All Posts =================
const getPosts = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const userId = req.user._id;
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("owner", "username profilePic")
      .populate("comments.user", "username profilePic")
      .lean();

    const postsWithLikedStatus = posts.map((post) => ({
      id: post._id.toString(),
      user: {
        id: post.owner._id.toString(),
        username: post.owner.username,
        avatar: post.owner.profilePic,
      },
      media: post.media ? `${baseUrl}${post.media}` : null,
      mediaType: post.mediaType || null,
      caption: post.caption,
      location: post.location,
      likes: post.likes?.length || 0,
      liked: post.likes?.some((like) => like.toString() === userId.toString()) || false,
      comments:
        post.comments?.map((comment) => ({
          id: comment._id.toString(),
          user: {
            id: comment.user._id.toString(),
            username: comment.user.username,
          },
          text: comment.text,
          createdAt: comment.createdAt,
        })) || [],
      createdAt: post.createdAt,
      _temp: false,
    }));

    const totalPosts = await Post.countDocuments();
    const hasMore = skip + posts.length < totalPosts;

    res.json({
      success: true,
      posts: postsWithLikedStatus,
      hasMore,
      total: totalPosts,
    });
  } catch (error) {
    console.error("❌ [getPosts] Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch posts" });
  }
};

// ================= Get Single Post =================
const getPostById = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user._id;
    const baseUrl = `${req.protocol}://${req.get("host")}`;

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ success: false, message: "Invalid post ID" });
    }

    const post = await Post.findById(postId)
      .populate("owner", "username profilePic")
      .populate("comments.user", "username profilePic")
      .populate("likes", "username")
      .lean();

    if (!post)
      return res.status(404).json({ success: false, message: "Post not found" });

    const postWithLikedStatus = {
      id: post._id.toString(),
      user: {
        id: post.owner._id.toString(),
        username: post.owner.username,
        avatar: post.owner.profilePic,
      },
      media: post.media ? `${baseUrl}${post.media}` : null,
      mediaType: post.mediaType || null,
      caption: post.caption,
      location: post.location,
      likes: post.likes?.length || 0,
      liked: post.likes?.some((like) => like._id?.toString() === userId.toString()) || false,
      comments:
        post.comments?.map((comment) => ({
          id: comment._id.toString(),
          user: {
            id: comment.user._id.toString(),
            username: comment.user.username,
          },
          text: comment.text,
          createdAt: comment.createdAt,
        })) || [],
      createdAt: post.createdAt,
    };

    res.json({ success: true, post: postWithLikedStatus });
  } catch (error) {
    console.error("❌ [getPostById] Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch post" });
  }
};

// ================= Delete Post =================
const deletePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ success: false, message: "Invalid post ID" });
    }

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ success: false, message: "Post not found" });

    if (post.owner.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized to delete this post" });
    }

    // Delete media file if exists
    if (post.media) {
      const mediaPath = path.join(process.cwd(), post.media);
      if (fs.existsSync(mediaPath)) fs.unlinkSync(mediaPath);
    }

    await Post.findByIdAndDelete(postId);
    await User.findByIdAndUpdate(userId, { $inc: { postsCount: -1 } });

    req.app.get("socketio")?.emit("postDeleted", postId);

    res.json({ success: true, message: "Post deleted successfully" });
  } catch (error) {
    console.error("❌ [deletePost] Error:", error);
    res.status(500).json({ success: false, message: "Failed to delete post" });
  }
};

// ================= Like/Unlike Post =================
// const likePost = async (req, res) => {
//   try {
//     const { postId } = req.params;
//     const userId = req.user._id;

//     if (!mongoose.Types.ObjectId.isValid(postId)) {
//       return res.status(400).json({ success: false, message: "Invalid post ID" });
//     }

//     const post = await Post.findById(postId);
//     if (!post) return res.status(404).json({ success: false, message: "Post not found" });

//     const isLiked = post.likes?.some((like) => like.toString() === userId.toString());
//     const updatedPost = await Post.findByIdAndUpdate(
//       postId,
//       isLiked
//         ? { $pull: { likes: userId }, $inc: { likesCount: -1 } }
//         : { $addToSet: { likes: userId }, $inc: { likesCount: 1 } },
//       { new: true }
//     );

//     const likeData = {
//       postId,
//       likesCount: updatedPost.likesCount,
//       liked: !isLiked,
//     };

//     req.app.get("socketio")?.emit("postLiked", likeData);
//     res.json({ success: true, ...likeData });
//   } catch (error) {
//     console.error("❌ [likePost] Error:", error);
//     res.status(500).json({ success: false, message: "Failed to like post" });
//   }
// };

// ================= Add Comment =================
// const addComment = async (req, res) => {
//   try {
//     const { postId } = req.params;
//     const { text } = req.body;
//     const userId = req.user._id;

//     if (!text || text.trim() === "") {
//       return res.status(400).json({ success: false, message: "Comment text required" });
//     }

//     const post = await Post.findById(postId);
//     if (!post) return res.status(404).json({ success: false, message: "Post not found" });

//     const newComment = { user: userId, text: text.trim(), createdAt: new Date() };

//     const updatedPost = await Post.findByIdAndUpdate(
//       postId,
//       { $push: { comments: newComment }, $inc: { commentsCount: 1 } },
//       { new: true }
//     ).populate("comments.user", "username profilePic");

//     const addedComment = updatedPost.comments[updatedPost.comments.length - 1];
//     req.app.get("socketio")?.emit("postCommented", { postId, comment: addedComment });

//     res.json({ success: true, comment: addedComment });
//   } catch (error) {
//     console.error("❌ [addComment] Error:", error);
//     res.status(500).json({ success: false, message: "Failed to add comment" });
//   }
// };























const likePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ success: false, message: "Invalid post ID" });
    }

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ success: false, message: "Post not found" });

    const isLiked = post.likes?.some((like) => like.toString() === userId.toString());
    const updatedPost = await Post.findByIdAndUpdate(
      postId,
      isLiked
        ? { $pull: { likes: userId }, $inc: { likesCount: -1 } }
        : { $addToSet: { likes: userId }, $inc: { likesCount: 1 } },
      { new: true }
    );

    const likeData = {
      postId,
      likesCount: updatedPost.likesCount,
      liked: !isLiked,
    };

    req.app.get("socketio")?.emit("postLiked", likeData);

    // 🔔 Send notification if post liked
    if (!isLiked) {
      await sendNotification({
        sender: userId,
        receiver: post.owner,
        type: "LIKE_POST",
        post: post._id,
        text: `${req.user.username} liked your post`,
      });
    }

    res.json({ success: true, ...likeData });
  } catch (error) {
    console.error("❌ [likePost] Error:", error);
    res.status(500).json({ success: false, message: "Failed to like post" });
  }
};

// ================= Add Comment =================
const addComment = async (req, res) => {
  try {
    const { postId } = req.params;
    const { text } = req.body;
    const userId = req.user._id;

    if (!text || text.trim() === "") {
      return res.status(400).json({ success: false, message: "Comment text required" });
    }

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ success: false, message: "Post not found" });

    const newComment = { user: userId, text: text.trim(), createdAt: new Date() };

    const updatedPost = await Post.findByIdAndUpdate(
      postId,
      { $push: { comments: newComment }, $inc: { commentsCount: 1 } },
      { new: true }
    ).populate("comments.user", "username profilePic");

    const addedComment = updatedPost.comments[updatedPost.comments.length - 1];

    req.app.get("socketio")?.emit("postCommented", { postId, comment: addedComment });

    // 🔔 Send notification to post owner
    if (userId.toString() !== post.owner.toString()) {
      await sendNotification({
        sender: userId,
        receiver: post.owner,
        type: "COMMENT_POST",
        post: post._id,
        text: `${req.user.username} commented: "${text}"`,
      });
    }

    res.json({ success: true, comment: addedComment });
  } catch (error) {
    console.error("❌ [addComment] Error:", error);
    res.status(500).json({ success: false, message: "Failed to add comment" });
  }
};

// ================= Upload Post =================
const uploadPost = async (req, res) => {
  try {
    const { caption, location } = req.body;

    if (!caption || caption.trim() === "") {
      return res.status(400).json({ success: false, message: "Caption is required" });
    }

    let mediaUrl = null;
    let mediaType = null;

    if (req.file) {
      mediaUrl = `/uploads/posts/${req.file.filename}`;
      mediaType = getMediaType(req.file.filename);
    }

    const post = await Post.create({
      owner: req.user._id,
      caption: caption.trim(),
      location: location || "",
      media: mediaUrl,
      mediaType,
    });

    await post.populate("owner", "username profilePic");

    const responsePost = {
      id: post._id.toString(),
      user: {
        id: post.owner._id.toString(),
        username: post.owner.username,
        avatar: post.owner.profilePic,
      },
      media: mediaUrl ? `${req.protocol}://${req.get("host")}${mediaUrl}` : null,
      mediaType,
      caption: post.caption,
      location: post.location,
      likes: 0,
      liked: false,
      comments: [],
      createdAt: post.createdAt,
      _temp: false,
    };

    req.app.get("socketio")?.emit("newPost", responsePost);

    res.status(201).json({
      success: true,
      message: "Post uploaded successfully",
      post: responsePost,
    });
  } catch (error) {
    console.error("❌ [uploadPost] Error:", error);
    res.status(500).json({ success: false, message: "Failed to upload post" });
  }
};




// ================= Delete Comment =================
const deleteComment = async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const userId = req.user._id;

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ success: false, message: "Post not found" });

    const comment = post.comments.id(commentId);
    if (!comment) return res.status(404).json({ success: false, message: "Comment not found" });

    if (comment.user.toString() !== userId.toString() && post.owner.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    await Post.findByIdAndUpdate(postId, { $pull: { comments: { _id: commentId } }, $inc: { commentsCount: -1 } });
    req.app.get("socketio")?.emit("commentDeleted", { postId, commentId });

    res.json({ success: true, message: "Comment deleted successfully" });
  } catch (error) {
    console.error("❌ [deleteComment] Error:", error);
    res.status(500).json({ success: false, message: "Failed to delete comment" });
  }
};

// ================= Get User Posts =================
const getUserPosts = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;
    const baseUrl = `${req.protocol}://${req.get("host")}`;

    const posts = await Post.find({ owner: userId })
      .sort({ createdAt: -1 })
      .populate("owner", "username profilePic")
      .populate("comments.user", "username profilePic")
      .lean();

    const formattedPosts = posts.map((post) => ({
      id: post._id,
      user: {
        id: post.owner._id,
        username: post.owner.username,
        avatar: post.owner.profilePic,
      },
      media: post.media ? `${baseUrl}${post.media}` : null,
      mediaType: post.mediaType || null,
      caption: post.caption,
      location: post.location,
      likes: post.likes?.length || 0,
      liked: post.likes?.some((like) => like.toString() === currentUserId.toString()) || false,
      comments: post.comments || [],
      createdAt: post.createdAt,
    }));

    res.json({ success: true, posts: formattedPosts });
  } catch (error) {
    console.error("❌ [getUserPosts] Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch user posts" });
  }
};

// ================= Update Post =================
const updatePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const { caption, location } = req.body;
    const userId = req.user._id;

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ success: false, message: "Post not found" });

    if (post.owner.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    // Update media if new file uploaded
    if (req.file) {
      // Delete old media
      if (post.media) {
        const mediaPath = path.join(process.cwd(), post.media);
        if (fs.existsSync(mediaPath)) fs.unlinkSync(mediaPath);
      }
      post.media = `/uploads/posts/${req.file.filename}`;
      post.mediaType = getMediaType(req.file.filename);
    }

    post.caption = caption || post.caption;
    post.location = location || post.location;
    post.updatedAt = new Date();
    await post.save();

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const responsePost = {
      id: post._id.toString(),
      user: {
        id: post.owner._id.toString(),
        username: post.owner.username,
        avatar: post.owner.profilePic,
      },
      media: post.media ? `${baseUrl}${post.media}` : null,
      mediaType: post.mediaType || null,
      caption: post.caption,
      location: post.location,
      likes: post.likesCount,
      liked: post.likes?.some((like) => like.toString() === userId.toString()) || false,
      comments: post.comments || [],
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };

    res.json({ success: true, message: "Post updated successfully", post: responsePost });
  } catch (error) {
    console.error("❌ [updatePost] Error:", error);
    res.status(500).json({ success: false, message: "Failed to update post" });
  }
};

export default {
  uploadPost,
  getPosts,
  getPostById,
  deletePost,
  likePost,
  addComment,
  deleteComment,
  getUserPosts,
  updatePost,
};
