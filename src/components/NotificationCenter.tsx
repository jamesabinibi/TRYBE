import React, { useState, useEffect, useRef } from 'react';
import { Bell, X, Check, Info, AlertTriangle, Package } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useAuth } from '../App';

interface Notification {
  id: number;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  is_read: boolean;
  created_at: string;
}

export default function NotificationCenter({ userId }: { userId: number }) {
  const { fetchWithAuth } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const fetchNotifications = async () => {
    if (!userId || typeof userId !== 'number') return;
    try {
      const response = await fetchWithAuth(`/api/notifications/${userId}`);
      
      if (!response.ok) {
        return;
      }

      const data = await response.json();
      if (Array.isArray(data)) {
        setNotifications(data);
        setUnreadCount(data.filter((n: Notification) => !n.is_read).length);
      }
    } catch (error) {
      // Silently fail for transient network errors (common during server restarts or sleep)
      const isFetchError = error instanceof TypeError || (error as any)?.message?.includes('fetch');
      if (isFetchError) {
        return;
      }
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
      const response = await fetchWithAuth(`/api/notifications/${id}/read`, { method: 'POST' });
      if (response.ok) {
        setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await fetchWithAuth('/api/notifications/all/read', { method: 'POST' });
      if (response.ok) {
        setNotifications(notifications.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const clearAll = async () => {
    if (!confirm('Are you sure you want to clear all notifications?')) return;
    try {
      const response = await fetchWithAuth(`/api/notifications/${userId}`, { method: 'DELETE' });
      if (response.ok) {
        setNotifications([]);
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Failed to clear notifications:', error);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'success': return <Check className="w-4 h-4 text-brand" />;
      case 'error': return <X className="w-4 h-4 text-red-500" />;
      case 'stock': return <Package className="w-4 h-4 text-blue-500" />;
      default: return <Info className="w-4 h-4 text-brand" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-3 text-zinc-500 hover:bg-zinc-100 rounded-2xl relative transition-all active:scale-95 group"
      >
        <Bell className="w-5 h-5 group-hover:rotate-12 transition-transform" />
        {unreadCount > 0 && (
          <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-brand rounded-full border-2 border-white shadow-[0_0_8px_rgba(var(--brand-rgb),0.4)]"></span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-zinc-900 rounded-[2rem] shadow-2xl shadow-zinc-200/50 dark:shadow-none border border-zinc-200 dark:border-zinc-800 overflow-hidden z-50"
          >
              <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/50">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-black text-zinc-950 dark:text-white uppercase tracking-widest">Notifications</h3>
                  {unreadCount > 0 && (
                    <span className="px-2 py-1 bg-brand/10 text-brand rounded-lg text-[10px] font-black">
                      {unreadCount} New
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  {notifications.length > 0 && (
                    <>
                      <button 
                        onClick={markAllAsRead}
                        className="text-[10px] font-black text-brand uppercase tracking-widest hover:opacity-70 transition-opacity"
                        title="Mark all as read"
                      >
                        Read All
                      </button>
                      <button 
                        onClick={clearAll}
                        className="text-[10px] font-black text-red-500 uppercase tracking-widest hover:opacity-70 transition-opacity"
                        title="Clear all"
                      >
                        Clear
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                {notifications.length > 0 ? (
                  <div className="divide-y divide-zinc-50 dark:divide-zinc-800">
                    {notifications.map((notification) => (
                      <div 
                        key={notification.id}
                        className={cn(
                          "p-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800 flex gap-4 cursor-pointer",
                          !notification.is_read ? "bg-brand/5 dark:bg-brand/10" : ""
                        )}
                        onClick={() => markAsRead(notification.id)}
                      >
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border",
                          !notification.is_read ? "bg-white dark:bg-zinc-800 border-brand/20" : "bg-zinc-50 dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800"
                        )}>
                          {getIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-black text-zinc-950 dark:text-white truncate tracking-tight">
                              {notification.title}
                            </p>
                            <span className="text-[10px] font-bold text-zinc-400">
                              {new Date(notification.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed line-clamp-2">
                            {notification.message}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-12 text-center">
                    <div className="w-12 h-12 bg-zinc-50 dark:bg-zinc-800 rounded-2xl flex items-center justify-center text-zinc-300 dark:text-zinc-700 mx-auto mb-4">
                      <Bell className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-bold text-zinc-400 dark:text-zinc-500 tracking-tight">No notifications yet</p>
                  </div>
                )}
              </div>

              <div className="p-4 bg-zinc-50/50 dark:bg-zinc-800/50 border-t border-zinc-100 dark:border-zinc-800 text-center">
                <button 
                  onClick={() => {
                    alert("You are viewing the most recent 50 notifications.");
                  }}
                  className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest hover:text-brand transition-colors"
                >
                  View All Notifications
                </button>
              </div>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
