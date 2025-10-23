import multer from "multer";
import path from "path";
import fs from "fs";

// -------- Storage Engine Setup --------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadFolder = "uploads/others"; // default

    // Separate folders based on file usage/type
    if (file.fieldname === "image") uploadFolder = "uploads/posts";
    else if (file.fieldname === "video") uploadFolder = "uploads/reels";
    else if (file.fieldname === "profilePic") uploadFolder = "uploads/profiles";

    // Create folder if not exists
    fs.mkdirSync(uploadFolder, { recursive: true });

    cb(null, uploadFolder);
  },

  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  },
});

// -------- File Filter (optional) --------
const fileFilter = (req, file, cb) => {
  const allowedImage = ["image/jpeg", "image/png", "image/jpg"];
  const allowedVideo = ["video/mp4", "video/mkv", "video/avi"];

  if ([...allowedImage, ...allowedVideo].includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type"), false);
  }
};

// -------- Multer Instance --------
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
});

export default upload;
