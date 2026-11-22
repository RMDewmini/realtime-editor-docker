
import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import Editor from '@monaco-editor/react';
import './App.css';

const API = import.meta.env.VITE_API_URL || window.location.origin;

const socket = io(API, {
  autoConnect: false
});

function App() {
  const isResetPasswordRoute =
  window.location.pathname === '/reset-password';

const [token, setToken] = useState(() =>
  isResetPasswordRoute
    ? ''
    : localStorage.getItem('token') || ''
);

const [user, setUser] = useState(() => {
  if (isResetPasswordRoute) {
    return null;
  }

  try {
    return JSON.parse(localStorage.getItem('user')) || null;
  } catch {
    return null;
  }
});

  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // FORGOT PASSWORD STATE
  const [authView, setAuthView] = useState(
    () => window.location.pathname === '/reset-password' ? 'reset' : 'login'
  );

  const [resetToken, setResetToken] = useState(
    () => new URLSearchParams(window.location.search).get('token') || ''
  );

  const [forgotEmail, setForgotEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');

  // PROFILE STATE
  const [showProfile, setShowProfile] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');

  const [documents, setDocuments] = useState([]);

  const [roomId, setRoomId] = useState(
    () => new URLSearchParams(window.location.search).get('room') || 'document-1'
  );

  const [documentName, setDocumentName] = useState('Untitled Document');
  const [documentRole, setDocumentRole] = useState('Owner');
  const [documentType, setDocumentType] = useState('Code');

  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');

  // WHITEBOARD STATE
  const [boardElements, setBoardElements] = useState([]);
  const [boardTool, setBoardTool] = useState('select');
  const [boardColor, setBoardColor] = useState('#2563eb');
  const [boardStroke, setBoardStroke] = useState(4);
  const [selectedBoardId, setSelectedBoardId] = useState(null);
  const [boardZoom, setBoardZoom] = useState(1);
  const [boardDraft, setBoardDraft] = useState(null);

  const [onlineUsers, setOnlineUsers] = useState([]);

  // REAL-TIME CHAT STATE
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');

  const [versions, setVersions] = useState([]);
  const [showVersions, setShowVersions] = useState(false);
  const [versionMessage, setVersionMessage] = useState('');

  const [connectionStatus, setConnectionStatus] = useState('Connecting');

  const editorRef = useRef(null);
  const currentRoomRef = useRef(roomId);
  const saveTimerRef = useRef(null);
  const lastSavedCodeRef = useRef(null);
  const savingVersionRef = useRef(false);
  const chatEndRef = useRef(null);

  const boardSvgRef = useRef(null);
  const boardElementsRef = useRef([]);
  const boardUndoRef = useRef([]);
  const boardRedoRef = useRef([]);
  const boardInteractionRef = useRef(null);

  const isLoggedIn = Boolean(token && user);

  const canEdit =
    documentRole === 'Owner' || documentRole === 'Editor';

  // ======================================
  // AUTH FETCH
  // ======================================

  const authFetch = useCallback(async (url, options = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
        Authorization: `Bearer ${token}`
      }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || data.error || 'Request failed');
    }

    return data;
  }, [token]);

  // ======================================
  // PROFILE PICTURE SELECTION
  // ======================================

  const handleAvatarSelect = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp'
    ];

    if (!allowedTypes.includes(file.type)) {
      setProfileMessage('Please select a JPG, PNG or WEBP image.');
      event.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setProfileMessage('Image size must be less than 5 MB.');
      event.target.value = '';
      return;
    }

    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setProfileMessage('');
  };

  // ======================================
  // UPLOAD PROFILE PICTURE
  // ======================================

  const handleAvatarUpload = async () => {
    if (!avatarFile) {
      setProfileMessage('Please select a picture first.');
      return;
    }

    setProfileLoading(true);
    setProfileMessage('');

    try {
      const formData = new FormData();
      formData.append('avatar', avatarFile);

      const response = await fetch(`${API}/api/profile/upload-avatar`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Profile picture upload failed.');
      }

      const updatedUser = {
        ...user,
        ...data.user
      };

      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));

      setAvatarFile(null);
      setAvatarPreview('');
      setProfileMessage('Profile picture uploaded successfully!');

    } catch (error) {
      setProfileMessage(error.message);

    } finally {
      setProfileLoading(false);
    }
  };

  // ======================================
  // CLEANUP IMAGE PREVIEW
  // ======================================

  useEffect(() => {
    return () => {
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  // ======================================
  // LOAD CHAT MESSAGES
  // ======================================

  useEffect(() => {
    if (!token || !roomId) return;

    let cancelled = false;

    const loadMessages = async () => {
      setChatLoading(true);
      setChatError('');

      try {
        const data = await authFetch(
          `${API}/api/documents/${encodeURIComponent(roomId)}/messages`
        );

        if (!cancelled) {
          setChatMessages(
            Array.isArray(data) ? data : data.messages || []
          );
        }

      } catch (error) {
        console.error('Load chat messages error:', error.message);

        if (!cancelled) {
          setChatMessages([]);
          setChatError('Unable to load chat messages.');
        }

      } finally {
        if (!cancelled) {
          setChatLoading(false);
        }
      }
    };

    setChatMessages([]);
    loadMessages();

    return () => {
      cancelled = true;
    };
  }, [token, roomId, authFetch]);

  // ======================================
  // SCROLL CHAT TO LATEST MESSAGE
  // ======================================

  useEffect(() => {
    if (showChat) {
      chatEndRef.current?.scrollIntoView({
        behavior: 'smooth'
      });
    }
  }, [chatMessages, showChat]);

  // ======================================
  // SEND CHAT MESSAGE
  // ======================================

  const handleSendChatMessage = (e) => {
    e.preventDefault();

    const message = chatInput.trim();

    if (!message) return;

    if (!socket.connected) {
      setChatError('Not connected to server. Please try again.');
      return;
    }

    socket.emit('chat-message', {
      roomId,
      message
    });

    setChatInput('');
    setChatError('');
  };

  // ======================================
  // LOGIN / REGISTER
  // ======================================

  const handleAuth = async (e) => {
    e.preventDefault();

    setAuthMessage('');
    setAuthSuccess('');
    setLoading(true);

    try {
      const endpoint = isRegister ? '/api/register' : '/api/login';

      const response = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(
          isRegister
            ? { name, email, password }
            : { email, password }
        )
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || data.error || 'Authentication failed'
        );
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      setToken(data.token);
      setUser(data.user);
      setAuthMessage('');
      setAuthSuccess('');

    } catch (error) {
      setAuthMessage(error.message);

    } finally {
      setLoading(false);
    }
  };

  // ======================================
  // FORGOT PASSWORD
  // ======================================

  const handleForgotPassword = async (e) => {
    e.preventDefault();

    setAuthMessage('');
    setAuthSuccess('');
    setLoading(true);

    try {
      const response = await fetch(`${API}/api/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: forgotEmail.trim()
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message || 'Unable to send reset email.'
        );
      }

      setAuthSuccess(
        data.message ||
        'If an account exists with this email, a password reset link has been sent.'
      );

    } catch (error) {
      setAuthMessage(error.message);

    } finally {
      setLoading(false);
    }
  };

  // ======================================
  // RESET PASSWORD
  // ======================================

  const handleResetPassword = async (e) => {
    e.preventDefault();

    setAuthMessage('');
    setAuthSuccess('');

    if (!resetToken) {
      setAuthMessage('Invalid or missing reset link.');
      return;
    }

    if (newPassword.length < 6) {
      setAuthMessage('Password must contain at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setAuthMessage('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API}/api/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token: resetToken,
          password: newPassword
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message || 'Password reset failed.'
        );
      }

      setAuthSuccess(
        data.message || 'Password reset successfully. Please login.'
      );

      setNewPassword('');
      setConfirmPassword('');

    } catch (error) {
      setAuthMessage(error.message);

    } finally {
      setLoading(false);
    }
  };

  // ======================================
  // BACK TO LOGIN
  // ======================================

  const handleBackToLogin = () => {
    setAuthView('login');
    setIsRegister(false);
    setAuthMessage('');
    setAuthSuccess('');
    setPassword('');
    setNewPassword('');
    setConfirmPassword('');
    window.history.replaceState({}, '', '/');
  };

  // ======================================
  // LOGOUT
  // ======================================

  const handleLogout = () => {
    socket.emit('leave-room', currentRoomRef.current);
    socket.disconnect();

    localStorage.removeItem('token');
    localStorage.removeItem('user');

    setToken('');
    setUser(null);
    setDocuments([]);
    setCode('');
    setVersions([]);
    setShowVersions(false);
    setOnlineUsers([]);
    setDocumentRole('Viewer');

    setChatMessages([]);
    setChatInput('');
    setShowChat(false);
    setChatError('');

    setShowProfile(false);
    setAvatarFile(null);
    setAvatarPreview('');
    setProfileMessage('');

    setAuthView('login');
    setAuthMessage('');
    setAuthSuccess('');
    setIsRegister(false);
  };

  // ======================================
  // LOAD DOCUMENTS
  // ======================================

  const loadDocuments = useCallback(async () => {
    try {
      const data = await authFetch(`${API}/api/documents`);

      setDocuments(
        Array.isArray(data) ? data : data.documents || []
      );

    } catch (error) {
      console.error('Load documents error:', error.message);
    }
  }, [authFetch]);

  // ======================================
  // LOAD VERSION HISTORY
  // ======================================

  const loadVersions = useCallback(async () => {
    try {
      const data = await authFetch(
        `${API}/api/documents/${encodeURIComponent(roomId)}/versions`
      );

      setVersions(
        Array.isArray(data) ? data : data.versions || []
      );

      setVersionMessage('');

    } catch (error) {
      setVersionMessage(error.message);
    }
  }, [authFetch, roomId]);

  // ======================================
  // SAVE VERSION
  // ======================================

  // ======================================
// SAVE VERSION
// ======================================

const saveVersionSnapshot = useCallback(async () => {
  if (!token || !canEdit || savingVersionRef.current) return;

  // Do not save unchanged code again.
  if (lastSavedCodeRef.current === code) return;

  savingVersionRef.current = true;

  try {
    await authFetch(
      `${API}/api/documents/${encodeURIComponent(roomId)}/versions`,
      {
        method: 'POST',
        body: JSON.stringify({
          code,
          author: user?.name || user?.email || 'Unknown',
          message: 'Automatic save'
        })
      }
    );

    lastSavedCodeRef.current = code;

    if (showVersions) {
      await loadVersions();
    }

  } catch (error) {
    console.error('Version save error:', error.message);

  } finally {
    savingVersionRef.current = false;
  }
}, [
  token,
  canEdit,
  authFetch,
  roomId,
  code,
  user,
  showVersions,
  loadVersions
]);
  // ======================================
  // CREATE DOCUMENT
  // ======================================

  const handleCreateDocument = async () => {
    const newName = window.prompt(
      'Enter document name:',
      'Untitled Document'
    );

    if (!newName || !newName.trim()) return;

    const type = window.confirm(
      'Press OK for Code Document.\nPress Cancel for Whiteboard Document.'
    ) ? 'Code' : 'Whiteboard';

    try {
      const data = await authFetch(`${API}/api/documents`, {
        method: 'POST',
        body: JSON.stringify({
          name: newName.trim(),
          type
        })
      });

      const newDocument = data.document || data;
      const newRoomId = newDocument.roomId;

      await loadDocuments();
      changeRoom(newRoomId);

    } catch (error) {
      alert(error.message);
    }
  };

  // ======================================
  // DUPLICATE DOCUMENT
  // ======================================

  const handleDuplicate = async () => {
    try {
      await authFetch(
        `${API}/api/documents/${encodeURIComponent(roomId)}/duplicate`,
        {
          method: 'POST'
        }
      );

      await loadDocuments();

      alert('Document duplicated successfully!');

    } catch (error) {
      alert(error.message);
    }
  };

  // ======================================
  // RENAME DOCUMENT
  // ======================================

  const handleRename = async () => {
    const newName = window.prompt(
      'Enter new document name:',
      documentName
    );

    if (!newName || !newName.trim()) return;

    try {
      await authFetch(
        `${API}/api/documents/${encodeURIComponent(roomId)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            name: newName.trim()
          })
        }
      );

      setDocumentName(newName.trim());

      await loadDocuments();

    } catch (error) {
      alert(error.message);
    }
  };

  // ======================================
  // DELETE DOCUMENT
  // ======================================

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this document?')) {
      return;
    }

    try {
      await authFetch(
        `${API}/api/documents/${encodeURIComponent(roomId)}`,
        {
          method: 'DELETE'
        }
      );

      await loadDocuments();

      setCode('');
      setVersions([]);
      setOnlineUsers([]);
      setChatMessages([]);
      setRoomId('document-1');

      window.history.replaceState({}, '', '/');

    } catch (error) {
      alert(error.message);
    }
  };

  // ======================================
  // SHARE DOCUMENT
  // ======================================

  const handleShare = async () => {
    const inviteEmail = window.prompt(
      'Enter registered user email:'
    );

    if (!inviteEmail || !inviteEmail.trim()) return;

    const role = window.confirm(
      'Press OK to give Editor access.\nPress Cancel to give Viewer access.'
    ) ? 'Editor' : 'Viewer';

    try {
      await authFetch(
        `${API}/api/documents/${encodeURIComponent(roomId)}/collaborators`,
        {
          method: 'POST',
          body: JSON.stringify({
            email: inviteEmail.trim(),
            role
          })
        }
      );

      alert(`Invitation access added as ${role}.`);

    } catch (error) {
      alert(error.message);
    }
  };

  // ======================================
  // COPY SHARE LINK
  // ======================================

  const copyShareLink = async () => {
    const link =
      `${window.location.origin}/?room=${encodeURIComponent(roomId)}`;

    try {
      await navigator.clipboard.writeText(link);

      alert('Document link copied!');

    } catch {
      window.prompt('Copy this link:', link);
    }
  };

  // ======================================
  // CHANGE ROOM
  // ======================================

  const changeRoom = (newRoomId) => {
    if (!newRoomId) return;

    socket.emit('leave-room', currentRoomRef.current);

    setRoomId(newRoomId);
    currentRoomRef.current = newRoomId;

    lastSavedCodeRef.current = null;
    setCode('');
    setVersions([]);
    setShowVersions(false);
    setDocumentRole('Viewer');
    setDocumentName('Loading document...');
    setOnlineUsers([]);
    setLanguage('javascript');

    setChatMessages([]);
    setChatInput('');
    setChatError('');
    setShowChat(false);

    boardElementsRef.current = [];
    setBoardElements([]);
    setSelectedBoardId(null);
    setBoardDraft(null);
    boardUndoRef.current = [];
    boardRedoRef.current = [];

    window.history.replaceState(
      {},
      '',
      `/?room=${encodeURIComponent(newRoomId)}`
    );

    if (socket.connected) {
      socket.emit('join-room', newRoomId);
    }
  };

  // ======================================
  // RESTORE VERSION
  // ======================================

  const handleRestore = async (version) => {
    if (!window.confirm('Restore this version?')) return;

    try {
      const versionId = version._id || version.id;

      const data = await authFetch(
        `${API}/api/documents/${encodeURIComponent(roomId)}/restore/${encodeURIComponent(versionId)}`,
        {
          method: 'POST'
        }
      );

      if (data.document?.code !== undefined) {
        lastSavedCodeRef.current = data.document.code;
        setCode(data.document.code);

      } 
      else if (version.code !== undefined) {
         lastSavedCodeRef.current = version.code;
          setCode(version.code);
      }

      setVersionMessage('Version restored successfully.');

      await loadVersions();

    } catch (error) {
      setVersionMessage(`Restore failed: ${error.message}`);
    }
  };

  // ======================================
  // SOCKET CONNECTION AND EVENTS
  // ======================================

  useEffect(() => {
    if (!token) return;

    socket.auth = { token };

    const onConnect = () => {
      setConnectionStatus('Connected');

      socket.emit('join-room', currentRoomRef.current);
    };

    const onDisconnect = () => {
      setConnectionStatus('Disconnected');
      setOnlineUsers([]);
    };

    const onConnectError = (error) => {
      setConnectionStatus('Connection error');

      console.error(
        'Socket connection error:',
        error.message
      );
    };

    const onDocumentContent = (data) => {
      if (typeof data === 'string') {
        setCode(data);

      } else if (data?.code !== undefined) {
        setCode(data.code);
      }
    };

    const onCodeUpdate = (updatedCode) => {
      if (typeof updatedCode === 'string') {
        setCode(updatedCode);

      } else if (updatedCode?.code !== undefined) {
        setCode(updatedCode.code);
      }
    };

    const onOnlineUsers = (users) => {
      if (Array.isArray(users)) {
        setOnlineUsers(users);
      }
    };

    const onDocumentDetails = (details) => {
      if (!details) return;

      setDocumentName(details.name || 'Untitled Document');
      setDocumentRole(details.role || 'Viewer');
      setDocumentType(details.type || 'Code');

      if (details.language) {
        setLanguage(details.language);
      }

      if (details.whiteboardData) {
        const elements = Array.isArray(details.whiteboardData.elements)
          ? details.whiteboardData.elements
          : [];
        boardElementsRef.current = elements;
        setBoardElements(elements);
        boardUndoRef.current = [];
        boardRedoRef.current = [];
      }
    };

    const onLanguageUpdate = (updatedLanguage) => {
      if (typeof updatedLanguage === 'string') {
        setLanguage(updatedLanguage);
      }
    };

    const onWhiteboardUpdate = (data) => {
      const incoming = data?.whiteboardData;
      const elements = Array.isArray(incoming?.elements) ? incoming.elements : [];
      boardElementsRef.current = elements;
      setBoardElements(elements);
      setBoardDraft(null);
      setSelectedBoardId(null);
    };

    const onNewChatMessage = (message) => {
      if (!message) return;

      if (message.roomId !== currentRoomRef.current) return;

      setChatMessages((previousMessages) => {
        const alreadyExists = previousMessages.some(
          (item) => item._id === message._id
        );

        if (alreadyExists) {
          return previousMessages;
        }

        return [...previousMessages, message];
      });

      setChatError('');
    };

    const onLanguageError = (message) => {
      alert(
        typeof message === 'string'
          ? message
          : 'Unable to save language'
      );
    };

    const onRoomError = (message) => {
      alert(
        typeof message === 'string'
          ? message
          : 'Unable to join document'
      );
    };

    const onPermissionError = (message) => {
      alert(
        typeof message === 'string'
          ? message
          : 'You do not have permission'
      );
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);

    socket.on('document-content', onDocumentContent);
    socket.on('code-update', onCodeUpdate);

    socket.on('online-users', onOnlineUsers);
    socket.on('document-details', onDocumentDetails);
    socket.on('whiteboard-update', onWhiteboardUpdate);

    socket.on('language-update', onLanguageUpdate);
    socket.on('language-error', onLanguageError);

    socket.on('new-chat-message', onNewChatMessage);

    socket.on('room-error', onRoomError);
    socket.on('permission-error', onPermissionError);

    socket.connect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);

      socket.off('document-content', onDocumentContent);
      socket.off('code-update', onCodeUpdate);

      socket.off('online-users', onOnlineUsers);
      socket.off('document-details', onDocumentDetails);
      socket.off('whiteboard-update', onWhiteboardUpdate);

      socket.off('language-update', onLanguageUpdate);
      socket.off('language-error', onLanguageError);

      socket.off('new-chat-message', onNewChatMessage);

      socket.off('room-error', onRoomError);
      socket.off('permission-error', onPermissionError);

      socket.disconnect();
    };
  }, [token]);

  // ======================================
  // JOIN NEW ROOM WHEN ROOM ID CHANGES
  // ======================================

  useEffect(() => {
    currentRoomRef.current = roomId;

    if (socket.connected) {
      socket.emit('join-room', roomId);
    }
  }, [roomId]);

  // ======================================
  // LOAD DOCUMENTS AFTER LOGIN
  // ======================================

  useEffect(() => {
    if (token) {
      loadDocuments();
    }
  }, [token, loadDocuments]);

  // ======================================
  // AUTOMATIC VERSION SAVE EVERY 30 SECONDS
  // ======================================

  useEffect(() => {
    if (!token || !canEdit) return;

    saveTimerRef.current = setInterval(() => {
      saveVersionSnapshot();
    }, 30000);

    return () => {
      clearInterval(saveTimerRef.current);
    };
  }, [token, canEdit, saveVersionSnapshot]);

  // ======================================
  // LOAD VERSIONS WHEN HISTORY OPENS
  // ======================================

  useEffect(() => {
    if (showVersions && token) {
      loadVersions();
    }
  }, [showVersions, token, loadVersions]);

  // ======================================
  // CODE CHANGE
  // ======================================

  const handleCodeChange = (newCode) => {
    setCode(newCode || '');

    if (canEdit && socket.connected) {
      socket.emit('code-change', {
        roomId,
        code: newCode || ''
      });
    }
  };

  // ======================================
  // LANGUAGE CHANGE
  // ======================================

  const handleLanguageChange = (newLanguage) => {
    if (!canEdit) return;

    setLanguage(newLanguage);

    if (socket.connected) {
      socket.emit('language-change', {
        roomId,
        language: newLanguage
      });
    } else {
      alert('Not connected to server. Please try again.');
    }
  };

  // ======================================
  // WHITEBOARD HELPERS
  // ======================================

  const commitBoardElements = (nextElements) => {
    const current = boardElementsRef.current;
    boardUndoRef.current = [...boardUndoRef.current, current].slice(-50);
    boardRedoRef.current = [];
    boardElementsRef.current = nextElements;
    setBoardElements(nextElements);

    if (socket.connected && canEdit) {
      socket.emit('whiteboard-change', {
        roomId,
        whiteboardData: { elements: nextElements }
      });
    }
  };

  const getBoardPoint = (event) => {
    const rect = boardSvgRef.current.getBoundingClientRect();

    return {
      x: Math.max(0, Math.min(1200, ((event.clientX - rect.left) / rect.width) * 1200)),
      y: Math.max(0, Math.min(700, ((event.clientY - rect.top) / rect.height) * 700))
    };
  };

  const getBoardBounds = (item) => {
    if (item.type === 'rect' || item.type === 'arrow') {
      return {
        x: Math.min(item.x1, item.x2),
        y: Math.min(item.y1, item.y2),
        w: Math.abs(item.x2 - item.x1),
        h: Math.abs(item.y2 - item.y1)
      };
    }

    if (item.type === 'circle') {
      return {
        x: item.cx - item.r,
        y: item.cy - item.r,
        w: item.r * 2,
        h: item.r * 2
      };
    }

    if (item.type === 'text') {
      return {
        x: item.x,
        y: item.y - 28,
        w: Math.max(70, item.text.length * 14),
        h: 36
      };
    }

    if (item.type === 'freehand' && item.points.length) {
      const xs = item.points.map((p) => p.x);
      const ys = item.points.map((p) => p.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);

      return {
        x: minX,
        y: minY,
        w: Math.max(8, Math.max(...xs) - minX),
        h: Math.max(8, Math.max(...ys) - minY)
      };
    }

    return { x: 0, y: 0, w: 0, h: 0 };
  };

  const moveBoardItem = (item, dx, dy) => {
    if (item.type === 'freehand') {
      return {
        ...item,
        points: item.points.map((p) => ({
          x: p.x + dx,
          y: p.y + dy
        }))
      };
    }

    if (item.type === 'rect' || item.type === 'arrow') {
      return {
        ...item,
        x1: item.x1 + dx,
        y1: item.y1 + dy,
        x2: item.x2 + dx,
        y2: item.y2 + dy
      };
    }

    if (item.type === 'circle') {
      return {
        ...item,
        cx: item.cx + dx,
        cy: item.cy + dy
      };
    }

    return {
      ...item,
      x: item.x + dx,
      y: item.y + dy
    };
  };

  const handleBoardPointerDown = (event) => {
    if (!canEdit) return;

    const point = getBoardPoint(event);
    boardSvgRef.current.setPointerCapture(event.pointerId);

    if (boardTool === 'text') {
      const text = window.prompt('Enter text for the whiteboard:');

      if (text && text.trim()) {
        commitBoardElements([
          ...boardElementsRef.current,
          {
            id: `${Date.now()}-${Math.random()}`,
            type: 'text',
            x: point.x,
            y: point.y,
            text: text.trim(),
            color: boardColor,
            fontSize: 26
          }
        ]);
      }

      return;
    }

    if (boardTool === 'select') {
      const hit = [...boardElementsRef.current].reverse().find((item) => {
        const b = getBoardBounds(item);

        return (
          point.x >= b.x - 12 &&
          point.x <= b.x + b.w + 12 &&
          point.y >= b.y - 12 &&
          point.y <= b.y + b.h + 12
        );
      });

      setSelectedBoardId(hit?.id || null);

      if (hit) {
        boardInteractionRef.current = {
          mode: 'move',
          id: hit.id,
          start: point,
          original: hit
        };
      }

      return;
    }

    boardInteractionRef.current = {
      mode: 'draw',
      tool: boardTool,
      start: point,
      points: [point],
      color: boardColor,
      width: boardStroke
    };

    setBoardDraft({
      type: boardTool,
      start: point,
      end: point,
      points: [point],
      color: boardColor,
      width: boardStroke
    });
  };

  const handleBoardPointerMove = (event) => {
    const interaction = boardInteractionRef.current;

    if (!interaction) return;

    const point = getBoardPoint(event);

    if (interaction.mode === 'draw') {
      if (interaction.tool === 'freehand') {
        interaction.points.push(point);

        setBoardDraft({
          type: 'freehand',
          points: [...interaction.points],
          color: interaction.color,
          width: interaction.width
        });

      } else {
        setBoardDraft({
          type: interaction.tool,
          start: interaction.start,
          end: point,
          color: interaction.color,
          width: interaction.width
        });
      }

    } else if (interaction.mode === 'move') {
      setBoardDraft(
        moveBoardItem(
          interaction.original,
          point.x - interaction.start.x,
          point.y - interaction.start.y
        )
      );
    }
  };

  const handleBoardPointerUp = () => {
    const interaction = boardInteractionRef.current;

    if (!interaction) return;

    if (interaction.mode === 'draw') {
      const draft = boardDraft;

      if (draft) {
        const id = `${Date.now()}-${Math.random()}`;
        let item = null;

        if (interaction.tool === 'freehand' && interaction.points.length > 1) {
          item = {
            id,
            type: 'freehand',
            points: interaction.points,
            color: interaction.color,
            width: interaction.width
          };

        } else if (interaction.tool === 'rect') {
          item = {
            id,
            type: 'rect',
            x1: interaction.start.x,
            y1: interaction.start.y,
            x2: draft.end.x,
            y2: draft.end.y,
            color: interaction.color,
            width: interaction.width
          };

        } else if (interaction.tool === 'circle') {
          const dx = draft.end.x - interaction.start.x;
          const dy = draft.end.y - interaction.start.y;

          item = {
            id,
            type: 'circle',
            cx: interaction.start.x,
            cy: interaction.start.y,
            r: Math.sqrt(dx * dx + dy * dy),
            color: interaction.color,
            width: interaction.width
          };

        } else if (interaction.tool === 'arrow') {
          item = {
            id,
            type: 'arrow',
            x1: interaction.start.x,
            y1: interaction.start.y,
            x2: draft.end.x,
            y2: draft.end.y,
            color: interaction.color,
            width: interaction.width
          };
        }

        if (item) {
          commitBoardElements([
            ...boardElementsRef.current,
            item
          ]);
        }
      }

    } else if (interaction.mode === 'move' && boardDraft) {
      commitBoardElements(
        boardElementsRef.current.map((item) =>
          item.id === interaction.id ? boardDraft : item
        )
      );
    }

    boardInteractionRef.current = null;
    setBoardDraft(null);
  };

  const undoBoard = () => {
    if (!canEdit || !boardUndoRef.current.length) return;

    const previous =
      boardUndoRef.current[boardUndoRef.current.length - 1];

    boardUndoRef.current = boardUndoRef.current.slice(0, -1);

    boardRedoRef.current = [
      ...boardRedoRef.current,
      boardElementsRef.current
    ];

    boardElementsRef.current = previous;
    setBoardElements(previous);

    socket.emit('whiteboard-change', {
      roomId,
      whiteboardData: { elements: previous }
    });
  };

  const redoBoard = () => {
    if (!canEdit || !boardRedoRef.current.length) return;

    const next =
      boardRedoRef.current[boardRedoRef.current.length - 1];

    boardRedoRef.current = boardRedoRef.current.slice(0, -1);

    boardUndoRef.current = [
      ...boardUndoRef.current,
      boardElementsRef.current
    ];

    boardElementsRef.current = next;
    setBoardElements(next);

    socket.emit('whiteboard-change', {
      roomId,
      whiteboardData: { elements: next }
    });
  };

  const deleteSelectedBoardItem = () => {
    if (!canEdit || !selectedBoardId) return;

    commitBoardElements(
      boardElementsRef.current.filter(
        (item) => item.id !== selectedBoardId
      )
    );

    setSelectedBoardId(null);
  };

  const clearWhiteboard = () => {
    if (
      !canEdit ||
      !boardElementsRef.current.length ||
      !window.confirm('Clear all whiteboard drawings?')
    ) {
      return;
    }

    commitBoardElements([]);
    setSelectedBoardId(null);
  };

  // ======================================
  // EDITOR MOUNT
  // ======================================

  const handleEditorMount = (editor) => {
    editorRef.current = editor;
  };

  // ======================================
  // LOGIN / FORGOT / RESET PASSWORD SCREEN
  // ======================================

  if (!isLoggedIn) {
    return (
      <div className="auth-page">
        <div className="auth-card">

          <div className="brand-mark">CC</div>

          <h1>Collaborative Editor</h1>

          {/* FORGOT PASSWORD SCREEN */}

          {authView === 'forgot' ? (
            <>
              <p className="auth-subtitle">
                Forgot your password?
              </p>

              <p style={{
                color: '#94a3b8',
                fontSize: 13,
                textAlign: 'center',
                lineHeight: 1.6,
                marginBottom: 22
              }}>
                Enter your registered email address. We will send you a password reset link.
              </p>

              <form onSubmit={handleForgotPassword}>

                <div className="form-group">
                  <label htmlFor="forgot-email">Email</label>

                  <input
                    id="forgot-email"
                    type="email"
                    placeholder="Enter your email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                  />
                </div>

                {authMessage && (
                  <p className="error-message">
                    {authMessage}
                  </p>
                )}

                {authSuccess && (
                  <p className="auth-success">
                    {authSuccess}
                  </p>
                )}

                <button
                  className="primary-button auth-submit"
                  disabled={loading}
                >
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>

              </form>

              <p className="auth-switch">
                Remember your password?

                <button
                  type="button"
                  className="text-button"
                  onClick={handleBackToLogin}
                >
                  Back to Login
                </button>
              </p>
            </>

          ) : authView === 'reset' ? (

            /* RESET PASSWORD SCREEN */

            <>
              <p className="auth-subtitle">
                Reset Your Password
              </p>

              <p style={{
                color: '#94a3b8',
                fontSize: 13,
                textAlign: 'center',
                lineHeight: 1.6,
                marginBottom: 22
              }}>
                Enter your new password below.
              </p>

              <form onSubmit={handleResetPassword}>

                <div className="form-group">
                  <label htmlFor="new-password">New Password</label>

                  <input
                    id="new-password"
                    type="password"
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={6}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="confirm-password">Confirm Password</label>

                  <input
                    id="confirm-password"
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={6}
                    required
                  />
                </div>

                {authMessage && (
                  <p className="error-message">
                    {authMessage}
                  </p>
                )}

                {authSuccess && (
                  <p className="auth-success">
                    {authSuccess}
                  </p>
                )}

                <button
                  className="primary-button auth-submit"
                  disabled={loading}
                >
                  {loading ? 'Resetting...' : 'Reset Password'}
                </button>

              </form>

              <p className="auth-switch">
                Remember your password?

                <button
                  type="button"
                  className="text-button"
                  onClick={handleBackToLogin}
                >
                  Back to Login
                </button>
              </p>
            </>

          ) : (

            /* LOGIN / REGISTER SCREEN */

            <>
              <p className="auth-subtitle">
                {isRegister
                  ? 'Create your account'
                  : 'Welcome back! Please login'}
              </p>

              <form onSubmit={handleAuth}>

                {isRegister && (
                  <div className="form-group">
                    <label htmlFor="name">Full Name</label>

                    <input
                      id="name"
                      type="text"
                      placeholder="Enter your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="email">Email</label>

                  <input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="password">Password</label>

                  <input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                {!isRegister && (
                  <div className="forgot-password-row">
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => {
                        setAuthView('forgot');
                        setAuthMessage('');
                        setAuthSuccess('');
                        setForgotEmail(email);
                      }}
                    >
                      Forgot Password?
                    </button>
                  </div>
                )}

                {authMessage && (
                  <p className="error-message">
                    {authMessage}
                  </p>
                )}

                <button
                  className="primary-button auth-submit"
                  disabled={loading}
                >
                  {loading
                    ? 'Please wait...'
                    : isRegister
                      ? 'Create Account'
                      : 'Login'}
                </button>

              </form>

              <p className="auth-switch">
                {isRegister
                  ? 'Already have an account?'
                  : "Don't have an account?"}

                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setIsRegister(!isRegister);
                    setAuthMessage('');
                    setAuthSuccess('');
                  }}
                >
                  {isRegister ? 'Login' : 'Register'}
                </button>
              </p>
            </>
          )}

        </div>
      </div>
    );
  }

  // ======================================
  // MAIN APPLICATION
  // ======================================

  return (
    <div className="app-page">

      {/* TOP BAR */}

      <header className="topbar">

        <div className="topbar-brand">
          <div className="small-brand-mark">CC</div>
          <span>Collaborative Editor</span>
        </div>

        <div className="topbar-user">

          <span className="connection-indicator">
            <span
              className={
                connectionStatus === 'Connected'
                  ? 'status-dot online'
                  : 'status-dot'
              }
            />

            {connectionStatus}
          </span>

          {/* PROFILE BUTTON */}

          <button
            type="button"
            onClick={() => {
              setShowProfile(true);
              setProfileMessage('');
              setAvatarFile(null);
              setAvatarPreview('');
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              border: '1px solid #475569',
              borderRadius: 24,
              padding: '5px 12px 5px 5px',
              background: '#1e293b',
              color: '#e2e8f0',
              cursor: 'pointer',
              fontSize: 13
            }}
          >
            {user?.avatar ? (
              <img
                src={`${API}${user.avatar}`}
                alt="Profile"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  objectFit: 'cover'
                }}
              />
            ) : (
              <span style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#4f46e5',
                color: '#fff',
                fontWeight: 700
              }}>
                {(user?.name || user?.email || 'U')
                  .charAt(0)
                  .toUpperCase()}
              </span>
            )}

            <span>{user?.name || user?.email}</span>
            <span>▾</span>
          </button>

          <button
            className="button button-logout"
            onClick={handleLogout}
          >
            Logout
          </button>

        </div>

      </header>

      <div className="workspace">

        {/* SIDEBAR */}

        <aside className="sidebar">

          <div className="sidebar-heading">

            <h2>My Documents</h2>

            <button
              className="button button-new"
              onClick={handleCreateDocument}
            >
              + New
            </button>

          </div>

          <div className="document-list">

            {documents.map((doc) => (
              <button
                key={doc.roomId}
                className={`document-item ${
                  doc.roomId === roomId ? 'active' : ''
                }`}
                onClick={() => changeRoom(doc.roomId)}
              >

                <span className="document-icon">
                  {doc.type === 'Whiteboard' ? '▧' : '〈〉'}
                </span>

                <span className="document-item-name">
                  {doc.name || 'Untitled Document'}
                </span>

              </button>
            ))}

            {documents.length === 0 && (
              <p className="empty-text">
                No documents found.
              </p>
            )}

          </div>

          {/* ONLINE USERS */}

          <div className="sidebar-footer">

            <strong>{onlineUsers.length} online</strong>

            <div className="online-users-list">

              {onlineUsers.length > 0 ? (
                onlineUsers.map((onlineUser) => (
                  <div
                    className="online-user-item"
                    key={onlineUser.id}
                  >

                    <span className="status-dot online" />

                    <span>{onlineUser.name}</span>

                    {onlineUser.id === user?.id && (
                      <small>(You)</small>
                    )}

                  </div>
                ))
              ) : (
                <p className="empty-text">
                  No online users
                </p>
              )}

            </div>

          </div>

        </aside>

        {/* MAIN CONTENT */}

        <main className="main-content">

          {/* DOCUMENT TOOLBAR */}

          <div className="document-toolbar">

            <div className="document-heading">

              <h1>{documentName}</h1>

              <span className="role-label">
                {documentRole}
              </span>

            </div>

            <div className="toolbar-actions">

              <button
                className="button"
                onClick={handleRename}
                disabled={documentRole !== 'Owner'}
              >
                ✎ <span>Rename</span>
              </button>

              <button
                className="button"
                onClick={handleDuplicate}
              >
                ⧉ <span>Duplicate</span>
              </button>

              <button
                className="button button-danger"
                onClick={handleDelete}
                disabled={documentRole !== 'Owner'}
              >
                ✕ <span>Delete</span>
              </button>

              <button
                className="button"
                onClick={handleShare}
                disabled={documentRole !== 'Owner'}
              >
                ♧ <span>Invite</span>
              </button>

              <button
                className="button button-share"
                onClick={copyShareLink}
              >
                🔗 <span>Copy Link</span>
              </button>

              <button
                className={`button ${
                  showVersions ? 'button-selected' : ''
                }`}
                onClick={() => setShowVersions(!showVersions)}
              >
                ◷ <span>Version History</span>
              </button>

            </div>

          </div>

          {/* VERSION HISTORY */}

          {showVersions && (
            <section className="version-panel">

              <div className="version-heading">

                <h2>Version History</h2>

                <button
                  className="button"
                  onClick={loadVersions}
                >
                  Refresh
                </button>

              </div>

              {versionMessage && (
                <p className="version-message">
                  {versionMessage}
                </p>
              )}

              {versions.length === 0 ? (
                <p className="empty-text">
                  No saved versions found.
                </p>
              ) : (
                <div className="version-list">

                  {versions.map((version) => (
                    <div
                      className="version-item"
                      key={version._id || version.id}
                    >

                      <div className="version-info">

                        <strong>
                          Version {version.versionNumber || ''}
                        </strong>

                        <span>
                          {version.author || 'Unknown'} · {' '}
                          {version.createdAt
                            ? new Date(version.createdAt).toLocaleString()
                            : ''}
                        </span>

                        {version.message && (
                          <small>{version.message}</small>
                        )}

                      </div>

                      <button
                        className="button button-restore"
                        onClick={() => handleRestore(version)}
                        disabled={!canEdit}
                      >
                        Restore
                      </button>

                    </div>
                  ))}

                </div>
              )}

            </section>
          )}

          {/* EDITOR TOOLBAR */}

          <div className="editor-toolbar">

            <div className="editor-language-controls">

              <span className="editor-file-label">
                {documentType === 'Whiteboard'
                  ? 'Whiteboard'
                  : 'Code Editor'}
              </span>

              {documentType === 'Code' && (
                <select
                  className="language-select"
                  value={language}
                  onChange={(e) =>
                    handleLanguageChange(e.target.value)
                  }
                  disabled={!canEdit}
                >

                  <option value="javascript">JavaScript</option>
                  <option value="python">Python</option>
                  <option value="java">Java</option>
                  <option value="cpp">C++</option>
                  <option value="html">HTML</option>
                  <option value="css">CSS</option>
                  <option value="typescript">TypeScript</option>
                  <option value="json">JSON</option>

                </select>
              )}

            </div>

            <span className="editor-permission">
              {canEdit ? 'Editing enabled' : 'View only'}
            </span>

          </div>

          {/* CODE EDITOR / WHITEBOARD */}

          {documentType === 'Code' ? (

            <div className="editor-container">

              <Editor
                height="100%"
                language={language}
                theme="vs-dark"
                value={code}
                onChange={handleCodeChange}
                onMount={handleEditorMount}
                options={{
                  readOnly: !canEdit,
                  automaticLayout: true,
                  fontSize: 15,
                  lineHeight: 23,
                  minimap: {
                    enabled: false
                  },
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  autoIndent: 'full',
                  formatOnPaste: true,
                  formatOnType: true,
                  bracketPairColorization: {
                    enabled: true
                  },
                  matchBrackets: 'always',
                  padding: {
                    top: 16,
                    bottom: 16
                  }
                }}
              />

            </div>

          ) : (

            <section style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              minHeight: 0,
              background: '#e2e8f0',
              borderRadius: 10,
              overflow: 'hidden'
            }}>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 9,
                padding: '10px 12px',
                background: '#111827',
                borderBottom: '1px solid #334155'
              }}>

                {[
                  ['select', 'Select / Move'],
                  ['freehand', 'Draw'],
                  ['rect', 'Rectangle'],
                  ['circle', 'Circle'],
                  ['arrow', 'Arrow'],
                  ['text', 'Text']
                ].map(([tool, label]) => (
                  <button
                    key={tool}
                    type="button"
                    onClick={() => setBoardTool(tool)}
                    disabled={!canEdit}
                    style={{
                      padding: '7px 11px',
                      borderRadius: 6,
                      border: boardTool === tool
                        ? '1px solid #818cf8'
                        : '1px solid #475569',
                      background: boardTool === tool
                        ? '#3730a3'
                        : '#1f2937',
                      color: '#f8fafc',
                      fontSize: 12,
                      cursor: canEdit ? 'pointer' : 'not-allowed'
                    }}
                  >
                    {label}
                  </button>
                ))}

                <span style={{
                  width: 1,
                  height: 25,
                  background: '#475569',
                  margin: '0 3px'
                }} />

                <label style={{ color: '#cbd5e1', fontSize: 12 }}>
                  Color
                </label>

                <input
                  type="color"
                  value={boardColor}
                  onChange={(e) => setBoardColor(e.target.value)}
                  disabled={!canEdit}
                  style={{
                    width: 34,
                    height: 30,
                    padding: 0,
                    border: 0,
                    background: 'transparent'
                  }}
                />

                <label style={{ color: '#cbd5e1', fontSize: 12 }}>
                  Stroke
                </label>

                <select
                  value={boardStroke}
                  onChange={(e) => setBoardStroke(Number(e.target.value))}
                  disabled={!canEdit}
                  style={{
                    padding: '6px 8px',
                    borderRadius: 6,
                    background: '#1f2937',
                    color: '#f8fafc',
                    border: '1px solid #475569'
                  }}
                >
                  <option value={2}>Thin</option>
                  <option value={4}>Medium</option>
                  <option value={7}>Thick</option>
                  <option value={10}>Extra</option>
                </select>

                <span style={{ flex: 1 }} />

                <button
                  type="button"
                  onClick={undoBoard}
                  disabled={!canEdit || !boardUndoRef.current.length}
                  style={{
                    padding: '7px 10px',
                    borderRadius: 6,
                    border: '1px solid #475569',
                    background: '#1f2937',
                    color: '#f8fafc'
                  }}
                >
                  ↶ Undo
                </button>

                <button
                  type="button"
                  onClick={redoBoard}
                  disabled={!canEdit || !boardRedoRef.current.length}
                  style={{
                    padding: '7px 10px',
                    borderRadius: 6,
                    border: '1px solid #475569',
                    background: '#1f2937',
                    color: '#f8fafc'
                  }}
                >
                  ↷ Redo
                </button>

                <button
                  type="button"
                  onClick={deleteSelectedBoardItem}
                  disabled={!canEdit || !selectedBoardId}
                  style={{
                    padding: '7px 10px',
                    borderRadius: 6,
                    border: '1px solid #7f1d1d',
                    background: '#991b1b',
                    color: '#fff'
                  }}
                >
                  Delete
                </button>

                <button
                  type="button"
                  onClick={clearWhiteboard}
                  disabled={!canEdit}
                  style={{
                    padding: '7px 10px',
                    borderRadius: 6,
                    border: '1px solid #7f1d1d',
                    background: '#7f1d1d',
                    color: '#fff'
                  }}
                >
                  Clear
                </button>

                <button
                  type="button"
                  onClick={() => setBoardZoom((z) =>
                    Math.min(2, Number((z + 0.1).toFixed(1)))
                  )}
                  style={{
                    padding: '7px 10px',
                    borderRadius: 6,
                    border: '1px solid #475569',
                    background: '#1f2937',
                    color: '#fff'
                  }}
                >
                  ＋
                </button>

                <span style={{
                  color: '#e2e8f0',
                  fontSize: 12,
                  minWidth: 38,
                  textAlign: 'center'
                }}>
                  {Math.round(boardZoom * 100)}%
                </span>

                <button
                  type="button"
                  onClick={() => setBoardZoom((z) =>
                    Math.max(0.5, Number((z - 0.1).toFixed(1)))
                  )}
                  style={{
                    padding: '7px 10px',
                    borderRadius: 6,
                    border: '1px solid #475569',
                    background: '#1f2937',
                    color: '#fff'
                  }}
                >
                  －
                </button>

                <button
                  type="button"
                  onClick={() => setBoardZoom(1)}
                  style={{
                    padding: '7px 10px',
                    borderRadius: 6,
                    border: '1px solid #475569',
                    background: '#1f2937',
                    color: '#fff'
                  }}
                >
                  Fit
                </button>

              </div>

              <div style={{
                flex: 1,
                minHeight: 320,
                overflow: 'auto',
                padding: 12,
                background: '#cbd5e1'
              }}>

                <svg
                  ref={boardSvgRef}
                  viewBox="0 0 1200 700"
                  preserveAspectRatio="xMidYMid meet"
                  onPointerDown={handleBoardPointerDown}
                  onPointerMove={handleBoardPointerMove}
                  onPointerUp={handleBoardPointerUp}
                  onPointerCancel={handleBoardPointerUp}
                  style={{
                    display: 'block',
                    width: `${boardZoom * 100}%`,
                    minWidth: 500,
                    height: 'auto',
                    margin: '0 auto',
                    background: '#fff',
                    borderRadius: 5,
                    boxShadow: '0 3px 14px rgba(15,23,42,.18)',
                    touchAction: 'none',
                    cursor: boardTool === 'select' ? 'default' : 'crosshair'
                  }}
                >

                  <defs>
                    <marker
                      id="whiteboard-arrowhead"
                      markerWidth="10"
                      markerHeight="8"
                      refX="8"
                      refY="4"
                      orient="auto"
                    >
                      <polygon
                        points="0 0, 10 4, 0 8"
                        fill="context-stroke"
                      />
                    </marker>
                  </defs>

                  {Array.from({ length: 25 }, (_, i) => (
                    <line
                      key={`v-${i}`}
                      x1={i * 50}
                      y1="0"
                      x2={i * 50}
                      y2="700"
                      stroke="#f1f5f9"
                      strokeWidth="1"
                      pointerEvents="none"
                    />
                  ))}

                  {Array.from({ length: 15 }, (_, i) => (
                    <line
                      key={`h-${i}`}
                      x1="0"
                      y1={i * 50}
                      x2="1200"
                      y2={i * 50}
                      stroke="#f1f5f9"
                      strokeWidth="1"
                      pointerEvents="none"
                    />
                  ))}

                  {boardElements.map((item) => {
                    const shown = boardDraft?.id === item.id
                      ? boardDraft
                      : item;

                    const selected = selectedBoardId === item.id;

                    return (
                      <g key={item.id}>

                        {shown.type === 'freehand' && (
                          <polyline
                            points={shown.points.map((p) => `${p.x},${p.y}`).join(' ')}
                            fill="none"
                            stroke={shown.color}
                            strokeWidth={shown.width}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        )}

                        {shown.type === 'rect' && (
                          <rect
                            x={Math.min(shown.x1, shown.x2)}
                            y={Math.min(shown.y1, shown.y2)}
                            width={Math.abs(shown.x2 - shown.x1)}
                            height={Math.abs(shown.y2 - shown.y1)}
                            fill="none"
                            stroke={shown.color}
                            strokeWidth={shown.width}
                          />
                        )}

                        {shown.type === 'circle' && (
                          <circle
                            cx={shown.cx}
                            cy={shown.cy}
                            r={shown.r}
                            fill="none"
                            stroke={shown.color}
                            strokeWidth={shown.width}
                          />
                        )}

                        {shown.type === 'arrow' && (
                          <line
                            x1={shown.x1}
                            y1={shown.y1}
                            x2={shown.x2}
                            y2={shown.y2}
                            stroke={shown.color}
                            strokeWidth={shown.width}
                            markerEnd="url(#whiteboard-arrowhead)"
                          />
                        )}

                        {shown.type === 'text' && (
                          <text
                            x={shown.x}
                            y={shown.y}
                            fill={shown.color}
                            fontSize={shown.fontSize || 26}
                            fontFamily="Arial, sans-serif"
                          >
                            {shown.text}
                          </text>
                        )}

                        {selected && (() => {
                          const b = getBoardBounds(item);

                          return (
                            <rect
                              x={b.x - 7}
                              y={b.y - 7}
                              width={b.w + 14}
                              height={b.h + 14}
                              fill="none"
                              stroke="#6366f1"
                              strokeWidth="2"
                              strokeDasharray="7 5"
                              pointerEvents="none"
                            />
                          );
                        })()}

                      </g>
                    );
                  })}

                  {boardDraft && !boardDraft.id && (
                    <g opacity="0.8" pointerEvents="none">

                      {boardDraft.type === 'freehand' && (
                        <polyline
                          points={boardDraft.points.map((p) => `${p.x},${p.y}`).join(' ')}
                          fill="none"
                          stroke={boardDraft.color}
                          strokeWidth={boardDraft.width}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}

                      {boardDraft.type === 'rect' && (
                        <rect
                          x={Math.min(boardDraft.start.x, boardDraft.end.x)}
                          y={Math.min(boardDraft.start.y, boardDraft.end.y)}
                          width={Math.abs(boardDraft.end.x - boardDraft.start.x)}
                          height={Math.abs(boardDraft.end.y - boardDraft.start.y)}
                          fill="none"
                          stroke={boardDraft.color}
                          strokeWidth={boardDraft.width}
                        />
                      )}

                      {boardDraft.type === 'circle' && (
                        <circle
                          cx={boardDraft.start.x}
                          cy={boardDraft.start.y}
                          r={Math.hypot(
                            boardDraft.end.x - boardDraft.start.x,
                            boardDraft.end.y - boardDraft.start.y
                          )}
                          fill="none"
                          stroke={boardDraft.color}
                          strokeWidth={boardDraft.width}
                        />
                      )}

                      {boardDraft.type === 'arrow' && (
                        <line
                          x1={boardDraft.start.x}
                          y1={boardDraft.start.y}
                          x2={boardDraft.end.x}
                          y2={boardDraft.end.y}
                          stroke={boardDraft.color}
                          strokeWidth={boardDraft.width}
                          markerEnd="url(#whiteboard-arrowhead)"
                        />
                      )}

                    </g>
                  )}

                </svg>

              </div>

              <div style={{
                padding: '8px 12px',
                background: '#111827',
                color: '#cbd5e1',
                fontSize: 12
              }}>
                {canEdit
                  ? 'Choose a tool and draw. Select / Move lets you drag existing objects.'
                  : 'View-only access — you can see the whiteboard but cannot change it.'}

                <span style={{ float: 'right' }}>
                  {boardElements.length} objects · Live sync
                </span>
              </div>

            </section>

          )}

          {/* FOOTER */}

          <footer className="editor-footer">

            <span>
              {canEdit
                ? 'You can edit this document'
                : 'Read-only access'}
            </span>

            <span>
              {code.length} characters
            </span>

          </footer>

        </main>

      </div>

      {/* ======================================
          PROFILE WINDOW
      ====================================== */}

      {showProfile && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowProfile(false);
              setAvatarFile(null);
              setAvatarPreview('');
              setProfileMessage('');
            }
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            background: 'rgba(2, 6, 23, 0.75)',
            backdropFilter: 'blur(4px)'
          }}
        >

          <section
            style={{
              width: '100%',
              maxWidth: 420,
              padding: 26,
              border: '1px solid #334155',
              borderRadius: 16,
              background: '#0f172a',
              color: '#e2e8f0',
              boxShadow: '0 20px 60px rgba(0,0,0,0.45)'
            }}
          >

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 22
            }}>
              <div>
                <h2 style={{
                  margin: 0,
                  fontSize: 21
                }}>
                  My Profile
                </h2>

                <p style={{
                  margin: '6px 0 0',
                  color: '#94a3b8',
                  fontSize: 13
                }}>
                  Manage your account picture
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowProfile(false);
                  setAvatarFile(null);
                  setAvatarPreview('');
                  setProfileMessage('');
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#cbd5e1',
                  fontSize: 26,
                  cursor: 'pointer'
                }}
                aria-label="Close profile"
              >
                ×
              </button>
            </div>

            {/* PROFILE IMAGE */}

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              marginBottom: 22
            }}>

              {avatarPreview || user?.avatar ? (
                <img
                  src={
                    avatarPreview ||
                    `${API}${user.avatar}`
                  }
                  alt="Profile preview"
                  style={{
                    width: 112,
                    height: 112,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '3px solid #6366f1',
                    background: '#1e293b'
                  }}
                />
              ) : (
                <div style={{
                  width: 112,
                  height: 112,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#3730a3',
                  color: '#fff',
                  fontSize: 42,
                  fontWeight: 700,
                  border: '3px solid #6366f1'
                }}>
                  {(user?.name || user?.email || 'U')
                    .charAt(0)
                    .toUpperCase()}
                </div>
              )}

              <strong style={{
                marginTop: 13,
                fontSize: 17
              }}>
                {user?.name || 'User'}
              </strong>

              <span style={{
                marginTop: 4,
                color: '#94a3b8',
                fontSize: 13
              }}>
                {user?.email}
              </span>

            </div>

            <div style={{
              height: 1,
              background: '#334155',
              marginBottom: 20
            }} />

            {/* IMAGE FILE INPUT */}

            <label
              htmlFor="profile-avatar"
              style={{
                display: 'block',
                marginBottom: 9,
                color: '#cbd5e1',
                fontSize: 13,
                fontWeight: 600
              }}
            >
              Choose Profile Picture
            </label>

            <input
              id="profile-avatar"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleAvatarSelect}
              style={{
                width: '100%',
                padding: 11,
                border: '1px solid #475569',
                borderRadius: 8,
                background: '#1e293b',
                color: '#cbd5e1',
                fontSize: 12
              }}
            />

            <p style={{
              color: '#64748b',
              fontSize: 11,
              marginTop: 8
            }}>
              Accepted formats: JPG, PNG, WEBP. Maximum size: 5 MB.
            </p>

            {profileMessage && (
              <p style={{
                padding: '10px 12px',
                margin: '14px 0',
                borderRadius: 7,
                background: profileMessage.toLowerCase().includes('success')
                  ? '#064e3b'
                  : '#7f1d1d',
                color: '#fff',
                fontSize: 12
              }}>
                {profileMessage}
              </p>
            )}

            <div style={{
              display: 'flex',
              gap: 10,
              marginTop: 20
            }}>

              <button
                type="button"
                onClick={handleAvatarUpload}
                disabled={!avatarFile || profileLoading}
                style={{
                  flex: 1,
                  padding: '11px 14px',
                  border: 'none',
                  borderRadius: 8,
                  background: !avatarFile || profileLoading
                    ? '#475569'
                    : '#4f46e5',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: !avatarFile || profileLoading
                    ? 'not-allowed'
                    : 'pointer'
                }}
              >
                {profileLoading ? 'Uploading...' : 'Upload Picture'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowProfile(false);
                  setAvatarFile(null);
                  setAvatarPreview('');
                  setProfileMessage('');
                }}
                style={{
                  padding: '11px 16px',
                  border: '1px solid #475569',
                  borderRadius: 8,
                  background: '#1e293b',
                  color: '#e2e8f0',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>

            </div>

          </section>

        </div>
      )}

      {/* ======================================
          REAL-TIME CHAT WINDOW
      ====================================== */}

      {showChat && (
        <section
          style={{
            position: 'fixed',
            right: 24,
            bottom: 86,
            width: 350,
            maxWidth: 'calc(100vw - 32px)',
            height: 460,
            maxHeight: 'calc(100vh - 120px)',
            display: 'flex',
            flexDirection: 'column',
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: 12,
            boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
            overflow: 'hidden',
            zIndex: 1000
          }}
        >

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '14px 16px',
              background: '#1e293b',
              borderBottom: '1px solid #334155'
            }}
          >

            <div>
              <strong style={{ color: '#f8fafc', fontSize: 15 }}>
                Document Chat
              </strong>

              <div style={{
                color: '#94a3b8',
                fontSize: 11,
                marginTop: 4
              }}>
                {documentName}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowChat(false)}
              style={{
                border: 'none',
                background: 'transparent',
                color: '#cbd5e1',
                fontSize: 22,
                cursor: 'pointer'
              }}
              aria-label="Close chat"
            >
              ×
            </button>

          </div>

          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}
          >

            {chatLoading && (
              <p style={{
                color: '#94a3b8',
                textAlign: 'center',
                fontSize: 12
              }}>
                Loading messages...
              </p>
            )}

            {!chatLoading && chatMessages.length === 0 && (
              <p style={{
                color: '#94a3b8',
                textAlign: 'center',
                fontSize: 13,
                marginTop: 30
              }}>
                No messages yet. Start the conversation!
              </p>
            )}

            {chatMessages.map((msg, index) => {
              const senderId =
                typeof msg.sender === 'object'
                  ? (msg.sender?._id || msg.sender?.id)
                  : msg.sender;

              const currentUserId = user?._id || user?.id;

              const isMine =
                String(senderId) === String(currentUserId);

              const senderName =
                typeof msg.sender === 'object'
                  ? (msg.sender?.name || msg.sender?.email || 'User')
                  : 'User';

              return (
                <div
                  key={msg._id || `${msg.createdAt}-${index}`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isMine ? 'flex-end' : 'flex-start'
                  }}
                >

                  <span style={{
                    color: '#94a3b8',
                    fontSize: 10,
                    marginBottom: 4
                  }}>
                    {isMine ? 'You' : senderName}
                  </span>

                  <div
                    style={{
                      maxWidth: '85%',
                      padding: '9px 12px',
                      borderRadius: 10,
                      background: isMine ? '#4f46e5' : '#334155',
                      color: '#f8fafc',
                      fontSize: 13,
                      lineHeight: 1.5,
                      overflowWrap: 'anywhere',
                      whiteSpace: 'pre-wrap'
                    }}
                  >
                    {msg.message}
                  </div>

                  <span style={{
                    color: '#64748b',
                    fontSize: 10,
                    marginTop: 4
                  }}>
                    {msg.createdAt
                      ? new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : ''}
                  </span>

                </div>
              );
            })}

            <div ref={chatEndRef} />

          </div>

          {chatError && (
            <p style={{
              color: '#fca5a5',
              fontSize: 11,
              padding: '4px 12px',
              margin: 0
            }}>
              {chatError}
            </p>
          )}

          <form
            onSubmit={handleSendChatMessage}
            style={{
              display: 'flex',
              gap: 8,
              padding: 12,
              background: '#1e293b',
              borderTop: '1px solid #334155'
            }}
          >

            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Type a message..."
              maxLength={2000}
              style={{
                flex: 1,
                minWidth: 0,
                padding: '10px 12px',
                borderRadius: 7,
                border: '1px solid #475569',
                outline: 'none',
                background: '#0f172a',
                color: '#f8fafc',
                fontSize: 13
              }}
            />

            <button
              type="submit"
              disabled={!chatInput.trim() || connectionStatus !== 'Connected'}
              style={{
                padding: '0 14px',
                borderRadius: 7,
                border: 'none',
                background: !chatInput.trim() || connectionStatus !== 'Connected'
                  ? '#475569'
                  : '#4f46e5',
                color: '#fff',
                fontWeight: 600,
                cursor: !chatInput.trim() || connectionStatus !== 'Connected'
                  ? 'not-allowed'
                  : 'pointer'
              }}
            >
              Send
            </button>

          </form>

        </section>
      )}

      {/* CHAT OPEN BUTTON */}

      <button
        type="button"
        onClick={() => setShowChat((previous) => !previous)}
        style={{
          position: 'fixed',
          right: 24,
          bottom: 24,
          zIndex: 1001,
          border: 'none',
          borderRadius: 30,
          padding: '12px 20px',
          background: '#4f46e5',
          color: '#fff',
          fontWeight: 600,
          fontSize: 14,
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          cursor: 'pointer'
        }}
      >
        {showChat ? 'Close Chat' : '💬 Chat'}
      </button>

    </div>
  );
}

export default App;
