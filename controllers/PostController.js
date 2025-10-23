
// // controllers/PostController.js
// import Post from "../models/Post.js";
// import User from "../models/User.js";
// import mongoose from "mongoose";

// // ================= Upload Post =================
// const uploadPost = async (req, res) => {
//   try {
//     const { caption, location } = req.body;
    
//     if (!caption || caption.trim() === "") {
//       return res.status(400).json({ success: false, message: "Caption is required" });
//     }

//     // Handle file upload
//     let imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

//     // Create post
//     const post = await Post.create({
//       owner: req.user._id,
//       caption: caption.trim(),
//       location: location || "",
//       image: imageUrl,
//     });

//     await post.populate('owner', 'username profilePic');

//     // Increment user posts count
//     await User.findByIdAndUpdate(req.user._id, { $inc: { postsCount: 1 } });

//     const responsePost = {
//       id: post._id.toString(),
//       user: {
//         id: post.owner._id.toString(),
//         username: post.owner.username,
//         avatar: post.owner.profilePic
//       },
//       image: post.image,
//       caption: post.caption,
//       location: post.location,
//       likes: 0,
//       liked: false,
//       comments: [],
//       createdAt: post.createdAt,
//       _temp: false
//     };

//     // Emit socket event
//     req.app.get('socketio')?.emit('newPost', responsePost);

//     res.status(201).json({ success: true, message: "Post uploaded successfully", post: responsePost });
//   } catch (error) {
//     console.error("❌ [uploadPost] Error:", error);
//     res.status(500).json({ success: false, message: "Failed to upload post" });
//   }
// };

// // ================= Get All Posts =================
// const getPosts = async (req, res) => {
//   try {
//     const { page = 1, limit = 10 } = req.query;
//     const userId = req.user._id;

//     const skip = (parseInt(page) - 1) * parseInt(limit);

//     const posts = await Post.find()
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(parseInt(limit))
//       .populate('owner', 'username profilePic')
//       .populate('comments.user', 'username profilePic')
//       .lean();

//     const postsWithLikedStatus = posts.map(post => ({
//       id: post._id.toString(),
//       user: {
//         id: post.owner._id.toString(),
//         username: post.owner.username,
//         avatar: post.owner.profilePic
//       },
//       image: post.image,
//       caption: post.caption,
//       location: post.location,
//       likes: post.likes?.length || 0,
//       liked: post.likes?.some(like => like.toString() === userId.toString()) || false,
//       comments: post.comments?.map(comment => ({
//         id: comment._id.toString(),
//         user: {
//           id: comment.user._id.toString(),
//           username: comment.user.username
//         },
//         text: comment.text,
//         createdAt: comment.createdAt
//       })) || [],
//       createdAt: post.createdAt,
//       _temp: false
//     }));

//     const totalPosts = await Post.countDocuments();
//     const hasMore = skip + posts.length < totalPosts;

//     res.json({ success: true, posts: postsWithLikedStatus, hasMore, total: totalPosts });
//   } catch (error) {
//     console.error("❌ [getPosts] Error:", error);
//     res.status(500).json({ success: false, message: "Failed to fetch posts" });
//   }
// };

// // ================= Get Single Post =================
// const getPostById = async (req, res) => {
//   try {
//     const { postId } = req.params;
//     const userId = req.user._id;

//     if (!mongoose.Types.ObjectId.isValid(postId)) {
//       return res.status(400).json({ success: false, message: "Invalid post ID" });
//     }

//     const post = await Post.findById(postId)
//       .populate('owner', 'username profilePic')
//       .populate('comments.user', 'username profilePic')
//       .populate('likes', 'username')
//       .lean();

//     if (!post) return res.status(404).json({ success: false, message: "Post not found" });

//     const postWithLikedStatus = {
//       id: post._id.toString(),
//       user: {
//         id: post.owner._id.toString(),
//         username: post.owner.username,
//         avatar: post.owner.profilePic
//       },
//       image: post.image,
//       caption: post.caption,
//       location: post.location,
//       likes: post.likes?.length || 0,
//       liked: post.likes?.some(like => like._id?.toString() === userId.toString()) || false,
//       comments: post.comments?.map(comment => ({
//         id: comment._id.toString(),
//         user: {
//           id: comment.user._id.toString(),
//           username: comment.user.username
//         },
//         text: comment.text,
//         createdAt: comment.createdAt
//       })) || [],
//       createdAt: post.createdAt
//     };

//     res.json({ success: true, post: postWithLikedStatus });
//   } catch (error) {
//     console.error("❌ [getPostById] Error:", error);
//     res.status(500).json({ success: false, message: "Failed to fetch post" });
//   }
// };

// // ================= Delete Post =================
// const deletePost = async (req, res) => {
//   try {
//     const { postId } = req.params;
//     const userId = req.user._id;

//     if (!mongoose.Types.ObjectId.isValid(postId)) {
//       return res.status(400).json({ success: false, message: "Invalid post ID" });
//     }

//     const post = await Post.findById(postId);
//     if (!post) return res.status(404).json({ success: false, message: "Post not found" });

//     if (post.owner.toString() !== userId.toString()) {
//       return res.status(403).json({ success: false, message: "Not authorized to delete this post" });
//     }

//     await Post.findByIdAndDelete(postId);
//     await User.findByIdAndUpdate(userId, { $inc: { postsCount: -1 } });

//     req.app.get('socketio')?.emit('postDeleted', postId);

//     res.json({ success: true, message: "Post deleted successfully" });
//   } catch (error) {
//     console.error("❌ [deletePost] Error:", error);
//     res.status(500).json({ success: false, message: "Failed to delete post" });
//   }
// };

// // ================= Like/Unlike Post =================
// const likePost = async (req, res) => {
//   try {
//     const { postId } = req.params;
//     const userId = req.user._id;

//     if (!mongoose.Types.ObjectId.isValid(postId)) {
//       return res.status(400).json({ success: false, message: "Invalid post ID" });
//     }

//     const post = await Post.findById(postId);
//     if (!post) return res.status(404).json({ success: false, message: "Post not found" });

//     const isLiked = post.likes?.some(like => like.toString() === userId.toString());
//     const updatedPost = await Post.findByIdAndUpdate(
//       postId,
//       isLiked
//         ? { $pull: { likes: userId }, $inc: { likesCount: -1 } }
//         : { $addToSet: { likes: userId }, $inc: { likesCount: 1 } },
//       { new: true }
//     ).populate('owner', 'username profilePic');

//     const likeData = {
//       postId,
//       likesCount: updatedPost.likesCount,
//       liked: !isLiked
//     };

//     req.app.get('socketio')?.emit('postLiked', { ...likeData, likedBy: updatedPost.likes });

//     res.json({ success: true, ...likeData });
//   } catch (error) {
//     console.error("❌ [likePost] Error:", error);
//     res.status(500).json({ success: false, message: "Failed to like post" });
//   }
// };

// // ================= Add Comment =================
// const addComment = async (req, res) => {
//   try {
//     const { postId } = req.params;
//     const { text } = req.body;
//     const userId = req.user._id;

//     if (!mongoose.Types.ObjectId.isValid(postId)) {
//       return res.status(400).json({ success: false, message: "Invalid post ID" });
//     }

//     if (!text || text.trim() === "") {
//       return res.status(400).json({ success: false, message: "Comment text is required" });
//     }

//     const post = await Post.findById(postId);
//     if (!post) return res.status(404).json({ success: false, message: "Post not found" });

//     const newComment = { user: userId, text: text.trim(), createdAt: new Date() };

//     const updatedPost = await Post.findByIdAndUpdate(
//       postId,
//       { $push: { comments: newComment }, $inc: { commentsCount: 1 } },
//       { new: true }
//     ).populate('comments.user', 'username profilePic');

//     const addedComment = updatedPost.comments[updatedPost.comments.length - 1];
//     const commentData = {
//       id: addedComment._id.toString(),
//       user: { id: addedComment.user._id.toString(), username: addedComment.user.username },
//       text: addedComment.text,
//       createdAt: addedComment.createdAt
//     };

//     req.app.get('socketio')?.emit('postCommented', { postId, comment: commentData });

//     res.json({ success: true, comment: commentData });
//   } catch (error) {
//     console.error("❌ [addComment] Error:", error);
//     res.status(500).json({ success: false, message: "Failed to add comment" });
//   }
// };

// // ================= Delete Comment =================
// const deleteComment = async (req, res) => {
//   try {
//     const { postId, commentId } = req.params;
//     const userId = req.user._id;

//     if (!mongoose.Types.ObjectId.isValid(postId) || !mongoose.Types.ObjectId.isValid(commentId)) {
//       return res.status(400).json({ success: false, message: "Invalid post ID or comment ID" });
//     }

//     const post = await Post.findById(postId);
//     if (!post) return res.status(404).json({ success: false, message: "Post not found" });

//     const comment = post.comments.id(commentId);
//     if (!comment) return res.status(404).json({ success: false, message: "Comment not found" });

//     if (comment.user.toString() !== userId.toString() && post.owner.toString() !== userId.toString()) {
//       return res.status(403).json({ success: false, message: "Not authorized to delete this comment" });
//     }

//     await Post.findByIdAndUpdate(postId, { $pull: { comments: { _id: commentId } }, $inc: { commentsCount: -1 } });

//     req.app.get('socketio')?.emit('commentDeleted', { postId, commentId });

//     res.json({ success: true, message: "Comment deleted successfully" });
//   } catch (error) {
//     console.error("❌ [deleteComment] Error:", error);
//     res.status(500).json({ success: false, message: "Failed to delete comment" });
//   }
// };

// // ================= Get User Posts =================
// const getUserPosts = async (req, res) => {
//   try {
//     const { userId } = req.params;
//     const { page = 1, limit = 10 } = req.query;
//     const currentUserId = req.user._id;

//     if (!mongoose.Types.ObjectId.isValid(userId)) {
//       return res.status(400).json({ success: false, message: "Invalid user ID" });
//     }

//     const skip = (parseInt(page) - 1) * parseInt(limit);

//     const posts = await Post.find({ owner: userId })
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(parseInt(limit))
//       .populate('owner', 'username profilePic')
//       .populate('comments.user', 'username profilePic')
//       .lean();

//     const postsWithLikedStatus = posts.map(post => ({
//       id: post._id.toString(),
//       user: {
//         id: post.owner._id.toString(),
//         username: post.owner.username,
//         avatar: post.owner.profilePic
//       },
//       image: post.image,
//       caption: post.caption,
//       location: post.location,
//       likes: post.likes?.length || 0,
//       liked: post.likes?.some(like => like.toString() === currentUserId.toString()) || false,
//       comments: post.comments?.map(comment => ({
//         id: comment._id.toString(),
//         user: { id: comment.user._id.toString(), username: comment.user.username },
//         text: comment.text,
//         createdAt: comment.createdAt
//       })) || [],
//       createdAt: post.createdAt
//     }));

//     const totalPosts = await Post.countDocuments({ owner: userId });
//     const hasMore = skip + posts.length < totalPosts;

//     res.json({ success: true, posts: postsWithLikedStatus, hasMore, total: totalPosts });
//   } catch (error) {
//     console.error("❌ [getUserPosts] Error:", error);
//     res.status(500).json({ success: false, message: "Failed to fetch user posts" });
//   }
// };

// // ================= Update Post =================
// const updatePost = async (req, res) => {
//   try {
//     const { postId } = req.params;
//     const { caption, location } = req.body;
//     const userId = req.user._id;

//     if (!mongoose.Types.ObjectId.isValid(postId)) {
//       return res.status(400).json({ success: false, message: "Invalid post ID" });
//     }

//     const post = await Post.findById(postId);
//     if (!post) return res.status(404).json({ success: false, message: "Post not found" });

//     if (post.owner.toString() !== userId.toString()) {
//       return res.status(403).json({ success: false, message: "Not authorized to update this post" });
//     }

//     const updates = {};
//     if (caption !== undefined) updates.caption = caption;
//     if (location !== undefined) updates.location = location;
//     updates.updatedAt = new Date();

//     const updatedPost = await Post.findByIdAndUpdate(postId, updates, { new: true })
//       .populate('owner', 'username profilePic')
//       .populate('comments.user', 'username profilePic')
//       .lean();

//     const postWithLikedStatus = {
//       id: updatedPost._id.toString(),
//       user: { id: updatedPost.owner._id.toString(), username: updatedPost.owner.username, avatar: updatedPost.owner.profilePic },
//       image: updatedPost.image,
//       caption: updatedPost.caption,
//       location: updatedPost.location,
//       likes: updatedPost.likes?.length || 0,
//       liked: updatedPost.likes?.some(like => like.toString() === userId.toString()) || false,
//       comments: updatedPost.comments?.map(comment => ({
//         id: comment._id.toString(),
//         user: { id: comment.user._id.toString(), username: comment.user.username },
//         text: comment.text,
//         createdAt: comment.createdAt
//       })) || [],
//       createdAt: updatedPost.createdAt,
//       updatedAt: updatedPost.updatedAt
//     };

//     res.json({ success: true, post: postWithLikedStatus, message: "Post updated successfully" });
//   } catch (error) {
//     console.error("❌ [updatePost] Error:", error);
//     res.status(500).json({ success: false, message: "Failed to update post" });
//   }
// };

// export default {
//   uploadPost,
//   getPosts,
//   getPostById,
//   deletePost,
//   likePost,
//   addComment,
//   deleteComment,
//   getUserPosts,
//   updatePost
// };




// controllers/PostController.js
import Post from "../models/Post.js";
import User from "../models/User.js";
import mongoose from "mongoose";

// ================= Upload Post =================
const uploadPost = async (req, res) => {
  try {
    const { caption, location } = req.body;

    if (!caption || caption.trim() === "") {
      return res
        .status(400)
        .json({ success: false, message: "Caption is required" });
    }

    // ✅ Build full base URL
    const baseUrl = `${req.protocol}://${req.get("host")}`;

    // ✅ Ensure correct upload path: /uploads/posts/
    let imageUrl = req.file
      ? `${baseUrl}/uploads/posts/${req.file.filename}`
      : null;

    // ✅ Create new post
    const post = await Post.create({
      owner: req.user._id,
      caption: caption.trim(),
      location: location || "",
      image: imageUrl,
    });

    await post.populate("owner", "username profilePic");

    // ✅ Increment user's post count
    await User.findByIdAndUpdate(req.user._id, { $inc: { postsCount: 1 } });

    const responsePost = {
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

    // ✅ Real-time socket emit (if connected)
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
      image: post.image
        ? post.image.startsWith("http")
          ? post.image
          : `${baseUrl}${post.image}`
        : null,
      caption: post.caption,
      location: post.location,
      likes: post.likes?.length || 0,
      liked:
        post.likes?.some(
          (like) => like.toString() === userId.toString()
        ) || false,
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
      image: post.image
        ? post.image.startsWith("http")
          ? post.image
          : `${baseUrl}${post.image}`
        : null,
      caption: post.caption,
      location: post.location,
      likes: post.likes?.length || 0,
      liked:
        post.likes?.some(
          (like) => like._id?.toString() === userId.toString()
        ) || false,
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
const likePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ success: false, message: "Invalid post ID" });
    }

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ success: false, message: "Post not found" });

    const isLiked = post.likes?.some(like => like.toString() === userId.toString());
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
      liked: !isLiked
    };

    req.app.get("socketio")?.emit("postLiked", likeData);
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

    res.json({ success: true, comment: addedComment });
  } catch (error) {
    console.error("❌ [addComment] Error:", error);
    res.status(500).json({ success: false, message: "Failed to add comment" });
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

    const formattedPosts = posts.map(post => ({
      id: post._id,
      user: {
        id: post.owner._id,
        username: post.owner.username,
        avatar: post.owner.profilePic,
      },
      image: post.image ? (post.image.startsWith("http") ? post.image : `${baseUrl}${post.image}`) : null,
      caption: post.caption,
      location: post.location,
      likes: post.likes?.length || 0,
      liked: post.likes?.some(like => like.toString() === currentUserId.toString()) || false,
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

    post.caption = caption || post.caption;
    post.location = location || post.location;
    post.updatedAt = new Date();
    await post.save();

    res.json({ success: true, message: "Post updated successfully", post });
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
