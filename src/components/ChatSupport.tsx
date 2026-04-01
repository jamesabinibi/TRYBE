import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Loader2, User as UserIcon, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../App';
import { cn, apiFetch } from '../lib/utils';
import { Input } from './Input';

interface Message {
  id: string;
  message: string;
  is_from_admin: boolean;
  created_at: string;
}

import { io, Socket } from 'socket.io-client';

export default function ChatSupport() {
  const { user, fetchWithAuth } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [guestId, setGuestId] = useState<string | null>(null);
  const [guestEmail, setGuestEmail] = useState('');
  const [hasStarted, setHasStarted] = useState(false);
  const [remoteIsTyping, setRemoteIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Initialize guest ID if not logged in
    if (!user) {
      let storedGuestId = localStorage.getItem('gryndee_guest_id');
      let storedGuestEmail = localStorage.getItem('gryndee_guest_email');
      if (!storedGuestId) {
        storedGuestId = 'guest_' + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('gryndee_guest_id', storedGuestId);
      }
      setGuestId(storedGuestId);
      if (storedGuestEmail) {
        setGuestEmail(storedGuestEmail);
        setHasStarted(true);
      }
    } else {
      setGuestId(null);
      setHasStarted(true);
    }
  }, [user]);

  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen && hasStarted) {
      fetchMessages();
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
  }, [isOpen, user, guestId, hasStarted]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, remoteIsTyping]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = async () => {
    try {
      if (user) {
        const res = await fetchWithAuth('/api/chat/messages');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setMessages(data);
          } else {
            setMessages([]);
          }
        }
      } else if (guestId) {
        const res = await apiFetch(`/api/chat/guest/messages?guestId=${guestId}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setMessages(data);
          } else {
            setMessages([]);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  };

  const connectWebSocket = () => {
    let query: any = {};
    if (user) {
      query = { userId: user.id, accountId: user.account_id };
    } else if (guestId) {
      query = { guestId };
    } else {
      return; // Wait for guestId to be set
    }
    
    console.log('Connecting to Socket.IO');
    const socket = io(window.location.origin, {
      path: '/socket.io',
      query,
      transports: ['polling', 'websocket'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 20000
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Socket.IO connected successfully');
      setIsConnected(true);
    });

    socket.on('connect_error', (err) => {
      console.error('Socket.IO connection error:', err.message);
      setIsConnected(false);
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket.IO disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('chat_message', (data) => {
      console.log('[WS] Received chat message:', data);
      // Avoid duplicates if it's from me (already added locally)
      if (data.fromUserId === (user?.id || guestId)) return;
      
      setMessages(prev => {
        // Double check for duplicates by message content and timestamp if possible
        const isDuplicate = prev.some(m => m.message === data.message && Math.abs(new Date(m.created_at).getTime() - new Date(data.created_at).getTime()) < 1000);
        if (isDuplicate) return prev;
        
        return [...prev, {
          id: Math.random().toString(),
          message: data.message,
          is_from_admin: data.isFromAdmin,
          created_at: data.created_at || new Date().toISOString()
        }];
      });
      setRemoteIsTyping(false);
    });

    socket.on('typing', (data) => {
      console.log('[WS] Received typing event:', data);
      // If it's from an admin, or from someone else (not me)
      if (data.isFromAdmin || (data.fromUserId && String(data.fromUserId) !== String(user?.id || guestId))) {
        console.log(`[WS] Setting remoteIsTyping to ${data.isTyping}`);
        setRemoteIsTyping(data.isTyping);
      }
    });

    socket.on('end_chat', () => {
      setMessages(prev => [...prev, {
        id: 'end_' + Math.random(),
        message: 'Chat session has been ended by support.',
        is_from_admin: true,
        created_at: new Date().toISOString()
      }]);
    });
  };

  const handleStartChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestEmail.trim()) return;
    localStorage.setItem('gryndee_guest_email', guestEmail);
    setHasStarted(true);
  };

  const isTypingRef = useRef(false);
  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    
    if (socketRef.current && isConnected) {
      if (!isTypingRef.current) {
        console.log('[WS] Sending typing event');
        socketRef.current.emit('typing', { isTyping: true });
        isTypingRef.current = true;
      }
      
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        console.log('[WS] Sending typing STOP event');
        socketRef.current?.emit('typing', { isTyping: false });
        isTypingRef.current = false;
      }, 3000);
    }
  };

  const handleEndChat = () => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('end_chat', {});
    }
    setHasStarted(false);
    setMessages([]);
    localStorage.removeItem('gryndee_guest_email');
    setGuestEmail('');
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !socketRef.current || !socketRef.current.connected) return;

    const messageData = {
      message: newMessage,
      isFromAdmin: false,
      guestEmail: user ? null : guestEmail
    };

    socketRef.current.emit('chat_message', messageData);
    socketRef.current.emit('typing', { isTyping: false });
    isTypingRef.current = false;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    // Optimistic update
    setMessages(prev => [...prev, {
      id: Math.random().toString(),
      message: newMessage,
      is_from_admin: false,
      created_at: new Date().toISOString()
    }]);
    
    setNewMessage('');
  };

  // Remove isPremium check so everyone can chat
  // if (!isPremium) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100]">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="absolute bottom-20 right-0 w-[350px] h-[500px] bg-white dark:bg-zinc-900 rounded-[2rem] shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 bg-brand text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold uppercase tracking-widest">Gryndee Support</p>
                  <div className="flex items-center gap-1.5">
                    <div className={cn("w-2 h-2 rounded-full", isConnected ? "bg-brand" : "bg-zinc-400")} />
                    <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest">
                      {isConnected ? 'Online' : 'Connecting...'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {hasStarted && (
                  <button 
                    onClick={handleEndChat}
                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-[9px] font-bold uppercase tracking-widest border border-white/10"
                    title="End Chat"
                  >
                    End Chat
                  </button>
                )}
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {!hasStarted ? (
              <div className="flex-1 p-8 flex flex-col justify-center space-y-6">
                <div className="text-center space-y-2">
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">Welcome to Support</h3>
                  <p className="text-xs text-zinc-500">Please enter your email to start a conversation with our team.</p>
                </div>
                <form onSubmit={handleStartChat} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Email Address</label>
                    <Input 
                      type="email"
                      required
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      placeholder="your@email.com"
                    />
                  </div>
                  <button 
                    type="submit"
                    className="w-full py-4 bg-brand text-white rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-brand-hover transition-all shadow-xl shadow-brand/20 active:scale-95"
                  >
                    Start Chat
                  </button>
                </form>
              </div>
            ) : (
              <>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50">
                      <MessageCircle className="w-12 h-12 text-zinc-300" />
                      <div>
                        <p className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-widest">No messages yet</p>
                        <p className="text-xs font-medium text-zinc-500">Start a conversation with our support team.</p>
                      </div>
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div 
                        key={msg.id}
                        className={cn(
                          "flex flex-col max-w-[80%]",
                          msg.is_from_admin ? "mr-auto" : "ml-auto items-end"
                        )}
                      >
                        <div className={cn(
                          "px-4 py-3 rounded-2xl text-sm font-medium",
                          msg.is_from_admin 
                            ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-tl-none" 
                            : "bg-brand text-white rounded-tr-none"
                        )}>
                          {msg.message}
                        </div>
                        <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-1">
                          {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                    ))
                  )}
                  {remoteIsTyping && (
                    <div className="flex items-center gap-2 text-zinc-400">
                      <div className="flex gap-1">
                        <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-1 h-1 bg-zinc-400 rounded-full" />
                        <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} className="w-1 h-1 bg-zinc-400 rounded-full" />
                        <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} className="w-1 h-1 bg-zinc-400 rounded-full" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest">Support is typing...</span>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <form onSubmit={handleSendMessage} className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50">
                  <div className="relative">
                    <Input 
                      type="text"
                      value={newMessage}
                      onChange={handleTyping}
                      placeholder="Type your message..."
                      className="pr-12"
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
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 relative",
          isOpen ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900" : "bg-brand text-white"
        )}
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
        {!isOpen && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 border-2 border-white dark:border-zinc-900 rounded-full" />
        )}
      </motion.button>
    </div>
  );
}
