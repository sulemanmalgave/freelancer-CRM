import { jsPDF } from "jspdf";
import { Invoice, Client, FreelancerProfile } from "../types";
import { formatCurrency } from "../utils";

/**
 * Cleanly generates a professional Invoice PDF document using jsPDF
 */
export function generateInvoicePdfDoc(
  invoice: Invoice,
  client?: Client,
  profile?: FreelancerProfile | null
): jsPDF {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  const currency = profile?.currency || "USD";
  const currencySymbol = currency === "INR" ? "Rs. " : currency === "EUR" ? "EUR " : currency === "GBP" ? "GBP " : "$ ";

  // Header background banner
  doc.setFillColor(30, 41, 59); // Slate-800
  doc.rect(0, 0, pageWidth, 42, "F");

  // Accent highlight bar
  doc.setFillColor(79, 70, 229); // Indigo-600
  doc.rect(0, 42, pageWidth, 3, "F");

  // Business / Freelancer Name in Banner
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  const businessTitle = profile?.businessName || profile?.name || "FREELANCER INVOICE";
  doc.text(businessTitle, margin, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(203, 213, 225); // Slate-300
  const subtitle = profile?.businessName ? profile.name : "Professional Services";
  doc.text(subtitle, margin, 27);

  if (profile?.gmailEmail) {
    doc.text(profile.gmailEmail, margin, 34);
  }

  // Invoice Number & Status on Top Right of Banner
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text(invoice.invoiceNumber, pageWidth - margin, 20, { align: "right" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(165, 180, 252); // Indigo-200
  doc.text(`STATUS: ${invoice.status.toUpperCase()}`, pageWidth - margin, 27, { align: "right" });

  // Reset text color for body
  doc.setTextColor(51, 65, 85); // Slate-700
  let yPos = 58;

  // Metadata Columns: Billed From / Billed To / Invoice Details
  const colWidth = (contentWidth - 10) / 2;

  // Left Column: Billed To (Client)
  doc.setFillColor(248, 250, 252); // Slate-50
  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.roundedRect(margin, yPos, colWidth, 44, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139); // Slate-500
  doc.text("BILLED TO", margin + 6, yPos + 8);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42); // Slate-900
  const clientCompany = client?.companyName || "Client Account";
  doc.text(clientCompany, margin + 6, yPos + 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105); // Slate-600
  let clientLineY = yPos + 23;
  if (client?.contactPerson) {
    doc.text(`Attn: ${client.contactPerson}`, margin + 6, clientLineY);
    clientLineY += 6;
  }
  if (client?.email) {
    doc.text(client.email, margin + 6, clientLineY);
    clientLineY += 6;
  }
  if (client?.phone) {
    doc.text(client.phone, margin + 6, clientLineY);
  }

  // Right Column: Invoice Details (Dates, Currency)
  const rightColX = margin + colWidth + 10;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(rightColX, yPos, colWidth, 44, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text("INVOICE DETAILS", rightColX + 6, yPos + 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);

  doc.text("Invoice Date:", rightColX + 6, yPos + 17);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(new Date(invoice.issueDate).toLocaleDateString(), rightColX + colWidth - 6, yPos + 17, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text("Payment Due:", rightColX + 6, yPos + 25);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(new Date(invoice.dueDate).toLocaleDateString(), rightColX + colWidth - 6, yPos + 25, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text("Currency:", rightColX + 6, yPos + 33);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(currency, rightColX + colWidth - 6, yPos + 33, { align: "right" });

  yPos += 54;

  // Services Table Header
  doc.setFillColor(241, 245, 249); // Slate-100
  doc.setDrawColor(203, 213, 225);
  doc.rect(margin, yPos, contentWidth, 9, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text("DESCRIPTION / DELIVERABLE", margin + 4, yPos + 6);
  doc.text("QTY", margin + contentWidth - 65, yPos + 6, { align: "center" });
  doc.text("RATE", margin + contentWidth - 36, yPos + 6, { align: "right" });
  doc.text("AMOUNT", margin + contentWidth - 4, yPos + 6, { align: "right" });

  yPos += 9;

  // Services Table Rows
  let subtotal = 0;
  invoice.services.forEach((s, idx) => {
    const lineAmount = s.quantity * s.rate;
    subtotal += lineAmount;

    // Row alternating background
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, yPos, contentWidth, 9, "F");
    }

    doc.setDrawColor(241, 245, 249);
    doc.line(margin, yPos + 9, margin + contentWidth, yPos + 9);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);

    // Truncate or fit description
    const desc = s.description || "Project Milestone / Service";
    doc.text(desc, margin + 4, yPos + 6, { maxWidth: contentWidth - 75 });
    doc.text(s.quantity.toString(), margin + contentWidth - 65, yPos + 6, { align: "center" });
    doc.text(`${currencySymbol}${s.rate.toLocaleString()}`, margin + contentWidth - 36, yPos + 6, { align: "right" });
    doc.text(`${currencySymbol}${lineAmount.toLocaleString()}`, margin + contentWidth - 4, yPos + 6, { align: "right" });

    yPos += 9;
  });

  yPos += 4;

  // Totals Section on the right
  const totalsWidth = 75;
  const totalsX = margin + contentWidth - totalsWidth;
  const taxAmount = (subtotal * (invoice.taxRate || 0)) / 100;
  const grandTotal = subtotal + taxAmount;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("Subtotal:", totalsX, yPos + 5);
  doc.setTextColor(30, 41, 59);
  doc.text(`${currencySymbol}${subtotal.toLocaleString()}`, margin + contentWidth - 4, yPos + 5, { align: "right" });
  yPos += 7;

  if (invoice.taxRate > 0) {
    doc.setTextColor(100, 116, 139);
    doc.text(`Tax (${invoice.taxRate}%):`, totalsX, yPos + 5);
    doc.setTextColor(30, 41, 59);
    doc.text(`${currencySymbol}${taxAmount.toLocaleString()}`, margin + contentWidth - 4, yPos + 5, { align: "right" });
    yPos += 7;
  }

  // Grand Total Highlight Bar
  doc.setFillColor(79, 70, 229);
  doc.roundedRect(totalsX - 4, yPos, totalsWidth + 4, 11, 2, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(255, 255, 255);
  doc.text("Total Due:", totalsX + 2, yPos + 7.5);
  doc.text(`${currencySymbol}${grandTotal.toLocaleString()}`, margin + contentWidth - 4, yPos + 7.5, { align: "right" });

  yPos += 18;

  // Notes & Payment Terms
  if (invoice.notes && invoice.notes.trim()) {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, yPos, contentWidth, 24, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text("NOTES & PAYMENT INSTRUCTIONS", margin + 6, yPos + 7);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(invoice.notes.trim(), margin + 6, yPos + 14, { maxWidth: contentWidth - 12 });

    yPos += 28;
  }

  // Footer
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184); // Slate-400
  const footerText = "Thank you for your business! Please contact us if you have any questions regarding this invoice.";
  doc.text(footerText, pageWidth / 2, pageHeight - 12, { align: "center" });

  return doc;
}

/**
 * Returns raw Base64 string of the generated PDF document (without data URI prefix)
 */
export function generateInvoicePdfBase64(
  invoice: Invoice,
  client?: Client,
  profile?: FreelancerProfile | null
): string {
  const doc = generateInvoicePdfDoc(invoice, client, profile);
  const dataUri = doc.output("datauristring");
  const commaIdx = dataUri.indexOf(",");
  return commaIdx !== -1 ? dataUri.substring(commaIdx + 1) : dataUri;
}

/**
 * Prompts download in browser
 */
export function downloadInvoicePdf(
  invoice: Invoice,
  client?: Client,
  profile?: FreelancerProfile | null
): void {
  const doc = generateInvoicePdfDoc(invoice, client, profile);
  const cleanNumber = invoice.invoiceNumber.replace(/[^a-zA-Z0-9-_]/g, "_");
  doc.save(`Invoice_${cleanNumber}.pdf`);
}
