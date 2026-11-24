import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

function formatTime(isoDate) {
  if (!isoDate) return '';
  return new Date(isoDate).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function AuthScreen({ onAuthSuccess }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Something went wrong.');
        return;
      }

      onAuthSuccess(data);
    } catch {
      setError('Cannot connect to server. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Simple Chat</h1>
        <p className="auth-subtitle">
          {mode === 'login' ? 'Sign in to start chatting' : 'Create a quick account'}
        </p>

        <div className="auth-tabs">
          <button
            type="button"
            className={mode === 'login' ? 'active' : ''}
            onClick={() => {
              setMode('login');
              setError('');
            }}
          >
            Login
          </button>
          <button
            type="button"
            className={mode === 'register' ? 'active' : ''}
            onClick={() => {
              setMode('register');
              setError('');
            }}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Username
            <input
              type="text"
              placeholder="e.g. rahul"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={2}
            />
          </label>

          <label>
            Password
            <input
              type="password"
              placeholder="Min 4 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={4}
            />
          </label>

          {error && <p className="error-text">{error}</p>}

          <button type="submit" className="primary-btn" disabled={loading}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  // Using sessionStorage so two browser tabs can log in as two different users for testing/demo
  const [auth, setAuth] = useState(() => {
    const saved = sessionStorage.getItem('chat_auth');
    return saved ? JSON.parse(saved) : null;
  });

  const [users, setUsers] = useState([]);
  const [onlineUserIds, setOnlineUserIds] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [unreadFrom, setUnreadFrom] = useState({});

  const socketRef = useRef(null);
  const selectedUserRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleAuthSuccess(data) {
    sessionStorage.setItem('chat_auth', JSON.stringify(data));
    setAuth(data);
  }

  function handleLogout() {
    sessionStorage.removeItem('chat_auth');
    socketRef.current?.disconnect();
    setAuth(null);
    setUsers([]);
    setSelectedUser(null);
    setMessages([]);
    setUnreadFrom({});
  }

  // Load user list and connect Socket.io when logged in
  useEffect(() => {
    if (!auth?.token) return;

    fetch('/api/auth/users', {
      headers: { Authorization: `Bearer ${auth.token}` },
    })
      .then((res) => {
        if (res.status === 401) {
          handleLogout();
          return [];
        }
        return res.json();
      })
      .then((list) => {
        if (Array.isArray(list)) setUsers(list);
      })
      .catch(() => {});

    const socket = io({
      auth: { token: auth.token },
    });
    socketRef.current = socket;

    socket.on('online_users', (ids) => {
      setOnlineUserIds(ids);
    });

    socket.on('user_registered', (newUser) => {
      if (newUser.id === auth.user.id) return;
      setUsers((prev) => {
        if (prev.some((u) => u.id === newUser.id)) return prev;
        return [...prev, newUser].sort((a, b) => a.username.localeCompare(b.username));
      });
    });

    socket.on('receive_message', (msg) => {
      const currentChatId = selectedUserRef.current?.id;
      const isForActiveChat =
        currentChatId &&
        ((msg.sender === currentChatId && msg.receiver === auth.user.id) ||
          (msg.sender === auth.user.id && msg.receiver === currentChatId));

      if (isForActiveChat) {
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      } else if (msg.sender !== auth.user.id) {
        setUnreadFrom((prev) => ({
          ...prev,
          [msg.sender]: (prev[msg.sender] || 0) + 1,
        }));
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [auth?.token, auth?.user?.id]);

  // Load chat history whenever a user is clicked
  useEffect(() => {
    if (!auth?.token || !selectedUser) return;

    setUnreadFrom((prev) => {
      if (!prev[selectedUser.id]) return prev;
      const next = { ...prev };
      delete next[selectedUser.id];
      return next;
    });

    fetch(`/api/messages/${selectedUser.id}`, {
      headers: { Authorization: `Bearer ${auth.token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setMessages(data);
      })
      .catch(() => {});
  }, [auth?.token, selectedUser]);

  function handleSend(e) {
    e.preventDefault();
    const clean = text.trim();
    if (!clean || !selectedUser || !socketRef.current) return;

    socketRef.current.emit('send_message', {
      receiverId: selectedUser.id,
      text: clean,
    });
    setText('');
  }

  if (!auth) {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="chat-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div>
            <div className="my-name">{auth.user.username}</div>
            <div className="my-status">Logged in</div>
          </div>
          <button type="button" className="logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>

        <div className="users-heading">Users ({users.length})</div>

        <div className="user-list">
          {users.length === 0 ? (
            <p className="empty-users">
              No other users yet. Open another tab and register a second user to chat!
            </p>
          ) : (
            users.map((u) => {
              const isOnline = onlineUserIds.includes(u.id);
              const isSelected = selectedUser?.id === u.id;
              const unread = unreadFrom[u.id] || 0;

              return (
                <button
                  key={u.id}
                  type="button"
                  className={`user-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedUser(u)}
                >
                  <span className={`dot ${isOnline ? 'online' : 'offline'}`} />
                  <span className="user-name">{u.username}</span>
                  {unread > 0 && <span className="unread-badge">{unread}</span>}
                </button>
              );
            })
          )}
        </div>
      </aside>

      <main className="chat-main">
        {!selectedUser ? (
          <div className="no-chat-selected">
            <h2>Select a user to start chatting</h2>
            <p>Messages are saved in MongoDB and delivered live with Socket.io.</p>
          </div>
        ) : (
          <>
            <header className="chat-header">
              <span
                className={`dot ${
                  onlineUserIds.includes(selectedUser.id) ? 'online' : 'offline'
                }`}
              />
              <div>
                <div className="chat-peer-name">{selectedUser.username}</div>
                <div className="chat-peer-status">
                  {onlineUserIds.includes(selectedUser.id) ? 'Online' : 'Offline'}
                </div>
              </div>
            </header>

            <div className="messages-area">
              {messages.length === 0 ? (
                <p className="empty-chat">No messages yet. Say hi!</p>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.sender === auth.user.id;
                  return (
                    <div key={msg.id} className={`msg-row ${isMine ? 'mine' : 'theirs'}`}>
                      <div className="msg-bubble">
                        <div className="msg-text">{msg.text}</div>
                        <div className="msg-time">{formatTime(msg.createdAt)}</div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <form className="chat-input-bar" onSubmit={handleSend}>
              <input
                type="text"
                placeholder={`Message ${selectedUser.username}...`}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <button type="submit" className="send-btn" disabled={!text.trim()}>
                Send
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
