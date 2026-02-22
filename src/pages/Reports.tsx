import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Download, 
  Filter, 
  Calendar,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { Sale } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

export default function Reports() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetch('/api/sales')
      .then(res => res.json())
      .then(setSales);
  }, []);

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text('Sales Report', 14, 15);
    
    const tableData = sales.map(s => [
      s.invoice_number,
      new Date(s.created_at).toLocaleDateString(),
      s.staff_name,
      s.payment_method,
      formatCurrency(s.total_amount),
      formatCurrency(s.total_profit)
    ]);

    (doc as any).autoTable({
      head: [['Invoice', 'Date', 'Staff', 'Payment', 'Amount', 'Profit']],
      body: tableData,
      startY: 20,
    });

    doc.save('sales-report.pdf');
  };

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(sales);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sales");
    XLSX.writeFile(wb, "sales-report.xlsx");
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">Reports & Analytics</h1>
          <p className="text-zinc-500 font-medium">Track your business performance and export data.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={exportExcel}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 border border-zinc-200 rounded-2xl text-sm font-bold text-zinc-600 hover:bg-zinc-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Excel
          </button>
          <button 
            onClick={exportPDF}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-zinc-900 text-white rounded-2xl text-sm font-bold hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200 active:scale-95"
          >
            <FileText className="w-4 h-4" />
            PDF Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-zinc-200 shadow-sm relative overflow-hidden group">
          <div className="relative z-10">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Total Revenue</p>
            <h3 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">
              {formatCurrency(sales.reduce((acc, s) => acc + s.total_amount, 0))}
            </h3>
          </div>
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-zinc-50 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500" />
        </div>
        <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-zinc-200 shadow-sm relative overflow-hidden group">
          <div className="relative z-10">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Total Profit</p>
            <h3 className="text-2xl sm:text-3xl font-black text-emerald-600 tracking-tight">
              {formatCurrency(sales.reduce((acc, s) => acc + s.total_profit, 0))}
            </h3>
          </div>
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-emerald-50/30 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500" />
        </div>
        <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-zinc-200 shadow-sm relative overflow-hidden group sm:col-span-2 lg:col-span-1">
          <div className="relative z-10">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Total Transactions</p>
            <h3 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">{sales.length}</h3>
          </div>
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-zinc-50 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500" />
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-zinc-200 shadow-sm overflow-hidden">
        <div className="p-6 sm:p-8 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-50/50">
          <div>
            <h3 className="font-black text-zinc-900 tracking-tight text-lg">Sales History</h3>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">Detailed transaction log</p>
          </div>
          <div className="flex gap-2">
            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-bold text-zinc-600 shadow-sm">
              <Calendar className="w-3.5 h-3.5" />
              This Month
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-zinc-50/30 border-b border-zinc-100">
                <th className="px-8 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Invoice</th>
                <th className="px-8 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Date</th>
                <th className="px-8 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Staff</th>
                <th className="px-8 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Payment</th>
                <th className="px-8 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right">Amount</th>
                <th className="px-8 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right">Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {sales.map((sale) => (
                <tr key={sale.id} className="hover:bg-zinc-50/50 transition-colors group">
                  <td className="px-8 py-5 text-sm font-black text-zinc-900 tracking-tight">{sale.invoice_number}</td>
                  <td className="px-8 py-5 text-sm text-zinc-500 font-medium">
                    {new Date(sale.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-8 py-5 text-sm text-zinc-600 font-bold">{sale.staff_name}</td>
                  <td className="px-8 py-5">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-zinc-100 text-zinc-600">
                      {sale.payment_method}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-sm font-black text-zinc-900 text-right tracking-tight">
                    {formatCurrency(sale.total_amount)}
                  </td>
                  <td className="px-8 py-5 text-sm font-black text-emerald-600 text-right tracking-tight">
                    {formatCurrency(sale.total_profit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {sales.length === 0 && (
          <div className="py-20 text-center">
            <div className="w-20 h-20 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <FileText className="w-10 h-10 text-zinc-200" />
            </div>
            <p className="text-zinc-500 font-bold tracking-tight">No sales data recorded yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
