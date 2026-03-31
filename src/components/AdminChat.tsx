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
  created_at: string;
  message: string;
}

interface Message {
  id: string;
  message: string;
  is_from_admin: boolean;
  created_at: string;
}

export default function AdminChat({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user, fetchWithAuth } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      fetchSessions();
      connectWebSocket();
    }
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (selectedSession) {
      fetchMessages(selectedSession);
    }
  }, [selectedSession]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchSessions = async () => {
    try {
      const res = await fetchWithAuth('/api/chat/admin/sessions');
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
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
        setMessages(data);
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  };

  const connectWebSocket = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}?userId=${user?.id}&accountId=${user?.account_id}`;
    
    console.log('Admin connecting to WebSocket:', wsUrl);
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      setIsConnected(true);
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'chat_message') {
        // Refresh sessions to show latest message
        fetchSessions();
        
        // If we are currently viewing this chat, append the message
        if (selectedSession) {
          const targetId = selectedSession.user_id || selectedSession.guest_id;
          if (data.fromUserId === targetId || data.isFromAdmin) {
            setMessages(prev => [...prev, {
              id: Math.random().toString(),
              message: data.message,
              is_from_admin: data.isFromAdmin,
              created_at: new Date().toISOString()
            }]);
          }
        }
      }
    };

    socket.onclose = () => {
      setIsConnected(false);
      // Reconnect after 3 seconds if modal is still open
      if (isOpen) {
        setTimeout(connectWebSocket, 3000);
      }
    };
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN || !selectedSession) return;

    const targetId = selectedSession.user_id || selectedSession.guest_id;

    const messageData = {
      type: 'chat_message',
      message: newMessage,
      targetUserId: targetId,
      isFromAdmin: true
    };

    socketRef.current.send(JSON.stringify(messageData));
    
    // Optimistic update
    setMessages(prev => [...prev, {
      id: Math.random().toString(),
      message: newMessage,
      is_from_admin: true,
      created_at: new Date().toISOString()
    }]);
    
    setNewMessage('');
    fetchSessions(); // Update last message in sidebar
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
                  <div className={cn("w-2 h-2 rounded-full", isConnected ? "bg-emerald-400" : "bg-zinc-400")} />
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
                const displayName = session.user_id ? `User ${session.user_id.substring(0, 8)}` : `Guest ${session.guest_id?.substring(6, 14)}`;
                
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
                      <span className="font-bold text-sm">{displayName}</span>
                      <span className={cn(
                        "text-[10px] font-bold uppercase tracking-widest",
                        isSelected ? "text-white/80" : "text-zinc-400"
                      )}>
                        {new Date(session.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className={cn(
                      "text-xs truncate",
                      isSelected ? "text-white/90" : "text-zinc-500 dark:text-zinc-400"
                    )}>
                      {session.message}
                    </p>
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
              <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500">
                  <UserIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-900 dark:text-white">
                    {selectedSession.user_id ? `User ${selectedSession.user_id}` : `Guest ${selectedSession.guest_id}`}
                  </h3>
                  {selectedSession.account_id && (
                    <p className="text-xs text-zinc-500">Account: {selectedSession.account_id}</p>
                  )}
                </div>
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
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                <div className="relative">
                  <Input 
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
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
