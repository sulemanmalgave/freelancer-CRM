export interface FreelancerProfile {
  id: string;
  name: string;
  businessName: string;
  currency: string;
  country: string;
  billingCountry?: string;
  plan: "Free" | "Pro" | "Monthly" | "3 Months" | string;
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
}

export interface ImportantLink {
  id: string;
  name: string;
  url: string;
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
  title: string;
  dueDate: string;
  priority: "Low" | "Medium" | "High";
  completed: boolean;
  createdAt: string;
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
  category: "Contract" | "Client File" | "Project File";
  fileType: string;
  fileSize: string;
  uploadDate: string;
  content: string; // base64 encoded document body
  createdAt: string;
}
