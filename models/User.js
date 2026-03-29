const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  name: String,
  password: String,
  status: { type: String, default: "offline" },
  friends: { type: [String], default: [] }
});

module.exports = mongoose.model("User", UserSchema);