import React, { useState, useEffect } from 'react';
import { Bell, X, Check, Info, AlertTriangle, Package } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface Notification {
  id: number;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  is_read: number;
  created_at: string;
}

export default function NotificationCenter({ userId }: { userId: number }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = async () => {
    if (!userId) return;
    try {
      const response = await fetch(`/api/notifications/${userId}`);
      const contentType = response.headers.get("content-type");
      
      if (response.ok && contentType && contentType.includes("application/json")) {
        const data = await response.json();
        setNotifications(data);
        setUnreadCount(data.filter((n: Notification) => n.is_read === 0).length);
      } else {
        const text = await response.text();
        console.warn(`[Notifications] Expected JSON but got ${contentType}. Status: ${response.status}`);
        if (!response.ok) {
          console.error(`[Notifications] Fetch failed with status ${response.status}: ${text.substring(0, 100)}`);
        }
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchNotifications();
      // Poll for new notifications every 30 seconds
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [userId]);

  const markAsRead = async (id: number) => {
    try {
      const response = await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
      if (response.ok) {
        setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: 1 } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'success': return <Check className="w-4 h-4 text-emerald-500" />;
      case 'error': return <X className="w-4 h-4 text-red-500" />;
      case 'stock': return <Package className="w-4 h-4 text-blue-500" />;
      default: return <Info className="w-4 h-4 text-emerald-500" />;
    }
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-3 text-zinc-500 hover:bg-zinc-100 rounded-2xl relative transition-all active:scale-95 group"
      >
        <Bell className="w-5 h-5 group-hover:rotate-12 transition-transform" />
        {unreadCount > 0 && (
          <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white shadow-[0_0_8px_rgba(16,185,129,0.4)]"></span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-[2rem] shadow-2xl shadow-zinc-200/50 border border-zinc-200 overflow-hidden z-50"
            >
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                <h3 className="text-sm font-black text-zinc-900 uppercase tracking-widest">Notifications</h3>
                <span className="px-2 py-1 bg-emerald-100 text-emerald-600 rounded-lg text-[10px] font-black">
                  {unreadCount} New
                </span>
              </div>

              <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                {notifications.length > 0 ? (
                  <div className="divide-y divide-zinc-50">
                    {notifications.map((notification) => (
                      <div 
                        key={notification.id}
                        className={cn(
                          "p-4 transition-colors hover:bg-zinc-50 flex gap-4",
                          notification.is_read === 0 ? "bg-emerald-50/30" : ""
                        )}
                        onClick={() => markAsRead(notification.id)}
                      >
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border",
                          notification.is_read === 0 ? "bg-white border-emerald-100" : "bg-zinc-50 border-zinc-100"
                        )}>
                          {getIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-black text-zinc-900 truncate tracking-tight">
                              {notification.title}
                            </p>
                            <span className="text-[10px] font-bold text-zinc-400">
                              {new Date(notification.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2">
                            {notification.message}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-12 text-center">
                    <div className="w-12 h-12 bg-zinc-50 rounded-2xl flex items-center justify-center text-zinc-300 mx-auto mb-4">
                      <Bell className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-bold text-zinc-400 tracking-tight">No notifications yet</p>
                  </div>
                )}
              </div>

              <div className="p-4 bg-zinc-50/50 border-t border-zinc-100 text-center">
                <button className="text-[10px] font-black text-zinc-400 uppercase tracking-widest hover:text-emerald-600 transition-colors">
                  View All Notifications
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
