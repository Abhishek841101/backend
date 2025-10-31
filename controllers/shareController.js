
import Share from "../models/Share.js";
import User from "../models/User.js";
import Post from "../models/Post.js";


export const sharePost = async (req, res) => {
  try {
    const { senderId, receiverId, postId, message, external } = req.body;

    // Required validation
    if (!senderId || !postId)
      return res.status(400).json({ message: "Missing required fields" });

    const sender = await User.findById(senderId);
    const post = await Post.findById(postId);
    if (!sender || !post)
      return res.status(404).json({ message: "Sender or Post not found" });

    // Optional receiver for internal share
    let receiver;
    if (receiverId) {
      receiver = await User.findById(receiverId);
      if (!receiver)
        return res.status(404).json({ message: "Receiver not found" });
    }

    // Construct direct post link
    const link = `${process.env.APP_URL}/post/${postId}`;

    const newShare = new Share({
      sender: senderId,
      receiver: receiverId || undefined, // optional
      post: postId,
      message: message || "",
      link,
      external: external || false, // true if native share
    });

    await newShare.save();

    // Emit real-time event only for internal shares
    if (!external && receiverId && req.io) {
      req.io.to(receiverId).emit("receive_share", newShare);
    }

    res.status(201).json({ success: true, share: newShare });
  } catch (error) {
    console.error("Share Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};



export const getReceivedShares = async (req, res) => {
  try {
    const { userId } = req.params;
    const shares = await Share.find({ receiver: userId })
      .populate("sender", "username profilePic")
      .populate("post", "image caption");
    res.status(200).json(shares);
  } catch (error) {
    console.error("Get Shares Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};


// ✅ Get shares SENT by user


export const getSentShares = async (req, res) => {
  try {
    const { userId } = req.params;
    const shares = await Share.find({ sender: userId })
      .populate("receiver", "username profilePic")
      .populate("post", "image caption");
    res.status(200).json(shares);
  } catch (error) {
    console.error("Get Sent Shares Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
