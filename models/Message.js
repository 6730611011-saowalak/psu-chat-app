const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
  room: String,
  sender: String,
  message: String,
  file: String,
  originalname: String,
  type: String,
  time: String
});

module.exports = mongoose.model("Message", MessageSchema);