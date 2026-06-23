import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

// Replace with your live Render backend Web Service URL once provisioned
const BACKEND_URL = process.env.NODE_ENV === 'production'
  ? 'https://your-backend-name.onrender.com' 
  : 'http://localhost:5000';

const glassBaseStyle = {
  background: 'rgba(255, 255, 255, 0.7)',
  backdropFilter: 'blur(30px)',
  WebkitBackdropFilter: 'blur(30px)',
  border: '1px solid rgba(255, 255, 255, 0.5)',
  borderRadius: '24px',
  boxShadow: '0 12px 40px rgba(31, 38, 135, 0.08)',
};

const sidebarTabStyle = (active) => ({
  width: '100%',
  padding: '14px 8px',
  borderRadius: '14px',
  background: active ? 'rgba(139, 61, 255, 0.12)' : 'transparent',
  color: active ? '#8b3dff' : '#555',
  border: 'none',
  cursor: 'pointer',
  fontWeight: '600',
  fontSize: '11px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '6px',
});

export default function App() {
  const [view, setView] = useState('portal'); 
  const [role, setRole] = useState('student'); 
  const [tutorPassword, setTutorPassword] = useState('');
  const [sessionInputName, setSessionInputName] = useState('Grade 12 Mathematics');
  
  const [studentName, setStudentName] = useState('');
  const [tutorAvatar, setTutorAvatar] = useState(null);
  const [studentAvatar, setStudentAvatar] = useState(null);
  const [studentCodeInput, setStudentCodeInput] = useState('');
  
  const [activeAccessCode, setActiveAccessCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    document.title = "CanvaClass Studio | Real-Time Peer Tutoring Workspace";
    
    const checkViewportSize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkViewportSize();
    window.addEventListener('resize', checkViewportSize);

    const metaDescriptions = [
      { name: 'description', content: 'High-performance interactive live drawing boards built specifically for distinctions-tier academic mentoring and real-time layout annotation.' },
      { property: 'og:title', content: 'CanvaClass Studio Whiteboard Core' },
      { property: 'og:description', content: 'Collaborate live, sketch equations, and upload past exam papers instantly in a dedicated private digital workspace room.' },
      { property: 'og:type', content: 'website' }
    ];

    metaDescriptions.forEach(({ name, property, content }) => {
      let element = name ? document.querySelector(`meta[name="${name}"]`) : document.querySelector(`meta[property="${property}"]`);
      if (!element) {
        element = document.createElement('meta');
        if (name) element.setAttribute('name', name);
        if (property) element.setAttribute('property', property);
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    });

    const svgFavicon = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <rect width="100" height="100" rx="25" fill="#8b3dff"/>
        <path d="M30 35 C 35 20, 65 20, 70 35 C 75 50, 45 55, 50 75" fill="none" stroke="#00c4cc" stroke-width="12" stroke-linecap="round"/>
        <circle cx="51" cy="83" r="7" fill="#fff"/>
      </svg>
    `;
    
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = `data:image/svg+xml;utf8,${encodeURIComponent(svgFavicon)}`;

    return () => window.removeEventListener('resize', checkViewportSize);
  }, []);

  const handleAvatarFile = (e, target) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (target === 'tutor') setTutorAvatar(reader.result);
        if (target === 'student') setStudentAvatar(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateSessionByTutor = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/tutor-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: tutorPassword, sessionName: sessionInputName, avatar: tutorAvatar })
      });
      const data = await res.json();
      if (data.success) {
        setActiveAccessCode(data.accessCode);
        setRole('tutor');
        setView('workspace');
      } else {
        setErrorMsg(data.message);
      }
    } catch {
      setErrorMsg('Failed connection to studio core server.');
    }
  };

  const handleJoinSessionByStudent = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!studentName.trim() || !studentCodeInput.trim()) {
      return setErrorMsg('Please complete your name and provide a raw code.');
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/verify-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessCode: studentCodeInput.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setActiveAccessCode(studentCodeInput.trim());
        setView('workspace');
      } else {
        setErrorMsg(data.message);
      }
    } catch {
      setErrorMsg('Session verification node is currently offline.');
    }
  };

  if (isMobile) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'linear-gradient(135deg, #0e1318 0%, #1e1b4b 100%)', fontFamily: 'sans-serif', padding: '24px', boxSizing: 'border-box' }}>
        <div style={{ ...glassBaseStyle, width: '100%', maxWidth: '400px', padding: '32px', boxSizing: 'border-box', textAlign: 'center', color: '#fff' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>💻</div>
          <h2 style={{ fontSize: '22px', fontWeight: '800', margin: '0 0 12px 0', color: '#8b3dff' }}>Desktop Required</h2>
          <p style={{ fontSize: '14px', lineHeight: '1.6', color: '#cbd5e1', margin: 0 }}>
            CanvaClass Studio is optimized for precise math drawing interfaces, side-by-side chats, and workspace board interactions. Please access this room from a desktop or laptop computer.
          </p>
        </div>
      </div>
    );
  }

  if (view === 'portal') {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'linear-gradient(135deg, #0e1318 0%, #1e1b4b 100%)', fontFamily: 'sans-serif' }}>
        <div style={{ ...glassBaseStyle, width: '420px', padding: '40px', boxSizing: 'border-box' }}>
          <h1 style={{ fontSize: '32px', fontWeight: '800', margin: '0 0 5px 0', textAlign: 'center', color: '#8b3dff', letterSpacing: '-1px' }}>CanvaClass Studio</h1>
          <p style={{ fontSize: '14px', opacity: 0.6, textAlign: 'center', margin: '0 0 30px 0' }}>Dedicated Workspace Hub</p>

          {errorMsg && <div style={{ background: 'rgba(255, 77, 79, 0.1)', color: '#ff4d4f', padding: '12px', borderRadius: '12px', fontSize: '13px', marginBottom: '20px', textAlign: 'center', fontWeight: '600' }}>⚠️ {errorMsg}</div>}

          <div style={{ display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.05)', padding: '4px', borderRadius: '12px', marginBottom: '20px' }}>
            <button onClick={() => setRole('student')} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '8px', background: role === 'student' ? '#fff' : 'transparent', fontWeight: '600', cursor: 'pointer', color: role === 'student' ? '#8b3dff' : '#555' }}>Student Entry</button>
            <button onClick={() => setRole('tutor')} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '8px', background: role === 'tutor' ? '#fff' : 'transparent', fontWeight: '600', cursor: 'pointer', color: role === 'tutor' ? '#8b3dff' : '#555' }}>Tutor Workspace Creator</button>
          </div>

          {role === 'tutor' ? (
            <form onSubmit={handleCreateSessionByTutor} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <input type="password" placeholder="Master Access Token Key" value={tutorPassword} onChange={e => setTutorPassword(e.target.value)} required style={{ padding: '14px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.1)', outline: 'none' }} />
              <input type="text" placeholder="Session Title" value={sessionInputName} onChange={e => setSessionInputName(e.target.value)} required style={{ padding: '14px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.1)', outline: 'none' }} />
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', background: 'rgba(0,0,0,0.02)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.05)' }}>
                <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '2px solid #8b3dff', flexShrink: 0 }}>
                  {tutorAvatar ? <img src={tutorAvatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '22px' }}>👨‍🏫</span>}
                </div>
                <label style={{ background: '#fff', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', fontWeight: '600', border: '1px solid #ccc' }}>
                  Pick Tutor Avatar
                  <input type="file" accept="image/*" onChange={e => handleAvatarFile(e, 'tutor')} style={{ display: 'none' }} />
                </label>
              </div>

              <button type="submit" style={{ padding: '14px', borderRadius: '12px', border: 'none', background: '#8b3dff', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>Generate Active Room Code</button>
            </form>
          ) : (
            <form onSubmit={handleJoinSessionByStudent} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <input type="text" placeholder="Enter 4-Digit Session Code" value={studentCodeInput} onChange={e => setStudentCodeInput(e.target.value)} required style={{ padding: '14px', borderRadius: '12px', border: '2px solid #8b3dff', outline: 'none', fontSize: '16px', fontWeight: '700', textAlign: 'center', letterSpacing: '2px' }} />
              <input type="text" placeholder="Your Name" value={studentName} onChange={e => setStudentName(e.target.value)} required style={{ padding: '14px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.1)', outline: 'none' }} />
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', background: 'rgba(0,0,0,0.02)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.05)' }}>
                <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '2px solid #8b3dff', flexShrink: 0 }}>
                  {studentAvatar ? <img src={studentAvatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '22px' }}>👤</span>}
                </div>
                <label style={{ background: '#fff', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', fontWeight: '600', border: '1px solid #ccc' }}>
                  Pick Chat Avatar
                  <input type="file" accept="image/*" onChange={e => handleAvatarFile(e, 'student')} style={{ display: 'none' }} />
                </label>
              </div>

              <button type="submit" style={{ padding: '14px', borderRadius: '12px', border: 'none', background: '#00c4cc', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>Connect to Whiteboard</button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <CanvaStudioWorkspace 
      accessCode={activeAccessCode} 
      role={role} 
      username={role === 'tutor' ? 'Tutor' : studentName} 
      avatar={role === 'tutor' ? tutorAvatar : studentAvatar} 
      onExit={() => {
        setActiveAccessCode('');
        setView('portal');
      }} 
    />
  );
}

function CanvaStudioWorkspace({ accessCode, role, username, avatar, onExit }) {
  const socketRef = useRef(null);
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const pdfCanvasRef = useRef(null);
  const chatEndRef = useRef(null);
  
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef({});

  const [activeTab, setActiveTab] = useState('design');
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#8b3dff');
  const [lineWidth, setLineWidth] = useState(6);
  const [tool, setTool] = useState('marker'); 
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pdfDocument, setPdfDocument] = useState(null);
  
  const [history, setHistory] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [messages, setMessages] = useState([]);
  const [typedMessage, setTypedMessage] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(10800);
  const [activeStudents, setActiveStudents] = useState(0);
  
  const [currentTutorAvatar, setCurrentTutorAvatar] = useState(avatar);
  const [isAudioMuted, setIsAudioMuted] = useState(true);

  useEffect(() => {
    socketRef.current = io(BACKEND_URL, {
      auth: { username }
    });
    const socket = socketRef.current;

    socket.emit('join-session', { accessCode, role, username, avatar });

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    context.lineCap = 'round';
    context.lineJoin = 'round';
    contextRef.current = context;

    const resizeCanvas = () => {
      const rect = canvas.parentNode.getBoundingClientRect();
      canvas.width = rect.width * 2;
      canvas.height = rect.height * 2;
      context.scale(2, 2);
      history.forEach(drawVector);
    };
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    socket.on('incoming-stroke', (stroke) => {
      drawVector(stroke);
      setHistory((prev) => [...prev, stroke]);
    });

    socket.on('history-updated', (newHistory) => {
      setHistory(newHistory);
      clearLocalCanvas();
      newHistory.forEach(drawVector);
    });

    socket.on('canvas-board-cleared', () => {
      setHistory([]);
      setRedoStack([]);
      clearLocalCanvas();
    });

    socket.on('pdf-file-loaded', async ({ fileData }) => {
      const typedArray = new Uint8Array(fileData);
      loadPdfDocument(typedArray);
    });

    socket.on('pdf-page-updated', (data) => {
      setCurrentPage(data.pageNumber);
      clearLocalCanvas();
      setHistory([]);
      setRedoStack([]);
    });

    socket.on('incoming-chat-message', (msg) => {
      setMessages((prev) => [...prev, msg]);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    });

    socket.on('room-presence-updated', ({ studentCount }) => {
      setActiveStudents(studentCount);
    });

    socket.on('timer-update', ({ timeLeft }) => {
      setSecondsLeft(timeLeft);
    });

    socket.on('sync-state', async (state) => {
      if (state.timeLeft) setSecondsLeft(state.timeLeft);
      if (state.tutorAvatar) setCurrentTutorAvatar(state.tutorAvatar);
      if (state.fileData) {
        const typedArray = new Uint8Array(state.fileData);
        await loadPdfDocument(typedArray);
      }
      if (state.currentPage) setCurrentPage(state.currentPage);
      if (state.history) {
        setHistory(state.history);
        state.history.forEach(drawVector);
      }
    });

    socket.on('incoming-audio-signal', async ({ senderId, signal }) => {
      try {
        let pc = peerConnectionsRef.current[senderId];
        if (!pc) {
          pc = createPeerConnection(senderId);
        }
        
        if (signal.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          if (signal.sdp.type === 'offer') {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('audio-stream-signal', { signal: { sdp: pc.localDescription } });
          }
        } else if (signal.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        }
      } catch (err) {
        console.warn('Audio mesh synchronization exception:', err);
      }
    });

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      socket.disconnect();
    };
  }, [accessCode, role]);

  useEffect(() => {
    if (pdfDocument) renderPdfPage(currentPage);
  }, [pdfDocument, currentPage]);

  const createPeerConnection = (peerId) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19002' }]
    });

    peerConnectionsRef.current[peerId] = pc;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit('audio-stream-signal', { signal: { candidate: event.candidate } });
      }
    };

    pc.ontrack = (event) => {
      const remoteAudio = document.createElement('audio');
      remoteAudio.srcObject = event.streams[0];
      remoteAudio.autoplay = true;
      remoteAudio.controls = false;
      document.body.appendChild(remoteAudio);
    };

    return pc;
  };

  const toggleVoiceChannel = async () => {
    try {
      if (isAudioMuted) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        localStreamRef.current = stream;
        
        Object.values(peerConnectionsRef.current).forEach(pc => {
          stream.getTracks().forEach(track => pc.addTrack(track, stream));
        });

        const pc = createPeerConnection('broadcast-channel');
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socketRef.current.emit('audio-stream-signal', { signal: { sdp: pc.localDescription } });

        setIsAudioMuted(false);
      } else {
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(track => track.stop());
        }
        setIsAudioMuted(true);
      }
    } catch (err) {
      alert("Microphone device permissions are missing or blocked.");
    }
  };

  const loadPdfDocument = async (arrayBufferData) => {
    try {
      const loadingTask = pdfjsLib.getDocument({ data: arrayBufferData });
      const pdf = await loadingTask.promise;
      setPdfDocument(pdf);
      setTotalPages(pdf.numPages);
      setCurrentPage(1);
      clearLocalCanvas();
    } catch (err) {
      console.error(err);
    }
  };

  const handlePdfUpload = (e) => {
    const file = e.target.files[0];
    if (!file || file.type !== 'application/pdf') return;

    const fileReader = new FileReader();
    fileReader.onload = async (event) => {
      const buffer = event.target.result;
      const typedArray = new Uint8Array(buffer);
      const binaryArray = Array.from(typedArray);

      await loadPdfDocument(typedArray);

      await fetch(`${BACKEND_URL}/api/upload-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessCode, fileData: binaryArray })
      });
    };
    fileReader.readAsArrayBuffer(file);
  };

  const renderPdfPage = async (pageNumber) => {
    if (!pdfDocument) return;
    const page = await pdfDocument.getPage(pageNumber);
    const canvas = pdfCanvasRef.current;
    const context = canvas.getContext('2d');
    const parentRect = canvas.parentNode.getBoundingClientRect();

    const unscaledViewport = page.getViewport({ scale: 1 });
    const idealScale = Math.min(parentRect.width / unscaledViewport.width, parentRect.height / unscaledViewport.height) * 0.95;

    const viewport = page.getViewport({ scale: idealScale });
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: context, viewport }).promise;
  };

  const drawVector = (stroke) => {
    const ctx = contextRef.current;
    if (!ctx) return;
    ctx.save();
    ctx.beginPath();
    
    if (stroke.tool === 'highlighter') {
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.lineWidth * 2.5; 
    } else {
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.lineWidth;
    }

    ctx.moveTo(stroke.x1, stroke.y1);
    ctx.lineTo(stroke.x2, stroke.y2);
    ctx.stroke();
    ctx.restore();
  };

  const startDrawing = (e) => {
    if (role !== 'tutor') return;
    const rect = canvasRef.current.getBoundingClientRect();
    canvasRef.current.lastX = e.clientX - rect.left;
    canvasRef.current.lastY = e.clientY - rect.top;
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing || role !== 'tutor') return;
    const rect = canvasRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    const stroke = {
      x1: canvasRef.current.lastX,
      y1: canvasRef.current.lastY,
      x2: currentX,
      y2: currentY,
      color,
      lineWidth,
      tool
    };

    drawVector(stroke);
    socketRef.current.emit('draw-stroke', stroke);
    setHistory((prev) => [...prev, stroke]);
    
    canvasRef.current.lastX = currentX;
    canvasRef.current.lastY = currentY;
  };

  const handleUndo = () => {
    if (role !== 'tutor' || history.length === 0) return;
    const nextHistory = [...history];
    const popped = nextHistory.pop();
    
    setRedoStack(prev => [popped, ...prev]);
    setHistory(nextHistory);
    
    clearLocalCanvas();
    nextHistory.forEach(drawVector);
    socketRef.current.emit('sync-history', nextHistory);
  };

  const handleRedo = () => {
    if (role !== 'tutor' || redoStack.length === 0) return;
    const nextRedo = [...redoStack];
    const restored = nextRedo.shift();

    setRedoStack(nextRedo);
    const targetHistory = [...history, restored];
    setHistory(targetHistory);
    
    drawVector(restored);
    socketRef.current.emit('draw-stroke', restored);
  };

  const handleClearBoard = () => {
    if (role !== 'tutor') return;
    if (window.confirm("Are you sure you want to clear all ink configurations on this page?")) {
      setHistory([]);
      setRedoStack([]);
      clearLocalCanvas();
      socketRef.current.emit('clear-canvas-board');
    }
  };

  const changePage = (dir) => {
    if (role !== 'tutor') return;
    const nextPage = dir === 'next' ? Math.min(totalPages, currentPage + 1) : Math.max(1, currentPage - 1);
    setCurrentPage(nextPage);
    clearLocalCanvas();
    socketRef.current.emit('pdf-page-change', { pageNumber: nextPage });
  };

  const clearLocalCanvas = () => contextRef.current?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!typedMessage.trim()) return;
    socketRef.current.emit('send-chat-message', typedMessage);
    setTypedMessage('');
  };

  const formatTimer = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', background: '#f3f4f6', fontFamily: 'sans-serif', overflow: 'hidden' }}>
      
      {/* LEFT BAR STRIP */}
      <div style={{ width: '76px', background: '#0b0f14', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0', gap: '16px' }}>
        <div style={{ color: '#8b3dff', fontSize: '26px', fontWeight: '900', marginBottom: '15px' }}>C</div>
        <button onClick={() => setActiveTab('design')} style={sidebarTabStyle(activeTab === 'design')}>🎨 <span>Tools</span></button>
        <button onClick={() => setActiveTab('uploads')} style={sidebarTabStyle(activeTab === 'uploads')}>📁 <span>Media</span></button>
        <button onClick={() => setActiveTab('chat')} style={sidebarTabStyle(activeTab === 'chat')}>
          💬 <span>Chat ({activeStudents})</span>
        </button>
        
        <button onClick={toggleVoiceChannel} style={{ ...sidebarTabStyle(!isAudioMuted), marginTop: 'auto', background: !isAudioMuted ? '#10b981' : 'rgba(239, 68, 68, 0.15)', color: !isAudioMuted ? '#fff' : '#ef4444' }}>
          {isAudioMuted ? '🔇' : '🔊'} <span>{isAudioMuted ? 'Muted' : 'Voice On'}</span>
        </button>
      </div>

      {/* DRAWER CONTROLS */}
      <div style={{ width: '300px', background: '#ffffff', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', padding: '24px', boxSizing: 'border-box' }}>
        {activeTab === 'design' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <h4 style={{ margin: 0, color: '#111827', fontSize: '16px', fontWeight: '700' }}>Canva Toolkit</h4>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => setTool('marker')} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #d1d5db', background: tool === 'marker' ? '#8b3dff' : '#fff', color: tool === 'marker' ? '#fff' : '#111827', cursor: 'pointer', fontWeight: '700' }}>✒️ Marker</button>
              <button onClick={() => setTool('highlighter')} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #d1d5db', background: tool === 'highlighter' ? '#8b3dff' : '#fff', color: tool === 'highlighter' ? '#fff' : '#111827', cursor: 'pointer', fontWeight: '700' }}>🖍️ Highlighter</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
              {['#8b3dff', '#00c4cc', '#ff4d4f', '#111827', '#10b981', '#f59e0b', '#f97316', '#ec4899', '#3b82f6', '#14b8a6'].map(c => (
                <div key={c} onClick={() => setColor(c)} style={{ width: '34px', height: '34px', borderRadius: '50%', background: c, cursor: 'pointer', border: color === c ? '3px solid #111827' : '1px solid rgba(0,0,0,0.1)' }} />
              ))}
            </div>
            <input type="range" min="2" max="35" value={lineWidth} onChange={e => setLineWidth(Number(e.target.value))} style={{ width: '100%', cursor: 'pointer' }} />
          </div>
        )}

        {activeTab === 'uploads' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <h4 style={{ margin: 0, color: '#111827', fontSize: '16px', fontWeight: '700' }}>Upload Desk</h4>
            {role === 'tutor' ? (
              <label style={{ display: 'block', background: '#8b3dff', color: '#fff', padding: '14px', borderRadius: '12px', textAlign: 'center', cursor: 'pointer', fontWeight: '700' }}>
                📁 Add PDF Past Paper
                <input type="file" accept="application/pdf" onChange={handlePdfUpload} style={{ display: 'none' }} />
              </label>
            ) : (
              <p style={{ fontSize: '12px', color: '#6b7280' }}>Only the tutor can drop master files onto the canvas viewport.</p>
            )}
          </div>
        )}

        {activeTab === 'chat' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <h4 style={{ margin: '0 0 15px 0', fontSize: '16px', fontWeight: '700' }}>Live Studio Chat</h4>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {messages.map((m, i) => {
                const isMe = (role === 'tutor' && m.role === 'tutor') || (m.username === username && m.role !== 'tutor');
                
                const renderAvatarBadge = () => {
                  if (m.role === 'tutor') {
                    return currentTutorAvatar ? <img src={currentTutorAvatar} alt="Tutor" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#8b3dff', color: '#fff', fontWeight: 'bold' }}>👨‍🏫</div>;
                  }
                  if (m.avatar) {
                    return <img src={m.avatar} alt={m.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
                  }
                  return (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#00c4cc', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}>
                      {m.username.charAt(0).toUpperCase()}
                    </div>
                  );
                };

                return (
                  <div key={i} style={{ display: 'flex', gap: '10px', alignSelf: isMe ? 'flex-end' : 'flex-start', flexDirection: isMe ? 'row-reverse' : 'row', maxWidth: '90%' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#e5e7eb', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: m.role === 'tutor' ? '2px solid #8b3dff' : '2px solid #00c4cc' }}>
                      {renderAvatarBadge()}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                      <div style={{ fontSize: '10px', opacity: 0.5, marginBottom: '2px', padding: '0 4px' }}>
                        {m.username} {m.role === 'tutor' && '• Tutor'}
                      </div>
                      <div style={{ background: isMe ? '#8b3dff' : '#f3f4f6', color: isMe ? '#fff' : '#111827', padding: '10px 14px', borderRadius: isMe ? '14px 2px 14px 14px' : '2px 14px 14px 14px', fontSize: '13px', wordBreak: 'break-word', boxShadow: '0 2px 5px rgba(0,0,0,0.03)' }}>
                        {m.text}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>
            <form onSubmit={handleSendMessage} style={{ marginTop: '12px', display: 'flex', gap: '6px' }}>
              <input type="text" value={typedMessage} onChange={e => setTypedMessage(e.target.value)} placeholder="Type comment..." style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #e5e7eb' }} />
              <button type="submit" style={{ background: '#8b3dff', color: '#fff', border: 'none', padding: '0 14px', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}>Send</button>
            </form>
          </div>
        )}
      </div>

      {/* WHITEBOARD DESK VIEWPORT */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: '64px', background: '#ffffff', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 24px' }}>
          <div>
            <span style={{ fontWeight: '800', color: '#111827', fontSize: '16px' }}>
              ACCESS CODE: <span style={{ color: '#8b3dff', background: 'rgba(139,61,255,0.1)', padding: '6px 12px', borderRadius: '8px', marginLeft: '5px', letterSpacing: '1px' }}>{accessCode}</span>
            </span>
            <span style={{ marginLeft: '15px', fontFamily: 'monospace', fontWeight: '700', background: '#ef4444', color: '#fff', padding: '6px 12px', borderRadius: '8px' }}>⏱️ {formatTimer(secondsLeft)}</span>
          </div>

          {role === 'tutor' && (
            <div style={{ display: 'flex', gap: '6px', background: '#f3f4f6', padding: '4px', borderRadius: '10px' }}>
              <button onClick={handleUndo} disabled={history.length === 0} style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', background: history.length === 0 ? 'transparent' : '#fff', cursor: 'pointer', fontWeight: '600', color: '#111827' }}>↩ Undo</button>
              <button onClick={handleRedo} disabled={redoStack.length === 0} style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', background: redoStack.length === 0 ? 'transparent' : '#fff', cursor: 'pointer', fontWeight: '600', color: '#111827' }}>↪ Redo</button>
              <button onClick={handleClearBoard} style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', background: 'rgba(239,68,68,0.1)', color: '#ef4444', cursor: 'pointer', fontWeight: '600' }}>🗑️ Clear Page</button>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f3f4f6', padding: '4px 12px', borderRadius: '10px' }}>
            <button onClick={() => changePage('prev')} disabled={currentPage === 1} style={{ border: 'none', background: 'none', fontSize: '16px', cursor: 'pointer', padding: '4px' }}>◀</button>
            <span style={{ fontSize: '13px', fontWeight: '700', minWidth: '45px', textAlign: 'center' }}>{currentPage} / {totalPages}</span>
            <button onClick={() => changePage('next')} disabled={currentPage === totalPages} style={{ border: 'none', background: 'none', fontSize: '16px', cursor: 'pointer', padding: '4px' }}>▶</button>
          </div>

          <button onClick={onExit} style={{ background: '#111827', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}>Leave Studio</button>
        </div>

        {/* WHITEBOARD SURFACE FRAME */}
        <div style={{ flex: 1, position: 'relative', background: '#e5e7eb', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '92%', height: '92%', background: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', borderRadius: '12px', overflow: 'hidden' }}>
            <canvas ref={pdfCanvasRef} style={{ position: 'absolute', top: 0, left: 0, zIndex: 1, pointerEvents: 'none' }} />
            <canvas ref={canvasRef} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={() => setIsDrawing(false)} onMouseLeave={() => setIsDrawing(false)} style={{ position: 'absolute', top: 0, left: 0, zIndex: 2, width: '100%', height: '100%', cursor: role === 'tutor' ? 'crosshair' : 'not-allowed' }} />
          </div>
        </div>

      </div>
    </div>
  );
}