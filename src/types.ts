export interface FreelancerProfile {
  id: string;
  name: string;
  email?: string;
  businessName: string;
  currency: string;
  country: string;
  billingCountry?: string;
  plan: "Free" | "Pro" | "Monthly" | "Annual" | "3 Months" | string;
  onboardingCompleted: boolean;
  createdAt: string;
  subscriptionStatus?: "active" | "cancelled" | "inactive";
  subscriptionRegion?: "IN" | "US" | "Other" | string;
  subscriptionMethod?: "UPI" | "Stripe" | "Razorpay" | "PayPal" | string;
  subscriptionRenewsAt?: string;
  premium?: boolean;
  paymentGateway?: "Razorpay" | "PayPal" | string;
  purchaseDate?: string;
  expiryDate?: string;
  transactionId?: string;
  razorpayKeyId?: string;
  razorpayKeySecret?: string;
  gmailConnected?: boolean;
  gmailEmail?: string;
  gmailName?: string;
  gmailPicture?: string;
  gmailConnectedAt?: string;
}

export interface ImportantLink {
  id: string;
  name: string;
  url: string;
}

export interface ClientPortalSettings {
  enabled: boolean;
  shareProjects: boolean;
  shareInvoices: boolean;
  shareDocuments: boolean;
  shareProposals?: boolean;
  welcomeMessage?: string;
  customNotes?: string;
}

export interface Client {
  id: string;
  freelancerId: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  notes: string;
  status: "Lead" | "Active" | "Inactive";
  createdAt: string;
  importantLinks?: ImportantLink[];
  portalSettings?: ClientPortalSettings;
  unlinkedEmailIds?: string[]; // IDs of emails explicitly unlinked from this client
}

export interface Project {
  id: string;
  freelancerId: string;
  clientId: string;
  title: string;
  budget: number;
  deadline: string;
  startDate?: string;
  endDate?: string;
  progress?: number;
  status: "Not Started" | "In Progress" | "On Hold" | "Completed";
  notes: string;
  createdAt: string;
}

export interface Task {
  id: string;
  freelancerId: string;
  projectId?: string;
  clientId?: string;
  title: string;
  dueDate: string;
  priority: "Low" | "Medium" | "High";
  status?: "Pending" | "In Progress" | "Completed";
  completed: boolean;
  notes?: string;
  relatedEmailId?: string;
  relatedEmailSubject?: string;
  createdAt: string;
}

export interface GmailMessageHeader {
  name: string;
  value: string;
}

export interface GmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface GmailEmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  from: string;
  fromName?: string;
  fromEmail?: string;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  date: string;
  timestamp: number;
  bodyHtml?: string;
  bodyText?: string;
  isUnread?: boolean;
  isStarred?: boolean;
  labelIds?: string[];
  attachments?: GmailAttachment[];
  matchedClientId?: string;
  matchedClientName?: string;
}

export interface GmailThread {
  id: string;
  historyId?: string;
  snippet: string;
  messages: GmailEmailMessage[];
  subject: string;
  lastMessageDate: string;
  lastMessageTimestamp: number;
  isUnread: boolean;
  isStarred?: boolean;
  hasAttachments?: boolean;
  participants: string[];
  matchedClientId?: string;
  matchedClientName?: string;
}

export interface ClientActivityItem {
  id: string;
  clientId: string;
  type:
    | "client_created"
    | "note_added"
    | "voice_recording_added"
    | "project_created"
    | "project_status_changed"
    | "task_created"
    | "task_completed"
    | "invoice_created"
    | "invoice_sent"
    | "invoice_paid"
    | "document_uploaded"
    | "email_received"
    | "email_sent"
    | "followup_completed";
  title: string;
  description?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface InvoiceService {
  description: string;
  quantity: number;
  rate: number;
}

export interface Invoice {
  id: string;
  freelancerId: string;
  invoiceNumber: string;
  clientId: string;
  issueDate: string;
  dueDate: string;
  services: InvoiceService[];
  taxRate: number; // e.g., 18 for 18%
  status: "Draft" | "Sent" | "Paid" | "Overdue";
  notes: string;
  lastReminderSentAt?: string;
  reminderCount?: number;
  sentAt?: string;
  sentTo?: string;
  sendMethod?: string;
  lastSendError?: string;
  createdAt: string;
}

export interface Lead {
  id: string;
  freelancerId: string;
  name: string;
  companyName: string;
  email: string;
  phone: string;
  source: string;
  followUpDate: string;
  status: "New" | "Contacted" | "Proposal Sent" | "Won" | "Lost";
  budget: number;
  notes: string;
  createdAt: string;
}

export interface DocumentRecord {
  id: string;
  freelancerId: string;
  title: string;
  category: "Contract" | "Client File" | "Project File" | "Invoice Attachment" | "Proposal File" | "Other";
  fileType: string;
  fileSize: string;
  uploadDate: string;
  content: string; // base64 encoded document body or text
  clientId?: string;
  projectId?: string;
  invoiceId?: string;
  proposalId?: string;
  sharedInPortal?: boolean;
  createdAt: string;
}

export interface NoteRecord {
  id: string;
  freelancerId: string;
  clientId: string;
  type: "note" | "voice_recording";
  title?: string;
  content?: string; // Note content
  description?: string; // Voice recording description
  audioFileName?: string;
  audioFileType?: string;
  audioFileSize?: string;
  audioFileUrl?: string; // Data URL or storage reference
  duration?: number; // duration in seconds
  createdAt: string;
  updatedAt: string;
}

export interface FollowUp {
  id: string;
  freelancerId: string;
  clientId?: string;
  leadId?: string;
  title: string;
  dueDate: string; // YYYY-MM-DD or ISO string
  notes?: string;
  status: "pending" | "completed" | "snoozed";
  priority?: "low" | "medium" | "high";
  completedAt?: string;
  snoozeUntil?: string;
  createdAt: string;
}

export interface ProposalItem {
  description: string;
  quantity: number;
  rate: number;
}

export interface Proposal {
  id: string;
  freelancerId: string;
  proposalNumber: string;
  clientId: string;
  projectId?: string;
  title: string;
  description?: string;
  issueDate: string;
  validUntil: string;
  items: ProposalItem[];
  discountRate?: number; // Percentage, e.g. 10 for 10%
  taxRate?: number; // Percentage, e.g. 18 for 18%
  notes?: string;
  terms?: string;
  status: "Draft" | "Sent" | "Viewed" | "Accepted" | "Rejected" | "Expired";
  convertedProjectId?: string;
  convertedInvoiceId?: string;
  sharedInPortal?: boolean;
  sentAt?: string;
  sentTo?: string;
  sendMethod?: string;
  lastSendError?: string;
  createdAt: string;
}

export interface ConnectedDevice {
  id: string;
  freelancerId: string;
  deviceName: string;
  platform: "iOS" | "Android" | "Mobile Web" | "Tablet" | string;
  userAgent?: string;
  pairedAt: string;
  lastActiveAt: string;
  status: "active" | "revoked";
}

export interface MobilePairingSession {
  pairingCode: string;
  pairingToken: string;
  freelancerId: string;
  createdAt: string;
  expiresAt: string;
  used: boolean;
  pairedDeviceName?: string;
}


