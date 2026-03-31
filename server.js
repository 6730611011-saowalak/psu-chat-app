const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const mongoose = require("mongoose");
const multer = require("multer");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/chat";

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

app.get("/", (req, res) => {
  res.redirect("/login.html");
});

mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log("MongoDB error:", err));

const User = require("./models/User");
const Message = require("./models/Message");
const Room = require("./models/Room");

const storage = multer.diskStorage({
  destination: "./uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

const upload = multer({ storage });

// register
app.post("/register", async (req, res) => {
  try {
    const { email, name, password } = req.body;

    if (!email || !name || !password) {
      return res.json({ success: false, msg: "กรอกข้อมูลให้ครบ" });
    }

    if (!/^\d{10}@psu\.ac\.th$/.test(email)) {
      return res.json({ success: false, msg: "ใช้เมล PSU เท่านั้น" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.json({ success: false, msg: "อีเมลนี้ถูกใช้แล้ว" });
    }

    const user = new User({
      email,
      name,
      password,
      status: "offline",
      friends: []
    });

    await user.save();
    res.json({ success: true, msg: "สมัครสำเร็จ" });
  } catch (error) {
    console.log(error);
    res.json({ success: false, msg: "เกิดข้อผิดพลาดในการสมัครสมาชิก" });
  }
});

// login
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email, password });
    if (!user) {
      return res.json({ success: false, msg: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });
    }

    user.status = "online";
    await user.save();

    res.json({
      success: true,
      msg: "เข้าสู่ระบบสำเร็จ",
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        status: user.status
      }
    });
  } catch (error) {
    console.log(error);
    res.json({ success: false, msg: "เกิดข้อผิดพลาดในการเข้าสู่ระบบ" });
  }
});

// reset password
app.post("/resetPassword", async (req, res) => {
  try {
    const { email, newPassword, confirmPassword } = req.body;

    if (!email || !newPassword || !confirmPassword) {
      return res.json({ success: false, msg: "กรุณากรอกข้อมูลให้ครบ" });
    }

    if (!/^\d{10}@psu\.ac\.th$/.test(email)) {
      return res.json({ success: false, msg: "ใช้อีเมล PSU เท่านั้น" });
    }

    if (newPassword !== confirmPassword) {
      return res.json({ success: false, msg: "รหัสผ่านไม่ตรงกัน" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.json({ success: false, msg: "ไม่พบอีเมลนี้ในระบบ" });
    }

    user.password = newPassword;
    await user.save();

    res.json({ success: true, msg: "รีเซ็ตรหัสผ่านสำเร็จ" });
  } catch (error) {
    console.log(error);
    res.json({ success: false, msg: "เกิดข้อผิดพลาดในการรีเซ็ตรหัสผ่าน" });
  }
});

// logout
app.post("/logout", async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (user) {
      user.status = "offline";
      await user.save();
    }

    res.json({ success: true, msg: "ออกจากระบบแล้ว" });
  } catch (error) {
    console.log(error);
    res.json({ success: false, msg: "เกิดข้อผิดพลาดในการออกจากระบบ" });
  }
});

// search all users
app.get("/searchUsers", async (req, res) => {
  try {
    const keyword = (req.query.keyword || "").trim();
    const myEmail = req.query.myEmail;

    if (!keyword) {
      return res.json([]);
    }

    const users = await User.find({
      email: { $ne: myEmail },
      $or: [
        { name: { $regex: keyword, $options: "i" } },
        { email: { $regex: keyword, $options: "i" } }
      ]
    }).limit(20);

    res.json(users);
  } catch (error) {
    console.log(error);
    res.json([]);
  }
});

// get my friends
app.get("/friends/:email", async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    if (!user) {
      return res.json([]);
    }

    const friends = await User.find({
      email: { $in: user.friends || [] }
    }).sort({ name: 1 });

    res.json(friends);
  } catch (error) {
    console.log(error);
    res.json([]);
  }
});

// add friend
app.post("/addFriend", async (req, res) => {
  try {
    const { myEmail, friendEmail } = req.body;

    if (!myEmail || !friendEmail) {
      return res.json({ success: false, msg: "กรุณากรอกข้อมูลให้ครบ" });
    }

    if (myEmail === friendEmail) {
      return res.json({ success: false, msg: "ไม่สามารถเพิ่มตัวเองเป็นเพื่อนได้" });
    }

    const me = await User.findOne({ email: myEmail });
    const friend = await User.findOne({ email: friendEmail });

    if (!me) {
      return res.json({ success: false, msg: "ไม่พบผู้ใช้ปัจจุบัน" });
    }

    if (!friend) {
      return res.json({ success: false, msg: "ไม่พบอีเมลเพื่อนในระบบ" });
    }

    if (me.friends.includes(friendEmail)) {
      return res.json({ success: false, msg: "เพิ่มเพื่อนคนนี้แล้ว" });
    }

    me.friends.push(friendEmail);
    friend.friends.push(myEmail);

    await me.save();
    await friend.save();

    res.json({ success: true, msg: "เพิ่มเพื่อนสำเร็จ" });
  } catch (error) {
    console.log(error);
    res.json({ success: false, msg: "เกิดข้อผิดพลาดในการเพิ่มเพื่อน" });
  }
});

// create group
app.post("/createRoom", async (req, res) => {
  try {
    const { name, members } = req.body;

    if (!name || !name.trim()) {
      return res.json({ success: false, msg: "กรุณาใส่ชื่อกลุ่ม" });
    }

    const existingRoom = await Room.findOne({ name: name.trim() });
    if (existingRoom) {
      return res.json({ success: false, msg: "ชื่อกลุ่มนี้มีอยู่แล้ว" });
    }

    const cleanMembers = Array.isArray(members)
      ? [...new Set(members.filter(Boolean))]
      : [];

    if (cleanMembers.length < 2) {
      return res.json({ success: false, msg: "กรุณาเลือกสมาชิกอย่างน้อย 1 คน" });
    }

    const room = new Room({
      name: name.trim(),
      members: cleanMembers,
      isGroup: true
    });

    await room.save();

    res.json({
      success: true,
      msg: "สร้างกลุ่มสำเร็จ",
      room
    });
  } catch (error) {
    console.log(error);
    res.json({ success: false, msg: "เกิดข้อผิดพลาดในการสร้างกลุ่ม" });
  }
});

// get rooms
app.get("/rooms", async (req, res) => {
  try {
    const rooms = await Room.find().sort({ name: 1 });
    res.json(rooms);
  } catch (error) {
    console.log(error);
    res.json([]);
  }
});

// messages
app.get("/messages/:room", async (req, res) => {
  try {
    const msgs = await Message.find({ room: req.params.room }).sort({ _id: 1 });
    res.json(msgs);
  } catch (error) {
    console.log(error);
    res.json([]);
  }
});

// upload
app.post("/upload", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.json({ success: false, msg: "ไม่พบไฟล์" });
    }

    res.json({
      success: true,
      file: req.file.filename,
      originalname: req.file.originalname
    });
  } catch (error) {
    console.log(error);
    res.json({ success: false, msg: "อัปโหลดไฟล์ไม่สำเร็จ" });
  }
});

io.on("connection", (socket) => {
  socket.on("joinRoom", (room) => {
    socket.join(room);
  });

  socket.on("userOnline", async (userData) => {
    try {
      if (!userData || !userData.email) return;

      socket.userEmail = userData.email;

      const user = await User.findOne({ email: userData.email });
      if (user) {
        user.status = "online";
        await user.save();
        io.emit("refreshUsers");
      }
    } catch (error) {
      console.log(error);
    }
  });

  socket.on("sendMessage", async (data) => {
    try {
      const messageData = {
        room: data.room,
        sender: data.sender,
        message: data.message,
        type: "text",
        time: new Date().toLocaleTimeString("th-TH", {
          hour: "2-digit",
          minute: "2-digit"
        })
      };

      const msg = new Message(messageData);
      await msg.save();

      io.to(data.room).emit("receiveMessage", messageData);
    } catch (error) {
      console.log(error);
    }
  });

  socket.on("sendFile", async (data) => {
    try {
      const fileData = {
        room: data.room,
        sender: data.sender,
        file: data.file,
        originalname: data.originalname,
        message: data.originalname || "ไฟล์แนบ",
        type: "file",
        time: new Date().toLocaleTimeString("th-TH", {
          hour: "2-digit",
          minute: "2-digit"
        })
      };

      const msg = new Message(fileData);
      await msg.save();

      io.to(data.room).emit("receiveFile", fileData);
    } catch (error) {
      console.log(error);
    }
  });

  socket.on("userOffline", async (userData) => {
    try {
      if (!userData || !userData.email) return;

      const user = await User.findOne({ email: userData.email });
      if (user) {
        user.status = "offline";
        await user.save();
        io.emit("refreshUsers");
      }
    } catch (error) {
      console.log(error);
    }
  });

  socket.on("disconnect", async () => {
    try {
      const email = socket.userEmail;

      if (email) {
        const user = await User.findOne({ email });
        if (user) {
          user.status = "offline";
          await user.save();
          io.emit("refreshUsers");
        }
      }

      console.log("User disconnected:", email);
    } catch (err) {
      console.log(err);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running: http://localhost:${PORT}`);
});
