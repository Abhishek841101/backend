


// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "./config/connectdb.js";
import userRoutes from "./routes/userRoutes.js";
import socketHandler from "./socketHandler.js";

dotenv.config();

// -------- Fix for __dirname (ES Module) --------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 8000;
const DATABASE_URL = process.env.DATABASE_URL;

// -------------------- Middlewares --------------------
app.use(cors());
app.use(express.json({ limit: "70mb" }));
app.use(express.urlencoded({ limit: "70mb", extended: true }));

// -------------------- Connect MongoDB --------------------
connectDB(DATABASE_URL);

// -------------------- Static Upload Folder --------------------
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// -------------------- Routes (all-in-one router) --------------------
// You are keeping all route definitions in a single router file (userRoutes.js)
// so we mount it under each API category.
app.use("/api/user", userRoutes);
app.use("/api/post", userRoutes);
app.use("/api/chat", userRoutes);
app.use("/api/contest", userRoutes);
app.use("/api/profile", userRoutes);
app.use("/api/reel", userRoutes);
app.use("/api/share", userRoutes);
app.use("/api/notification", userRoutes); // Uncomment when ready
app.use("/api/media", userRoutes); // Uncomment when ready
// -------------------- Socket.IO Setup --------------------
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});
socketHandler(io);

// -------------------- Start Server --------------------
server.listen(port, () => {
  console.log(`✅ Server listening at http://localhost:${port}`);
});
