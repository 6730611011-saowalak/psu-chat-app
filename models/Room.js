const mongoose = require("mongoose");

const RoomSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  members: [String],
  isGroup: { type: Boolean, default: false }
});

module.exports = mongoose.model("Room", RoomSchema);