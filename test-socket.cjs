const { io } = require("socket.io-client");

const socket = io("https://ais-pre-maktu7vxpyn2ghysibw2hq-28880934033.europe-west1.run.app", {
  path: "/api/chat",
  transports: ["polling"],
  extraHeaders: {
    'Cookie': 'GAESA=CgQIg8SYBw; __SECURE-aistudio_auth_flow_may_set_cookies=true'
  }
});

socket.on("connect", () => {
  console.log("Connected with ID:", socket.id);
  socket.disconnect();
});

socket.on("connect_error", (err) => {
  console.error("Connection error:", err.message);
});
