import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, User as UserIcon, ShieldCheck, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../App';
import { cn } from '../lib/utils';
import { Input } from './Input';

interface ChatSession {
  user_id: string | null;
  guest_id: string | null;
  account_id: string | null;
  guest_email: string | null;
  created_at: string;
  message: string;
}

interface Message {
  id: string;
  message: string;
  is_from_admin: boolean;
  created_at: string;
}

import { io, Socket } from 'socket.io-client';

export default function AdminChat({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user, fetchWithAuth } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [remoteIsTyping, setRemoteIsTyping] = useState<Record<string, boolean>>({});
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchSessions();
      connectWebSocket();
    }
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [isOpen, user?.id]);

  useEffect(() => {
    if (selectedSession) {
      fetchMessages(selectedSession);
    }
  }, [selectedSession]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, remoteIsTyping]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchSessions = async () => {
    try {
      const res = await fetchWithAuth('/api/chat/admin/sessions');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setSessions(data);
        } else {
          setSessions([]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    }
  };

  const fetchMessages = async (session: ChatSession) => {
    try {
      const targetId = session.user_id || session.guest_id;
      const res = await fetchWithAuth(`/api/chat/admin/messages/${targetId}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setMessages(data);
        } else {
          setMessages([]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  };

  const connectWebSocket = () => {
    console.log('Admin connecting to Socket.IO');
    const socket = io(window.location.origin, {
      path: '/socket.io',
      query: { userId: user?.id, accountId: user?.account_id, isAdmin: 'true' },
      transports: ['polling', 'websocket'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 20000
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Admin Socket.IO connected successfully');
      setIsConnected(true);
    });

    socket.on('connect_error', (err) => {
      console.error('Admin Socket.IO connection error:', err.message);
      setIsConnected(false);
    });

    socket.on('disconnect', (reason) => {
      console.log('Admin Socket.IO disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('chat_message', (data) => {
      console.log('[WS] Admin received chat message:', data);
      
      // Update sessions list locally instead of fetching all sessions
      setSessions(prev => {
        const targetId = String(data.fromUserId || data.targetUserId);
        const existingSessionIndex = prev.findIndex(s => 
          String(s.user_id || s.guest_id) === targetId
        );
        
        if (existingSessionIndex !== -1) {
          const updatedSessions = [...prev];
          updatedSessions[existingSessionIndex] = {
            ...updatedSessions[existingSessionIndex],
            message: data.message,
            created_at: data.created_at || new Date().toISOString()
          };
          // Move to top
          const session = updatedSessions.splice(existingSessionIndex, 1)[0];
          return [session, ...updatedSessions];
        } else {
          // New session, but we don't have all info, so maybe fetch sessions once
          fetchSessions();
          return prev;
        }
      });
      
      // If we are currently viewing this chat, append the message
      if (selectedSession) {
        const targetId = selectedSession.user_id || selectedSession.guest_id;
        
        // If message is from the user we are viewing, OR if it's from another admin TO the user we are viewing
        // Use String() for safe comparison
        const isFromTarget = String(data.fromUserId) === String(targetId);
        const isFromOtherAdminToTarget = data.isFromAdmin && String(data.targetUserId) === String(targetId) && String(data.fromUserId) !== String(user?.id);

        if (isFromTarget || isFromOtherAdminToTarget) {
          setMessages(prev => {
            // Avoid duplicates
            const isDuplicate = prev.some(m => m.message === data.message && Math.abs(new Date(m.created_at).getTime() - new Date(data.created_at).getTime()) < 1000);
            if (isDuplicate) return prev;

            return [...prev, {
              id: data.id || Math.random().toString(),
              message: data.message,
              is_from_admin: data.isFromAdmin,
              created_at: data.created_at || new Date().toISOString()
            }];
          });
          
          if (isFromTarget) {
            setRemoteIsTyping(prev => ({ ...prev, [String(data.fromUserId)]: false }));
          }
        }
      }
    });

    socket.on('typing', (data) => {
      console.log('[WS] Admin received typing event:', data);
      if (data.fromUserId) {
        setRemoteIsTyping(prev => ({ ...prev, [String(data.fromUserId)]: data.isTyping }));
      }
    });

    socket.on('end_chat', (data) => {
      if (selectedSession) {
        const targetId = selectedSession.user_id || selectedSession.guest_id;
        if (data.fromUserId === targetId) {
          setMessages(prev => [...prev, {
            id: 'end_' + Math.random(),
            message: 'User has ended the chat session.',
            is_from_admin: false,
            created_at: new Date().toISOString()
          }]);
        }
      }
      fetchSessions();
    });
  };

  const isTypingRef = useRef(false);
  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    
    if (socketRef.current && isConnected && selectedSession) {
      const targetId = selectedSession.user_id || selectedSession.guest_id;
      
      if (!isTypingRef.current) {
        console.log(`[WS] Admin sending typing event to ${targetId}`);
        socketRef.current.emit('typing', { targetUserId: targetId, isTyping: true });
        isTypingRef.current = true;
      }
      
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        console.log(`[WS] Admin sending typing STOP event to ${targetId}`);
        socketRef.current?.emit('typing', { targetUserId: targetId, isTyping: false });
        isTypingRef.current = false;
      }, 3000);
    }
  };

  const handleEndChat = () => {
    if (!selectedSession || !socketRef.current || !isConnected) return;
    const targetId = selectedSession.user_id || selectedSession.guest_id;
    socketRef.current.emit('end_chat', { targetUserId: targetId });
    
    setMessages(prev => [...prev, {
      id: 'end_admin_' + Math.random(),
      message: 'You have ended this chat session.',
      is_from_admin: true,
      created_at: new Date().toISOString()
    }]);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !socketRef.current || !socketRef.current.connected || !selectedSession) return;

    const targetId = selectedSession.user_id || selectedSession.guest_id;

    const messageData = {
      message: newMessage,
      targetUserId: targetId,
      isFromAdmin: true
    };

    socketRef.current.emit('chat_message', messageData);
    socketRef.current.emit('typing', { targetUserId: targetId, isTyping: false });
    isTypingRef.current = false;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    // Update last message in sidebar locally
    setSessions(prev => {
      const existingSessionIndex = prev.findIndex(s => 
        String(s.user_id || s.guest_id) === String(targetId)
      );
      
      if (existingSessionIndex !== -1) {
        const updatedSessions = [...prev];
        updatedSessions[existingSessionIndex] = {
          ...updatedSessions[existingSessionIndex],
          message: newMessage,
          created_at: new Date().toISOString()
        };
        // Move to top
        const session = updatedSessions.splice(existingSessionIndex, 1)[0];
        return [session, ...updatedSessions];
      }
      return prev;
    });

    // Optimistic update
    setMessages(prev => [...prev, {
      id: Math.random().toString(),
      message: newMessage,
      is_from_admin: true,
      created_at: new Date().toISOString()
    }]);
    
    setNewMessage('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-5xl h-[80vh] bg-white dark:bg-zinc-900 rounded-[2rem] shadow-2xl border border-zinc-200 dark:border-zinc-800 flex overflow-hidden"
      >
        {/* Sidebar */}
        <div className="w-1/3 border-r border-zinc-200 dark:border-zinc-800 flex flex-col bg-zinc-50 dark:bg-zinc-900/50">
          <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-zinc-900">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-zinc-900 dark:text-white">Live Support</h2>
                <div className="flex items-center gap-1.5">
                  <div className={cn("w-2 h-2 rounded-full", isConnected ? "bg-brand" : "bg-zinc-400")} />
                  <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest text-zinc-500">
                    {isConnected ? 'Online' : 'Connecting...'}
                  </p>
                </div>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors text-zinc-500"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {sessions.length === 0 ? (
              <div className="text-center p-8 text-zinc-500">
                <MessageCircle className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <p className="text-sm font-medium">No active chats</p>
              </div>
            ) : (
              sessions.map((session, idx) => {
                const isSelected = selectedSession?.user_id === session.user_id && selectedSession?.guest_id === session.guest_id;
                const displayName = session.user_id ? `User ${String(session.user_id).substring(0, 8)}` : `Guest ${session.guest_id?.substring(6, 14)}`;
                const targetId = session.user_id || session.guest_id || '';
                const isTyping = remoteIsTyping[targetId];

                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedSession(session)}
                    className={cn(
                      "w-full text-left p-4 rounded-2xl transition-all",
                      isSelected 
                        ? "bg-brand text-white shadow-lg shadow-brand/20" 
                        : "bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-700"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex flex-col">
                        <span className="font-bold text-sm">{displayName}</span>
                        {session.guest_email && (
                          <span className={cn("text-[9px] font-medium", isSelected ? "text-white/70" : "text-zinc-400")}>
                            {session.guest_email}
                          </span>
                        )}
                      </div>
                      <span className={cn(
                        "text-[10px] font-bold uppercase tracking-widest",
                        isSelected ? "text-white/80" : "text-zinc-400"
                      )}>
                        {session.created_at ? new Date(session.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn(
                        "text-xs truncate flex-1",
                        isSelected ? "text-white/90" : "text-zinc-500 dark:text-zinc-400"
                      )}>
                        {isTyping ? 'Typing...' : session.message}
                      </p>
                      {isTyping && (
                        <div className="flex gap-0.5">
                          <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 0.6 }} className={cn("w-1 h-1 rounded-full", isSelected ? "bg-white" : "bg-brand")} />
                          <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} className={cn("w-1 h-1 rounded-full", isSelected ? "bg-white" : "bg-brand")} />
                          <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} className={cn("w-1 h-1 rounded-full", isSelected ? "bg-white" : "bg-brand")} />
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-white dark:bg-zinc-900">
          {selectedSession ? (
            <>
              {/* Chat Header */}
              <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500">
                    <UserIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-zinc-900 dark:text-white">
                      {selectedSession.user_id ? `User ${selectedSession.user_id}` : `Guest ${selectedSession.guest_id}`}
                    </h3>
                    <div className="flex items-center gap-2">
                      {selectedSession.guest_email && (
                        <p className="text-xs text-zinc-500">{selectedSession.guest_email}</p>
                      )}
                      {selectedSession.account_id && (
                        <p className="text-xs text-zinc-500">Account: {selectedSession.account_id}</p>
                      )}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={handleEndChat}
                  className="px-4 py-2 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-red-100 dark:hover:bg-red-900/30 transition-all"
                >
                  End Session
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.map((msg) => (
                  <div 
                    key={msg.id}
                    className={cn(
                      "flex flex-col max-w-[70%]",
                      msg.is_from_admin ? "ml-auto items-end" : "mr-auto"
                    )}
                  >
                    <div className={cn(
                      "px-4 py-3 rounded-2xl text-sm font-medium",
                      msg.is_from_admin 
                        ? "bg-brand text-white rounded-tr-none"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-tl-none" 
                    )}>
                      {msg.message}
                    </div>
                    <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-1">
                      {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                ))}
                {remoteIsTyping[selectedSession.user_id || selectedSession.guest_id || ''] && (
                  <div className="flex items-center gap-2 text-zinc-400">
                    <div className="flex gap-1">
                      <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-1 h-1 bg-zinc-400 rounded-full" />
                      <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} className="w-1 h-1 bg-zinc-400 rounded-full" />
                      <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} className="w-1 h-1 bg-zinc-400 rounded-full" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest">User is typing...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                <div className="relative">
                  <Input 
                    type="text"
                    value={newMessage}
                    onChange={handleTyping}
                    placeholder="Type your reply..."
                    className="pr-12 bg-white dark:bg-zinc-900"
                  />
                  <button 
                    type="submit"
                    disabled={!newMessage.trim() || !isConnected}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-brand text-white rounded-lg hover:bg-brand-hover transition-all disabled:opacity-50 disabled:scale-100 active:scale-90"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 space-y-4">
              <MessageCircle className="w-16 h-16 opacity-20" />
              <p className="text-sm font-medium">Select a chat session to start replying</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
