



// controllers/notificationController.js
import Notification from "../models/Notification.js";

// 🔔 Create & emit notification
export const sendNotification = async ({
  sender,
  receiver,
  type,
  post = null,
  reel = null,
  follow = null,
  messageRef = null,
  text = "",
}) => {
  try {
    if (sender.toString() === receiver.toString()) return;

    const newNotification = new Notification({
      sender,
      receiver,
      type,
      post,
      reel,
      follow,
      messageRef,
      text,
    });

    await newNotification.save();
    console.log("[DEBUG] Notification saved:", newNotification._id);

    // Emit via socket.io if connected
    if (global.io) {
      global.io.to(receiver.toString()).emit("receive-notification", newNotification);
      console.log("[DEBUG] Notification emitted to receiver:", receiver.toString());
    }

    return newNotification;
  } catch (error) {
    console.error("[ERROR] sendNotification failed:", error.message);
  }
};

// 📨 Fetch all notifications for logged-in user
export const getNotifications = async (req, res) => {
  try {
    console.log("[DEBUG] getNotifications called by user:", req.user?._id);

    const notifications = await Notification.find({ receiver: req.user._id })
      .populate("sender", "username avatar")
      .sort({ createdAt: -1 });

    console.log("[DEBUG] Notifications found:", notifications.length);

    res.json({ notifications }); // ✅ Always return wrapped object
  } catch (error) {
    console.error("[ERROR] getNotifications failed:", error.message);
    res.status(500).json({ message: error.message });
  }
};

// ✅ Mark single notification as read
export const markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.body; // ✅ from body instead of params
    console.log("[DEBUG] markAsRead called with:", notificationId);

    await Notification.findByIdAndUpdate(notificationId, { read: true });

    res.json({ message: "Notification marked as read", notificationId });
  } catch (error) {
    console.error("[ERROR] markAsRead failed:", error.message);
    res.status(500).json({ message: error.message });
  }
};

// ✅ Mark all notifications as read
export const markAllAsRead = async (req, res) => {
  try {
    console.log("[DEBUG] markAllAsRead called by:", req.user?._id);

    await Notification.updateMany(
      { receiver: req.user._id, read: false },
      { $set: { read: true } }
    );

    res.json({ message: "All notifications marked as read" });
  } catch (error) {
    console.error("[ERROR] markAllAsRead failed:", error.message);
    res.status(500).json({ message: error.message });
  }
};
