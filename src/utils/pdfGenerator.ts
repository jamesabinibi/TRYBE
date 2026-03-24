import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generatePDF = async (data: any, settings: any) => {
  const items = data.items;
  const rec = data.recipient;
  const num = data.invoiceNumber;
  const date = data.invoiceDate;
  const disc = data.discount;

  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter'
    });
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Handle potential gradient brand color
    let brandColor = settings?.brand_color || '#10b981';
    if (brandColor.includes('gradient')) {
      const hexMatch = brandColor.match(/#[a-fA-F0-9]{3,6}/);
      brandColor = hexMatch ? hexMatch[0] : '#10b981';
    }
    
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
          setTimeout(() => reject(new Error('Logo load timeout')), 3000);
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

    // Business Info
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(10);
    let y = 55;
    doc.setFont('helvetica', 'bold');
    doc.text('FROM:', 15, y);
    doc.setFont('helvetica', 'normal');
    y += 5;
    doc.text(settings?.business_name || 'StockFlow', 15, y);
    if (settings?.email) { y += 5; doc.text(settings.email, 15, y); }
    if (settings?.phone_number) { y += 5; doc.text(settings.phone_number, 15, y); }
    if (settings?.address) { y += 5; doc.text(settings.address, 15, y); }

    // Recipient Info
    y = 55;
    doc.setFont('helvetica', 'bold');
    doc.text('BILL TO:', 120, y);
    doc.setFont('helvetica', 'normal');
    y += 5;
    doc.text(rec.name, 120, y);
    if (rec.email) { y += 5; doc.text(rec.email, 120, y); }
    if (rec.phone) { y += 5; doc.text(rec.phone, 120, y); }
    if (rec.address) { y += 5; doc.text(rec.address, 120, y); }

    // Invoice Meta
    y = 100;
    doc.setDrawColor(230, 230, 230);
    doc.line(15, y, pageWidth - 15, y);
    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.text(`Invoice #: ${num}`, 15, y);
    doc.text(`Date: ${date}`, pageWidth - 15, y, { align: 'right' });
    y += 10;

    // Table
    const tableData = items.map((item: any) => [
      item.name,
      item.quantity.toString(),
      new Intl.NumberFormat('en-NG', { style: 'currency', currency: settings?.currency || 'NGN' }).format(item.price),
      new Intl.NumberFormat('en-NG', { style: 'currency', currency: settings?.currency || 'NGN' }).format(item.total)
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Item', 'Qty', 'Price', 'Total']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: brandColor, textColor: 255 },
      styles: { fontSize: 9, cellPadding: 5 },
      columnStyles: {
        1: { halign: 'center' },
        2: { halign: 'right' },
        3: { halign: 'right' }
      }
    });

    // Totals
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    const subtotal = items.reduce((sum: number, item: any) => sum + item.total, 0);
    const discountAmount = (subtotal * disc) / 100;
    const total = subtotal - discountAmount;

    doc.setFont('helvetica', 'normal');
    doc.text('Subtotal:', pageWidth - 60, finalY);
    doc.text(new Intl.NumberFormat('en-NG', { style: 'currency', currency: settings?.currency || 'NGN' }).format(subtotal), pageWidth - 15, finalY, { align: 'right' });
    
    if (disc > 0) {
      doc.text(`Discount (${disc}%):`, pageWidth - 60, finalY + 7);
      doc.text(`-${new Intl.NumberFormat('en-NG', { style: 'currency', currency: settings?.currency || 'NGN' }).format(discountAmount)}`, pageWidth - 15, finalY + 7, { align: 'right' });
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Total:', pageWidth - 60, finalY + 15);
    doc.text(new Intl.NumberFormat('en-NG', { style: 'currency', currency: settings?.currency || 'NGN' }).format(total), pageWidth - 15, finalY + 15, { align: 'right' });

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Thank you for your business!', pageWidth / 2, 260, { align: 'center' });

    doc.save(`Invoice_${num}.pdf`);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};
