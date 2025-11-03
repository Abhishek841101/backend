
import express from "express";
import uploadMiddleware from "../middlewares/uploadMiddleware.js"; // ✅ Central multer setup

import UserController from "../controllers/userController.js";
import PostController from "../controllers/PostController.js";
import * as contestController from "../controllers/contestController.js";
import * as chatController from "../controllers/chatController.js";
import * as reelsController from "../controllers/reelsController.js"; // ✅ import as object

import * as mediaController from "../controllers/mediaController.js";
import {
  getProfile,
  followUser,
  unfollowUser,
  getPendingFollowRequests,
  acceptFollowRequest,
  declineFollowRequest,
  cancelFollowRequest,
  getAllUsers
} from "../controllers/profileController.js";

import * as notificationController from "../controllers/notificationController.js";
import checkUserAuth from "../middlewares/auth-middleware.js";
import {
  sharePost,
  getReceivedShares,
  getSentShares,
} from "../controllers/shareController.js";

const router = express.Router();

// =========================
// AUTH ROUTES
// =========================
router.post("/register", UserController.userRegistration);
router.post("/login", UserController.userLogin);
router.post("/send-reset-password-email", UserController.sendUserPasswordResetEmail);
router.post("/reset-password/:id/:token", UserController.userPasswordReset);
router.post("/changepassword", checkUserAuth, UserController.changeUserPassword);
router.get("/loggeduser", checkUserAuth, UserController.loggedUser);

// =========================
// USER ROUTES
// =========================
router.get("/all-users", checkUserAuth, getAllUsers);

// =========================
// PROFILE ROUTES
// =========================
router.get("/profile/:username", checkUserAuth, getProfile);
router.post("/profile/:username/follow", checkUserAuth, followUser);
router.delete("/profile/:username/follow", checkUserAuth, unfollowUser);
// Follow-Requests
// Follow-Requests
router.get("/follow/requests", checkUserAuth, getPendingFollowRequests);
router.put("/follow/accept/:username", checkUserAuth, acceptFollowRequest);
router.delete("/follow/decline/:username", checkUserAuth, declineFollowRequest);
router.delete("/cancel/:username", checkUserAuth, cancelFollowRequest);



// =========================
// POST ROUTES
// =========================
router.post("/posts", checkUserAuth, uploadMiddleware.single("media"), PostController.uploadPost);
router.get("/posts", checkUserAuth, PostController.getPosts);
router.get("/posts/:postId", checkUserAuth, PostController.getPostById);
router.delete("/posts/:postId", checkUserAuth, PostController.deletePost);
router.post("/posts/:postId/like", checkUserAuth, PostController.likePost);
router.post("/posts/:postId/comment", checkUserAuth, PostController.addComment);
router.delete("/posts/:postId/comments/:commentId", checkUserAuth, PostController.deleteComment);
router.get("/posts/user/:userId", checkUserAuth, PostController.getUserPosts);
router.put("/posts/:postId", checkUserAuth, PostController.updatePost);
router.get("/posts/me", checkUserAuth, PostController.getMyPosts);

// =========================
// CHAT ROUTES
// =========================

router.get("/chat/users", checkUserAuth, chatController.getAllUsers);
router.get("/messages/:userId", checkUserAuth, chatController.getMessagesBetweenUsers);
// router.post("/messages/send", checkUserAuth, chatController.sendMessage);
router.post(
  "/messages/send",
  checkUserAuth,
  uploadMiddleware.fields([
    { name: "image", maxCount: 2 },
    { name: "audio", maxCount: 1 },
  ]),
  chatController.sendMessage
);
router.put("/messages/edit/:messageId", checkUserAuth, chatController.editMessage);
router.post("/messages/react/:messageId", checkUserAuth, chatController.toggleReaction);
router.get("/chat/unread-summary", checkUserAuth, chatController.getUnreadSummary);
router.post("/chat/mark-seen/:friendId", checkUserAuth, chatController.markMessagesAsRead);
router.delete("/chat/delete/me/:messageId", checkUserAuth, chatController.deleteMessageForMe);
router.delete("/chat/delete/everyone/:messageId", checkUserAuth, chatController.deleteMessageForEveryone);
router.post("/chat/wallpaper/:friendId", checkUserAuth, chatController.setChatWallpaper);
router.get("/chat/wallpaper/:friendId", checkUserAuth, chatController.getChatWallpaper);

// =========================
// GROUP CHAT ROUTES
// =========================
router.post("/groups/create", checkUserAuth, chatController.createGroup);
router.get("/groups", checkUserAuth, chatController.getGroups);
router.get("/groups/:groupId", checkUserAuth, chatController.getGroup);
router.get("/groups/:groupId/messages", checkUserAuth, chatController.getGroupMessages);
// router.post("/groups/:groupId/send", checkUserAuth, chatController.sendGroupMessage);
router.post(
  "/groups/:groupId/send",
  checkUserAuth,
  uploadMiddleware.fields([
    { name: "image", maxCount: 1 },
    { name: "audio", maxCount: 1 },
  ]),
  chatController.sendGroupMessage
);
router.put("/groups/:groupId/edit/:messageId", checkUserAuth, chatController.editGroupMessage);
router.post("/groups/:groupId/react/:messageId", checkUserAuth, chatController.toggleGroupReaction);
router.post("/groups/:groupId/add-member", checkUserAuth, chatController.addGroupMember);
router.post("/groups/:groupId/remove-member", checkUserAuth, chatController.removeGroupMember);
router.post("/groups/:groupId/set-admin", checkUserAuth, chatController.setGroupAdmin);
router.post("/groups/:groupId/wallpaper", checkUserAuth, chatController.setGroupWallpaper);
router.get("/groups/:groupId/wallpaper", checkUserAuth, chatController.getGroupWallpaper);
router.get("/groups/:groupId/unread-summary", checkUserAuth, chatController.getGroupUnreadSummary);
router.post("/groups/:groupId/mark-seen", checkUserAuth, chatController.markGroupMessagesAsRead);

// NOTIFICATIONS ROUTES
// =========================
router.get("/notifications", checkUserAuth, notificationController.getNotifications);
router.post("/notifications/mark-read/:notificationId", checkUserAuth, notificationController.markAsRead);
router.post("/notifications/mark-all-read", checkUserAuth, notificationController.markAllAsRead);

// =========================
// CONTEST ROUTES
// =========================
router.use("/contests", checkUserAuth);
router.get("/contests", contestController.getContests);
router.get("/contests/my", contestController.getMyContests);
router.get("/contests/:id", contestController.getContestById);
router.post("/contests/create", contestController.createContest);
router.put("/contests/:id", contestController.updateContest);
router.delete("/contests/:id", contestController.deleteContest);
router.post("/contests/join/:id", contestController.joinContest);
router.post("/contests/promote", contestController.promoteToAdmin);
router.post("/contests/entry/:entryId/like", contestController.likeEntry);
router.get("/contests/entry/leaderboard/:contestId", contestController.getLeaderboard);

// =========================
// REELS ROUTES
// =========================
router.get("/reels", reelsController.getReels);
router.post(
  "/upload",
  checkUserAuth,
  uploadMiddleware.single("video"),
  reelsController.uploadReel
);
// router.post("/upload", uploadMiddleware.single("video"), reelsController.uploadReel);
router.post("/reels/:id/like", checkUserAuth, reelsController.likeReel);
router.post("/reels/:id/comment", checkUserAuth, reelsController.commentReel);
router.post("/reels/:id/like", checkUserAuth, reelsController.likeReel);
router.post("/reels/:id/unlike", checkUserAuth, reelsController.unlikeReel);
router.post("/reels/:id/comment", checkUserAuth, reelsController.commentReel);
router.get("/reels/me", checkUserAuth, reelsController.getMyReels);
router.delete("/reels/:id", checkUserAuth, reelsController.deleteReel);
router.post("/reels/:id/save", checkUserAuth, reelsController.saveReel);
router.post("/reels/:id/unsave", checkUserAuth, reelsController.unsaveReel);
router.get("/reels/saved", checkUserAuth, reelsController.getSavedReels);

// =========================
// SHARE ROUTES
// =========================
router.post("/share", checkUserAuth, sharePost);
router.get("/shares/received/:userId", checkUserAuth, getReceivedShares);
router.get("/shares/sent/:userId", checkUserAuth, getSentShares);


//media routes
router.post(
  "/media/upload",
  checkUserAuth,
  uploadMiddleware.fields([
    { name: "media", maxCount: 1 },      
    { name: "thumbnail", maxCount: 1 },  
  ]),
  mediaController.uploadMedia
);
router.get("/media", checkUserAuth, mediaController.getAllMedia);
router.get("/media/:id", checkUserAuth, mediaController.getMediaById);
router.delete("/media/:id", checkUserAuth, mediaController.deleteMedia);
router.put("/media/:id", checkUserAuth, mediaController.updateMedia);
router.post("/media/:id/like", checkUserAuth, mediaController.likeMedia);
router.post("/media/:id/comment", checkUserAuth, mediaController.commentMedia);
router.get("/media/me", checkUserAuth, mediaController.getMyMedia);

export default router;
