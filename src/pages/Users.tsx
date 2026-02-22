import React, { useState, useEffect } from 'react';
import { Users as UsersIcon, Plus, Shield, User as UserIcon, MoreVertical } from 'lucide-react';
import { User } from '../types';
import { cn } from '../lib/utils';

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    // In a real app, we'd have an API for this. 
    // For now, let's just show the current user and maybe some mock ones if we had a route.
    // I'll add a route to server.ts for users if I have time, but let's stick to basics.
    setUsers([
      { id: 1, username: 'admin', role: 'admin', name: 'System Admin' },
      { id: 2, username: 'manager1', role: 'manager', name: 'John Manager' },
      { id: 3, username: 'staff1', role: 'staff', name: 'Sarah Sales' },
    ]);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">User Management</h1>
          <p className="text-zinc-500">Manage staff accounts and permissions.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm">
          <Plus className="w-4 h-4" />
          Add User
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-50 border-bottom border-zinc-200">
              <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">User</th>
              <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Role</th>
              <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-zinc-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400">
                      <UserIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-900">{user.name}</p>
                      <p className="text-xs text-zinc-500">@{user.username}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Shield className={cn(
                      "w-4 h-4",
                      user.role === 'admin' ? "text-purple-500" : 
                      user.role === 'manager' ? "text-blue-500" : "text-zinc-400"
                    )} />
                    <span className="text-sm font-medium capitalize text-zinc-700">{user.role}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                    Active
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
