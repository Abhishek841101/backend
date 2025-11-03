import multer from "multer";
import path from "path";
import fs from "fs";

// Allowed MIME types
const allowedImage = ["image/jpeg", "image/png", "image/jpg"];
const allowedVideo = ["video/mp4", "video/mkv", "video/avi", "video/mov"];
const allowedAudio = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg"];

// Folder map by fieldname
const folderMap = {
  media: "uploads/posts",       // post (image/video)
  video: "uploads/reels",       // reels / podcast
  profilePic: "uploads/profiles",
  thumbnail: "uploads/thumbnails",
  audio: "uploads/audios",      // ✅ audio files
};

// Storage engine
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadFolder = "uploads/others";

    if (folderMap[file.fieldname]) {
      uploadFolder = folderMap[file.fieldname];
    }

    // Ensure folder exists
    fs.mkdirSync(uploadFolder, { recursive: true });

    cb(null, uploadFolder);
  },

  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  },
});

// File Filter
const fileFilter = (req, file, cb) => {
  // ✅ Posts → image / video / audio
  if (file.fieldname === "media") {
    if ([...allowedImage, ...allowedVideo, ...allowedAudio].includes(file.mimetype)) {
      return cb(null, true);
    }
    return cb(new Error("Only image/video/audio allowed for posts"), false);
  }

  // ✅ Reels/podcast → video only
  if (file.fieldname === "video") {
    if (allowedVideo.includes(file.mimetype)) {
      return cb(null, true);
    }
    return cb(new Error("Only video allowed for reels/podcast"), false);
  }

  // ✅ Profile photo → image only
  if (file.fieldname === "profilePic") {
    if (allowedImage.includes(file.mimetype)) {
      return cb(null, true);
    }
    return cb(new Error("Only image allowed for profile picture"), false);
  }

  // ✅ Thumbnail → image only
  if (file.fieldname === "thumbnail") {
    if (allowedImage.includes(file.mimetype)) {
      return cb(null, true);
    }
    return cb(new Error("Only image allowed for thumbnail"), false);
  }

  // ✅ AUDIO fields
  if (file.fieldname === "audio") {
    if (allowedAudio.includes(file.mimetype)) {
      return cb(null, true);
    }
    return cb(new Error("Only audio allowed"), false);
  }

  return cb(new Error("Unknown upload field"), false);
};

// Multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 800 * 1024 * 1024, // 800MB
  },
});

export default upload;
