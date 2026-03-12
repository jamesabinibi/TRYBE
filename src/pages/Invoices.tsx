import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Download, 
  FileText, 
  Search, 
  User, 
  Mail, 
  Phone, 
  MapPin,
  Calendar,
  Hash,
  Package,
  Wrench,
  ChevronDown,
  Printer,
  Save
} from 'lucide-react';
import { useAuth } from '../App';
import { useSettings } from '../App';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface InvoiceItem {
  id: string;
  name: string;
  type: 'product' | 'service';
  quantity: number;
  price: number;
  total: number;
}

interface Recipient {
  name: string;
  email: string;
  phone: string;
  address: string;
}

const Invoices: React.FC = () => {
  const { fetchWithAuth } = useAuth();
  const { settings } = useSettings();
  const [products, setProducts] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [recipient, setRecipient] = useState<Recipient>({
    name: '',
    email: '',
    phone: '',
    address: ''
  });
  const [invoiceNumber, setInvoiceNumber] = useState(`INV-${Date.now().toString().slice(-6)}`);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showItemDropdown, setShowItemDropdown] = useState(false);

  const brandColor = settings?.brand_color || '#10b981';

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      const [productsRes, servicesRes] = await Promise.all([
        fetchWithAuth('/api/products'),
        fetchWithAuth('/api/services')
      ]);

      if (productsRes.ok) setProducts(await productsRes.json());
      if (servicesRes.ok) setServices(await servicesRes.json());
    } catch (error) {
      console.error('Error fetching inventory:', error);
      toast.error('Failed to load inventory items');
    }
  };

  const addItem = (item: any, type: 'product' | 'service') => {
    const newItem: InvoiceItem = {
      id: item.id,
      name: item.name,
      type,
      quantity: 1,
      price: type === 'product' ? item.selling_price : item.price,
      total: type === 'product' ? item.selling_price : item.price
    };
    setInvoiceItems([...invoiceItems, newItem]);
    setShowItemDropdown(false);
    setSearchTerm('');
  };

  const removeItem = (index: number) => {
    setInvoiceItems(invoiceItems.filter((_, i) => i !== index));
  };

  const updateQuantity = (index: number, qty: number) => {
    const updated = [...invoiceItems];
    updated[index].quantity = Math.max(1, qty);
    updated[index].total = updated[index].quantity * updated[index].price;
    setInvoiceItems(updated);
  };

  const updatePrice = (index: number, price: number) => {
    const updated = [...invoiceItems];
    updated[index].price = Math.max(0, price);
    updated[index].total = updated[index].quantity * updated[index].price;
    setInvoiceItems(updated);
  };

  const calculateSubtotal = () => {
    return invoiceItems.reduce((sum, item) => sum + item.total, 0);
  };

  const calculateVAT = () => {
    if (!settings?.vat_enabled) return 0;
    return calculateSubtotal() * 0.075; // 7.5% VAT
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateVAT();
  };

  const generatePDF = () => {
    if (invoiceItems.length === 0) {
      toast.error('Please add at least one item to the invoice');
      return;
    }
    if (!recipient.name) {
      toast.error('Please add recipient name');
      return;
    }

    setIsGenerating(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Header
      doc.setFillColor(brandColor);
      doc.rect(0, 0, pageWidth, 40, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text(settings?.business_name || 'StockFlow', 15, 25);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('INVOICE', pageWidth - 15, 25, { align: 'right' });
      doc.text(`#${invoiceNumber}`, pageWidth - 15, 32, { align: 'right' });

      // Business Info & Recipient Info
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('From:', 15, 55);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(settings?.business_name || 'StockFlow', 15, 62);
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('Bill To:', 120, 55);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(recipient.name, 120, 62);
      if (recipient.email) doc.text(recipient.email, 120, 67);
      if (recipient.phone) doc.text(recipient.phone, 120, 72);
      if (recipient.address) {
        const splitAddress = doc.splitTextToSize(recipient.address, 75);
        doc.text(splitAddress, 120, 77);
      }

      // Invoice Details
      doc.setFont('helvetica', 'bold');
      doc.text('Date:', 15, 85);
      doc.setFont('helvetica', 'normal');
      doc.text(invoiceDate, 35, 85);

      // Table
      const tableData = invoiceItems.map(item => [
        item.name,
        item.type.toUpperCase(),
        item.quantity.toString(),
        `${settings?.currency || '₦'}${item.price.toLocaleString()}`,
        `${settings?.currency || '₦'}${item.total.toLocaleString()}`
      ]);

      (doc as any).autoTable({
        startY: 100,
        head: [['Description', 'Type', 'Qty', 'Unit Price', 'Amount']],
        body: tableData,
        headStyles: { fillColor: brandColor, textColor: 255 },
        foot: [
          ['', '', '', 'Subtotal', `${settings?.currency || '₦'}${calculateSubtotal().toLocaleString()}`],
          ['', '', '', 'VAT (7.5%)', `${settings?.currency || '₦'}${calculateVAT().toLocaleString()}`],
          ['', '', '', 'Total', `${settings?.currency || '₦'}${calculateTotal().toLocaleString()}`]
        ],
        footStyles: { fillColor: [245, 245, 245], textColor: 0, fontStyle: 'bold' }
      });

      // Footer
      const finalY = (doc as any).lastAutoTable.finalY + 20;
      doc.setFontSize(10);
      doc.setTextColor(150, 150, 150);
      doc.text('Thank you for your business!', pageWidth / 2, finalY, { align: 'center' });

      doc.save(`${invoiceNumber}.pdf`);
      toast.success('Invoice generated successfully');
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error('Failed to generate PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  const filteredItems = [...products, ...services].filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white shadow-sm border border-slate-100">
              <FileText className="w-6 h-6" style={{ color: brandColor }} />
            </div>
            Create Invoice
          </h1>
          <p className="text-slate-500 mt-1">Generate professional invoices for your clients</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={generatePDF}
            disabled={isGenerating}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-bold shadow-lg shadow-emerald-200 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100"
            style={{ backgroundColor: brandColor }}
          >
            {isGenerating ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Download className="w-5 h-5" />
            )}
            {isGenerating ? 'Generating...' : 'Download PDF'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Invoice Details & Items */}
        <div className="lg:col-span-2 space-y-6">
          {/* Invoice Header Info */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Invoice Number</label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Invoice Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium"
                />
              </div>
            </div>
          </div>

          {/* Item Selection */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-900">Invoice Items</h2>
              <div className="relative">
                <button
                  onClick={() => setShowItemDropdown(!showItemDropdown)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl text-sm font-bold text-slate-600 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Item
                  <ChevronDown className={`w-4 h-4 transition-transform ${showItemDropdown ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {showItemDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden"
                    >
                      <div className="p-3 border-bottom border-slate-50">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Search inventory..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20"
                            autoFocus
                          />
                        </div>
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        {filteredItems.length > 0 ? (
                          filteredItems.map((item) => (
                            <button
                              key={`${item.id}-${item.price ? 'service' : 'product'}`}
                              onClick={() => addItem(item, item.price ? 'service' : 'product')}
                              className="w-full flex items-center justify-between p-3 hover:bg-slate-50 transition-colors text-left"
                            >
                              <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${item.price ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                                  {item.price ? <Wrench className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-slate-900">{item.name}</p>
                                  <p className="text-xs text-slate-500">{item.price ? 'Service' : 'Product'}</p>
                                </div>
                              </div>
                              <p className="text-sm font-black text-slate-900">
                                {settings?.currency || '₦'}{(item.price || item.selling_price || 0).toLocaleString()}
                              </p>
                            </button>
                          ))
                        ) : (
                          <div className="p-8 text-center text-slate-400">
                            <Search className="w-8 h-8 mx-auto mb-2 opacity-20" />
                            <p className="text-sm">No items found</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left border-b border-slate-50">
                    <th className="pb-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Description</th>
                    <th className="pb-4 text-xs font-bold text-slate-400 uppercase tracking-wider w-24">Qty</th>
                    <th className="pb-4 text-xs font-bold text-slate-400 uppercase tracking-wider w-32">Price</th>
                    <th className="pb-4 text-xs font-bold text-slate-400 uppercase tracking-wider w-32">Total</th>
                    <th className="pb-4 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {invoiceItems.length > 0 ? (
                    invoiceItems.map((item, index) => (
                      <tr key={index} className="group">
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${item.type === 'service' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                              {item.type === 'service' ? <Wrench className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                            </div>
                            <span className="font-bold text-slate-700">{item.name}</span>
                          </div>
                        </td>
                        <td className="py-4">
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateQuantity(index, parseInt(e.target.value))}
                            className="w-20 px-3 py-2 bg-slate-50 border-none rounded-lg text-sm font-bold focus:ring-2 focus:ring-emerald-500/20"
                          />
                        </td>
                        <td className="py-4">
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">{settings?.currency || '₦'}</span>
                            <input
                              type="number"
                              value={item.price}
                              onChange={(e) => updatePrice(index, parseFloat(e.target.value))}
                              className="w-28 pl-7 pr-3 py-2 bg-slate-50 border-none rounded-lg text-sm font-bold focus:ring-2 focus:ring-emerald-500/20"
                            />
                          </div>
                        </td>
                        <td className="py-4">
                          <span className="font-black text-slate-900">
                            {settings?.currency || '₦'}{item.total.toLocaleString()}
                          </span>
                        </td>
                        <td className="py-4">
                          <button
                            onClick={() => removeItem(index)}
                            className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center gap-2">
                          <Package className="w-12 h-12 opacity-10" />
                          <p className="font-medium">No items added yet</p>
                          <p className="text-xs">Click "Add Item" to start building your invoice</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Recipient & Totals */}
        <div className="space-y-6">
          {/* Recipient Info */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <User className="w-5 h-5 text-slate-400" />
              Recipient Details
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Client Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="John Doe"
                    value={recipient.name}
                    onChange={(e) => setRecipient({ ...recipient, name: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    placeholder="john@example.com"
                    value={recipient.email}
                    onChange={(e) => setRecipient({ ...recipient, email: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="tel"
                    placeholder="+234..."
                    value={recipient.phone}
                    onChange={(e) => setRecipient({ ...recipient, phone: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Address</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <textarea
                    placeholder="123 Street, City, Country"
                    value={recipient.address}
                    onChange={(e) => setRecipient({ ...recipient, address: e.target.value })}
                    rows={3}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium resize-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Totals */}
          <div className="bg-slate-900 rounded-3xl p-6 shadow-xl text-white">
            <h2 className="text-lg font-bold mb-6">Summary</h2>
            <div className="space-y-4">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal</span>
                <span className="font-bold">{settings?.currency || '₦'}{calculateSubtotal().toLocaleString()}</span>
              </div>
              {settings?.vat_enabled && (
                <div className="flex justify-between text-slate-400">
                  <span>VAT (7.5%)</span>
                  <span className="font-bold">{settings?.currency || '₦'}{calculateVAT().toLocaleString()}</span>
                </div>
              )}
              <div className="pt-4 border-t border-white/10 flex justify-between items-end">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Total Amount</p>
                  <p className="text-3xl font-black mt-1">
                    {settings?.currency || '₦'}{calculateTotal().toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Invoices;
