const mongoose = require("mongoose");

const RoomSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }, // ⭐ กันชื่อซ้ำ
  members: [String],
  isGroup: { type: Boolean, default: false } // ⭐ กัน undefined
});

module.exports = mongoose.model("Room", RoomSchema);