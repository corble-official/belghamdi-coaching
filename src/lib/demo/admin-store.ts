import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { uuid } from "@/lib/utils";
import type {
  Lead,
  Client,
  Order,
  Subscription,
  ProgressRecord,
  Testimonial,
  Transformation,
  InternalNote,
} from "@/lib/types";
import type { IntegrationEventType } from "@/lib/integrations/events";

const daysAgo = (n: number) =>
  new Date(Date.now() - n * 86400000).toISOString();

const initialLeads: Lead[] = [
  { id: "ld-1041", fullName: "Yasmine Ait", email: "yasmine.a.demo@example.com", phone: "+212 6X1 XXX 01", source: "program-selector", interestedProgram: "Push Pull Leg x Upper Lower — 5 Days", fitnessGoal: "Build muscle", status: "new", createdAt: daysAgo(1), assignedCoach: "Unassigned", notes: "Selected via program selector. Intermediate lifter.", history: [{ at: daysAgo(1), action: "Lead created from program selector" }] },
  { id: "ld-1040", fullName: "Omar Benali", email: "omar.b.demo@example.com", phone: "+212 6X2 XXX 02", source: "website-form", interestedProgram: "Gold Coaching", fitnessGoal: "Lose fat", status: "contacted", createdAt: daysAgo(3), assignedCoach: "Coach Belghamdi", notes: "Wants to start after holidays.", history: [{ at: daysAgo(3), action: "Lead created from contact form" }, { at: daysAgo(2), action: "Status changed to Contacted" }] },
  { id: "ld-1039", fullName: "Sara El Fassi", email: "sara.f.demo@example.com", phone: "+212 6X3 XXX 03", source: "contact-page", interestedProgram: "Muscle Mommies", fitnessGoal: "Build muscle", status: "qualified", createdAt: daysAgo(6), assignedCoach: "Coach Belghamdi", notes: "Ready to commit. Asked about Silver vs Gold.", history: [{ at: daysAgo(6), action: "Lead created" }, { at: daysAgo(5), action: "Status changed to Contacted" }, { at: daysAgo(4), action: "Status changed to Qualified" }] },
  { id: "ld-1038", fullName: "Karim Zerhouni", email: "karim.z.demo@example.com", phone: "+212 6X4 XXX 04", source: "referral", interestedProgram: "Upper Lower", fitnessGoal: "Get stronger", status: "converted", createdAt: daysAgo(15), assignedCoach: "Coach Belghamdi", notes: "Purchased program. Converted to client.", history: [{ at: daysAgo(15), action: "Lead created" }, { at: daysAgo(13), action: "Converted to client cl-0512" }] },
  { id: "ld-1037", fullName: "Demo Visitor", email: "visitor.demo@example.com", phone: "-", source: "website-form", interestedProgram: "Arnold x U-L", fitnessGoal: "Lose fat", status: "lost", createdAt: daysAgo(30), assignedCoach: "Unassigned", notes: "No response after 3 attempts.", history: [{ at: daysAgo(30), action: "Lead created" }, { at: daysAgo(24), action: "Marked as Lost" }] },
];

const initialClients: Client[] = [
  { id: "cl-0512", name: "Karim Zerhouni", email: "karim.z.demo@example.com", phone: "+212 6X4 XXX 04", age: 28, fitnessGoal: "Get stronger", experienceLevel: "intermediate", assignedProgram: "Upper Lower", coachingPackage: "silver", startDate: daysAgo(12), subscriptionStatus: "active", assignedCoach: "Coach Belghamdi", notes: "Referred by a current client.", createdAt: daysAgo(12) },
  { id: "cl-0511", name: "Nadia Rami", email: "nadia.r.demo@example.com", phone: "+212 6X5 XXX 05", age: 31, fitnessGoal: "Build muscle", experienceLevel: "intermediate", assignedProgram: "Muscle Mommies", coachingPackage: "gold", startDate: daysAgo(40), subscriptionStatus: "active", assignedCoach: "Coach Belghamdi", notes: "Second package cycle.", createdAt: daysAgo(40) },
  { id: "cl-0510", name: "Yassine Hadi", email: "yassine.h.demo@example.com", phone: "+212 6X6 XXX 06", age: 24, fitnessGoal: "Lose fat", experienceLevel: "beginner", assignedProgram: "Full Body", coachingPackage: "none", startDate: daysAgo(9), subscriptionStatus: "active", assignedCoach: "Unassigned", notes: "Program-only client.", createdAt: daysAgo(9) },
  { id: "cl-0509", name: "Laila Drissi", email: "laila.d.demo@example.com", phone: "+212 6X7 XXX 07", age: 35, fitnessGoal: "Athletic performance", experienceLevel: "advanced", assignedProgram: "Anterior x Posterior", coachingPackage: "gold", startDate: daysAgo(80), subscriptionStatus: "on-hold", assignedCoach: "Coach Belghamdi", notes: "Traveling this month. Paused.", createdAt: daysAgo(80) },
];

const initialOrders: Order[] = [
  { id: "od-0777", shopifyOrderId: "SO-DEMO-7788", customer: "Karim Zerhouni", customerId: "cl-0512", productTitle: "Upper Lower", total: 380, currency: "EGP", paymentStatus: "paid", fulfillmentStatus: "fulfilled", date: daysAgo(12), timeline: [{ at: daysAgo(12), event: "Order created (demo)" }, { at: daysAgo(12), event: "Payment captured (demo)" }, { at: daysAgo(11), event: "Fulfilled program delivered (demo)" }], demo: true },
  { id: "od-0776", shopifyOrderId: "SO-DEMO-7787", customer: "Nadia Rami", customerId: "cl-0511", productTitle: "Muscle Mommies", total: 380, currency: "EGP", paymentStatus: "paid", fulfillmentStatus: "fulfilled", date: daysAgo(40), timeline: [{ at: daysAgo(40), event: "Order created (demo)" }, { at: daysAgo(40), event: "Payment captured (demo)" }], demo: true },
  { id: "od-0775", shopifyOrderId: "SO-DEMO-7786", customer: "Yassine Hadi", customerId: "cl-0510", productTitle: "Full Body", total: 380, currency: "EGP", paymentStatus: "paid", fulfillmentStatus: "fulfilled", date: daysAgo(9), timeline: [{ at: daysAgo(9), event: "Order created (demo)" }], demo: true },
  { id: "od-0774", shopifyOrderId: "SO-DEMO-7785", customer: "Guest (demo)", productTitle: "Push Pull Leg x Upper Lower — 5 Days", total: 380, currency: "EGP", paymentStatus: "pending", fulfillmentStatus: "unfulfilled", date: daysAgo(2), timeline: [{ at: daysAgo(2), event: "Order created (demo) awaiting payment" }], demo: true },
  { id: "od-0773", shopifyOrderId: "SO-DEMO-7784", customer: "Laila Drissi", customerId: "cl-0509", productTitle: "Anterior x Posterior", total: 380, currency: "EGP", paymentStatus: "refunded", fulfillmentStatus: "cancelled", date: daysAgo(60), timeline: [{ at: daysAgo(60), event: "Order created (demo)" }, { at: daysAgo(58), event: "Refund issued (demo)" }], demo: true },
];

const initialSubscriptions: Subscription[] = [
  { id: "sb-0211", clientId: "cl-0512", clientName: "Karim Zerhouni", package: "silver", startDate: daysAgo(12), renewalDate: new Date(Date.now() + 18 * 86400000).toISOString(), status: "active", paymentStatus: "paid", assignedCoach: "Coach Belghamdi" },
  { id: "sb-0210", clientId: "cl-0511", clientName: "Nadia Rami", package: "gold", startDate: daysAgo(40), renewalDate: new Date(Date.now() + 4 * 86400000).toISOString(), status: "active", paymentStatus: "paid", assignedCoach: "Coach Belghamdi" },
  { id: "sb-0209", clientId: "cl-0509", clientName: "Laila Drissi", package: "gold", startDate: daysAgo(80), renewalDate: new Date(Date.now() - 15 * 86400000).toISOString(), status: "on-hold", paymentStatus: "paid", assignedCoach: "Coach Belghamdi" },
];

const initialProgress: ProgressRecord[] = [
  { id: "pg-0093", clientId: "cl-0512", clientName: "Karim Zerhouni", date: daysAgo(1), weightKg: 79.2, targetWeightKg: 76, heightCm: 178, workoutCompletionPct: 100, nutritionAdherencePct: 85, notes: "Hit all four sessions. Deadlift form reported better this week.", photoRef: "progress-photos/demo-kz-01.jpg" },
  { id: "pg-0092", clientId: "cl-0512", clientName: "Karim Zerhouni", date: daysAgo(7), weightKg: 79.8, targetWeightKg: 76, heightCm: 178, workoutCompletionPct: 100, nutritionAdherencePct: 76, notes: "Great week.", photoRef: "progress-photos/demo-kz-02.jpg" },
  { id: "pg-0091", clientId: "cl-0511", clientName: "Nadia Rami", date: daysAgo(3), weightKg: 62.4, targetWeightKg: 60, heightCm: 165, workoutCompletionPct: 85, nutritionAdherencePct: 90, notes: "Missed one session due to work.", photoRef: "progress-photos/demo-nr-01.jpg" },
  { id: "pg-0090", clientId: "cl-0511", clientName: "Nadia Rami", date: daysAgo(10), weightKg: 62.9, targetWeightKg: 60, heightCm: 165, workoutCompletionPct: 100, nutritionAdherencePct: 88, notes: "Leg day PR on hip thrust.", photoRef: "progress-photos/demo-nr-02.jpg" },
  { id: "pg-0089", clientId: "cl-0510", clientName: "Yassine Hadi", date: daysAgo(2), weightKg: 88.5, targetWeightKg: 79, heightCm: 182, workoutCompletionPct: 66, nutritionAdherencePct: 70, notes: "Struggling with consistency schedule check-in.", },
];

const initialTestimonials: Testimonial[] = [
  { id: "tm-0001", clientName: "Demo Athlete 01", program: "Push Pull Leg x Upper Lower — 5 Days", quote: "This is a demo testimonial. Replace with a real client quote: the structure is clear, the coaching accountability kept me consistent.", rating: 5, demo: true, visible: true },
  { id: "tm-0002", clientName: "Demo Athlete 02", program: "Muscle Mommies", quote: "This is a demo testimonial. Replace with a real client quote: I gained visible arm size while maintaining bodyweight progress.", rating: 5, demo: true, visible: true },
  { id: "tm-0003", clientName: "Demo Athlete 03", program: "Gold Coaching", quote: "This is a demo testimonial. Replace with a real client quote: weekly video reviews caught what I never would have.", rating: 5, demo: true, visible: true },
];

const initialTransformations: Transformation[] = [
  {
    id: "tr-0001",
    clientLabel: "Demo Client A",
    demo: true,
    weeks: 24,
    beforeImage: "https://belghamdicoaching.com/cdn/shop/files/dcbdd09a8b66d1d9f0dc875ccab63824.png?v=1740677851&width=600",
    afterImage: "https://belghamdicoaching.com/cdn/shop/files/2.png?v=1741112795&width=600",
    summary: "Demo transformation entry. Stages show a recommended 16-week build cycle.",
    stages: [
      { week: 1, title: "Assessment", detail: "Baseline measurements and movement screening recorded.", metric: "Power clean 65 kg", image: "https://belghamdicoaching.com/cdn/shop/files/dcbdd09a8b66d1d9f0dc875ccab63824.png?v=1740677851&width=400" },
      { week: 8, title: "Volume phase", detail: "Hypertrophy block completed with full training adherence.", metric: "Power clean 78 kg" },
      { week: 20, title: "Peak block", detail: "Final strength block with deload scheduling.", metric: "Power clean 90 kg", image: "https://belghamdicoaching.com/cdn/shop/files/2.png?v=1741112795&width=400" },
    ],
    visible: true,
  },
  {
    id: "tr-0002",
    clientLabel: "Demo Client B",
    demo: true,
    weeks: 16,
    beforeImage: "https://belghamdicoaching.com/cdn/shop/files/8b5f9cd07c576a45d0e8b8f7546e310a.png?v=1740678031&width=600",
    afterImage: "https://belghamdicoaching.com/cdn/shop/files/9d2eef58f419a730887c6092b3023294.png?v=1740682018&width=600",
    summary: "Demo transformation entry. Stages show a recommended cutting cycle.",
    stages: [
      { week: 1, title: "Baseline", detail: "Starting bodyweight and weekly targets documented.", metric: "Weight 92 kg" },
      { week: 8, title: "Mid cut", detail: "Training volume maintained while conditioning added.", metric: "Weight 85 kg" },
      { week: 16, title: "Finish", detail: "Ending form documented with maintenance plan.", metric: "Weight 79 kg" },
    ],
    visible: true,
  },
];

export type ContentTab = "homepage" | "programs" | "coaching" | "faq";

export interface ContentEdit {
  title: string;
  body: string;
  visible: boolean;
}

const initialContentEdits: Record<ContentTab, ContentEdit> = {
  homepage: {
    title: "Build the strongest version of yourself",
    body: "Elite programming and 1:1 coaching designed around your body, your schedule, and your goals.",
    visible: true,
  },
  programs: {
    title: "",
    body: "Structured training programs built and refined by Coach Belghamdi — pick the split that matches your schedule and experience.",
    visible: true,
  },
  coaching: {
    title: "",
    body: "Personal coaching with weekly check-ins, custom nutrition targets, and direct access to Coach Belghamdi.",
    visible: true,
  },
  faq: {
    title: "",
    body: "Answers to the most common questions about programs, coaching, and delivery.",
    visible: true,
  },
};

interface AdminDataState {
  contentEdits: Record<ContentTab, ContentEdit>;
  leads: Lead[];
  clients: Client[];
  orders: Order[];
  subscriptions: Subscription[];
  progress: ProgressRecord[];
  testimonials: Testimonial[];
  transformations: Transformation[];
  notes: InternalNote[];
  currency: "EGP" | "MAD" | "EUR" | "USD";
  seedVersion: number;
  settings: {
    businessName: string;
    contactEmail: string;
    phone: string;
    whatsapp: string;
    instagram: string;
    youtube: string;
    language: "en" | "ar";
    notifyNewLeads: boolean;
    notifyNewOrders: boolean;
    notifyProgress: boolean;
  };
  setSeed: () => void;
  addLead: (lead: Omit<Lead, "id" | "createdAt" | "history">) => Lead;
  updateLead: (id: string, patch: Partial<Lead>) => void;
  deleteLead: (id: string) => void;
  addClient: (client: Omit<Client, "id" | "createdAt">) => Client;
  updateClient: (id: string, patch: Partial<Client>) => void;
  deleteClient: (id: string) => void;
  addOrder: (order: Omit<Order, "id">) => Order;
  updateOrder: (id: string, patch: Partial<Order>) => void;
  addSubscription: (sub: Omit<Subscription, "id">) => Subscription;
  updateSubscription: (id: string, patch: Partial<Subscription>) => void;
  deleteSubscription: (id: string) => void;
  addProgress: (rec: Omit<ProgressRecord, "id">) => ProgressRecord;
  updateTestimonial: (id: string, patch: Partial<Testimonial>) => void;
  updateTransformation: (id: string, patch: Partial<Transformation>) => void;
  addNote: (note: { entityType: "lead" | "client"; entityId: string; note: string; author?: string }) => void;
  notesFor: (entityType: "lead" | "client", entityId: string) => InternalNote[];
  setCurrency: (c: "EGP" | "MAD" | "EUR" | "USD") => void;
  saveContentTab: (tab: ContentTab, patch: Partial<ContentEdit>) => void;
  saveSettings: (patch: Partial<AdminDataState["settings"]>) => void;
  resetDemoData: () => void;
}

const SEED_VERSION = 1;

const baseState = {
  contentEdits: initialContentEdits,
  leads: initialLeads,
  clients: initialClients,
  orders: initialOrders,
  subscriptions: initialSubscriptions,
  progress: initialProgress,
  testimonials: initialTestimonials,
  transformations: initialTransformations,
  notes: [] as InternalNote[],
  currency: "EGP" as const,
  seedVersion: SEED_VERSION,
  settings: {
    businessName: "Belghamdi Coaching",
    contactEmail: "coach@belghamdicoaching.com",
    phone: "+212 6XX XXX XXX",
    whatsapp: "",
    instagram: "",
    youtube: "",
    language: "en" as const,
    notifyNewLeads: true,
    notifyNewOrders: true,
    notifyProgress: false,
  },
};

export const useAdminStore = create<AdminDataState>()(
  persist(
    (set, get) => ({
      ...baseState,
      setSeed: () => set({ seedVersion: SEED_VERSION }),
      addLead: (lead) => {
        const full: Lead = {
          ...lead,
          id: `ld-${Math.floor(1000 + Math.random() * 9000)}`,
          createdAt: new Date().toISOString(),
          history: [{ at: new Date().toISOString(), action: "Lead created manually" }],
        };
        set({ leads: [full, ...get().leads] });
        return full;
      },
      updateLead: (id, patch) =>
        set({
          leads: get().leads.map((l) =>
            l.id === id
              ? patch.status && patch.status !== l.status
                ? {
                    ...l,
                    ...patch,
                    history: [
                      { at: new Date().toISOString(), action: `Status changed to ${patch.status}` },
                      ...l.history,
                    ],
                  }
                : { ...l, ...patch }
              : l
          ),
        }),
      deleteLead: (id) => set({ leads: get().leads.filter((l) => l.id !== id) }),
      addClient: (client) => {
        const full: Client = { ...client, id: `cl-0${Math.floor(500 + Math.random() * 400)}`, createdAt: new Date().toISOString() };
        set({ clients: [full, ...get().clients] });
        return full;
      },
      updateClient: (id, patch) =>
        set({ clients: get().clients.map((c) => (c.id === id ? { ...c, ...patch } : c)) }),
      deleteClient: (id) => set({ clients: get().clients.filter((c) => c.id !== id) }),
      addOrder: (order) => {
        const full: Order = { ...order, id: `od-0${Math.floor(700 + Math.random() * 99)}` };
        set({ orders: [full, ...get().orders] });
        return full;
      },
      updateOrder: (id, patch) =>
        set({ orders: get().orders.map((o) => (o.id === id ? { ...o, ...patch } : o)) }),
      addSubscription: (sub) => {
        const full: Subscription = { ...sub, id: `sb-0${Math.floor(200 + Math.random() * 90)}` };
        set({ subscriptions: [full, ...get().subscriptions] });
        return full;
      },
      updateSubscription: (id, patch) =>
        set({ subscriptions: get().subscriptions.map((s) => (s.id === id ? { ...s, ...patch } : s)) }),
      deleteSubscription: (id) => set({ subscriptions: get().subscriptions.filter((s) => s.id !== id) }),
      addProgress: (rec) => {
        const full: ProgressRecord = { ...rec, id: `pg-00${Math.floor(90 + Math.random() * 99)}` };
        set({ progress: [full, ...get().progress] });
        return full;
      },
      updateTestimonial: (id, patch) =>
        set({ testimonials: get().testimonials.map((t) => (t.id === id ? { ...t, ...patch } : t)) }),
      updateTransformation: (id, patch) =>
        set({ transformations: get().transformations.map((t) => (t.id === id ? { ...t, ...patch } : t)) }),
      addNote: (note) => {
        const full: InternalNote = { ...note, id: uuid(), createdAt: new Date().toISOString(), author: "Coach Belghamdi" };
        set({ notes: [full, ...get().notes] });
      },
      notesFor: (entityType, entityId) =>
        get().notes.filter((n) => n.entityType === entityType && n.entityId === entityId),
      setCurrency: (c) => set({ currency: c }),
      saveContentTab: (tab, patch) =>
        set({
          contentEdits: {
            ...get().contentEdits,
            [tab]: { ...get().contentEdits[tab], ...patch },
          },
        }),
      saveSettings: (patch) => set({ settings: { ...get().settings, ...patch } }),
      resetDemoData: () => {
        set({ ...baseState, settings: get().settings });
      },
    }),
    {
      name: "bc_admin_data",
      version: SEED_VERSION,
      migrate: (persisted) => persisted,
    }
  )
);

export const demoEventFor = (
  action: "lead" | "client" | "order" | "subscription" | "progress",
  verb: "created" | "updated" | "paid" | "submitted"
): IntegrationEventType => {
  const key = `${action}.${verb}`;
  const allowed: IntegrationEventType[] = [
    "lead.created",
    "lead.updated",
    "client.created",
    "client.updated",
    "order.paid",
    "order.cancelled",
    "subscription.created",
    "subscription.renewed",
    "subscription.expired",
    "progress.submitted",
  ];
  return (allowed as string[]).includes(key) ? (key as IntegrationEventType) : "lead.updated";
};

