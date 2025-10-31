// import Notification from "../models/Notification.js";

// export const sendNotification = async ({
//   senderId,
//   receiverId,
//   type,
//   message,
//   io,
//   reelId,
//   postId,
// }) => {
//   const notification = await Notification.create({
//     sender: senderId,
//     receiver: receiverId,
//     type,
//     message,
//     reel: reelId || null,
//     post: postId || null,
//   });

//   if (io) {
//     io.to(receiverId.toString()).emit("notification:new", {
//       _id: notification._id,
//       sender: senderId,
//       receiver: receiverId,
//       type,
//       message,
//       reelId,
//       postId,
//       createdAt: notification.createdAt,
//     });
//   }

//   return notification;
// };



import Notification from "../models/Notification.js";

export const sendNotification = async ({
  senderId,
  receiverId,
  type,
  message,
  io,
  reelId,
  postId,
}) => {
  const payload = {
    sender: senderId,
    receiver: receiverId,
    type,
    message,
    reel: reelId || null,
    post: postId || null,
  };

  // ✅ Save to DB
  const notification = await Notification.create(payload);

  // ✅ Realtime socket
  if (io) {
    io.to(receiverId.toString()).emit("notification:new", {
      _id: notification._id,
      ...payload,                // ✅ SAME FORMAT
      createdAt: notification.createdAt,
      read: false,
    });
  }

  return notification;
};
