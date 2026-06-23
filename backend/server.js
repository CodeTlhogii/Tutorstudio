const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Dynamic CORS configuration: Allow localhost in development, and your Render URL in production
const ALLOWED_ORIGINS = [
  "http://localhost:5173", // Default Vite port
  "http://localhost:3000", // Default CRA port
  "https://tutorstudio-frontend.onrender.com" // CHANGE THIS to your actual Render frontend URL
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));

app.use(express.json({ limit: '50mb' })); // Increased limit to handle raw PDF binary array payloads

// In-memory state store for rooms
const activeSessions = {};

// API Endpoint: Tutor Creation / Login
app.post('/api/tutor-login', (req, res) => {
  const { password, sessionName, avatar } = req.body;
  
  // Basic security fallback check (Replace 'admin123' with your secure master key string)
  if (password !== 'admin123') {
    return res.status(401).json({ success: false, message: 'Invalid Master Access Token Key.' });
  }

  // Generate a random 4-digit code
  const accessCode = Math.floor(1000 + Math.random() * 9000).toString();
  
  activeSessions[accessCode] = {
    sessionName,
    tutorAvatar: avatar,
    timeLeft: 10800, // 3 hours in seconds
    history: [],
    fileData: null,
    currentPage: 1,
    studentCount: 0
  };

  res.json({ success: true, accessCode });
});

// API Endpoint: Verify Code room structural verification node
app.post('/api/verify-session', (req, res) => {
  const { accessCode } = req.body;
  if (activeSessions[accessCode]) {
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, message: 'Active room code session not found or expired.' });
  }
});

// API Endpoint: Sync PDF payload upload
app.post('/api/upload-pdf', (req, res) => {
  const { accessCode, fileData } = req.body;
  if (activeSessions[accessCode]) {
    activeSessions[accessCode].fileData = fileData;
    activeSessions[accessCode].currentPage = 1;
    activeSessions[accessCode].history = []; // Clear page markers upon new load configuration
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, message: 'Target workspace not found.' });
  }
});

// Socket.io Coordination Mesh Engine
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true
  }
});

io.on('connection', (socket) => {
  let userSessionCode = null;
  let userRole = null;

  socket.on('join-session', ({ accessCode, role, username, avatar }) => {
    userSessionCode = accessCode;
    userRole = role;
    
    const session = activeSessions[accessCode];
    if (!session) return;

    socket.join(accessCode);

    if (role === 'student') {
      session.studentCount++;
    }

    // Broadcast updated metrics down workspace channels
    io.to(accessCode).emit('room-presence-updated', { studentCount: session.studentCount });

    // Sync newly connected client instantly with runtime board configuration values
    socket.emit('sync-state', {
      timeLeft: session.timeLeft,
      tutorAvatar: session.tutorAvatar,
      fileData: session.fileData,
      currentPage: session.currentPage,
      history: session.history
    });

    // Handle System Announce Message
    io.to(accessCode).emit('incoming-chat-message', {
      username: 'System Node',
      role: 'system',
      text: `${username} successfully attached to workspace link.`
    });
  });

  socket.on('draw-stroke', (stroke) => {
    if (!userSessionCode || !activeSessions[userSessionCode]) return;
    activeSessions[userSessionCode].history.push(stroke);
    socket.to(userSessionCode).emit('incoming-stroke', stroke);
  });

  socket.on('sync-history', (newHistory) => {
    if (!userSessionCode || !activeSessions[userSessionCode]) return;
    activeSessions[userSessionCode].history = newHistory;
    socket.to(userSessionCode).emit('history-updated', newHistory);
  });

  socket.on('clear-canvas-board', () => {
    if (!userSessionCode || !activeSessions[userSessionCode]) return;
    activeSessions[userSessionCode].history = [];
    socket.to(userSessionCode).emit('canvas-board-cleared');
  });

  socket.on('pdf-page-change', ({ pageNumber }) => {
    if (!userSessionCode || !activeSessions[userSessionCode]) return;
    activeSessions[userSessionCode].currentPage = pageNumber;
    activeSessions[userSessionCode].history = []; // reset active overlays per structural canvas clear rules
    socket.to(userSessionCode).emit('pdf-page-updated', { pageNumber });
  });

  socket.on('send-chat-message', (text) => {
    if (!userSessionCode) return;
    io.to(userSessionCode).emit('incoming-chat-message', {
      username: socket.handshake.auth.username || 'Anonymous Participant',
      role: userRole,
      text
    });
  });

  // WebRTC Signaling Relay
  socket.on('audio-stream-signal', ({ signal }) => {
    if (!userSessionCode) return;
    socket.to(userSessionCode).emit('incoming-audio-signal', {
      senderId: socket.id,
      signal
    });
  });

  socket.on('disconnect', () => {
    const session = activeSessions[userSessionCode];
    if (session && userRole === 'student') {
      session.studentCount = Math.max(0, session.studentCount - 1);
      io.to(userSessionCode).emit('room-presence-updated', { studentCount: session.studentCount });
    }
  });
});

// Periodic Countdown Sync Thread (Fires every second)
setInterval(() => {
  Object.keys(activeSessions).forEach((code) => {
    if (activeSessions[code].timeLeft > 0) {
      activeSessions[code].timeLeft--;
      io.to(code).emit('timer-update', { timeLeft: activeSessions[code].timeLeft });
    } else {
      delete activeSessions[code]; // Destruct dead room channels gracefully
    }
  });
}, 1000);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`CanvaClass Engine online executing on internal network port ${PORT}`));