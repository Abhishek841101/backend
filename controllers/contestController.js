
import Contest from "../models/Contest.js";
import ContestEntry from "../models/ContestEntry.js";
import User from "../models/User.js";

// ---------------- Create Contest ----------------
export const createContest = async (req, res) => {
  try {
    console.log("[CREATE] Request body:", req.body);

    const contest = new Contest({
      ...req.body,
      createdBy: req.user.id,
    });

    // Solo contests: creator automatically joins
    if (contest.contestType === "solo") {
      contest.participants = [req.user.id];
    }

    // Group contests: creator is superAdmin + admin + participant
    if (contest.contestType === "group") {
      contest.superAdmin = req.user.id;
      contest.admins = [req.user.id];
      contest.participants = [req.user.id];
    }

    await contest.save();
    console.log("[CREATE] Contest saved:", contest._id);

    res.status(201).json(contest);
  } catch (error) {
    console.error("[CREATE][ERROR]:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ---------------- Invite friends to group contest ----------------
// export const inviteToContest = async (req, res) => {
//   try {
//     const { contestId, friendIds } = req.body; // array of userIds
//     const userId = req.user.id;

//     const contest = await Contest.findById(contestId);
//     if (!contest) return res.status(404).json({ message: "Contest not found" });

//     // Only superAdmin or admins can invite
//     if (
//       contest.superAdmin.toString() !== userId &&
//       !contest.admins.includes(userId)
//     ) {
//       return res.status(403).json({ message: "Only admins can invite friends" });
//     }

//     const added = [];
//     for (let friendId of friendIds) {
//       if (!contest.participants.includes(friendId)) {
//         contest.participants.push(friendId);
//         added.push(friendId);

//         // also create a ContestEntry for each invited friend
//         const entry = new ContestEntry({
//           contest: contestId,
//           user: friendId,
//           likes: 0,
//         });
//         await entry.save();
//       }
//     }

//     await contest.save();
//     res.json({ message: "Friends invited successfully", added });
//   } catch (error) {
//     console.error("[INVITE][ERROR]:", error);
//     res.status(500).json({ message: "Server Error", error: error.message });
//   }
// };

// ---------------- Join contest ----------------

export const joinContest = async (req, res) => {
  try {
    const { id: contestId } = req.params;   // ✅ safe destructuring
    const loggedInUserId = req.user._id;    // ✅ comes from auth middleware
    const addUserId = req.body?.userId;     // ✅ optional (admin adds someone)

    if (!contestId) {
      return res.status(400).json({ message: "Contest ID is required" });
    }

    console.log("➡️ [JOIN] Contest ID:", contestId);
    console.log("➡️ [JOIN] Logged in user:", loggedInUserId);
    console.log("➡️ [JOIN] Add user (if admin):", addUserId);

    // Find contest
    const contest = await Contest.findById(contestId);
    if (!contest) {
      return res.status(404).json({ message: "Contest not found" });
    }

    // ✅ Check if admin
    const isAdmin =
      contest.superAdmin?.toString() === loggedInUserId.toString() ||
      contest.admins?.map((a) => a.toString()).includes(loggedInUserId.toString());

    // --- Case 1: Admin adds user ---
    if (addUserId && isAdmin) {
      if (contest.participants.includes(addUserId)) {
        return res.status(400).json({ message: "User already joined this contest" });
      }
      if (contest.slots && contest.participants.length >= contest.slots) {
        return res.status(400).json({ message: "Contest is full" });
      }

      const user = await User.findById(addUserId);
      if (!user) return res.status(404).json({ message: "User not found" });

      contest.participants.push(addUserId);
      await contest.save();

      const entry = await ContestEntry.create({
        contest: contestId,
        user: addUserId,
        likes: 0,
      });

      return res.status(201).json({
        message: "User added to contest by admin",
        contest,
        entry,
      });
    }

    // --- Case 2: Normal user ---
    if (contest.contestType === "group") {
      return res.status(403).json({ message: "You cannot join a group contest directly. Admin must add you." });
    }

    if (contest.participants.includes(loggedInUserId.toString())) {
      return res.status(400).json({ message: "Already joined this contest" });
    }

    if (contest.slots && contest.participants.length >= contest.slots) {
      return res.status(400).json({ message: "Contest is full" });
    }

    contest.participants.push(loggedInUserId);
    await contest.save();

    const entry = await ContestEntry.create({
      contest: contestId,
      user: loggedInUserId,
      likes: 0,
    });

    return res.status(201).json({
      message: "Joined contest successfully",
      contest,
      entry,
    });
  } catch (error) {
    console.error("[JOIN][ERROR]:", error);
    return res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ---------------- Promote participant to admin ----------------
export const promoteToAdmin = async (req, res) => {
  try {
    const { contestId, userIdToPromote } = req.body;
    const userId = req.user.id;

    const contest = await Contest.findById(contestId);
    if (!contest) return res.status(404).json({ message: "Contest not found" });

    if (contest.superAdmin.toString() !== userId) {
      return res.status(403).json({ message: "Only Super Admin can promote admins" });
    }

    if (!contest.participants.includes(userIdToPromote)) {
      return res.status(400).json({ message: "User is not a participant" });
    }

    if (!contest.admins.includes(userIdToPromote)) {
      contest.admins.push(userIdToPromote);
      await contest.save();
    }

    res.json({ message: "User promoted to admin", contest });
  } catch (error) {
    console.error("[PROMOTE][ERROR]:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};


// ---------------- Get all contests ----------------
export const getContests = async (req, res) => {
  try {
    const contests = await Contest.find()
      .populate("participants", "username email")
      .populate("admins", "username email");
    res.json(contests);
  } catch (error) {
    console.error("[GET][ERROR]:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ---------------- Get contest by ID ----------------
export const getContestById = async (req, res) => {
  try {
    const contest = await Contest.findById(req.params.id)
      .populate("participants", "username email")
      .populate("admins", "username email");
    if (!contest) return res.status(404).json({ message: "Contest not found" });

    res.json(contest);
  } catch (error) {
    console.error("[GETBYID][ERROR]:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ---------------- Get my contests ----------------
export const getMyContests = async (req, res) => {
  try {
    const contests = await Contest.find({ participants: req.user.id })
      .populate("participants", "username email")
      .populate("admins", "username email")
      .sort({ createdAt: -1 });
    res.json(contests);
  } catch (error) {
    console.error("[MYCONTESTS][ERROR]:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ---------------- Like a contest entry ----------------
export const likeEntry = async (req, res) => {
  try {
    const entry = await ContestEntry.findById(req.params.entryId);
    if (!entry) return res.status(404).json({ message: "Entry not found" });

    entry.likes += 1;
    await entry.save();

    res.json({ message: "Liked", likes: entry.likes });
  } catch (error) {
    console.error("[LIKE][ERROR]:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ---------------- Leaderboard ----------------
export const getLeaderboard = async (req, res) => {
  try {
    const { contestId } = req.params;
    if (!contestId) return res.status(400).json({ message: "contestId is required" });

    const entries = await ContestEntry.find({ contest: contestId })
      .populate("user", "username")
      .sort({ likes: -1, createdAt: 1 });

    const leaderboard = entries.map(e => ({
      _id: e._id,
      userId: e.user?._id,
      username: e.user?.username || "Unknown",
      likes: e.likes || 0,
    }));

    res.json(leaderboard);
  } catch (error) {
    console.error("[LEADERBOARD][ERROR]:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ---------------- Update contest ----------------
export const updateContest = async (req, res) => {
  try {
    const contest = await Contest.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.status(200).json(contest);
  } catch (err) {
    console.error("[UPDATE][ERROR]:", err.message);
    res.status(500).json({ message: "Server Error", error: err.message });
  }
};

// ---------------- Delete contest ----------------
export const deleteContest = async (req, res) => {
  try {
    await Contest.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Contest deleted successfully" });
  } catch (err) {
    console.error("[DELETE][ERROR]:", err.message);
    res.status(500).json({ message: "Server Error", error: err.message });
  }
};
