import React, { useRef, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export default function Whiteboard({ roomId, role }) {
  const socketRef = useRef(null);
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const pdfCanvasRef = useRef(null);
  const chatEndRef = useRef(null);
  const fileReaderRef = useRef(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#1e1e1e');
  const [lineWidth, setLineWidth] = useState(4);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pdfDocument, setPdfDocument] = useState(null);
  
  // Undo/Redo Storage Mechanics
  const [history, setHistory] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  // Chat State
  const [messages, setMessages] = useState([]);
  const [typedMessage, setTypedMessage] = useState('');

  useEffect(() => {
    socketRef.current = io('http://localhost:5000');
    const socket = socketRef.current;

    socket.emit('join-room', { roomId, role });

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
      redrawFromHistory(history);
    };
    
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // --- SOCKET ACTIONS ---
    socket.on('incoming-stroke', (stroke) => {
      drawRemoteLine(stroke.x1, stroke.y1, stroke.x2, stroke.y2, stroke.color, stroke.lineWidth);
      setHistory((prev) => [...prev, stroke]);
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

    socket.on('canvas-cleared', () => {
      clearLocalCanvas();
      setHistory([]);
      setRedoStack([]);
    });

    socket.on('incoming-chat-message', (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on('sync-state', async (state) => {
      if (state.fileData) {
        const typedArray = new Uint8Array(state.fileData);
        await loadPdfDocument(typedArray);
      }
      if (state.currentPage) {
        setCurrentPage(state.currentPage);
      }
    });

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      socket.disconnect();
    };
  }, [roomId, role]);

  useEffect(() => {
    if (pdfDocument) {
      renderPdfPage(currentPage);
    }
  }, [pdfDocument, currentPage]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadPdfDocument = async (arrayBufferData) => {
    try {
      const loadingTask = pdfjsLib.getDocument({ data: arrayBufferData });
      const pdf = await loadingTask.promise;
      setPdfDocument(pdf);
      setTotalPages(pdf.numPages);
      setCurrentPage(1);
      clearLocalCanvas();
    } catch (err) {
      console.error("Error loading PDF document: ", err);
    }
  };

  const handlePdfUpload = (e) => {
    const file = e.target.files[0];
    if (!file || file.type !== 'application/pdf') return;

    if (fileReaderRef.current) fileReaderRef.current.abort();

    const fileReader = new FileReader();
    fileReaderRef.current = fileReader;

    fileReader.onload = async (event) => {
      const buffer = event.target.result;
      const typedArray = new Uint8Array(buffer);
      await loadPdfDocument(typedArray);

      const binaryArray = Array.from(typedArray);
      socketRef.current.emit('upload-pdf-file', { roomId, fileData: binaryArray });
    };
    fileReader.readAsArrayBuffer(file);
  };

  const renderPdfPage = async (pageNumber) => {
    if (!pdfDocument) return;
    try {
      const page = await pdfDocument.getPage(pageNumber);
      const canvas = pdfCanvasRef.current;
      const context = canvas.getContext('2d');
      const parentRect = canvas.parentNode.getBoundingClientRect();

      const unscaledViewport = page.getViewport({ scale: 1 });
      const scaleWidth = parentRect.width / unscaledViewport.width;
      const scaleHeight = parentRect.height / unscaledViewport.height;
      const idealScale = Math.min(scaleWidth, scaleHeight) * 0.95;

      const viewport = page.getViewport({ scale: idealScale });
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const renderContext = { canvasContext: context, viewport: viewport };
      await page.render(renderContext).promise;
    } catch (err) {
      console.error("Failed rendering PDF: ", err);
    }
  };

  // --- DRAWING ARENA ---
  const lastCoords = useRef({ x: 0, y: 0 });

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    if (role !== 'tutor') return;
    const { x, y } = getCoordinates(e);
    lastCoords.current = { x, y };
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing || role !== 'tutor') return;
    const ctx = contextRef.current;
    const { x, y } = getCoordinates(e);

    const stroke = {
      x1: lastCoords.current.x,
      y1: lastCoords.current.y,
      x2: x,
      y2: y,
      color,
      lineWidth
    };

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.moveTo(stroke.x1, stroke.y1);
    ctx.lineTo(stroke.x2, stroke.y2);
    ctx.stroke();
    ctx.closePath();

    socketRef.current.emit('draw-stroke', stroke);
    setHistory((prev) => [...prev, stroke]);
    setRedoStack([]); // Clear redo vector on a clean manual brush stroke

    lastCoords.current = { x, y };
  };

  const drawRemoteLine = (x1, y1, x2, y2, strokeColor, strokeWidth) => {
    const ctx = contextRef.current;
    if (!ctx) return;
    ctx.beginPath();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.closePath();
  };

  const stopDrawing = () => setIsDrawing(false);

  // --- HISTORICAL UNDO / REDO LOOPS ---
  const handleUndo = () => {
    if (role !== 'tutor' || history.length === 0) return;
    const updatedHistory = [...history];
    const undoneStroke = updatedHistory.pop();

    setRedoStack((prev) => [undoneStroke, ...prev]);
    setHistory(updatedHistory);

    clearLocalCanvas();
    redrawFromHistory(updatedHistory);
  };

  const handleRedo = () => {
    if (role !== 'tutor' || redoStack.length === 0) return;
    const updatedRedo = [...redoStack];
    const redoneStroke = updatedRedo.shift();

    setHistory((prev) => [...prev, redoneStroke]);
    setRedoStack(updatedRedo);

    const ctx = contextRef.current;
    ctx.beginPath();
    ctx.strokeStyle = redoneStroke.color;
    ctx.lineWidth = redoneStroke.lineWidth;
    ctx.moveTo(redoneStroke.x1, redoneStroke.y1);
    ctx.lineTo(redoneStroke.x2, redoneStroke.y2);
    ctx.stroke();
    ctx.closePath();

    socketRef.current.emit('draw-stroke', redoneStroke);
  };

  const redrawFromHistory = (strokeHistory) => {
    strokeHistory.forEach((stroke) => {
      drawRemoteLine(stroke.x1, stroke.y1, stroke.x2, stroke.y2, stroke.color, stroke.lineWidth);
    });
  };

  const changePage = (direction) => {
    if (role !== 'tutor') return;
    const nextPage = direction === 'next' ? Math.min(totalPages, currentPage + 1) : Math.max(1, currentPage - 1);
    setCurrentPage(nextPage);
    clearLocalCanvas();
    setHistory([]);
    setRedoStack([]);
    socketRef.current.emit('pdf-page-change', { pageNumber: nextPage });
  };

  const clearLocalCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const handleClearAll = () => {
    if (role !== 'tutor') return;
    clearLocalCanvas();
    setHistory([]);
    setRedoStack([]);
    socketRef.current.emit('clear-canvas');
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!typedMessage.trim()) return;

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const payload = { text: typedMessage, sender: role, timestamp };

    socketRef.current.emit('send-chat-message', payload);
    setTypedMessage('');
  };

  // Glassmorphism Shared Inline CSS Layout Styles
  const glassPanelStyle = {
    background: 'rgba(255, 255, 255, 0.45)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    border: '1px solid rgba(255, 255, 255, 0.4)',
    borderRadius: '16px',
    boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.08)',
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      background: 'linear-gradient(135deg, #e0eafc 0%, #cfdef3 100%)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      overflow: 'hidden',
      boxSizing: 'border-box',
      padding: '15px',
      gap: '15px'
    }}>

      {/* LEFT: MAIN WHITEBOARD CONTENT PANELS */}
      <div style={{ flex: 3, display: 'flex', flexDirection: 'column', gap: '15px', height: '100%' }}>
        
        {/* UPPER FLOATING DASHBOARD PANEL */}
        <div style={{ ...glassPanelStyle, padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <span style={{ fontWeight: '700', color: '#2c3e50', fontSize: '15px' }}>Room ID: <span style={{ color: '#007bff' }}>{roomId}</span></span>
            <span style={{ fontSize: '12px', background: role === 'tutor' ? '#e1f5fe' : '#e8f5e9', color: role === 'tutor' ? '#0288d1' : '#2e7d32', padding: '4px 10px', borderRadius: '20px', fontWeight: 'bold' }}>
              {role.toUpperCase()} VIEW
            </span>
          </div>

          {/* BRUSH AND CONTROL MANAGEMENT CONTROLS */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {role === 'tutor' && (
              <>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', background: '#007bff', color: '#fff', padding: '8px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: '6px' }}>
                  📁 Upload Exam Paper
                  <input type="file" accept="application/pdf" onChange={handlePdfUpload} style={{ display: 'none' }} />
                </label>
                <div style={{ width: '1px', height: '20px', background: 'rgba(0,0,0,0.1)' }} />
                
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ border: 'none', background: 'none', cursor: 'pointer', width: '32px', height: '32px' }} />
                
                <select value={lineWidth} onChange={(e) => setLineWidth(Number(e.target.value))} style={{ border: '1px solid rgba(0,0,0,0.15)', background: '#fff', padding: '6px', borderRadius: '8px', fontSize: '13px' }}>
                  <option value="2">Fine Pen</option>
                  <option value="4">Medium Marker</option>
                  <option value="10">Highlighter</option>
                </select>

                <div style={{ width: '1px', height: '20px', background: 'rgba(0,0,0,0.1)' }} />
                <button onClick={handleUndo} disabled={history.length === 0} style={{ padding: '6px 12px', borderRadius: '8px', border: 'none', background: history.length === 0 ? '#ccc' : '#fff', cursor: 'pointer' }}>↩ Undo</button>
                <button onClick={handleRedo} disabled={redoStack.length === 0} style={{ padding: '6px 12px', borderRadius: '8px', border: 'none', background: redoStack.length === 0 ? '#ccc' : '#fff', cursor: 'pointer' }}>↪ Redo</button>
                <button onClick={handleClearAll} style={{ backgroundColor: '#ff4d4f', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>🧹 Clear</button>
              </>
            )}
          </div>

          {/* PAGE NAVIGATOR NAVIGATION */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button onClick={() => changePage('prev')} disabled={currentPage === 1 || role !== 'tutor'} style={{ padding: '6px 12px', borderRadius: '8px', border: 'none', background: '#fff', cursor: 'pointer' }}>◀</button>
            <span style={{ fontSize: '13px', fontWeight: '600' }}>Page {currentPage} / {totalPages}</span>
            <button onClick={() => changePage('next')} disabled={currentPage === totalPages || role !== 'tutor'} style={{ padding: '6px 12px', borderRadius: '8px', border: 'none', background: '#fff', cursor: 'pointer' }}>▶</button>
          </div>
        </div>

        {/* INTERACTIVE WORKSPACE ARENA */}
        <div style={{ ...glassPanelStyle, flex: 1, position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
          <canvas ref={pdfCanvasRef} style={{ position: 'absolute', zIndex: 1, pointerEvents: 'none', objectFit: 'contain' }} />
          <canvas ref={canvasRef} onPointerDown={startDrawing} onPointerMove={draw} onPointerUp={stopDrawing} onPointerLeave={stopDrawing} style={{ position: 'absolute', top: 0, left: 0, zIndex: 2, width: '100%', height: '100%', cursor: role === 'tutor' ? 'crosshair' : 'not-allowed', touchAction: 'none' }} />
          
          {!pdfDocument && (
            <div style={{ position: 'absolute', zIndex: 0, color: '#7f8c8d', fontSize: '20px', fontWeight: '500' }}>
              No document synchronized. Waiting for tutor upload...
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: CHAT BAR WINDOW */}
      <div style={{ ...glassPanelStyle, width: '340px', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <div style={{ padding: '15px 20px', borderBottom: '1px solid rgba(255,255,255,0.3)', fontWeight: 'bold', color: '#2c3e50', fontSize: '16px' }}>
          💬 Classroom Chat
        </div>

        <div style={{ flex: 1, padding: '15px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {messages.map((msg, index) => {
            const isMe = msg.sender === role;
            return (
              <div key={index} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                <div style={{ fontSize: '10px', color: '#7f8c8d', marginBottom: '2px', textAlign: isMe ? 'right' : 'left', fontWeight: 'bold' }}>
                  {msg.sender.toUpperCase()} • {msg.timestamp}
                </div>
                <div style={{ backgroundColor: isMe ? '#007bff' : 'rgba(255,255,255,0.7)', color: isMe ? '#fff' : '#2c3e50', padding: '10px 14px', borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px', fontSize: '13px', lineHeight: '1.4', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
                  {msg.text}
                </div>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        <form onSubmit={handleSendMessage} style={{ padding: '12px', borderTop: '1px solid rgba(255,255,255,0.3)', display: 'flex', gap: '8px' }}>
          <input type="text" value={typedMessage} onChange={(e) => setTypedMessage(e.target.value)} placeholder="Send an answer..." style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.1)', outline: 'none', fontSize: '13px', background: 'rgba(255,255,255,0.8)' }} />
          <button type="submit" style={{ background: '#007bff', color: '#fff', border: 'none', padding: '0 16px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>Send</button>
        </form>
      </div>

    </div>
  );
}