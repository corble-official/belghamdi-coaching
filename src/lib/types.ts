export interface Lead {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  source: "website-form" | "program-selector" | "contact-page" | "referral" | "social";
  interestedProgram: string;
  fitnessGoal: string;
  status: "new" | "contacted" | "qualified" | "converted" | "lost";
  createdAt: string;
  assignedCoach: string;
  notes: string;
  history: { at: string; action: string }[];
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  age?: number;
  fitnessGoal: string;
  experienceLevel: "beginner" | "intermediate" | "advanced";
  assignedProgram: string;
  coachingPackage: "silver" | "gold" | "none";
  startDate: string;
  subscriptionStatus: "active" | "pending" | "expired" | "cancelled" | "on-hold";
  assignedCoach: string;
  notes: string;
  createdAt: string;
}

export interface Order {
  id: string;
  shopifyOrderId?: string;
  customer: string;
  customerId?: string;
  productTitle: string;
  productId?: string;
  total: number;
  currency: string;
  paymentStatus: "paid" | "pending" | "refunded";
  fulfillmentStatus: "fulfilled" | "unfulfilled" | "cancelled";
  date: string;
  timeline: { at: string; event: string }[];
  demo?: boolean;
}

export interface Subscription {
  id: string;
  clientId?: string;
  clientName: string;
  package: "silver" | "gold";
  startDate: string;
  renewalDate: string;
  status: "active" | "pending" | "expired" | "cancelled" | "on-hold";
  paymentStatus: "paid" | "pending" | "failed";
  assignedCoach: string;
}

export interface ProgressRecord {
  id: string;
  clientId?: string;
  clientName: string;
  date: string;
  weightKg: number;
  targetWeightKg: number;
  heightCm?: number;
  workoutCompletionPct: number;
  nutritionAdherencePct: number;
  notes: string;
  photoRef?: string;
}

export interface Testimonial {
  id: string;
  clientName: string;
  program: string;
  quote: string;
  rating: number;
  demo: boolean;
  visible: boolean;
}

export interface Transformation {
  id: string;
  clientLabel: string;
  demo: boolean;
  weeks: number;
  summary: string;
  stages: {
    week: number;
    title: string;
    detail: string;
    metric: string;
    image?: string;
  }[];
  beforeImage?: string;
  afterImage?: string;
  visible: boolean;
}

export interface InternalNote {
  id: string;
  entityType: "lead" | "client";
  entityId: string;
  note: string;
  createdAt: string;
  author: string;
}
