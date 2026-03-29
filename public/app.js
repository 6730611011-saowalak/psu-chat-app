const socket = io();
const user = JSON.parse(localStorage.getItem("user"));

if (!user) {
  window.location.href = "login.html";
}

const currentUserBox = document.getElementById("currentUserBox");
const userList = document.getElementById("userList");
const groupList = document.getElementById("groupList");
const chatBox = document.getElementById("chatBox");
const chatHeader = document.getElementById("chatHeader");
const msgInput = document.getElementById("msg");
const fileInput = document.getElementById("fileInput");

// เพิ่ม 2 อันนี้
const searchFriendInput = document.getElementById("searchFriend");
const groupMemberSelector = document.getElementById("groupMemberSelector");

let currentRoom = "";
let currentChatName = "";
let friendCache = [];

currentUserBox.innerHTML = `
  <div><strong>${user.name}</strong></div>
  <div>${user.email}</div>
  <div style="color: green; font-weight: bold;">สถานะ: ออนไลน์</div>
`;

socket.emit("userOnline", user);

window.addEventListener("beforeunload", () => {
  try {
    navigator.sendBeacon(
      "/logout",
      new Blob([JSON.stringify({ email: user.email })], {
        type: "application/json"
      })
    );
  } catch (error) {}
});

function createPrivateRoom(a, b) {
  return [a, b].sort().join("-");
}

// ดึงเฉพาะเพื่อน
async function loadUsers() {
  const res = await fetch(`/friends/${encodeURIComponent(user.email)}`);
  const users = await res.json();

  friendCache = users.filter((u) => u.email !== user.email);

  renderFriendList(friendCache);
  renderGroupMemberSelector(friendCache);
}

// แสดงรายชื่อเพื่อน
function renderFriendList(users) {
  userList.innerHTML = "";

  if (!users.length) {
    userList.innerHTML = `<div class="item-sub">ยังไม่มีเพื่อน</div>`;
    return;
  }

  users.forEach((u) => {
    const div = document.createElement("div");
    div.className = "list-item";
    div.innerHTML = `
      <div class="item-top">
        <span>${u.name}</span>
        <span class="${u.status === "online" ? "status-online" : "status-offline"}">
          ${u.status}
        </span>
      </div>
      <div class="item-sub">${u.email}</div>
    `;
    div.onclick = () => startPrivateChat(u);
    userList.appendChild(div);
  });
}

// ค้นหาเพื่อน
function filterFriends() {
  const keyword = (searchFriendInput?.value || "").trim().toLowerCase();

  if (!keyword) {
    renderFriendList(friendCache);
    return;
  }

  const filtered = friendCache.filter((u) => {
    return (
      u.name.toLowerCase().includes(keyword) ||
      u.email.toLowerCase().includes(keyword)
    );
  });

  renderFriendList(filtered);
}

// แสดงช่องเลือกสมาชิกตอนสร้างกลุ่ม
function renderGroupMemberSelector(users) {
  if (!groupMemberSelector) return;

  groupMemberSelector.innerHTML = "";

  if (!users.length) {
    groupMemberSelector.innerHTML = `
      <div class="item-sub">ยังไม่มีเพื่อนให้เลือกเข้ากลุ่ม</div>
    `;
    return;
  }

  users.forEach((u) => {
    const label = document.createElement("label");
    label.className = "member-option";
    label.innerHTML = `
      <input type="checkbox" value="${u.name}" />
      <span>${u.name}</span>
      <small>${u.email}</small>
    `;
    groupMemberSelector.appendChild(label);
  });
}

async function loadGroups() {
  const res = await fetch("/rooms");
  const rooms = await res.json();

  groupList.innerHTML = "";

  rooms.forEach((room) => {
    const div = document.createElement("div");
    div.className = "list-item";
    div.innerHTML = `
      <div class="item-top">
        <span>👥 ${room.name}</span>
      </div>
      <div class="item-sub">กลุ่มแชท</div>
    `;
    div.onclick = () => startGroupChat(room);
    groupList.appendChild(div);
  });
}

function startPrivateChat(targetUser) {
  currentRoom = createPrivateRoom(user.name, targetUser.name);
  currentChatName = targetUser.name;
  chatHeader.textContent = `แชทกับ ${targetUser.name}`;
  socket.emit("joinRoom", currentRoom);
  loadMessages(currentRoom);
}

function startGroupChat(room) {
  currentRoom = room.name;
  currentChatName = room.name;
  chatHeader.textContent = `กลุ่ม: ${room.name}`;
  socket.emit("joinRoom", currentRoom);
  loadMessages(currentRoom);
}

async function loadMessages(room) {
  const res = await fetch(`/messages/${encodeURIComponent(room)}`);
  const messages = await res.json();

  chatBox.innerHTML = "";

  messages.forEach(renderMessage);
  scrollToBottom();
}

function renderMessage(data) {
  const isMe = data.sender === user.name;
  const wrapper = document.createElement("div");
  wrapper.className = isMe ? "message-row me" : "message-row other";

  let content = "";

  if (data.type === "file") {
    content = `
      <div class="sender-name">${data.sender}</div>
      <div>
        📎 <a href="/uploads/${data.file}" target="_blank">
          ${data.originalname || data.message || "ดาวน์โหลดไฟล์"}
        </a>
      </div>
      <div class="message-time">${data.time || ""}</div>
    `;
  } else {
    content = `
      <div class="sender-name">${data.sender}</div>
      <div>${data.message}</div>
      <div class="message-time">${data.time || ""}</div>
    `;
  }

  wrapper.innerHTML = `<div class="message-bubble">${content}</div>`;
  chatBox.appendChild(wrapper);
}

function scrollToBottom() {
  chatBox.scrollTop = chatBox.scrollHeight;
}

function sendMessage() {
  const text = msgInput.value.trim();

  if (!currentRoom) {
    alert("กรุณาเลือกผู้ใช้หรือกลุ่มก่อน");
    return;
  }

  if (!text) return;

  socket.emit("sendMessage", {
    room: currentRoom,
    sender: user.name,
    message: text
  });

  msgInput.value = "";
}

async function sendFile() {
  if (!currentRoom) {
    alert("กรุณาเลือกผู้ใช้หรือกลุ่มก่อน");
    return;
  }

  const file = fileInput.files[0];

  if (!file) {
    alert("กรุณาเลือกไฟล์");
    return;
  }

  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/upload", {
    method: "POST",
    body: formData
  });

  const data = await res.json();

  if (!data.success) {
    alert(data.msg || "อัปโหลดไฟล์ไม่สำเร็จ");
    return;
  }

  socket.emit("sendFile", {
    room: currentRoom,
    sender: user.name,
    file: data.file,
    originalname: data.originalname
  });

  fileInput.value = "";
}

// เพิ่มเพื่อน
async function addFriend() {
  const friendEmail = document.getElementById("friendEmail").value.trim();

  if (!friendEmail) {
    alert("กรุณากรอกอีเมลเพื่อน");
    return;
  }

  const res = await fetch("/addFriend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      myEmail: user.email,
      friendEmail
    })
  });

  const data = await res.json();
  alert(data.msg);

  if (data.success) {
    document.getElementById("friendEmail").value = "";
    loadUsers();
  }
}

// สร้างกลุ่มแบบเลือกสมาชิก
async function createGroup() {
  const groupName = document.getElementById("groupName").value.trim();

  if (!groupName) {
    alert("กรุณาใส่ชื่อกลุ่ม");
    return;
  }

  const checkedMembers = Array.from(
    document.querySelectorAll('#groupMemberSelector input[type="checkbox"]:checked')
  ).map((checkbox) => checkbox.value);

  const members = [...new Set([user.name, ...checkedMembers])];

  if (members.length < 2) {
    alert("กรุณาเลือกเพื่อนอย่างน้อย 1 คนเข้ากลุ่ม");
    return;
  }

  const res = await fetch("/createRoom", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: groupName,
      members,
      isGroup: true
    })
  });

  const data = await res.json();

  if (!data.success) {
    alert(data.msg);
    return;
  }

  document.getElementById("groupName").value = "";
  document
    .querySelectorAll('#groupMemberSelector input[type="checkbox"]')
    .forEach((checkbox) => {
      checkbox.checked = false;
    });

  loadGroups();
  alert("สร้างกลุ่มสำเร็จ");
}

async function logout() {
  await fetch("/logout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: user.email })
  });

  localStorage.removeItem("user");
  window.location.href = "login.html";
}

socket.on("receiveMessage", (data) => {
  if (data.room === currentRoom) {
    renderMessage(data);
    scrollToBottom();
  }
});

socket.on("receiveFile", (data) => {
  if (data.room === currentRoom) {
    renderMessage(data);
    scrollToBottom();
  }
});

socket.on("refreshUsers", () => {
  loadUsers();
});

loadUsers();
loadGroups();