export type ProductCategory =
  | "Training Splits"
  | "Full Body"
  | "Upper / Lower"
  | "PPL"
  | "Specialized Programs"
  | "Women's Training";

export interface Product {
  id: string;
  title: string;
  category: ProductCategory;
  description: string;
  image: string;
  sourceUrl: string;
  price: number;
  compareAtPrice?: number;
  frequency: string;
  audience: string;
  benefits: string[];
  included: string[];
  level: "beginner" | "intermediate" | "advanced";
  tags: string[];
  equipment: "gym" | "home" | "both";
  daysPerWeek: number;
  slug: string;
}

export const CATEGORIES: ProductCategory[] = [
  "Training Splits",
  "Full Body",
  "Upper / Lower",
  "PPL",
  "Specialized Programs",
  "Women's Training",
];

/* Real data extracted from the live store — belghamdicoaching.com (Shopify).
   Every product includes the same 7 bundled items (see INCLUDED_ITEMS),
   and the note below is taken verbatim from the live product pages. */

export const INJURY_NOTE =
  "This program is not suitable for those with current injuries or during rehabilitation.";

export const INCLUDED_ITEMS: { title: string; detail: string }[] = [
  {
    title: "Video exercise explanations",
    detail:
      "Detailed video walkthroughs (voice + visuals) for every exercise, so you execute perfect technique with ease.",
  },
  {
    title: "Carefully selected exercises",
    detail:
      "Professional exercise selection for maximum muscle stimulus with minimum fatigue.",
  },
  {
    title: "Weight & rep tracking sheet",
    detail: "A log file to record your weights and reps — watch your progress day after day.",
  },
  {
    title: "Full training details",
    detail:
      "Precise rep ranges, rest periods, and intensity targets — every element calculated for peak performance.",
  },
  {
    title: "Private community & support",
    detail:
      "An interactive private community sharing the same goal, with direct support inside the group.",
  },
  {
    title: "Complete guidelines guide",
    detail: "A comprehensive guide to avoid mistakes and achieve the best results.",
  },
  {
    title: "Exclusive discount file",
    detail: "Exclusive partner discounts from fitness and nutrition brands.",
  },
];

const CDN = "https://belghamdicoaching.com/cdn/shop/files";

export const CATALOG: Product[] = [
  {
    id: "prod-anterior-posterior",
    slug: "anterior-x-posterior",
    title: "Anterior x Posterior",
    category: "Training Splits",
    description:
      "A complete training program, 4+ days a week at high frequency for every muscle group. Anterior/posterior structure that develops your whole body scientifically, building balanced muscular mass with high frequency and intensity — no dedicated lower-body days, in a flexible, resilient plan.",
    image: `${CDN}/1242352235.png?v=1760710968&width=1000`,
    sourceUrl: "https://belghamdicoaching.com/products/anterior-x-posterior",
    price: 380,
    compareAtPrice: 699,
    frequency: "4+ sessions / week",
    audience:
      "Anyone who wants a comprehensive plan that develops the whole body — all levels welcome",
    benefits: [
      "Full-body development on a scientific basis",
      "High frequency for every muscle group",
      "Balanced, coordinated muscular mass",
      "Maximum results with minimum fatigue",
    ],
    included: INCLUDED_ITEMS.map((i) => `${i.title} — ${i.detail}`),
    level: "intermediate",
    tags: ["hypertrophy", "frequency", "full-body", "gym", "muscle"],
    equipment: "gym",
    daysPerWeek: 4,
  },
  {
    id: "prod-arnold-ul",
    slug: "arnold-x-u-l",
    title: "Arnold x U-L",
    category: "Specialized Programs",
    description:
      "A hybrid program that blends the classic Arnold-style volume approach with an Upper/Lower framework. Choose it when you want a signature Belghamdi system that keeps the intensity high every week.",
    image: `${CDN}/arnoold.png?v=1755456413&width=1000`,
    sourceUrl: "https://belghamdicoaching.com/products/arnold-x-u-l",
    price: 380,
    compareAtPrice: 699,
    frequency: "Multi-split / week",
    audience: "Lifters who enjoyed classic Arnold splits and want a modern, structured version",
    benefits: [
      "Arnold-style volume with U-L structure",
      "Signature Belghamdi system",
      "High weekly intensity",
      "Video-guided execution",
    ],
    included: INCLUDED_ITEMS.map((i) => `${i.title} — ${i.detail}`),
    level: "intermediate",
    tags: ["arnold", "upper-lower", "hybrid", "gym", "muscle"],
    equipment: "gym",
    daysPerWeek: 5,
  },
  {
    id: "prod-full-body-3",
    slug: "muscle-mommies-4-5-days-splits",
    title: "Full Body",
    category: "Full Body",
    description:
      "A training program, just 3 days a week — for maximum muscle mass gain in minimum time. If your time is limited but you want a strong, muscular body built scientifically, this program is for you. 3 days are enough for the largest muscle gains while respecting recovery and preventing overtraining.",
    image: `${CDN}/dcbdd09a8b66d1d9f0dc875ccab63824.png?v=1740677851&width=1000`,
    sourceUrl: "https://belghamdicoaching.com/products/muscle-mommies-4-5-days-splits",
    price: 380,
    compareAtPrice: 699,
    frequency: "3 sessions / week",
    audience: "Busy trainees who want maximum results in minimum time — beginners to advanced",
    benefits: [
      "Only 3 days a week needed",
      "Maximum hypertrophy per session",
      "Recovery-aware structure",
      "No daily gym presence required",
    ],
    included: INCLUDED_ITEMS.map((i) => `${i.title} — ${i.detail}`),
    level: "beginner",
    tags: ["beginner", "full-body", "gym", "muscle", "busy"],
    equipment: "gym",
    daysPerWeek: 3,
  },
  {
    id: "prod-mm-35",
    slug: "full-body-3-days-high-frequency-split",
    title: "Muscle Mommies",
    category: "Women's Training",
    description:
      "The signature Belghamdi women's split built on a 3-day full-body, high-frequency structure — developed for the Muscle Mommies community and available with selectable training days (4–5 day options inside).",
    image: `${CDN}/2.png?v=1741112795&width=1000`,
    sourceUrl: "https://belghamdicoaching.com/products/full-body-3-days-high-frequency-split",
    price: 380,
    compareAtPrice: 699,
    frequency: "3 days (4–5 day options)",
    audience: "Women building strength and shape on a flexible weekly schedule",
    benefits: [
      "High-frequency full-body structure",
      "Choose the days that fit your week",
      "Tailored to Muscle Mommies community",
      "Video-guided execution",
    ],
    included: INCLUDED_ITEMS.map((i) => `${i.title} — ${i.detail}`),
    level: "beginner",
    tags: ["women", "full-body", "frequency", "gym", "muscle"],
    equipment: "gym",
    daysPerWeek: 4,
  },
  {
    id: "prod-ppl-ul-5",
    slug: "push-pull-leg-x-upper-lower",
    title: "Push Pull Leg x Upper Lower — 5 Days",
    category: "PPL",
    description:
      "The five-day hybrid: a Push/Pull/Legs week woven into Upper/Lower days, giving every muscle high weekly volume while keeping recovery realistic. This is the pick of the store's 5-day split.",
    image: `${CDN}/9d2eef58f419a730887c6092b3023294.png?v=1740682018&width=1000`,
    sourceUrl: "https://belghamdicoaching.com/products/push-pull-leg-x-upper-lower",
    price: 380,
    compareAtPrice: 699,
    frequency: "5 sessions / week",
    audience: "Committed lifters who can train 5 consistent days for 6+ months",
    benefits: [
      "High weekly volume per muscle",
      "PPL + U-L hybrid rhythm",
      "Recovery-realistic five-day plan",
      "Video-guided execution",
    ],
    included: INCLUDED_ITEMS.map((i) => `${i.title} — ${i.detail}`),
    level: "intermediate",
    tags: ["intermediate", "ppl", "upper-lower", "gym", "muscle", "volume"],
    equipment: "gym",
    daysPerWeek: 5,
  },
  {
    id: "prod-ul-4",
    slug: "upper-lower-4-days",
    title: "Upper Lower",
    category: "Upper / Lower",
    description:
      "The store's classic 4-day Upper/Lower split — a step up from the 3-day plan with dedicated upper and lower sessions twice a week, engineered for balanced strength and size when you can commit four consistent days.",
    image: `${CDN}/8b5f9cd07c576a45d0e8b8f7546e310a.png?v=1740678031&width=1000`,
    sourceUrl: "https://belghamdicoaching.com/products/upper-lower-4-days",
    price: 380,
    compareAtPrice: 699,
    frequency: "4 sessions / week",
    audience: "Lifters who can commit 4 consistent days (the pick between Full Body and PPL x U-L)",
    benefits: [
      "Balanced upper/lower weekly rhythm",
      "Strength + size progression",
      "Sinto structure you can sustain for months",
      "Video-guided execution",
    ],
    included: INCLUDED_ITEMS.map((i) => `${i.title} — ${i.detail}`),
    level: "beginner",
    tags: ["beginner", "upper-lower", "gym", "muscle", "strength"],
    equipment: "gym",
    daysPerWeek: 4,
  },
];

export const getProduct = (slug: string) => CATALOG.find((p) => p.slug === slug);

/* ===== Arabic copy per product (site is Arabic-first) ===== */
const PRODUCT_AR: Record<string, { title: string; description: string; audience: string }> = {
  "anterior-x-posterior": {
    title: "أنتريو × بوستيريور",
    description:
      "برنامج تدريب كامل، 4 أيام أو أكتر في الأسبوع بتكرار عالي لكل مجموعة عضلية. تقسيمة أمامية/خلفية بتطوّر جسمك كله على أساس علمي، وتضخيم متوازن بتكرار وشدة عالية — من غير أيام رجل منفصلة، في خطة مرنة تقدر تستمر معاها.",
    audience: "أي حد عايز خطة شاملة تطوّر جسمه كله — كل المستويات",
  },
  "arnold-x-u-l": {
    title: "أرنولد × أبر لور",
    description:
      "برنامج هجين بيدمج حجم أرنولد الكلاسيكي مع تقسيمة أبر/لور. اختاره لو عايز نظام بالغامدي بتدريب عالي كل أسبوع.",
    audience: "أصحاب تقسيمة أرنولد اللي عايزينها بشكل حديث ومنظم",
  },
  "muscle-mommies-4-5-days-splits": {
    title: "فول بودي — 3 أيام",
    description:
      "برنامج تدريب 3 أيام بس في الأسبوع — لأكبر كتلة عضلية في أقل وقت. لو وقتك ضيق بس عايز جسم قوي ومليان بشكل علمي، البرنامج ده ليك. 3 أيام كفايين لأكبر تنشيش عضلي مع احترام الاستشفاء ومنع التمرين المفرط.",
    audience: "اللي معندهمش وقت كتير وعايز أقصى نتيجة — من المبتدئ للمتقدم",
  },
  "full-body-3-days-high-frequency-split": {
    title: "مسل ماميز",
    description:
      "تقسيمة بالغامدي المميزة للسيدات على أساس 3 أيام فول بودي بتكرار عالي — متطورة لمجتمع Muscle Mommies ومتاحة بحد أيام متغير (اختيارات 4–5 أيام داخل الخطة).",
    audience: "سيدات بيبنيوا قوة ورشاقة على جدول أسبوعي مرن",
  },
  "push-pull-leg-x-upper-lower": {
    title: "بوش بول ليج × أبر لور — 5 أيام",
    description:
      "النظام الهجين خمسي: أسبوع Push/Pull/Legs مع يومين أبر/لور، يدي كل عضلة حجم أسبوعي عالي مع استشفاء واقعي. دي أقوى تقسيمة 5 أيام في المتجر.",
    audience: "اللي يقدر يلتزم 5 أيام تدريب متواصلة لمدة 6 شهور أو أكتر",
  },
  "upper-lower-4-days": {
    title: "أبر لور — 4 أيام",
    description:
      "تقسيمة أبر/لور 4 أيام الكلاسيكية في المتجر — خطوة لقدام من خطة 3 أيام بحصص مخصصة لفوق وتحت مرتين في الأسبوع، معمولة لتوازن القوة والحجم لما تقدر تلتزم 4 أيام ثابتة.",
    audience: "اللي يقدر يلتزم 4 أيام ثابتة (الاختيار بين فول بودي و PPL × أبر لور)",
  },
};

export function productTitle(p: Product, lang: "ar" | "en") {
  return lang === "ar" ? PRODUCT_AR[p.slug]?.title ?? p.title : p.title;
}
export function productDescription(p: Product, lang: "ar" | "en") {
  return lang === "ar" ? PRODUCT_AR[p.slug]?.description ?? p.description : p.description;
}
export function productAudience(p: Product, lang: "ar" | "en") {
  return lang === "ar" ? PRODUCT_AR[p.slug]?.audience ?? p.audience : p.audience;
}

export const INJURY_NOTE_AR = "البرنامج ده مش مناسب للي عنده إصابة حالية أو للي في فترة تأهيل.";

const INCLUDED_ITEMS_AR: { title: string; detail: string }[] = [
  { title: "شرح بالفيديو لكل تمرين", detail: "فيديوهات شرح تفصيلي (صوت + صورة) لكل تمرين، عشان تنفذ الأداء الصحيح بسهولة." },
  { title: "تمارين مختارة بعناية", detail: "اختيار احترافي للتمارين لأقصى تنشيش عضلي بأقل تعب." },
  { title: "جدول متابعة الأوزان والعدد", detail: "ملف تسجل فيه أوزانك وعدد مرات التكرار — تشوف تقدمك يوم بعد يوم." },
  { title: "تفاصيل تدريب كاملة", detail: "نطاق تكرار، فترات راحة، وشدّة التمرين المطلوبة — كل حاجة محسوبة بدقة." },
  { title: "جروب خاص ودعم", detail: "كوميونيتي تفاعلي بكل اللي شاوكهم نفس الهدف، ودعم مباشر جوا الجروب." },
  { title: "دليل إرشادات كامل", detail: "دليل شامل تتجنب بيه الأخطاء الشائعة وتوصل لأفضل نتيجة." },
  { title: "ملف خصومات حصرية", detail: "خصومات حصرية من براندات التغذية والفيتنس الشريكة." },
];

export function includedLines(lang: "ar" | "en"): string[] {
  return (lang === "ar" ? INCLUDED_ITEMS_AR : INCLUDED_ITEMS).map(
    (i) => `${i.title} — ${i.detail}`
  );
}

const BENEFITS_AR: Record<string, string[]> = {
  "anterior-x-posterior": [
    "تطوير كامل للجسم على أساس علمي",
    "تكرار عالي لكل مجموعة عضلية",
    "تضخيم متوازن ومتناسق",
    "أقصى نتيجة بأقل تعب",
  ],
  "arnold-x-u-l": [
    "حجم أرنولد الكلاسيكي مع تقسيمة أبر/لور",
    "نظام بالغامدي المميز",
    "شدة أسبوعية عالية",
    "تنفيذ مشروح بالفيديو",
  ],
  "muscle-mommies-4-5-days-splits": [
    "3 أيام في الأسبوع فقط",
    "أقصى تنشيش عضلي لكل حصة",
    "خطة بتراعي الاستشفاء",
    "مش محتاج حضور يومي للجيم",
  ],
  "full-body-3-days-high-frequency-split": [
    "بنية فول بودي بتكرار عالي",
    "اختار الأيام اللي تناسب أسبوعك",
    "خاص بمجتمع Muscle Mommies",
    "تنفيذ مشروح بالفيديو",
  ],
  "push-pull-leg-x-upper-lower": [
    "حجم أسبوعي عالي لكل عضلة",
    "إيقاع هجين PPL + أبر/لور",
    "خطة 5 أيام واقعية الاستشفاء",
    "تنفيذ مشروح بالفيديو",
  ],
  "upper-lower-4-days": [
    "إيقاع أسبوعي متوازن فوق/تحت",
    "تدرج في القوة والحجم",
    "بنية تقدر تستمر معاها شهور",
    "تنفيذ مشروح بالفيديو",
  ],
};

export function benefitsFor(product: Product, lang: "ar" | "en"): string[] {
  return lang === "ar" ? BENEFITS_AR[product.slug] ?? product.benefits : product.benefits;
}

const FREQ_AR: Record<string, string> = {
  "anterior-x-posterior": "4+ حصص / أسبوع",
  "arnold-x-u-l": "تقسيمات متعددة / أسبوع",
  "muscle-mommies-4-5-days-splits": "3 حصص / أسبوع",
  "full-body-3-days-high-frequency-split": "3 أيام (اختيارات 4–5 أيام)",
  "push-pull-leg-x-upper-lower": "5 حصص / أسبوع",
  "upper-lower-4-days": "4 حصص / أسبوع",
};

export function productFrequency(p: Product, lang: "ar" | "en") {
  return lang === "ar" ? FREQ_AR[p.slug] ?? p.frequency : p.frequency;
}

export function levelName(level: Product["level"], lang: "ar" | "en") {
  const ar = { beginner: "مبتدئ", intermediate: "متوسط", advanced: "متقدم" } as const;
  return lang === "ar" ? ar[level] : level;
}

export type CoachingPackageId = "silver" | "gold";

export interface CoachingPackage {
  id: CoachingPackageId;
  name: string;
  price: number;
  cadence: string;
  followUp: string;
  reporting: string;
  responseTime: string;
  support: string;
  personalizedTraining: boolean;
  nutritionPlans: boolean;
  exerciseExplanations: boolean;
  progressAdjustments: boolean;
}

export const COACHING_PACKAGES: CoachingPackage[] = [
  {
    id: "silver",
    name: "Silver",
    price: 89,
    cadence: "per month",
    followUp: "Every 2 weeks",
    reporting: "Progress report every 2 weeks",
    responseTime: "48h response window",
    support: "Email support",
    personalizedTraining: true,
    nutritionPlans: false,
    exerciseExplanations: true,
    progressAdjustments: true,
  },
  {
    id: "gold",
    name: "Gold",
    price: 149,
    cadence: "per month",
    followUp: "Weekly",
    reporting: "Deep-dive report weekly",
    responseTime: "24h priority response",
    support: "Priority email + weekly video review",
    personalizedTraining: true,
    nutritionPlans: true,
    exerciseExplanations: true,
    progressAdjustments: true,
  },
];

export const getCoachingPackage = (id: CoachingPackageId) =>
  COACHING_PACKAGES.find((p) => p.id === id);

/* Real coach & business data extracted from the live client site. */
export const BUSINESS = {
  brand: "Belghamdi Coaching",
  brandLegal: "Belghamdi-Coaching",
  coach: "Bassam El Ghamdi",
  coachArabic: "بسام بالغامدي",
  location: "Cairo, Egypt",
  website: "https://belghamdicoaching.com",
  email: "coach@belghamdicoaching.com",
  whatsapp: "+201028796338",
  whatsappLink: "https://wa.me/201028796338",
  logo: "https://belghamdicoaching.com/cdn/shop/files/logi.png?v=1750603230&width=600",
  stats: {
    clientsServed: "20,000+",
    clientsOnSplits: "16,000+",
    instagramFollowers: "65.5K",
    tiktokFollowers: "232K",
  },
  payments: ["Vodafone Cash", "Instapay", "Visa / Credit"],
  socials: {
    instagram: "https://www.instagram.com/belghamdi.coaching/",
    tiktok: "https://www.tiktok.com/@belghamdi.coaching",
    youtube: "https://www.youtube.com/@Belghamdi.Coaching",
    threads: "https://www.threads.com/@belghamdi.coaching",
  },
} as const;
