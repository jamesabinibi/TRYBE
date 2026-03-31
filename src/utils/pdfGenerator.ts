import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generatePDF = async (data: any, settings: any) => {
  const items = data.items;
  const rec = data.recipient;
  const num = data.invoiceNumber;
  const date = data.invoiceDate;
  const disc = parseFloat(data.discount) || 0;
  const invoiceTerms = data.invoiceTerms;
  const vatEnabled = data.vatEnabled;
  const vatAmount = parseFloat(data.vatAmount) || 0;

  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter'
    });
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Handle potential gradient brand color
    let brandColor = settings?.brand_color || '#ff4d00';
    if (brandColor.includes('gradient')) {
      const hexMatch = brandColor.match(/#[a-fA-F0-9]{3,6}/);
      brandColor = hexMatch ? hexMatch[0] : '#ff4d00';
    }
    
    // Header Background
    doc.setFillColor(brandColor);
    doc.rect(0, 0, pageWidth, 60, 'F');
    
    // Logo handling
    let logoLoaded = false;
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
        doc.addImage(img, 'PNG', 20, 15, 30, 30);
        logoLoaded = true;
      } catch (e) {
        console.warn('Could not add logo to PDF:', e);
      }
    }

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.text(settings?.business_name || 'Gryndee', logoLoaded ? 55 : 20, 35);
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('INVOICE', pageWidth - 20, 25, { align: 'right' });
    doc.setFontSize(10);
    doc.text(`#${num}`, pageWidth - 20, 32, { align: 'right' });
    doc.text(date, pageWidth - 20, 39, { align: 'right' });

    // Content area
    doc.setTextColor(40, 40, 40);
    let y = 80;

    // Info Grid
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(150, 150, 150);
    doc.text('FROM', 20, y);
    doc.text('BILL TO', 110, y);

    y += 7;
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(settings?.business_name || 'Gryndee', 20, y);
    doc.text(rec.name, 110, y);

    y += 5;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    
    // Business details
    let busY = y;
    if (settings?.email) { doc.text(settings.email, 20, busY); busY += 5; }
    if (settings?.phone_number) { doc.text(settings.phone_number, 20, busY); busY += 5; }
    if (settings?.address) { 
      const addrLines = doc.splitTextToSize(settings.address, 70);
      doc.text(addrLines, 20, busY);
      busY += (addrLines.length * 5);
    }

    // Recipient details
    let recY = y;
    if (rec.email) { doc.text(rec.email, 110, recY); recY += 5; }
    if (rec.phone) { doc.text(rec.phone, 110, recY); recY += 5; }
    if (rec.address) {
      const addrLines = doc.splitTextToSize(rec.address, 70);
      doc.text(addrLines, 110, recY);
      recY += (addrLines.length * 5);
    }

    y = Math.max(busY, recY) + 15;

    // Table
    const tableData = items.map((item: any) => [
      item.name,
      item.quantity.toString(),
      (settings?.currency || 'NGN') + ' ' + (parseFloat(item.price) || 0).toLocaleString('en-NG', { minimumFractionDigits: 0 }),
      (settings?.currency || 'NGN') + ' ' + (parseFloat(item.total) || 0).toLocaleString('en-NG', { minimumFractionDigits: 0 })
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Description', 'Qty', 'Unit Price', 'Total']],
      body: tableData,
      theme: 'grid',
      headStyles: { 
        fillColor: [40, 40, 40], 
        textColor: 255,
        fontSize: 10,
        fontStyle: 'bold',
        halign: 'left'
      },
      styles: { 
        fontSize: 9, 
        cellPadding: 6,
        lineColor: [240, 240, 240],
        lineWidth: 0.1
      },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { halign: 'center', cellWidth: 20 },
        2: { halign: 'right', cellWidth: 40 },
        3: { halign: 'right', cellWidth: 40, fontStyle: 'bold' }
      },
      alternateRowStyles: {
        fillColor: [252, 252, 252]
      }
    });

    // Totals
    const finalY = (doc as any).lastAutoTable.finalY + 15;
    const subtotal = items.reduce((sum: number, item: any) => sum + (parseFloat(item.total) || 0), 0);
    const discountAmount = (subtotal * disc) / 100;
    const total = subtotal - discountAmount + (vatEnabled ? vatAmount : 0);

    const rightColX = pageWidth - 20;
    const labelX = pageWidth - 70;

    // Bank Details
    if (settings?.bank_name || settings?.account_name || settings?.account_number) {
      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      doc.setFont('helvetica', 'bold');
      doc.text('PAYMENT DETAILS', 20, finalY);
      
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.setFont('helvetica', 'normal');
      let bankY = finalY + 6;
      
      if (settings?.bank_name) {
        doc.setFont('helvetica', 'bold');
        doc.text('Bank:', 20, bankY);
        doc.setFont('helvetica', 'normal');
        doc.text(settings.bank_name, 35, bankY);
        bankY += 5;
      }
      if (settings?.account_name) {
        doc.setFont('helvetica', 'bold');
        doc.text('Account Name:', 20, bankY);
        doc.setFont('helvetica', 'normal');
        doc.text(settings.account_name, 45, bankY);
        bankY += 5;
      }
      if (settings?.account_number) {
        doc.setFont('helvetica', 'bold');
        doc.text('Account Number:', 20, bankY);
        doc.setFont('helvetica', 'normal');
        doc.text(settings.account_number, 48, bankY);
      }
    }

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    
    doc.text('Subtotal:', labelX, finalY);
    doc.text(new Intl.NumberFormat('en-NG', { style: 'currency', currency: settings?.currency || 'NGN', minimumFractionDigits: 0 }).format(subtotal), rightColX, finalY, { align: 'right' });
    
    let totalY = finalY;
    if (disc > 0) {
      totalY += 8;
      doc.setTextColor(16, 185, 129); // Emerald color for discount
      doc.text(`Discount (${disc}%):`, labelX, totalY);
      doc.text(`-${new Intl.NumberFormat('en-NG', { style: 'currency', currency: settings?.currency || 'NGN', minimumFractionDigits: 0 }).format(discountAmount)}`, rightColX, totalY, { align: 'right' });
    }

    if (vatEnabled && vatAmount > 0) {
      totalY += 8;
      doc.setTextColor(100, 100, 100);
      doc.text(`VAT (7.5%):`, labelX, totalY);
      doc.text(new Intl.NumberFormat('en-NG', { style: 'currency', currency: settings?.currency || 'NGN', minimumFractionDigits: 0 }).format(vatAmount), rightColX, totalY, { align: 'right' });
    }

    totalY += 12;
    doc.setDrawColor(40, 40, 40);
    doc.setLineWidth(0.5);
    doc.line(labelX, totalY - 5, rightColX, totalY - 5);
    
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Total:', labelX, totalY + 2);
    doc.text(new Intl.NumberFormat('en-NG', { style: 'currency', currency: settings?.currency || 'NGN', minimumFractionDigits: 0 }).format(total), rightColX, totalY + 2, { align: 'right' });

    // Footer
    const footerY = 260;
    doc.setDrawColor(240, 240, 240);
    doc.setLineWidth(0.1);
    doc.line(20, footerY - 10, pageWidth - 20, footerY - 10);
    
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.setFont('helvetica', 'normal');
    
    const termsText = invoiceTerms || settings?.invoice_terms || 'Thank you for your business!';
    const splitTerms = doc.splitTextToSize(termsText, pageWidth - 40);
    
    // Adjust footerY based on terms length
    const adjustedFooterY = footerY - (splitTerms.length - 1) * 4;
    
    doc.text(splitTerms, pageWidth / 2, adjustedFooterY, { align: 'center' });
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(settings?.business_name || 'Gryndee', pageWidth / 2, adjustedFooterY + (splitTerms.length * 4) + 1, { align: 'center' });

    doc.save(`Invoice_${num}.pdf`);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};
