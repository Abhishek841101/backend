// // import mongoose from "mongoose";



// // const userSchema = new mongoose.Schema({
// //   username: { type: String, required: true },
// //   email:    { type: String, required: true, unique: true },
// //   password: { type: String, required: true }
// // });


// // const UserModel = mongoose.model("user", userSchema)

// // export default UserModel





// import mongoose from "mongoose";

// const UserSchema = new mongoose.Schema({
//   username: { type: String, unique: true, index: true, required: true },
//   fullName: String,
//   email: { type: String, unique: true, required: true },
//   password: { type: String, required: true },
//   avatar: String,
//   bio: String,
//   link: String,
//   isPrivate: { type: Boolean, default: false },
//   isVerified: { type: Boolean, default: false },
//   stats: {
//     posts: { type: Number, default: 0 },
//     followers: { type: Number, default: 0 },
//     following: { type: Number, default: 0 }
//   },
//   createdAt: { type: Date, default: Date.now }
// });

// export default mongoose.model("User", UserSchema);






import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true, index: true, required: true },
  fullName: String,
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  avatar: String,
  bio: String,
  link: String,
  readBy: { type: [mongoose.Schema.Types.ObjectId], ref: "User", default: [] },
  isPrivate: { type: Boolean, default: false },
  isVerified: { type: Boolean, default: false },
  stats: {
    posts: { type: Number, default: 0 },
    followers: { type: Number, default: 0 },
    following: { type: Number, default: 0 }
  },

  // ---------------- Online / Offline ----------------
  isOnline: { type: Boolean, default: false },
  lastActive: { type: Date, default: Date.now },

  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("User", UserSchema);
