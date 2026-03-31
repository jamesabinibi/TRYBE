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

export default function ChatSupport() {
  const { user, fetchWithAuth } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [guestId, setGuestId] = useState<string | null>(null);

  useEffect(() => {
    // Initialize guest ID if not logged in
    if (!user) {
      let storedGuestId = localStorage.getItem('gryndee_guest_id');
      if (!storedGuestId) {
        storedGuestId = 'guest_' + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('gryndee_guest_id', storedGuestId);
      }
      setGuestId(storedGuestId);
    } else {
      setGuestId(null);
    }
  }, [user]);

  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchMessages();
      connectWebSocket();
    }
    return () => {
      if (socketRef.current) {
        // Prevent reconnect on intentional close
        socketRef.current.onclose = null;
        socketRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [isOpen, user, guestId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = async () => {
    try {
      if (user) {
        const res = await fetchWithAuth('/api/chat/messages');
        if (res.ok) {
          const data = await res.json();
          setMessages(data);
        }
      } else if (guestId) {
        const res = await apiFetch(`/api/chat/guest/messages?guestId=${guestId}`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  };

  const connectWebSocket = () => {
    const baseUrl = import.meta.env.VITE_APP_URL || window.location.origin;
    const wsBaseUrl = baseUrl.replace(/^http/, 'ws');
    let wsUrl = `${wsBaseUrl}/api/chat?`;
    
    if (user) {
      wsUrl += `userId=${user.id}&accountId=${user.account_id}`;
    } else if (guestId) {
      wsUrl += `guestId=${guestId}`;
    } else {
      return; // Wait for guestId to be set
    }
    
    console.log('Connecting to WebSocket:', wsUrl);
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      setIsConnected(true);
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'chat_message') {
        setMessages(prev => [...prev, {
          id: Math.random().toString(),
          message: data.message,
          is_from_admin: data.isFromAdmin,
          created_at: new Date().toISOString()
        }]);
      }
    };

    socket.onclose = () => {
      setIsConnected(false);
      // Reconnect after 3 seconds if still open
      reconnectTimeoutRef.current = setTimeout(() => {
        if (isOpen) {
          connectWebSocket();
        }
      }, 3000);
    };
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;

    const messageData = {
      type: 'chat_message',
      message: newMessage,
      isFromAdmin: user?.role === 'super_admin'
    };

    socketRef.current.send(JSON.stringify(messageData));
    
    // Optimistic update
    setMessages(prev => [...prev, {
      id: Math.random().toString(),
      message: newMessage,
      is_from_admin: user?.role === 'super_admin',
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
              <button 
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-white/10 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

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
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50">
              <div className="relative">
                <Input 
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
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
