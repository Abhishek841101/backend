


import multer from "multer";
import path from "path";
import fs from "fs";

// -------- Storage Engine Setup --------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadFolder = "uploads/others"; // default

    // Determine folder based on fieldname
    if (file.fieldname === "media") uploadFolder = "uploads/posts"; // updated for posts
    else if (file.fieldname === "video") uploadFolder = "uploads/reels"; // reels remain
    else if (file.fieldname === "profilePic") uploadFolder = "uploads/profiles";

    // Create folder if it doesn't exist
    fs.mkdirSync(uploadFolder, { recursive: true });

    cb(null, uploadFolder);
  },

  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  },
});

// -------- File Filter --------
const fileFilter = (req, file, cb) => {
  const allowedImage = ["image/jpeg", "image/png", "image/jpg"];
  const allowedVideo = ["video/mp4", "video/mkv", "video/avi"];

  if (file.fieldname === "media") {
    // For posts: accept both image & video
    if ([...allowedImage, ...allowedVideo].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type for post. Only images/videos allowed."), false);
    }
  } else if (file.fieldname === "video") {
    // For reels: accept only video
    if (allowedVideo.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type for reel. Only videos allowed."), false);
    }
  } else if (file.fieldname === "profilePic") {
    if (allowedImage.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type for profile picture. Only images allowed."), false);
    }
  } else {
    cb(new Error("Unknown file field"), false);
  }
};

// -------- Multer Instance --------
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
});

export default upload;
