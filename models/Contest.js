
import mongoose from "mongoose";

const contestSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  prize: { type: Number },
  slots: { type: Number },
  participants: { type: [String], default: [] }, // user IDs
  admins: { type: [String], default: [] },       // admin IDs (for group contests)
  contestType: {
    type: String,
    enum: ["solo", "group"],
    default: "solo",
  },
  createdAt: { type: Date, default: Date.now },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
});

const Contest = mongoose.models.Contest || mongoose.model("Contest", contestSchema);
export default Contest;
