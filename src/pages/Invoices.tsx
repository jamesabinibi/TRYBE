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
  Save,
  Loader2,
  Edit2,
  History,
  X
} from 'lucide-react';
import { useAuth } from '../App';
import { useSettings } from '../App';
import { cn } from '../lib/utils';
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
  const [discount, setDiscount] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pastInvoices, setPastInvoices] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');
  const [searchTerm, setSearchTerm] = useState('');
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState<any>(null);

  const brandColor = settings?.brand_color || '#10b981';

  useEffect(() => {
    fetchInventory();
    fetchPastInvoices();
  }, []);

  const fetchPastInvoices = async () => {
    try {
      const res = await fetchWithAuth('/api/sales');
      if (res.ok) {
        const data = await res.json();
        // Filter only those with invoice numbers
        setPastInvoices(data.filter((s: any) => s.invoice_number));
      }
    } catch (error) {
      console.error('Error fetching past invoices:', error);
    }
  };

  const loadInvoice = (invoice: any) => {
    try {
      setInvoiceNumber(invoice.invoice_number || `INV-${Date.now().toString().slice(-6)}`);
      setInvoiceDate(invoice.created_at ? new Date(invoice.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
      setDiscount(invoice.discount_percentage || 0);
      setRecipient({
        name: invoice.customer_name || (invoice.customers?.name) || '',
        email: invoice.customer_email || (invoice.customers?.email) || '', 
        phone: invoice.customer_phone || (invoice.customers?.phone) || '',
        address: invoice.customer_address || (invoice.customers?.address) || ''
      });
      
      if (invoice.sale_items && Array.isArray(invoice.sale_items)) {
        const items: InvoiceItem[] = invoice.sale_items.map((si: any) => ({
          id: si.variant_id || si.service_id || Math.random().toString(),
          name: si.product_variants?.products?.name || si.services?.name || si.product_name || si.service_name || 'Item',
          type: si.service_id ? 'service' : 'product',
          quantity: si.quantity || 0,
          price: si.unit_price || si.price_at_sale || 0,
          total: si.total_price || (si.quantity * (si.unit_price || si.price_at_sale || 0))
        }));
        setInvoiceItems(items);
      } else {
        setInvoiceItems([]);
      }

      setActiveTab('create');
      toast.success('Invoice loaded successfully');
    } catch (error) {
      console.error('Error loading invoice:', error);
      toast.error('Failed to load invoice details');
    }
  };

  const handleDownload = (inv: any) => {
    const mappedItems = inv.sale_items.map((si: any) => {
      const name = si.product_variants?.products?.name || si.services?.name || si.product_name || si.service_name || 'Item';
      const variant = si.product_variants ? ` (${si.product_variants.size || ''}${si.product_variants.color ? ' - ' + si.product_variants.color : ''})` : '';
      return {
        name: name + variant,
        type: si.service_id ? 'service' : 'product',
        quantity: si.quantity || 0,
        price: si.unit_price || si.price_at_sale || 0,
        total: si.total_price || (si.quantity * (si.unit_price || si.price_at_sale || 0))
      };
    });

    const mappedData = {
      items: mappedItems,
      recipient: {
        name: inv.customer_name || inv.customers?.name || 'N/A',
        email: inv.customer_email || inv.customers?.email || '',
        phone: inv.customer_phone || inv.customers?.phone || '',
        address: inv.customer_address || inv.customers?.address || ''
      },
      invoiceNumber: inv.invoice_number,
      invoiceDate: new Date(inv.created_at).toLocaleDateString(),
      discount: inv.discount_percentage || 0
    };

    generatePDF(mappedData);
  };

  const handlePreview = (inv: any) => {
    setPreviewInvoice(inv);
  };

  const saveInvoice = async () => {
    if (invoiceItems.length === 0) {
      toast.error('Please add at least one item');
      return;
    }

    setIsSaving(true);
    try {
      const subtotal = calculateSubtotal();
      const discountAmount = calculateDiscountAmount();
      const vatAmount = calculateVAT();
      const total = subtotal - discountAmount + vatAmount;

      const payload = {
        items: invoiceItems.map(item => ({
          variant_id: item.type === 'product' ? item.id : undefined,
          service_id: item.type === 'service' ? item.id : undefined,
          quantity: item.quantity,
          price_override: item.price
        })),
        customer_name: recipient.name,
        customer_phone: recipient.phone,
        customer_email: recipient.email,
        customer_address: recipient.address,
        invoice_number: invoiceNumber,
        discount_percentage: discount,
        discount_amount: discountAmount,
        vat_amount: vatAmount,
        total_amount: total,
        payment_method: 'Invoice',
        status: 'Pending'
      };

      const res = await fetchWithAuth('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        toast.success('Invoice saved successfully');
        fetchPastInvoices();
        setActiveTab('history');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to save invoice');
      }
    } catch (error) {
      toast.error('An error occurred while saving');
    } finally {
      setIsSaving(false);
    }
  };

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

  const calculateDiscountAmount = () => {
    return (calculateSubtotal() * discount) / 100;
  };

  const calculateVAT = () => {
    if (!settings?.vat_enabled) return 0;
    const afterDiscount = calculateSubtotal() - calculateDiscountAmount();
    return afterDiscount * 0.075; // 7.5% VAT
  };

  const calculateTotal = () => {
    return calculateSubtotal() - calculateDiscountAmount() + calculateVAT();
  };

  const generatePDF = async (externalData?: any) => {
    const isExternal = !!externalData;
    const items = isExternal ? externalData.items : invoiceItems;
    const rec = isExternal ? externalData.recipient : recipient;
    const num = isExternal ? externalData.invoiceNumber : invoiceNumber;
    const date = isExternal ? externalData.invoiceDate : invoiceDate;
    const disc = isExternal ? externalData.discount : discount;

    if (items.length === 0) {
      toast.error('Please add at least one item to the invoice');
      return;
    }
    if (!rec.name) {
      toast.error('Please add recipient name');
      return;
    }

    setIsGenerating(true);
    try {
      const doc = new jsPDF('p', 'mm', 'letter');
      const pageWidth = doc.internal.pageSize.getWidth();
      const brandColor = settings?.brand_color || '#10b981';
      
      // Header
      doc.setFillColor(brandColor);
      doc.rect(0, 0, pageWidth, 40, 'F');
      
      // Logo handling
      if (settings?.logo_url) {
        try {
          const img = new Image();
          img.src = settings.logo_url;
          img.crossOrigin = "anonymous";
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
          });
          doc.addImage(img, 'PNG', 15, 8, 24, 24);
        } catch (e) {
          console.warn('Could not add logo to PDF:', e);
        }
      }

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text(settings?.business_name || 'StockFlow', 45, 25);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('INVOICE', pageWidth - 15, 25, { align: 'right' });
      doc.text(`#${num}`, pageWidth - 15, 32, { align: 'right' });

      // Business Info & Recipient Info
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('From:', 15, 55);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      let fromY = 62;
      doc.text(settings?.business_name || 'StockFlow', 15, fromY);
      fromY += 5;
      if (settings?.email) {
        doc.text(`Email: ${settings.email}`, 15, fromY);
        fromY += 5;
      }
      if (settings?.phone_number) {
        doc.text(`Phone: ${settings.phone_number}`, 15, fromY);
        fromY += 5;
      }
      if (settings?.address) {
        const splitFromAddress = doc.splitTextToSize(settings.address, 75);
        doc.text(splitFromAddress, 15, fromY);
        fromY += (splitFromAddress.length * 5);
      }
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('Bill To:', 120, 55);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      let toY = 62;
      doc.text(rec.name, 120, toY);
      toY += 5;
      if (rec.email) {
        doc.text(rec.email, 120, toY);
        toY += 5;
      }
      if (rec.phone) {
        doc.text(rec.phone, 120, toY);
        toY += 5;
      }
      if (rec.address) {
        const splitAddress = doc.splitTextToSize(rec.address, 75);
        doc.text(splitAddress, 120, toY);
        toY += (splitAddress.length * 5);
      }

      // Invoice Details
      doc.setFont('helvetica', 'bold');
      doc.text('Date:', 15, 85);
      doc.setFont('helvetica', 'normal');
      doc.text(date, 35, 85);

      // Table
      const tableData = items.map((item: any) => [
        item.name,
        item.type.toUpperCase(),
        item.quantity.toString(),
        `${settings?.currency || '₦'}${item.price.toLocaleString()}`,
        `${settings?.currency || '₦'}${item.total.toLocaleString()}`
      ]);

      const subtotal = items.reduce((sum: number, item: any) => sum + item.total, 0);
      const discountAmount = (subtotal * disc) / 100;
      const vatAmount = settings?.vat_enabled ? (subtotal - discountAmount) * 0.075 : 0;
      const total = subtotal - discountAmount + vatAmount;

      (doc as any).autoTable({
        startY: 100,
        head: [['Description', 'Type', 'Qty', 'Unit Price', 'Amount']],
        body: tableData,
        headStyles: { fillColor: brandColor, textColor: 255 },
        foot: [
          ['', '', '', 'Subtotal', `${settings?.currency || '₦'}${subtotal.toLocaleString()}`],
          ['', '', '', `Discount (${disc}%)`, `-${settings?.currency || '₦'}${discountAmount.toLocaleString()}`],
          ['', '', '', 'VAT (7.5%)', `${settings?.currency || '₦'}${vatAmount.toLocaleString()}`],
          ['', '', '', 'Total', `${settings?.currency || '₦'}${total.toLocaleString()}`]
        ],
        footStyles: { fillColor: [245, 245, 245], textColor: 0, fontStyle: 'bold' }
      });

      // Footer
      const finalY = (doc as any).lastAutoTable.finalY + 20;
      doc.setFontSize(10);
      doc.setTextColor(150, 150, 150);
      doc.text('Thank you for your business!', pageWidth / 2, finalY, { align: 'center' });

      doc.save(`${num}.pdf`);
      toast.success('Invoice generated successfully');
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error('Failed to generate PDF. Check console for details.');
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
            {settings?.logo_url ? (
              <div className="w-12 h-12 rounded-xl overflow-hidden shadow-sm border border-slate-100 bg-white">
                <img src={settings.logo_url} alt="Logo" className="w-full h-full object-contain p-1" referrerPolicy="no-referrer" />
              </div>
            ) : (
              <div className="p-2 rounded-xl bg-white shadow-sm border border-slate-100">
                <FileText className="w-6 h-6" style={{ color: brandColor }} />
              </div>
            )}
            {activeTab === 'create' ? 'Create Invoice' : 'Invoice History'}
          </h1>
          <p className="text-slate-500 mt-1">
            {activeTab === 'create' ? 'Generate professional invoices for your clients' : 'View and manage your past invoices'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-xl mr-2">
            <button
              onClick={() => setActiveTab('create')}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-bold transition-all",
                activeTab === 'create' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Create
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-bold transition-all",
                activeTab === 'history' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              History
            </button>
          </div>

          {activeTab === 'create' && (
            <>
              <button
                onClick={saveInvoice}
                disabled={isSaving || invoiceItems.length === 0}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-all disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Save
              </button>
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
            </>
          )}
        </div>
      </div>

      {activeTab === 'history' ? (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-slate-100 dark:border-zinc-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-zinc-800/50">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Invoice #</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Client</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {pastInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <History className="w-12 h-12 opacity-10" />
                        <p className="font-medium">No saved invoices found</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  pastInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/50 transition-colors group">
                      <td className="px-6 py-4">
                        <span className="font-bold text-slate-900 dark:text-white">#{inv.invoice_number}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500 dark:text-zinc-400">
                        {new Date(inv.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 dark:text-white">{inv.customer_name || 'N/A'}</span>
                          <span className="text-xs text-slate-500 dark:text-zinc-400">{inv.customer_phone}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {settings?.currency || '₦'}{inv.total_amount?.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handlePreview(inv)}
                            className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                            title="Preview"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDownload(inv)}
                            className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-all"
                            title="Download PDF"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => loadInvoice(inv)}
                            className="p-2 text-slate-400 hover:text-brand hover:bg-brand/5 rounded-lg transition-all"
                            title="Edit / Load"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Invoice Details & Items */}
        <div className="lg:col-span-2 space-y-6">
          {/* Invoice Header Info */}
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-zinc-800 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Invoice Number</label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium text-slate-900 dark:text-white"
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
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Item Selection */}
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-zinc-800">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Invoice Items</h2>
              <div className="relative">
                <button
                  onClick={() => setShowItemDropdown(!showItemDropdown)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-xl text-sm font-bold text-slate-600 dark:text-zinc-400 transition-colors"
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
                      className="absolute right-0 mt-2 w-80 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-zinc-800 z-50 overflow-hidden"
                    >
                      <div className="p-3 border-bottom border-slate-50 dark:border-zinc-800">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Search inventory..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-zinc-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white"
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
                              className="w-full flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors text-left"
                            >
                              <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${item.price ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'bg-orange-50 dark:bg-orange-900/20 text-orange-600'}`}>
                                  {item.price ? <Wrench className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-slate-900 dark:text-white">{item.name}</p>
                                  <p className="text-xs text-slate-500 dark:text-zinc-400">{item.price ? 'Service' : 'Product'}</p>
                                </div>
                              </div>
                              <p className="text-sm font-black text-slate-900 dark:text-white">
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
                  <tr className="text-left border-b border-slate-50 dark:border-zinc-800">
                    <th className="pb-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Description</th>
                    <th className="pb-4 text-xs font-bold text-slate-400 uppercase tracking-wider w-24">Qty</th>
                    <th className="pb-4 text-xs font-bold text-slate-400 uppercase tracking-wider w-32">Price</th>
                    <th className="pb-4 text-xs font-bold text-slate-400 uppercase tracking-wider w-32">Total</th>
                    <th className="pb-4 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-zinc-800">
                  {invoiceItems.length > 0 ? (
                    invoiceItems.map((item, index) => (
                      <tr key={index} className="group">
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${item.type === 'service' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'bg-orange-50 dark:bg-orange-900/20 text-orange-600'}`}>
                              {item.type === 'service' ? <Wrench className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                            </div>
                            <span className="font-bold text-slate-700 dark:text-zinc-300">{item.name}</span>
                          </div>
                        </td>
                        <td className="py-4">
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateQuantity(index, parseInt(e.target.value))}
                            className="w-20 px-3 py-2 bg-slate-50 dark:bg-zinc-800 border-none rounded-lg text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white"
                          />
                        </td>
                        <td className="py-4">
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">{settings?.currency || '₦'}</span>
                            <input
                              type="number"
                              value={item.price}
                              onChange={(e) => updatePrice(index, parseFloat(e.target.value))}
                              className="w-28 pl-7 pr-3 py-2 bg-slate-50 dark:bg-zinc-800 border-none rounded-lg text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white"
                            />
                          </div>
                        </td>
                        <td className="py-4">
                          <span className="font-black text-slate-900 dark:text-white">
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
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-zinc-800">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
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
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium text-slate-900 dark:text-white"
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
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium text-slate-900 dark:text-white"
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
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium text-slate-900 dark:text-white"
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
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium resize-none text-slate-900 dark:text-white"
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
              
              <div className="flex items-center justify-between text-slate-400">
                <span>Discount (%)</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={discount}
                    onChange={(e) => setDiscount(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                    className="w-16 px-2 py-1 bg-white/10 border-none rounded-lg text-xs font-bold text-white text-right focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
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
    )}
    {previewInvoice && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        >
          <div className="p-8 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-800/50">
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">Invoice Preview</h2>
              <p className="text-slate-500 dark:text-zinc-400 text-sm">#{previewInvoice.invoice_number}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleDownload(previewInvoice)}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl text-white font-bold shadow-lg transition-all hover:scale-105 active:scale-95"
                style={{ backgroundColor: brandColor }}
              >
                <Download className="w-5 h-5" />
                Download PDF
              </button>
              <button
                onClick={() => setPreviewInvoice(null)}
                className="p-3 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400 rounded-2xl transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
            {/* Invoice Content Preview */}
            <div className="flex justify-between items-start">
              <div className="space-y-4">
                {settings?.logo_url ? (
                  <img src={settings.logo_url} alt="Logo" className="h-16 object-contain" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-2xl" style={{ backgroundColor: brandColor }}>
                    {settings?.business_name?.charAt(0) || 'S'}
                  </div>
                )}
                <div>
                  <h3 className="font-black text-xl text-slate-900 dark:text-white">{settings?.business_name || 'StockFlow'}</h3>
                  {settings?.slogan && <p className="text-slate-400 text-[10px] font-bold italic">{settings.slogan}</p>}
                  <div className="mt-2 space-y-0.5">
                    {settings?.email && <p className="text-slate-500 dark:text-zinc-400 text-[10px] font-medium">Email: {settings.email}</p>}
                    {settings?.phone_number && <p className="text-slate-500 dark:text-zinc-400 text-[10px] font-medium">Phone: {settings.phone_number}</p>}
                    {settings?.website && <p className="text-slate-500 dark:text-zinc-400 text-[10px] font-medium">Web: {settings.website}</p>}
                    {settings?.address && <p className="text-slate-500 dark:text-zinc-400 text-[10px] font-medium max-w-[200px]">{settings.address}</p>}
                  </div>
                </div>
              </div>
              <div className="text-right space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Invoice Date</p>
                <p className="font-bold text-slate-900 dark:text-white">{new Date(previewInvoice.created_at).toLocaleDateString()}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-10 pt-10 border-t border-slate-100 dark:border-zinc-800">
              <div className="space-y-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bill To</p>
                <h4 className="font-black text-lg text-slate-900 dark:text-white">{previewInvoice.customer_name || previewInvoice.customers?.name || 'Walk-in Customer'}</h4>
                <div className="space-y-0.5">
                  {(previewInvoice.customer_email || previewInvoice.customers?.email) && (
                    <p className="text-slate-500 dark:text-zinc-400 text-xs">{previewInvoice.customer_email || previewInvoice.customers?.email}</p>
                  )}
                  {(previewInvoice.customer_phone || previewInvoice.customers?.phone) && (
                    <p className="text-slate-500 dark:text-zinc-400 text-xs">{previewInvoice.customer_phone || previewInvoice.customers?.phone}</p>
                  )}
                  {(previewInvoice.customer_address || previewInvoice.customers?.address) && (
                    <p className="text-slate-500 dark:text-zinc-400 text-xs max-w-[200px]">{previewInvoice.customer_address || previewInvoice.customers?.address}</p>
                  )}
                </div>
              </div>
              <div className="space-y-2 text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Payment Method</p>
                <p className="font-bold text-slate-900 dark:text-white">{previewInvoice.payment_method || 'Invoice'}</p>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-100 dark:border-zinc-800 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-zinc-800/50">
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Qty</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Price</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {previewInvoice.sale_items?.map((item: any, idx: number) => {
                    const name = item.product_variants?.products?.name || item.services?.name || item.product_name || item.service_name || 'Item';
                    const variant = item.product_variants ? ` (${item.product_variants.size || ''}${item.product_variants.color ? ' - ' + item.product_variants.color : ''})` : '';
                    return (
                      <tr key={idx}>
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-900 dark:text-white">{name}{variant}</p>
                          <p className="text-[10px] text-slate-400 uppercase font-black">{item.service_id ? 'Service' : 'Product'}</p>
                        </td>
                        <td className="px-6 py-4 text-center font-bold text-slate-600 dark:text-zinc-400">{item.quantity}</td>
                        <td className="px-6 py-4 text-right font-bold text-slate-600 dark:text-zinc-400">{settings?.currency || '₦'}{(item.unit_price || item.price_at_sale || 0).toLocaleString()}</td>
                        <td className="px-6 py-4 text-right font-black text-slate-900 dark:text-white">{settings?.currency || '₦'}{(item.total_price || (item.quantity * (item.unit_price || item.price_at_sale || 0))).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-6">
              <div className="w-full max-w-xs space-y-3">
                <div className="flex justify-between text-slate-500 dark:text-zinc-400 text-sm">
                  <span>Subtotal</span>
                  <span className="font-bold text-slate-900 dark:text-white">{settings?.currency || '₦'}{(previewInvoice.total_amount + (previewInvoice.discount_amount || 0) - (previewInvoice.vat_amount || 0)).toLocaleString()}</span>
                </div>
                {previewInvoice.discount_amount > 0 && (
                  <div className="flex justify-between text-rose-500 text-sm">
                    <span>Discount ({previewInvoice.discount_percentage}%)</span>
                    <span className="font-bold">-{settings?.currency || '₦'}{previewInvoice.discount_amount.toLocaleString()}</span>
                  </div>
                )}
                {previewInvoice.vat_amount > 0 && (
                  <div className="flex justify-between text-slate-500 dark:text-zinc-400 text-sm">
                    <span>VAT (7.5%)</span>
                    <span className="font-bold text-slate-900 dark:text-white">{settings?.currency || '₦'}{previewInvoice.vat_amount.toLocaleString()}</span>
                  </div>
                )}
                <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex justify-between items-center">
                  <span className="text-lg font-black text-slate-900 dark:text-white">Total</span>
                  <span className="text-2xl font-black" style={{ color: brandColor }}>{settings?.currency || '₦'}{previewInvoice.total_amount.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    )}
    </div>
  );
};

export default Invoices;
