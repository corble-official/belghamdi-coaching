"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "ar";

const DICT: Record<string, { en: string; ar: string }> = {
  nav_programs: { en: "Programs", ar: "البرامج" },
  nav_coaching: { en: "Online Coaching", ar: "الكوتشينج أونلاين" },
  nav_transformations: { en: "Transformations", ar: "التحولات" },
  nav_about: { en: "About", ar: "عن المدرب" },
  nav_contact: { en: "Contact", ar: "اتصل بنا" },
  nav_cart: { en: "Cart", ar: "السلة" },
  nav_login: { en: "Client Login", ar: "دخول العملاء" },
  hero_kicker: { en: "Anatomy of Performance", ar: "تشريح الأداء" },
  hero_headline_1: { en: "BUILD", ar: "ابنِ" },
  hero_headline_2: { en: "BEYOND", ar: "ما وراء" },
  hero_headline_3: { en: "YOUR LIMITS.", ar: "حدودك." },
  hero_copy: {
    en: "Science-backed training. Personalized coaching. Measurable progress.",
    ar: "تدريب علمي. كوتشينج شخصي. نتائج قابلة للقياس.",
  },
  cta_explore: { en: "Explore Programs", ar: "استكشف البرامج" },
  cta_transform: { en: "Start Your Transformation", ar: "ابدأ تحولك" },
  cta_add_cart: { en: "Add to Cart", ar: "أضف إلى السلة" },
  cta_view_details: { en: "View Details", ar: "عرض التفاصيل" },
  section_programs: { en: "Training Programs", ar: "برامج التدريب" },
  section_coaching: { en: "Online Coaching", ar: "الكوتشينج أونلاين" },
  section_transformations: { en: "Transformations", ar: "التحولات" },
  footer_tagline: {
    en: "Performance coaching built on science.",
    ar: "كوتشينج أداء مبني على العلم.",
  },
  newsletter_placeholder: {
    en: "Email for training insights",
    ar: "بريدك الإلكتروني لنصائح التدريب",
  },
  newsletter_subscribe: { en: "Subscribe", ar: "اشترك" },
  newsletter_email_label: {
    en: "Newsletter email",
    ar: "البريد الإلكتروني للنشرة",
  },
  newsletter_success: { en: "You are on the list.", ar: "تم إضافتك إلى القائمة." },
  newsletter_error: {
    en: "Please enter a valid email address.",
    ar: "يرجى إدخال بريد إلكتروني صحيح.",
  },
  coaching_compare_title: { en: "Quick comparison", ar: "مقارنة سريعة" },
  coaching_table_feature: { en: "Feature", ar: "الميزة" },
  coaching_tier_silver: { en: "Silver", ar: "سيلفر" },
  coaching_tier_gold: { en: "Gold", ar: "جولد" },
  coaching_row_followup: {
    en: "Follow-up frequency",
    ar: "تكرار المتابعة",
  },
  coaching_row_reporting: { en: "Reporting", ar: "التقارير" },
  coaching_row_response: { en: "Response time", ar: "زمن الرد" },
  coaching_row_support: { en: "Support", ar: "الدعم" },
  home_prog_title: {
    en: "Programs engineered for outcomes.",
    ar: "برامج مصممة لتحقيق نتائج.",
  },
  home_prog_copy: {
    en: "Structured plans with clear progression — from your first week of training to advanced hypertrophy work.",
    ar: "خطط منظمة بتدرج واضح — من أسبوعك الأول في التدريب حتى تمارين التضخيم المتقدمة.",
  },
  cta_all_programs: { en: "All Programs", ar: "جميع البرامج" },
  home_coach_title: { en: "Coach in your corner. Every week.", ar: "كوتش بجوارك. كل أسبوع." },
  home_coach_copy: {
    en: "Silver and Gold coaching tracks keep your plan evolving with your progress — not fading after week six.",
    ar: "مسارات الكوتشينج سيلفر وجولد تجعل خطتك تتطور مع تقدمك — لا تفقد فعاليتها بعد الأسبوع السادس.",
  },
  home_coach_silver_freq: { en: "Bi-weekly", ar: "كل أسبوعين" },
  home_coach_silver_copy: {
    en: "Personalized training, exercise breakdowns, and a progress report every two weeks.",
    ar: "تدريب شخصي، شرح تفصيلي للتمارين، وتقرير تقدم كل أسبوعين.",
  },
  home_coach_gold_freq: { en: "Weekly", ar: "أسبوعياً" },
  home_coach_gold_copy: {
    en: "Everything in Silver plus nutrition planning, weekly deep-dive reviews, and priority responses.",
    ar: "كل ما في سيلفر بالإضافة إلى تخطيط التغذية، ومراجعات أسبوعية تفصيلية، وردود ذات أولوية.",
  },
  cta_compare_coaching: { en: "Compare Coaching", ar: "قارن الباقات" },
  home_feat_1_title: { en: "Instant PDF delivery", ar: "تسليم PDF فوري" },
  home_feat_1_copy: {
    en: "Every program includes a print-ready plan.",
    ar: "كل برنامج يتضمن خطة جاهزة للطباعة.",
  },
  home_feat_2_title: { en: "Data-driven check-ins", ar: "متابعة مبنية على البيانات" },
  home_feat_2_copy: {
    en: "Weight trends, adherence, and workload tracked.",
    ar: "متابعة مؤشرات الوزن والالتزام وحجم التدريب.",
  },
  home_feat_3_title: { en: "Direct coach access", ar: "تواصل مباشر مع الكوتش" },
  home_feat_3_copy: {
    en: "Real adjustments from real feedback.",
    ar: "تعديلات حقيقية بناءً على ملاحظات واقعية.",
  },
  home_timeline_title: { en: "Progress is a timeline, not a photo.", ar: "التقدم رحلة زمنية، لا صورة." },
  home_timeline_copy: {
    en: "Our clients' journeys follow weekly checkpoints. Explore sample demo timelines below.",
    ar: "رحلات عملائنا تمر بمحطات أسبوعية. استكشف نماذج تجريبية من الخطوط الزمنية أدناه.",
  },
  cta_explore_journeys: { en: "Explore All Journeys", ar: "استكشف كل الرحلات" },
  philosophy_eyebrow: { en: "The Philosophy", ar: "الفلسفة" },
  philosophy_title: { en: "Training is a science.", ar: "التدريب علم." },
  philosophy_title_accent: { en: "We treat it that way.", ar: "ونتعامل معه كذلك." },
  philosophy_principle_1_title: { en: "Training with purpose", ar: "تدريب بهدف واضح" },
  philosophy_principle_1_copy: {
    en: "Every session maps to a phase. Nothing is filler.",
    ar: "كل جلسة تمرين مربوطة بمرحلة محددة. لا يوجد أي حشو.",
  },
  philosophy_principle_2_title: { en: "Scientific programming", ar: "برمجة علمية" },
  philosophy_principle_2_copy: {
    en: "Volume, intensity, and progression driven by evidence.",
    ar: "الحجم والشدة والتدرج مبنية على الأدلة العلمية.",
  },
  philosophy_principle_3_title: { en: "Consistency", ar: "الاستمرارية" },
  philosophy_principle_3_copy: {
    en: "The structure you can repeat is the structure that works.",
    ar: "الخطة التي تستطيع تكرارها هي الخطة التي تنجح.",
  },
  philosophy_principle_4_title: { en: "Progressive overload", ar: "زيادة الأحمال التدريجية" },
  philosophy_principle_4_copy: {
    en: "Measured increases week by week — no guesswork.",
    ar: "زيادات محسوبة أسبوعاً بعد أسبوع — بدون تخمين.",
  },
  philosophy_principle_5_title: { en: "Sustainable development", ar: "بناء مستدام" },
  philosophy_principle_5_copy: {
    en: "Physique built for years, not for one photo.",
    ar: "بناء جسم يبقى معك لسنوات، لا لصورة واحدة.",
  },
  hiw_eyebrow: { en: "How It Works", ar: "طريقة العمل" },
  hiw_title: { en: "From zero to first check-in.", ar: "من الصفر إلى أول جلسة متابعة." },
  hiw_step_1_title: { en: "Choose your program", ar: "اختر برنامجك" },
  hiw_step_1_copy: {
    en: "Pick the program that matches your goal, experience, and schedule.",
    ar: "اختر البرنامج المناسب لهدفك وخبرتك وجدولك.",
  },
  hiw_step_2_title: { en: "Complete your purchase", ar: "أكمل عملية الشراء" },
  hiw_step_2_copy: {
    en: "Secure checkout. Instant access to your plan.",
    ar: "دفع آمن. وصول فوري إلى خطتك.",
  },
  hiw_step_3_title: { en: "Submit your personal information", ar: "أرسل بياناتك الشخصية" },
  hiw_step_3_copy: {
    en: "A short intake form so your plan fits you.",
    ar: "نموذج قصير حتى تُبنى خطتك حسب وضعك.",
  },
  hiw_step_4_title: { en: "Receive your training plan", ar: "استلم خطة التدريب" },
  hiw_step_4_copy: {
    en: "Delivered with video breakdowns of every movement.",
    ar: "تُسلَّم مع شرح بالفيديو لكل تمرين.",
  },
  hiw_step_5_title: { en: "Track your progress", ar: "تابع تقدمك" },
  hiw_step_5_copy: {
    en: "Check-ins and adjustments based on real data.",
    ar: "متابعات وتعديلات مبنية على بيانات حقيقية.",
  },
  testimonials_eyebrow: { en: "Testimonials", ar: "آراء العملاء" },
  testimonials_title: { en: "What training feels like here.", ar: "تجربة التدريب عندنا." },
  badge_demo: { en: "Demo", ar: "تجريبي" },
  cta_final_bg: { en: "NEXT LEVEL", ar: "المستوى القادم" },
  cta_final_eyebrow: { en: "Final Call", ar: "الفرصة الأخيرة" },
  cta_final_headline: { en: "YOUR NEXT LEVEL STARTS HERE.", ar: "مستواك القادم يبدأ من هنا." },
  cta_final_copy: {
    en: "The programs are ready. The coaching is personalized. The first session is yours.",
    ar: "البرامج جاهزة. الكوتشينج شخصي. الجلسة الأولى لك.",
  },
  cta_find_program: { en: "Find My Program", ar: "اعثر على برنامجك" },
  demo_content_note: {
    en: "Demo Content — replace with real client story",
    ar: "محتوى تجريبي — استبدله بقصة عميل حقيقية",
  },
  timeline_weeks_journey: {
    en: "{weeks}-week journey",
    ar: "رحلة مدتها {weeks} أسبوعاً",
  },
  timeline_week_label: { en: "Week {week}", ar: "الأسبوع {week}" },
  timeline_collapse: { en: "Collapse", ar: "إخفاء" },
  timeline_expand: { en: "Expand", ar: "إظهار" },
  programs_title: { en: "Pick your", ar: "اختر" },
  programs_title_accent: { en: "battle plan.", ar: "خطتك القتالية." },
  programs_copy: {
    en: "Every program is structured for progression. Filter by category, find your fit, and start this week.",
    ar: "كل برنامج مصمم للتدرج. فلتر حسب الفئة، حدد الأنسب لك، وابدأ هذا الأسبوع.",
  },
  programs_filter_all: { en: "All", ar: "الكل" },
  programs_search_placeholder: { en: "Search programs", ar: "ابحث في البرامج" },
  programs_search_aria: { en: "Search programs", ar: "ابحث في البرامج" },
  programs_sort_aria: { en: "Sort programs", ar: "ترتيب البرامج" },
  programs_sort_featured: { en: "Featured", ar: "المميزة" },
  programs_sort_price_asc: { en: "Price: low to high", ar: "السعر: من الأقل إلى الأعلى" },
  programs_sort_price_desc: { en: "Price: high to low", ar: "السعر: من الأعلى إلى الأقل" },
  programs_empty: {
    en: "No programs match your filters. Try clearing the search.",
    ar: "لا توجد برامج مطابقة لخياراتك. جرّب مسح البحث.",
  },
  product_view_n: { en: "View {n}", ar: "عرض {n}" },
  product_important_note: { en: "Important note", ar: "ملاحظة هامة" },
  product_frequency: { en: "Frequency", ar: "التكرار" },
  product_level: { en: "Level", ar: "المستوى" },
  product_for: { en: "For: {audience}", ar: "مناسب لـ: {audience}" },
  product_whats_included: { en: "What's included", ar: "ما يتضمنه البرنامج" },
  product_benefits_title: { en: "Program benefits", ar: "فوائد البرنامج" },
  product_video_library: { en: "Exercise video library", ar: "مكتبة فيديوهات التمارين" },
  product_related_title: { en: "Related programs", ar: "برامج ذات صلة" },
  selector_eyebrow: { en: "Program Selector", ar: "اختيار البرنامج" },
  selector_title: { en: "Five questions. Your next program.", ar: "خمسة أسئلة. برنامجك القادم." },
  selector_question_step: {
    en: "Question {step} of {total}",
    ar: "السؤال {step} من {total}",
  },
  selector_back: { en: "Back", ar: "رجوع" },
  selector_results_title: { en: "Your recommended programs", ar: "برامجك الموصى بها" },
  selector_disclaimer: {
    en: "These recommendations are informational and based on standard training principles. Final training decisions should be reviewed with the coach.",
    ar: "هذه التوصيات معلوماتية ومبنية على مبادئ التدريب القياسية. يجب مراجعة قرارات التدريب النهائية مع الكوتش.",
  },
  selector_retake: { en: "Retake", ar: "إعادة" },
  selector_explore_coaching: { en: "Explore Coaching", ar: "استكشف الكوتشينج" },
  coaching_title: { en: "Your plan adapts as", ar: "خطتك تتكيف" },
  coaching_title_accent: { en: "you adapt.", ar: "مع تطورك." },
  coaching_philosophy_copy: {
    en: "Coaching philosophy: training with purpose, scientific programming, consistency, and progressive overload — supported by a coach who reads your check-ins weekly.",
    ar: "فلسفة الكوتشينج: تدريب بهدف واضح، وبرمجة علمية، واستمرارية، وزيادة أحمال تدريجية — بدعم من كوتش يراجع متابعاتك أسبوعياً.",
  },
  coaching_card_silver_line: { en: "Silver — LE {price}/mo", ar: "سيلفر — LE {price}/شهر" },
  coaching_silver_headline: { en: "Structured accountability.", ar: "مساءلة منظمة." },
  coaching_silver_feat_1: { en: "Bi-weekly plan updates", ar: "تحديثات الخطة كل أسبوعين" },
  coaching_silver_feat_2: { en: "Progress report follow-up", ar: "متابعة تقرير التقدم" },
  coaching_silver_feat_3: { en: "48h response window", ar: "نافذة رد خلال 48 ساعة" },
  coaching_silver_feat_5: { en: "Email support", ar: "دعم عبر البريد الإلكتروني" },
  coaching_badge_most_complete: { en: "Most complete", ar: "الأشمل" },
  coaching_card_gold_line: { en: "Gold — LE {price}/mo", ar: "جولد — LE {price}/شهر" },
  coaching_gold_headline: { en: "Full transformation system.", ar: "نظام تحوّل متكامل." },
  coaching_gold_feat_1: { en: "Weekly plan updates", ar: "تحديثات الخطة أسبوعياً" },
  coaching_gold_feat_2: { en: "Weekly deep-dive reporting", ar: "تقارير أسبوعية تفصيلية" },
  coaching_gold_feat_3: { en: "24h priority response", ar: "رد ذو أولوية خلال 24 ساعة" },
  coaching_gold_feat_4: { en: "Personalized nutrition plans", ar: "خطط تغذية شخصية" },
  coaching_gold_feat_5: { en: "Priority email support", ar: "دعم ذو أولوية عبر البريد الإلكتروني" },
  coaching_comparison_title: { en: "Feature comparison", ar: "مقارنة الميزات" },
  coaching_row_personalized: { en: "Personalized training", ar: "تدريب شخصي" },
  coaching_row_nutrition: { en: "Nutrition plans", ar: "خطط التغذية" },
  coaching_row_explanations: { en: "Exercise explanations", ar: "شرح التمارين" },
  coaching_row_adjustments: { en: "Adjustments based on progress", ar: "تعديلات حسب التقدم" },
  coaching_val_yes: { en: "Yes", ar: "نعم" },
  coaching_val_no: { en: "No", ar: "لا" },
  coaching_val_every_2_weeks: { en: "Every 2 weeks", ar: "كل أسبوعين" },
  coaching_val_every_week: { en: "Every week", ar: "كل أسبوع" },
  coaching_val_followup: { en: "Every 2 weeks", ar: "كل أسبوعين" },
  coaching_val_reporting: { en: "Progress report every 2 weeks", ar: "تقرير تقدم كل أسبوعين" },
  coaching_val_response: { en: "48h response window", ar: "نافذة رد خلال 48 ساعة" },
  coaching_val_support: { en: "Email support", ar: "دعم عبر البريد الإلكتروني" },
  coaching_val_gold_followup: { en: "Weekly", ar: "أسبوعياً" },
  coaching_val_gold_reporting: { en: "Deep-dive report weekly", ar: "تقرير تفصيلي أسبوعياً" },
  coaching_val_gold_response: { en: "24h priority response", ar: "رد ذو أولوية خلال 24 ساعة" },
  coaching_val_gold_support: {
    en: "Priority email + weekly video review",
    ar: "دعم ذو أولوية عبر البريد الإلكتروني + مراجعة فيديو أسبوعية",
  },
  coaching_faq_title: { en: "Coaching FAQ", ar: "أسئلة شائعة عن الكوتشينج" },
  coaching_faq_general: { en: "General FAQ", ar: "الأسئلة الشائعة العامة" },
  coaching_faq_1_q: { en: "How fast do I get my plan?", ar: "ما مدى سرعة استلام خطتي؟" },
  coaching_faq_1_a: {
    en: "Plans are assembled after your intake form. Most clients receive their first program within 48 hours of purchase.",
    ar: "تُجهَّز الخطط بعد تعبئة نموذج البيانات. معظم العملاء يستلمون برنامجهم الأول خلال 48 ساعة من الشراء.",
  },
  coaching_faq_2_q: { en: "Can I switch between Silver and Gold?", ar: "هل يمكنني التبديل بين سيلفر وجولد؟" },
  coaching_faq_2_a: {
    en: "Yes — changes apply at the next billing cycle. Your progress history carries over.",
    ar: "نعم — تُطبَّق التغييرات في دورة الفوترة التالية. وسجل تقدمك ينتقل معك.",
  },
  coaching_faq_3_q: { en: "What if I miss sessions?", ar: "ماذا لو فاتتني بعض الجلسات؟" },
  coaching_faq_3_a: {
    en: "Reports are built around adherence, not perfection. Missed weeks trigger plan adjustments, not penalties.",
    ar: "التقارير مبنية على الالتزام، لا الكمال. الأسابيع الفائتة تستدعي تعديلات على الخطة، لا عقوبات.",
  },
  coaching_apply_eyebrow: { en: "Application", ar: "طلب تقديم" },
  coaching_apply_title: { en: "Apply for coaching.", ar: "قدّم على الكوتشينج." },
  coaching_apply_copy: {
    en: "Tell us where you are and where you want to be. The coach reviews every application.",
    ar: "أخبرنا أين أنت الآن وإلى أين تريد الوصول. الكوتش يراجع كل طلب.",
  },
  coaching_apply_success_title: { en: "Application received", ar: "تم استلام الطلب" },
  coaching_apply_success_copy: {
    en: "Thanks — your application was captured. Expect a response within 48 hours.",
    ar: "شكراً — تم استلام طلبك. توقّع الرد خلال 48 ساعة.",
  },
  coaching_label_full_name: { en: "Full name", ar: "الاسم الكامل" },
  coaching_label_email: { en: "Email", ar: "البريد الإلكتروني" },
  coaching_label_goal: { en: "Primary goal", ar: "الهدف الأساسي" },
  coaching_goal_muscle: { en: "Build muscle", ar: "بناء العضلات" },
  coaching_goal_fat: { en: "Lose fat", ar: "خسارة الدهون" },
  coaching_goal_strength: { en: "Get stronger", ar: "زيادة القوة" },
  coaching_goal_athletic: { en: "Athletic performance", ar: "الأداء الرياضي" },
  coaching_label_context: { en: "Your context", ar: "وضعك الحالي" },
  coaching_placeholder_context: {
    en: "Experience, schedule, current stats...",
    ar: "خبرتك، جدولك، أرقامك الحالية...",
  },
  coaching_apply_submit: { en: "Send Application", ar: "أرسل الطلب" },
  faq_eyebrow: { en: "FAQ", ar: "الأسئلة الشائعة" },
  faq_title: { en: "Frequently asked questions.", ar: "الأسئلة الشائعة." },
  faq_1_q: {
    en: "What is the difference between the training programs and online coaching?",
    ar: "ما الفرق بين برامج التدريب والكوتشينج أونلاين؟",
  },
  faq_1_a: {
    en: "Online coaching is the full service: a training AND nutrition plan built specifically for you, with continuous follow-up. The training programs are ready-to-execute plans you start immediately — no nutrition plan or follow-up — reaching your goal at the lowest cost.",
    ar: "الكوتشينج أونلاين هو الخدمة الكاملة: خطة تدريب وتغذية مبنية خصيصاً لك، مع متابعة مستمرة. برامج التدريب خطة جاهزة للتنفيذ تبدأ بها فوراً — دون خطة تغذية أو متابعة — لتصل إلى هدفك بأقل تكلفة.",
  },
  faq_2_q: {
    en: "Are the programs or coaching suitable for me if I'm a beginner?",
    ar: "هل البرامج أو الكوتشينج تناسبني إذا كنت مبتدئاً؟",
  },
  faq_2_a: {
    en: "Absolutely — the entire service respects your level, beginner or advanced. You get full instructions for everything in your program plus detailed video explanations of every exercise so you train with the best efficiency and safety.",
    ar: "بالتأكيد — الخدمة بأكملها تراعي مستواك، مبتدئاً كنت أو متقدماً. ستحصل على تعليمات كاملة لكل شيء في برنامجك مع شرح فيديو تفصيلي لكل تمرين لتتدرب بأعلى كفاءة وأمان.",
  },
  faq_3_q: {
    en: "My time is tight and I can't train often?",
    ar: "وقتي ضيق ولا أستطيع التدريب كثيراً؟",
  },
  faq_3_a: {
    en: "You decide the number of training days that suits your life. Programs range from 3 days up to 6 days a week depending on what fits your schedule.",
    ar: "أنت تحدد عدد أيام التدريب الذي يناسب حياتك. البرامج تتراوح من 3 أيام حتى 6 أيام في الأسبوع حسب ما يناسب جدولك.",
  },
  faq_4_q: {
    en: "Do these systems require an expensive gym?",
    ar: "هل تتطلب هذه الأنظمة صالة رياضية مكلفة؟",
  },
  faq_4_a: {
    en: "No. You can run the programs anywhere in the world, whatever the setup — every exercise in your plan has substitutes, and nutrition is built around what's available to you and your budget.",
    ar: "لا. يمكنك تنفيذ البرامج في أي مكان في العالم، بأي تجهيزات — كل تمرين في خطتك له بدائل، والتغذية مبنية على المتاح لك وعلى ميزانيتك.",
  },
  faq_5_q: {
    en: "How do I pick the right split for me?",
    ar: "كيف أختار التقسيمة التدريبية المناسبة لي؟",
  },
  faq_5_a: {
    en: "First ask: how many days can I commit 100% for the next 6 months? 3 days → Full Body. 4 days → Upper Lower. 5 days → PPL x Upper Lower. Then ask which split you actually enjoy.",
    ar: "اسأل نفسك أولاً: كم يوم يمكنني الالتزام به بنسبة 100% خلال الأشهر الستة القادمة؟ 3 أيام ← فول بودي. 4 أيام ← أبر لور. 5 أيام ← PPL مع أبر لور. ثم اسأل أي تقسيمة تستمتع بها فعلاً.",
  },
  faq_6_q: {
    en: "How does payment and activation work?",
    ar: "كيف تتم عملية الدفع والتفعيل؟",
  },
  faq_6_a: {
    en: "Choose your program on the website and pay with any accepted method — Vodafone Cash, Instapay, or Visa. Then send the payment screenshot with your chosen program to WhatsApp to get activated immediately.",
    ar: "اختر برنامجك من الموقع وادفع بأي وسيلة مقبولة — فودافون كاش، أو إنستاباي، أو فيزا. ثم أرسل صورة الدفع مع البرنامج المختار على واتساب ليتم تفعيلك فوراً.",
  },
  faq_7_q: {
    en: "Why is this different from anything else out there?",
    ar: "لماذا يختلف هذا عن أي شيء آخر متاح؟",
  },
  faq_7_a: {
    en: "Everything is designed on scientific principles — no random experimentation or wasted time. It's a clear system that has worked for thousands of clients, and it will work for you whatever your goal is.",
    ar: "كل شيء مصمم على مبادئ علمية — بلا تجارب عشوائية ولا وقت ضائع. إنه نظام واضح نجح مع آلاف العملاء، وسينجح معك مهما كان هدفك.",
  },
  faq_policies_title: { en: "Policies", ar: "السياسات" },
  faq_policy_refunds: { en: "Refunds", ar: "الاسترداد" },
  faq_policy_refunds_copy: {
    en: "Digital products are refundable within 14 days if the program files have not been accessed beyond the first week.",
    ar: "المنتجات الرقمية قابلة للاسترداد خلال 14 يوماً إذا لم يتم الوصول إلى ملفات البرنامج بما يتجاوز الأسبوع الأول.",
  },
  faq_policy_terms: { en: "Terms", ar: "الشروط" },
  faq_policy_terms_copy: {
    en: "Programs are licensed for personal use only. Redistribution of program files is not permitted.",
    ar: "البرامج مرخّصة للاستخدام الشخصي فقط. لا يُسمح بإعادة توزيع ملفات البرامج.",
  },
  faq_policy_privacy: { en: "Privacy", ar: "الخصوصية" },
  faq_policy_privacy_copy: {
    en: "Client intake data and progress records are stored securely and used solely for coaching purposes.",
    ar: "بيانات العملاء وسجلات التقدم تُخزَّن بشكل آمن وتُستخدم لأغراض الكوتشينج فقط.",
  },
  faq_still_questions: { en: "Still have questions?", ar: "لا يزال لديك أسئلة؟" },
  faq_contact_coach: { en: "Contact the Coach", ar: "تواصل مع الكوتش" },
  contact_title: { en: "Let's talk training.", ar: "لنتحدث عن التدريب." },
  contact_copy: {
    en: "Coaching inquiries and program questions start here — the fastest answer is WhatsApp.",
    ar: "استفسارات الكوتشينج وأسئلة البرامج تبدأ من هنا — أسرع إجابة هي واتساب.",
  },
  contact_whatsapp_fastest: { en: "WhatsApp — fastest", ar: "واتساب — الأسرع" },
  contact_label_email: { en: "Email", ar: "البريد الإلكتروني" },
  contact_based_in: { en: "Based in", ar: "المقر" },
  contact_location_line: {
    en: "{location} — coaching clients worldwide, online.",
    ar: "{location} — كوتشينج للعملاء حول العالم، أونلاين.",
  },
  contact_cta_whatsapp: { en: "Message on WhatsApp", ar: "راسلنا على واتساب" },
  contact_success_title: { en: "Message sent", ar: "تم إرسال الرسالة" },
  contact_success_copy: {
    en: "Your inquiry was captured. Expect a response within 48 hours.",
    ar: "تم استلام استفسارك. توقّع الرد خلال 48 ساعة.",
  },
  contact_label_inquiry_type: { en: "Inquiry type", ar: "نوع الاستفسار" },
  contact_option_general: { en: "General inquiry", ar: "استفسار عام" },
  contact_option_coaching: { en: "Coaching inquiry", ar: "استفسار كوتشينج" },
  contact_option_programs: { en: "Program question", ar: "سؤال عن البرامج" },
  contact_label_full_name: { en: "Full name", ar: "الاسم الكامل" },
  contact_label_phone: { en: "Phone number", ar: "رقم الهاتف" },
  contact_label_message: { en: "Message", ar: "الرسالة" },
  contact_submit: { en: "Send Message", ar: "أرسل الرسالة" },
  /* ===== Login / auth (OTP email sign-in) ===== */
  login_title_welcome: { en: "Welcome back.", ar: "أهلاً بعودتك." },
  login_label_email: { en: "Email", ar: "البريد الإلكتروني" },
  login_submit: { en: "Send sign-in link", ar: "أرسل رابط الدخول" },
  login_sending: { en: "Sending…", ar: "جارٍ الإرسال…" },
  login_check_inbox_title: { en: "Check your inbox.", ar: "افحص بريدك الإلكتروني." },
  login_use_different_email: {
    en: "Use a different email",
    ar: "استخدم بريداً إلكترونياً آخر",
  },
  login_check_inbox_email: {
    en: "We sent a temporary sign-in link to {email}. It expires after one hour.",
    ar: "أرسلنا رابط دخول مؤقت إلى {email}. تنتهي صلاحيته بعد ساعة.",
  },
  login_check_inbox_hint: {
    en: "Didn't get it? Wait a few minutes, check the spam folder, or request a new link.",
    ar: "لم يصلك البريد؟ انتظر بضع دقائق، وتفقد مجلد الرسائل غير المرغوبة، أو اطلب رابطاً جديداً.",
  },
  login_demo_submit: {
    en: "Enter the client portal (demo)",
    ar: "الدخول إلى بوابة العملاء (تجريبي)",
  },
  login_demo_note: {
    en: "Demo mode: this opens a simulated client session with sample data — nothing is sent by email.",
    ar: "وضع تجريبي: هذا يفتح جلسة عميل محاكاة ببيانات نموذجية — لا يُرسل أي بريد إلكتروني.",
  },
  login_error_rate_limit: {
    en: "Too many attempts. Wait a few minutes, then try again.",
    ar: "عدد كبير من المحاولات. انتظر بضع دقائق ثم أعد المحاولة.",
  },
  login_error_invalid_email: {
    en: "This email address doesn't look valid. Check it and try again.",
    ar: "يبدو هذا البريد الإلكتروني غير صحيح. تأكد منه وأعد المحاولة.",
  },
  login_error_generic: {
    en: "Couldn't send the sign-in email right now. Try again shortly, or contact the coach.",
    ar: "تعذّر إرسال بريد الدخول الآن. أعد المحاولة بعد قليل، أو تواصل مع الكوتش.",
  },
  auth_callback_error: {
    en: "This sign-in link is invalid or expired. Request a new one from the login page.",
    ar: "رابط الدخول غير صالح أو منتهي الصلاحية. اطلب رابطاً جديداً من صفحة الدخول.",
  },
  login_status_prefix: {
    en: "No portal access yet?",
    ar: "ليس لديك وصول للبوابة بعد؟",
  },
  login_status_cta: { en: "Start with a program", ar: "ابدأ ببرنامج" },
  checkout_confirmed_title: { en: "Order confirmed.", ar: "تم تأكيد الطلب." },
  checkout_confirmed_prefix: { en: "Order", ar: "الطلب" },
  checkout_confirmed_suffix: {
    en: "was recorded (demo). In live mode this order flows through Shopify.",
    ar: "تم تسجيله (تجريبي). في الوضع الفعلي يمر هذا الطلب عبر Shopify.",
  },
  checkout_cta_keep_exploring: { en: "Keep Exploring", ar: "تابع الاستكشاف" },
  checkout_eyebrow: { en: "Checkout", ar: "إتمام الشراء" },
  checkout_title: { en: "Complete your order.", ar: "أكمل طلبك." },
  checkout_label_full_name: { en: "Full name", ar: "الاسم الكامل" },
  checkout_label_email: { en: "Email", ar: "البريد الإلكتروني" },
  checkout_label_phone: { en: "Phone (for follow-up)", ar: "رقم الهاتف (للمتابعة)" },
  checkout_label_goal: { en: "Primary goal", ar: "الهدف الأساسي" },
  checkout_goal_muscle: { en: "Build muscle", ar: "بناء العضلات" },
  checkout_goal_fat: { en: "Lose fat", ar: "خسارة الدهون" },
  checkout_goal_strength: { en: "Get stronger", ar: "زيادة القوة" },
  checkout_goal_athletic: { en: "Athletic performance", ar: "الأداء الرياضي" },
  checkout_demo_payment: { en: "Demo payment", ar: "دفع تجريبي" },
  checkout_demo_note: {
    en: "No real payment is processed in demo mode. Card fields are intentionally omitted until the Shopify checkout integration is live.",
    ar: "لا تتم معالجة أي دفع حقيقي في الوضع التجريبي. حقول البطاقة محذوفة عمداً حتى يتم تشغيل تكامل الدفع عبر Shopify.",
  },
  checkout_simulate: { en: "Simulate Purchase — {total}", ar: "محاكاة الشراء — {total}" },
  checkout_summary_title: { en: "Order summary", ar: "ملخص الطلب" },
  checkout_total: { en: "Total", ar: "الإجمالي" },
  checkout_delivery_note: {
    en: "Digital delivery — all programs are delivered instantly after the intake form in live mode.",
    ar: "تسليم رقمي — جميع البرامج تُسلَّم فوراً بعد نموذج البيانات في الوضع الفعلي.",
  },
  cart_title: { en: "Your selection.", ar: "اختياراتك." },
  cart_empty: { en: "Your cart is empty.", ar: "سلتك فارغة." },
  cart_browse_programs: { en: "Browse Programs", ar: "تصفح البرامج" },
  cart_qty_decrease: { en: "Decrease quantity", ar: "تقليل الكمية" },
  cart_qty_increase: { en: "Increase quantity", ar: "زيادة الكمية" },
  cart_qty_remove: { en: "Remove item", ar: "إزالة العنصر" },
  cart_summary_title: { en: "Summary", ar: "الملخص" },
  cart_subtotal: { en: "Subtotal", ar: "المجموع الفرعي" },
  cart_delivery: { en: "Delivery", ar: "التوصيل" },
  cart_delivery_value: { en: "Instant (digital)", ar: "فوري (رقمي)" },
  cart_total: { en: "Total", ar: "الإجمالي" },
  cart_checkout_cta: { en: "Proceed to Checkout", ar: "إتمام الشراء" },
  cart_demo_note: {
    en: "Demo mode: checkout is simulated. Live mode will route through the Shopify checkout.",
    ar: "وضع تجريبي: الشراء محاكى. الوضع الفعلي سيمر عبر الدفع في Shopify.",
  },

  /* ===== Rebrand — homepage v2 ===== */
  hero_kicker2: { en: "Ready-made training programs — in Arabic", ar: "برامج تدريب جاهزة — بالعربي" },
  hero_headline2: { en: "The body you dream of... start building it the right way", ar: "جسمك اللي بتحلم بيه... ابدأ تبنيه صح" },
  hero_copy2: {
    en: "Practical training programs that fit your goal and your budget — clear steps that let you train with confidence, no guesswork.",
    ar: "برامج تدريبية عملية تناسب هدفك وميزانيتك، بخطوات واضحة تساعدك تتمرن بثقة ومن غير عشوائية.",
  },
  hero_cta_programs: { en: "Discover the programs", ar: "اكتشف البرامج" },
  hero_cta_coach: { en: "Meet the captain", ar: "اعرف أكتر عن الكابتن" },
  hero_trust_line: { en: "Programs for beginners and pros — 3 to 6 training days", ar: "برامج للمبتدئين والمحترفين — من 3 لـ 6 أيام تدريب" },
  float_label_coach: { en: "Your coach on the journey", ar: "مدربك في رحلتك" },
  float_label_videos: { en: "Video explanation for every exercise", ar: "شرح فيديو لكل تمرين" },
  float_label_price: { en: "Starting 380 EGP", ar: "تبدأ من 380 جنيه" },
  coach_photo_placeholder: {
    en: "Coach portrait placeholder — drop the file at public/images/coach-avatar.jpg",
    ar: "مكان صورة الكابتن — حط الملف في public/images/coach-avatar.jpg",
  },
  trust_1: { en: "Programs at fair prices", ar: "برامج بأسعار مناسبة" },
  trust_2: { en: "Perfect for beginners", ar: "مناسب للمبتدئين" },
  trust_3: { en: "Video explained exercises", ar: "شرح فيديو للتمارين" },
  trust_4: { en: "Alternatives for your setup", ar: "بدائل تناسب إمكانياتك" },
  trust_5: { en: "Vodafone Cash & Instapay", ar: "فودافون كاش و إنستاباي" },
  programs2_section_name: { en: "Training programs", ar: "برامج التدريب" },
  programs2_headline: { en: "Pick a program and start the change", ar: "اختار برنامجك وابدأ التغيير" },
  programs2_copy: { en: "You don't need to spend a lot to train correctly.", ar: "مش محتاج تدفع كتير عشان تبدأ تتمرن صح." },
  programs2_cta_all: { en: "See all programs", ar: "شوف كل البرامج" },
  level_beginner: { en: "Beginner", ar: "مبتدئ" },
  level_intermediate: { en: "Intermediate", ar: "متوسط" },
  level_advanced: { en: "Advanced", ar: "متقدم" },
  days_per_week_n: { en: "{n} days / week", ar: "{n} أيام / أسبوع" },
  why_title: { en: "Why FitForge?", ar: "ليه فيت فورج؟" },
  why_headline: { en: "You don't need a big budget to train right", ar: "مش لازم ميزانية كبيرة عشان تبدأ صح" },
  why_1_title: { en: "A clear program", ar: "برنامج واضح" },
  why_1_copy: { en: "Instead of wondering what to train every single day.", ar: "بدل ما تفضل محتار تتمرن إيه كل يوم." },
  why_2_title: { en: "Video explanations", ar: "شرح بالفيديو" },
  why_2_copy: { en: "Learn the correct performance of every exercise.", ar: "اتعلم الأداء الصحيح لكل تمرين." },
  why_3_title: { en: "Fits your time", ar: "مناسب لوقتك" },
  why_3_copy: { en: "Choose the number of days that fits your schedule.", ar: "اختار عدد أيام يناسب جدولك." },
  why_4_title: { en: "Exercise alternatives", ar: "بدائل للتمارين" },
  why_4_copy: { en: "Not every exercise needs a specific machine.", ar: "مش كل تمرين محتاج جهاز معين." },
  why_5_title: { en: "Fits your level", ar: "مناسب لمستواك" },
  why_5_copy: { en: "Whether it's your first time in a gym or you have experience.", ar: "سواء أول مرة تدخل الجيم أو عندك خبرة." },
  why_6_title: { en: "Choices that fit your budget", ar: "اختيارات تناسب ميزانيتك" },
  why_6_copy: { en: "Start with the program that suits your capabilities.", ar: "ابدأ بالبرنامج المناسب لإمكانياتك." },
  results_headline: { en: "Results speak", ar: "النتائج بتتكلم" },
  results_before: { en: "Before", ar: "قبل" },
  results_after: { en: "After", ar: "بعد" },
  results_copy: { en: "Real journeys from real clients — different goals, one method.", ar: "رحلات حقيقية من عملاء حقيقيين — أهداف مختلفة ومنهج واحد." },
  results_cta: { en: "See all transformations", ar: "شوف كل التحولات" },
  results_note: { en: "Results vary from person to person according to commitment and consistency.", ar: "النتائج بتختلف من شخص لشخص حسب الالتزام والاستمرارية." },
  results_empty: { en: "No published transformations yet — check back soon.", ar: "مفيش تحولات منشورة لسه — تابعنا قريب." },
  contact_failed_copy: {
    en: "The message could not be sent — check your details and try again, or reach us on WhatsApp.",
    ar: "الرسالة ما اتبعتتش — راجع بياناتك وحاول تاني، أو كلمنا على واتساب.",
  },
  hiw2_headline: { en: "From choosing a program to your first exercise", ar: "من اختيار البرنامج لحد أول تمرينة" },
  hiw2_step1: { en: "Pick your goal", ar: "اختار هدفك" },
  hiw2_step1_copy: { en: "Find the program that suits you.", ar: "حدد البرنامج المناسب ليك." },
  hiw2_step2: { en: "Pay easily", ar: "اشترك بسهولة" },
  hiw2_step2_copy: { en: "Choose the payment method that suits you.", ar: "اختار طريقة الدفع المناسبة." },
  hiw2_step3: { en: "Receive your program", ar: "استلم برنامجك" },
  hiw2_step3_copy: { en: "Follow the delivery instructions.", ar: "اتبع تعليمات الاستلام." },
  hiw2_step4: { en: "Start training", ar: "ابدأ التمرين" },
  hiw2_step4_copy: { en: "Watch the exercise explanations and start your plan.", ar: "شوف شرح التمارين وابدأ تنفيذ خطتك." },
  coaching2_q: { en: "Need personal follow-up?", ar: "محتاج متابعة شخصية؟" },
  coaching2_copy: {
    en: "If you need a plan built for your goal and circumstances, with continuous follow-up and adjustments — online training is your choice.",
    ar: "لو محتاج خطة معمولة على هدفك وظروفك مع متابعة وتعديلات مستمرة، التدريب الأونلاين هو اختيارك.",
  },
  coaching2_feat_personalized: { en: "Personalized training", ar: "تدريب شخصي" },
  coaching2_feat_nutrition: { en: "Nutrition planning", ar: "تخطيط التغذية" },
  coaching2_feat_followup: { en: "Ongoing follow-up", ar: "متابعة مستمرة" },
  coaching2_feat_adjustments: { en: "Program adjustments", ar: "تعديلات على البرنامج" },
  coaching2_feat_explanations: { en: "Exercise explanation", ar: "شرح التمارين" },
  coaching2_cta: { en: "Discover online training", ar: "اكتشف التدريب الأونلاين" },
  coaching2_diff: {
    en: "Ready-made program: buy it and start today. Online coaching: a plan built for you with follow-up.",
    ar: "البرنامج الجاهز: تشتريه وتبدأ النهارده. التدريب الأونلاين: خطة مبنية ليك مع متابعة شخصية.",
  },
  coach_section_q: { en: "Who is the captain?", ar: "مين الكابتن؟" },
  coach_section_copy: {
    en: "I'm Coach Adam — for years I've been training thousands of the Arabic community every week, and my goal is simple: make correct training accessible to everyone, at a price everyone can afford.",
    ar: "أنا الكابتن آدم، من سنين بشغّل مع آلاف من الناس كل أسبوع، وهدفي بسيط: أخلي التمرين الصح في متناول الكل، وبسعر يستاهله كل واحد.",
  },
  videos_section_q: { en: "Learn with me", ar: "اتعلم معايا" },
  videos_copy: {
    en: "Selected videos from my weekly content — exercise tips, common mistakes, and nutrition.",
    ar: "فيديوهات مختارة من محتواي الأسبوعي — نصائح تمرين، أخطاء شائعة، وتغذية.",
  },
  videos_cta: { en: "See all videos", ar: "شوف كل الفيديوهات" },
  video_platform_yt: { en: "YouTube", ar: "يوتيوب" },
  video_platform_ig: { en: "Instagram", ar: "انستجرام" },
  video_platform_tt: { en: "TikTok", ar: "تيك توك" },
  video_placeholder_note: {
    en: "Video previews — replace with real YouTube/Instagram content",
    ar: "معرض فيديوهات — استبدله بمحتوى يوتيوب و انستجرام الفعلي",
  },
  testimonials2_q: { en: "What people say", ar: "الكلام اللي بنسمعه" },
  testimonials2_title: { en: "Feedback from trainees", ar: "ملاحظات المتدربين" },
  final_q: { en: "What are you waiting for to start?", ar: "مستني إيه عشان تبدأ؟" },
  final_copy2: {
    en: "Pick your program and take the first step toward a stronger body and more active life.",
    ar: "اختار برنامجك وخد أول خطوة ناحية جسم أقوى وحياة أنشط.",
  },
  final_cta2: { en: "Start with your program", ar: "ابدأ ببرنامجك" },
  footer_programs: { en: "Training programs", ar: "برامج التدريب" },
  footer_coaching: { en: "Online training", ar: "التدريب الأونلاين" },
  footer_transformations: { en: "Transformations", ar: "التحولات" },
  footer_videos: { en: "Videos", ar: "الفيديوهات" },
  footer_contact: { en: "Contact", ar: "تواصل معي" },
  footer_privacy: { en: "Privacy policy", ar: "سياسة الخصوصية" },
  footer_terms: { en: "Terms and conditions", ar: "الشروط والأحكام" },
  footer_explore3d: { en: "3D muscle explorer", ar: "استكشاف العضلات ثلاثي الأبعاد" },
  nav_home: { en: "Home", ar: "الرئيسية" },
  nav_results: { en: "Results", ar: "النتائج" },
  nav_whoami: { en: "About", ar: "من أنا" },
  nav_start_now: { en: "Start now", ar: "ابدأ دلوقتي" },
  wa_float_label: { en: "Ask on WhatsApp", ar: "اسأل على واتساب" },

  /* ===== About page ===== */
  about_q: { en: "About", ar: "من أنا" },
  about_headline: { en: "A coach obsessed with the process", ar: "كوتش مهووس بالتنفيذ الصح" },
  about_copy: {
    en: "FitForge Coaching exists to bring scientific training to people who want real outcomes — structured programming, honest accountability, and progress you can measure week over week.",
    ar: "فيت فورج كوتشينج موجود عشان يجيب التدريب العلمي لكل الناس اللي عايزة نتيجة حقيقية — برمجة منظمة، ومتابعة صادقة، وتقدم تراه بعينك أسبوع ورا أسبوع.",
  },
  about_1_title: { en: "Coach-led programs", ar: "برامج من الكابتن بنفسه" },
  about_1_copy: {
    en: "Every training split and full program is designed and reviewed by the coach — never recycled templates.",
    ar: "كل تقسيمة وكل برنامج معهود عليه من الكابتن بنفسه — مفيش قوالب جاهزة متكررة.",
  },
  about_2_title: { en: "Education first", ar: "التعليم الأول" },
  about_2_copy: {
    en: "Clients learn why exercises are chosen. Workout education and exercise explanations are part of the plan.",
    ar: "العملاء بيفهموا ليه كل تمرين موجود لهم. شرح التمارين جزء من الخطة نفسها.",
  },
  about_3_title: { en: "Community + accountability", ar: "كوميونيتي + التزام" },
  about_3_copy: {
    en: "A fitness community and structured check-ins keep progress social, honest, and consistent.",
    ar: "كوميونيتي فيتنس ومتابعات منظمة تخلي تقدمك الاجتماعي والصادق والمستمر.",
  },
  about_quote: {
    en: "Build beyond your limits — but build in a way you can sustain for the next decade.",
    ar: "ابنِ أكبر من حدودك — بس بطريقة تقدر تكمل معاك عشر سنين جاية.",
  },
  about_quote_by: { en: "— Coach Adam", ar: "— الكابتن آدم" },

  /* ===== Transformations page ===== */
  transformations_q: { en: "Transformations", ar: "التحولات" },
  transformations_headline: { en: "Journeys measured in checkpoints", ar: "رحلات محسوبة بمحطات" },
  transformations_copy: {
    en: "Instead of a before/after wall, we show the process: assessment weeks, volume phases, and peak blocks — each with measurable outcomes.",
    ar: "بدل صورتين قبل وبعد، بنعرض العملية كلها: أسابيع تقييم، مراحل بناء، وبلوكات الذروة — كل مرحلة بنتيجة معلومة.",
  },
  transformations_note: {
    en: "Demo content shown. Real client transformations will replace these entries — never presented without verified consent.",
    ar: "محتوى تجريبي. التحولات الحقيقية للعملاء هتظهر هنا بعد موافقتهم — عمرنا ما بنعرض حاجة من غير إذن صريح.",
  },

  /* ===== Client portal (shell + hub) ===== */
  portal_title: { en: "Client Portal", ar: "بوابة العملاء" },
  portal_greeting: { en: "Welcome back, {name}.", ar: "أهلاً بعودتك، {name}." },
  portal_signout: { en: "Sign out", ar: "تسجيل الخروج" },
  portal_footer_note: {
    en: "FitForge Coaching — client portal",
    ar: "فيت فورج — بوابة العملاء",
  },
  portal_nav_home: { en: "Home", ar: "الرئيسية" },
  portal_nav_chat: { en: "Chat", ar: "المحادثة" },
  portal_nav_progress: { en: "Progress", ar: "التقدم" },
  portal_nav_renewal: { en: "Renewal", ar: "التجديد" },
  portal_banner_active: {
    en: "Your subscription is active until {date}.",
    ar: "اشتراكك نشط حتى {date}.",
  },
  portal_banner_history_only: {
    en: "Your subscription period has ended — your history stays available read-only, while new submissions and coach chat are paused. Renew to regain full access.",
    ar: "انتهت مدة اشتراكك — يبقى سجلك متاحاً للقراءة فقط، بينما توقفت الإرساليات الجديدة والمحادثة مع الكوتش. جدّد اشتراكك لاستعادة الوصول الكامل.",
  },
  portal_banner_suspended: {
    en: "Portal access is temporarily suspended. Contact the coach for details.",
    ar: "تم إيقاف الوصول إلى البوابة مؤقتاً. تواصل مع الكوتش لمعرفة التفاصيل.",
  },
  portal_banner_revoked: {
    en: "Portal access was revoked after a full refund. Contact the coach if you believe this is a mistake.",
    ar: "تم إلغاء الوصول إلى البوابة بعد الاسترداد الكامل للمبلغ. تواصل مع الكوتش إذا كنت ترى أن ذلك خطأ.",
  },
  portal_banner_pending: {
    en: "Eligibility invite awaiting verification — in the meantime you can complete your onboarding details.",
    ar: "دعوة الأهلية بانتظار التحقق — يمكنك في هذه الأثناء إكمال بيانات الالتحاق.",
  },
  portal_hub_eyebrow: { en: "Your portal", ar: "بوابتك" },
  portal_hub_title: { en: "Everything in one place.", ar: "كل شيء في مكان واحد." },
  portal_card_onboarding_title: {
    en: "Complete onboarding",
    ar: "إكمال بيانات الالتحاق",
  },
  portal_card_onboarding_desc: {
    en: "Share your intake details so the coach can build your plan.",
    ar: "أكمل بيانات التحاقك حتى يبني الكوتش خطتك.",
  },
  portal_card_chat_title: { en: "Coach chat", ar: "المحادثة مع الكوتش" },
  portal_card_chat_desc: {
    en: "Direct follow-up with the coach — questions, feedback, and plan adjustments.",
    ar: "متابعة مباشرة مع الكوتش — أسئلة وملاحظات وتعديلات على الخطة.",
  },
  portal_card_checkins_title: { en: "Weekly check-ins", ar: "المتابعات الأسبوعية" },
  portal_card_checkins_desc: {
    en: "Submit your weekly stats and read the coach's feedback.",
    ar: "أرسل أرقامك الأسبوعية واطلع على ملاحظات الكوتش.",
  },
  portal_card_progress_title: {
    en: "Progress & history",
    ar: "التقدم والسجل",
  },
  portal_card_progress_desc: {
    en: "Track your measurements and check-in history over time.",
    ar: "تابع قياساتك وسجل متابعاتك عبر الزمن.",
  },
  portal_card_renewal_title: { en: "Renewal", ar: "التجديد" },
  portal_card_renewal_desc: {
    en: "Renew or extend your subscription.",
    ar: "جدّد اشتراكك أو مدّد مدته.",
  },
  portal_card_locked: { en: "Locked", ar: "مقفل" },
  portal_card_readonly: { en: "Read-only", ar: "قراءة فقط" },
  /* ===== Portal renewal hub (request-only) ===== */
  renewal_title: { en: "Renewal", ar: "التجديد" },
  renewal_intro: {
    en: "Your subscription, your payments and renewal requests — all in one place.",
    ar: "اشتراكك ومدفوعاتك وطلبات التجديد — كلها في مكان واحد.",
  },
  renewal_sub_card_title: { en: "Current subscription", ar: "اشتراكك الحالي" },
  renewal_sub_code: { en: "Subscription code", ar: "كود الاشتراك" },
  renewal_sub_period: { en: "Subscription period", ar: "فترة الاشتراك" },
  renewal_package_unknown: { en: "Coaching package", ar: "باقة الكوتشنج" },
  renewal_price_demo_note: {
    en: "Demo placeholder price — not a real offer.",
    ar: "سعر توضيحي للعرض فقط — وليس عرضًا حقيقيًا.",
  },
  renewal_status_active: { en: "Active", ar: "نشط" },
  renewal_status_expired: { en: "Expired", ar: "منتهي" },
  renewal_status_cancelled: { en: "Cancelled", ar: "ملغي" },
  renewal_status_refunded: { en: "Refunded", ar: "مُسترد" },
  renewal_status_disputed: { en: "Under review", ar: "قيد المراجعة" },
  renewal_status_suspended: { en: "Suspended", ar: "موقوف" },
  renewal_status_pending: { en: "Pending", ar: "قيد التفعيل" },
  renewal_notice_active_title: { en: "You're all set", ar: "اشتراكك يعمل بشكل جيد" },
  renewal_notice_active_body: {
    en: "Your coaching access is live. You can request an early renewal any time — it activates only after your verified payment, and your account stays the same.",
    ar: "وصولك للكوتشنج مفعّل. يمكنك طلب التجديد المبكر في أي وقت — ولن يُفعَّل إلا بعد الدفع الموثّق، وحسابك يبقى كما هو.",
  },
  renewal_notice_expired_title: { en: "Period ended", ar: "انتهت فترة اشتراكك" },
  renewal_notice_expired_body: {
    en: "Your subscription has expired — history stays readable, but new access paused. Request a renewal to restore it; activation happens only after your verified payment.",
    ar: "انتهت فترة اشتراكك — السجل يظل متاحًا للقراءة، والوصول الجديد متوقف. اطلب التجديد لاستعادة الوصول؛ ويُفعَّل فقط بعد الدفع الموثّق.",
  },
  renewal_notice_cancelled_title: { en: "Subscription cancelled", ar: "اشتراكك ملغي" },
  renewal_notice_cancelled_body: {
    en: "Your subscription was cancelled. You keep access until the end of the paid period; after that, history stays readable and renewal requests restore your access once payment is verified.",
    ar: "تم إلغاء اشتراكك. يبقى وصولك حتى نهاية الفترة المدفوعة؛ بعدها يظل السجل متاحًا للقراءة، وطلب التجديد يعيد الوصول بعد توثيق الدفع.",
  },
  renewal_notice_refunded_title: { en: "Payment refunded", ar: "تم استرداد الدفعة" },
  renewal_notice_refunded_body: {
    en: "A full refund was recorded and access is paused. A new verified payment is required to reactivate — the coach can help you complete it.",
    ar: "تم تسجيل استرداد كامل للدفعة والوصول متوقف. مطلوب دفعة موثقة جديدة لإعادة التفعيل — والمدرب يقدر يساعدك في إتمامها.",
  },
  renewal_notice_disputed_title: { en: "Payment under review", ar: "مشكلتك قيد المراجعة" },
  renewal_notice_disputed_body: {
    en: "Your payment is under dispute review and access is paused. Nothing changes automatically — the coach reviews and resolves with you directly.",
    ar: "دفعتك قيد النزاع وتحت المراجعة والوصول متوقف. لا يتغير شيء تلقائيًا — المدرب يراجع الحالة ويحسمها معك مباشرة.",
  },
  renewal_notice_suspended_title: { en: "Access paused", ar: "الوصول متوقف مؤقتًا" },
  renewal_notice_suspended_body: {
    en: "Your access is paused pending review. Contact the coach directly — a renewal request records your intent, but activation waits for the review outcome.",
    ar: "وصولك متوقف بانتظار المراجعة. تواصل مع المدرب مباشرة — طلب التجديد يسجل رغبتك، لكن التفعيل ينتظر نتيجة المراجعة.",
  },
  renewal_notice_pending_title: { en: "Activation pending", ar: "التفعيل قيد الانتظار" },
  renewal_notice_pending_body: {
    en: "Your subscription is pending activation. Complete the onboarding steps and the verified payment, and the coach will switch it on.",
    ar: "اشتراكك قيد التفعيل. أكمل خطوات التأسيس والدفع الموثّق، والمدرب هيفعّل اشتراكك.",
  },
  renewal_cta_active: { en: "Early renewal", ar: "تجديد مسبق" },
  renewal_cta: { en: "Request renewal", ar: "اطلب التجديد" },
  renewal_cta_note: {
    en: "Requesting never activates anything by itself — your payment completes through the store, and a verified payment event is what restores access.",
    ar: "طلب التجديد وحده لا يفعّل أي شيء — الدفع يتم عبر المتجر، والوصول يُستعاد فقط بعد حدث دفع موثّق.",
  },
  renewal_package_label: { en: "Preferred package", ar: "الباقة المفضلة" },
  renewal_package_no_pref: { en: "No preference", ar: "بدون تفضيل" },
  renewal_submit: { en: "Send renewal request", ar: "أرسل طلب التجديد" },
  renewal_submitting: { en: "Sending…", ar: "جاري الإرسال…" },
  renewal_requested_title: { en: "Request received", ar: "وصل طلبك" },
  renewal_requested_body: {
    en: "The coach has your renewal request. To complete it, finish the payment through the store — your access restores automatically once the payment is verified.",
    ar: "وصل طلب التجديد للمدرب. لإتمام التجديد، أكمل الدفع عبر المتجر — ويرجع وصولك تلقائيًا بعد توثيق الدفع.",
  },
  renewal_requested_ref: { en: "Request reference: {ref}", ar: "مرجع الطلب: {ref}" },
  renewal_requested_whatsapp: { en: "Message the coach on WhatsApp", ar: "راسل المدرب على واتساب" },
  renewal_requested_again: { en: "Send another request", ar: "أرسل طلبًا آخر" },
  renewal_requested_error_title: { en: "Couldn't send the request", ar: "تعذر إرسال الطلب" },
  renewal_requested_error_body: {
    en: "Something went wrong while recording your request — please retry, or contact the coach on WhatsApp.",
    ar: "حدث خطأ أثناء تسجيل طلبك — حاول مرة أخرى، أو تواصل مع المدرب على واتساب.",
  },
  renewal_requests_title: { en: "Your renewal requests", ar: "طلبات التجديد الخاصة بك" },
  renewal_orders_title: { en: "Your payments", ar: "مدفوعاتك" },
  renewal_orders_error: {
    en: "Couldn't load your payments right now — the subscription and requests above are unaffected.",
    ar: "تعذر تحميل مدفوعاتك الآن — الاشتراك والطلبات أعلاه لم تتأثر.",
  },
  renewal_orders_empty: { en: "No payments recorded yet", ar: "لا توجد مدفوعات مسجلة بعد" },
  renewal_order_ref: { en: "Order", ar: "الطلب" },
  renewal_order_product: { en: "Product", ar: "المنتج" },
  renewal_order_amount: { en: "Amount", ar: "المبلغ" },
  renewal_order_status: { en: "Status", ar: "الحالة" },
  renewal_order_date: { en: "Date", ar: "التاريخ" },
  renewal_request_ref: { en: "Reference", ar: "المرجع" },
  renewal_request_package: { en: "Package", ar: "الباقة" },
  renewal_request_date: { en: "Requested", ar: "تاريخ الطلب" },
  renewal_timeline_title: { en: "Subscription timeline", ar: "سجل اشتراكك" },
  renewal_events_empty: { en: "No events recorded yet", ar: "لا توجد أحداث مسجلة بعد" },
  renewal_event_payment_verified: { en: "Payment verified", ar: "تم توثيق الدفع" },
  renewal_event_activated: { en: "Activated", ar: "تم التفعيل" },
  renewal_event_renewed: { en: "Renewed", ar: "تم التجديد" },
  renewal_event_extended: { en: "Extended", ar: "تم التمديد" },
  renewal_event_cancelled: { en: "Cancelled", ar: "تم الإلغاء" },
  renewal_event_expired: { en: "Expired", ar: "انتهت الفترة" },
  renewal_event_refunded_full: { en: "Refunded (full)", ar: "استرداد كامل" },
  renewal_event_refunded_partial: { en: "Refunded (partial)", ar: "استرداد جزئي" },
  renewal_event_dispute_opened: { en: "Dispute opened", ar: "نزاع مفتوح" },
  renewal_event_dispute_resolved: { en: "Dispute resolved", ar: "نزاع محسوم" },
  renewal_error_title: { en: "Couldn't load your renewal hub", ar: "تعذر تحميل صفحة التجديد" },
  renewal_error_body: {
    en: "Something went wrong while loading your subscription — refresh the page, and contact the coach if it persists.",
    ar: "حدث خطأ أثناء تحميل اشتراكك — حدّث الصفحة، وتواصل مع المدرب لو استمرت المشكلة.",
  },

  portal_period_ends: { en: "Period ends {date}", ar: "تنتهي الفترة في {date}" },

  /* ===== Portal onboarding form (BC-03 native surface) ===== */
  onboarding_title: {
    en: "Complete onboarding",
    ar: "إكمال بيانات الالتحاق",
  },
  onboarding_intro: {
    en: "Five minutes to fill in; the coach uses these details to build your program.",
    ar: "خمس دقائق تعبئة — الكوتش بيستخدم هذه البيانات لبناء برنامجك.",
  },
  onboarding_label_full_name: { en: "Full name", ar: "الاسم الكامل" },
  onboarding_label_phone: { en: "WhatsApp number", ar: "رقم الواتساب" },
  onboarding_label_email: { en: "Email", ar: "البريد الإلكتروني" },
  onboarding_email_locked: {
    en: "Your verified login email — not editable.",
    ar: "بريد الدخول الموثوق لك — غير قابل للتعديل.",
  },
  onboarding_label_goal: {
    en: "Primary fitness goal",
    ar: "بهدف الاشتراك",
  },
  onboarding_goal_weight: { en: "Weight loss", ar: "خسارة وزن" },
  onboarding_goal_muscle: { en: "Muscle gain", ar: "زيادة عضل" },
  onboarding_goal_fitness: { en: "General fitness", ar: "لياقة عامة" },
  onboarding_goal_nutrition: { en: "Nutrition", ar: "تغذية" },
  onboarding_goal_injury: {
    en: "Post-injury rehab",
    ar: "ترميم بعد إصابة",
  },
  onboarding_goal_hint: {
    en: "Pick a quick option or write your own.",
    ar: "اختر خياراً سريعاً أو اكتب هدفك بنفسك.",
  },
  onboarding_label_days: {
    en: "Training days per week",
    ar: "أيام التدريب أسبوعياً",
  },
  onboarding_days_1_2: { en: "1–2 days", ar: "1-2 أيام" },
  onboarding_days_3_4: { en: "3–4 days", ar: "3-4 أيام" },
  onboarding_days_5_6: { en: "5–6 days", ar: "5-6 أيام" },
  onboarding_label_location: {
    en: "Training location",
    ar: "مكان التدريب",
  },
  onboarding_location_gym: { en: "The gym", ar: "النادي" },
  onboarding_location_home: { en: "At home", ar: "المنزل" },
  onboarding_label_level: {
    en: "Current level",
    ar: "المستوى الحالي",
  },
  onboarding_level_beginner: { en: "Beginner", ar: "مبتدئ" },
  onboarding_level_intermediate: { en: "Intermediate", ar: "متوسط" },
  onboarding_level_advanced: { en: "Advanced", ar: "متقدم" },
  onboarding_label_health: {
    en: "Injuries / health notes",
    ar: "إصابات أو ملاحظات صحية",
  },
  onboarding_health_hint: {
    en: "Optional — anything the coach should know.",
    ar: "اختياري — أي شيء يجب أن يعرفه الكوتش.",
  },
  onboarding_label_referral: {
    en: "How did you hear about us?",
    ar: "كيف سمعت عنّا؟",
  },
  onboarding_label_extra: {
    en: "Anything else?",
    ar: "أي شيء إضافي؟",
  },
  onboarding_submit: { en: "Submit onboarding", ar: "إرسال بيانات الالتحاق" },
  onboarding_submitting: { en: "Submitting…", ar: "جارٍ الإرسال…" },
  onboarding_success_title: {
    en: "Onboarding submitted.",
    ar: "تم إرسال بيانات الالتحاق.",
  },
  onboarding_success_body: {
    en: "The coach received your details and will reach out with your plan.",
    ar: "استلم الكوتش بياناتك وسيتواصل معك بخطتك.",
  },
  onboarding_error_required: {
    en: "Please enter your full name.",
    ar: "يرجى إدخال الاسم الكامل.",
  },
  onboarding_error_generic: {
    en: "Something went wrong — please try again.",
    ar: "حدث خطأ ما — يرجى المحاولة مرة أخرى.",
  },
  // (no i18n "already completed" error string: a 409 renders the terminal
  // "completed" card instead of an inline message; see OnboardingForm)
  onboarding_error_unavailable: {
    en: "Your onboarding isn't open right now — please contact the coach.",
    ar: "التحاقك غير متاح حالياً — يرجى التواصل مع الكوتش.",
  },
  onboarding_completed_title: {
    en: "All set.",
    ar: "تم إكمال التحاقك.",
  },
  onboarding_completed_body: {
    en: "Your onboarding details were already submitted — nothing pending here.",
    ar: "تم إرسال بيانات التحاقك سابقاً — لا يوجد شيء مطلوب هنا.",
  },
  onboarding_no_request_title: {
    en: "No open onboarding",
    ar: "لا يوجد التحاق مفتوح",
  },
  onboarding_no_request_body: {
    en: "There is no onboarding request open for your account right now. Contact the coach if this looks wrong.",
    ar: "لا يوجد طلب التحاق مفتوح لحسابك حالياً. تواصل مع الكوتش إذا رأيت أن ذلك خطأ.",
  },
  onboarding_back_to_hub: {
    en: "Back to portal",
    ar: "العودة إلى البوابة",
  },

  /* ===== Portal follow-up chat (BC-06 client tunnel) ===== */
  followup_title: { en: "Follow-up chat", ar: "محادثة المتابعة" },
  followup_intro: {
    en: "One thread for everything — your web messages and the Telegram history from the coach in a single place.",
    ar: "مسار واحد لكل شيء — رسائلك من الموقع وسجل تيليجرام من الكوتش في مكان واحد.",
  },
  followup_thread_aria: {
    en: "Conversation with the coach",
    ar: "المحادثة مع الكوتش",
  },
  followup_input_label: { en: "Message the coach", ar: "راسل الكوتش" },
  followup_placeholder: {
    en: "Write your question or update…",
    ar: "اكتب سؤالك أو ملاحظتك…",
  },
  followup_hint: {
    en: "Up to 2000 characters per message.",
    ar: "حتى 2000 حرف لكل رسالة.",
  },
  followup_send: { en: "Send", ar: "إرسال" },
  followup_sending: { en: "Sending…", ar: "جارٍ الإرسال…" },
  followup_empty: {
    en: "No messages yet — say hello to your coach.",
    ar: "لا توجد رسائل بعد — رحّب بكوتشك.",
  },
  followup_badge_telegram: { en: "Telegram", ar: "تيليجرام" },
  followup_telegram_note: {
    en: "Messages from Telegram are part of the same thread — read-only history here.",
    ar: "رسائل تيليجرام جزء من نفس المحادثة — سجل للقراءة فقط هنا.",
  },
  followup_history_banner: {
    en: "Your subscription period has ended — the conversation stays visible for reading, but sending is paused. Renew to reply to the coach.",
    ar: "انتهت مدة اشتراكك — المحادثة تبقى ظاهرة للقراءة، لكن الإرسال متوقف. جدّد لتراسل الكوتش من جديد.",
  },
  followup_locked_title: { en: "Chat locked", ar: "المحادثة مقفلة" },
  followup_locked_body: {
    en: "Chatting with the coach needs an active subscription — renew your plan to reopen the conversation with the coach.",
    ar: "المحادثة مع الكوتش تحتاج اشتراكاً نشطاً — جدّد باقتك لإعادة فتح المحادثة مع الكوتش.",
  },
  followup_locked_cta: {
    en: "Renew subscription",
    ar: "جدّد اشتراكك",
  },
  /* ===== Portal check-ins + progress (Task 8) ===== */
  checkins_section_title: { en: "Check-ins", ar: "المتابعات" },
  checkins_section_intro: {
    en: "Send your weekly card and read the coach's feedback.",
    ar: "أرسل بطاقتك الأسبوعية واطلع على ملاحظات الكوتش.",
  },
  checkins_section_empty: {
    en: "No open check-in right now — a new card appears here as soon as it is scheduled.",
    ar: "مفيش بطاقة مفتوحة حالياً — أول ما تفتح بطاقة جديدة هتلاقيها هنا.",
  },
  checkins_blocked_body: {
    en: "Check-ins are paused with your subscription state — renew to reopen the cards and the history.",
    ar: "المتابعات متوقفة مع حالة اشتراكك — جدّد الباقة لفتح البطاقات والسجل.",
  },
  checkins_readonly_banner: {
    en: "Your subscription period has ended — open cards stay read-only and your history remains available.",
    ar: "انتهت مدة اشتراكك — البطاقات المفتوحة للقراءة فقط وسجلك يبقى متاحاً.",
  },
  checkins_loading: {
    en: "Loading check-ins…",
    ar: "جارٍ تحميل المتابعات…",
  },
  checkins_error: {
    en: "Couldn't load your check-ins.",
    ar: "تعذر تحميل المتابعات.",
  },
  checkins_retry: { en: "Try again", ar: "حاول تاني" },
  checkins_view_history: { en: "View history", ar: "عرض السجل" },
  checkins_submit_cta: { en: "Fill check-in", ar: "املأ البطاقة" },
  checkins_history_note: {
    en: "Full history and trends live in the progress page.",
    ar: "السجل الكامل والرسوم في صفحة التقدم.",
  },
  checkins_period: { en: "Period {label}", ar: "الفترة {label}" },
  checkins_due: { en: "Due {date}", ar: "آخر موعد: {date}" },
  checkins_due_unknown: {
    en: "No due date set",
    ar: "بدون موعد محدد",
  },

  checkin_title: { en: "Weekly check-in", ar: "البطاقة الأسبوعية" },
  checkin_intro: {
    en: "This week's numbers — weight or measurements, adherence and energy. The coach reviews and replies.",
    ar: "أرقام الأسبوع ده — الوزن أو القياسات والالتزام والطاقة. الكوتش بيراجعها ويرد عليك.",
  },
  checkin_label_weight: {
    en: "Current weight (kg)",
    ar: "الوزن الحالي (كجم)",
  },
  checkin_last_weight: {
    en: "Last recorded weight: {weight} kg",
    ar: "آخر وزن مسجل: {weight} كجم",
  },
  checkin_label_measurements: {
    en: "Measurements (cm) — optional",
    ar: "القياسات (سم) — اختياري",
  },
  checkin_measurements_hint: {
    en: "Fill what you can — a weight or any single measurement is enough.",
    ar: "اكمل اللي تقدر عليه — الوزن أو أي قياس واحد يكفي.",
  },
  checkin_measure_chest: { en: "Chest", ar: "الصدر" },
  checkin_measure_waist: { en: "Waist", ar: "الوسط" },
  checkin_measure_hips: { en: "Hips", ar: "الأرداف" },
  checkin_measure_arm: { en: "Arm", ar: "الذراع" },
  checkin_measure_thigh: { en: "Thigh", ar: "الفخذ" },
  checkin_label_training_days: {
    en: "Training days completed (0–7)",
    ar: "أيام التمرين المنفذة (0-7)",
  },
  checkin_label_workout_pct: {
    en: "Workout adherence",
    ar: "الالتزام بالتمرين",
  },
  checkin_label_nutrition_pct: {
    en: "Nutrition adherence",
    ar: "الالتزام بالتغذية",
  },
  checkin_label_energy: { en: "Energy level (1–10)", ar: "مستوى الطاقة (1-10)" },
  checkin_label_sleep: { en: "Sleep quality (1–10)", ar: "جودة النوم (1-10)" },
  checkin_label_difficulties: {
    en: "Difficulties or injuries this week",
    ar: "صعوبات أو إصابات هذا الأسبوع",
  },
  checkin_label_feedback: {
    en: "Notes for the coach",
    ar: "ملاحظات للكوتش",
  },
  checkin_label_photos: {
    en: "Progress photos (optional)",
    ar: "صور التقدم (اختياري)",
  },
  checkin_photos_hint: {
    en: "Up to 3 photos — JPG, PNG or WebP, max 10MB each. Photos are private to you and your coach.",
    ar: "حتى 3 صور — JPG أو PNG أو WebP وبحد أقصى 10 ميجا للصورة. الصور خاصة ليك وللكوتش فقط.",
  },
  checkin_photos_remaining: {
    en: "{count} spots left",
    ar: "متبقي {count} أماكن",
  },
  checkin_photo_add: { en: "Add photo", ar: "إضافة صورة" },
  checkin_photo_uploading: { en: "Uploading…", ar: "جارٍ الرفع…" },
  checkin_photo_remove: { en: "Remove", ar: "إزالة" },
  checkin_submit: { en: "Send check-in", ar: "إرسال البطاقة" },
  checkin_submitting: { en: "Sending…", ar: "جارٍ الإرسال…" },
  checkin_error_required: {
    en: "Enter your weight or at least one measurement.",
    ar: "أدخل الوزن أو قياساً واحداً على الأقل.",
  },
  checkin_error_range: {
    en: "A value is outside the allowed range — check the weight, measurements and percentages.",
    ar: "في قيمة خارج النطاق المسموح — راجع الوزن والقياسات والنسب.",
  },
  checkin_error_photo_limit: {
    en: "Up to 3 photos per check-in.",
    ar: "الحد الأقصى 3 صور للبطاقة الواحدة.",
  },
  checkin_error_photo_type: {
    en: "Only JPG, PNG or WebP images are supported.",
    ar: "الصور المسموحة JPG أو PNG أو WebP فقط.",
  },
  checkin_error_photo_size: {
    en: "That image is larger than 10MB.",
    ar: "حجم الصورة أكبر من 10 ميجا.",
  },
  checkin_error_photo_failed: {
    en: "The photo didn't upload — please try again.",
    ar: "فشل رفع الصورة — جرّب تاني.",
  },
  checkin_error_locked: {
    en: "Submitting is unavailable right now — your plan doesn't include check-ins.",
    ar: "الإرسال غير متاح حالياً — باقتك لا تتضمن المتابعات.",
  },
  checkin_error_already: {
    en: "This period was already submitted.",
    ar: "تم إرسال هذه الفترة بالفعل.",
  },
  checkin_error_generic: {
    en: "The check-in wasn't sent — check your connection and try again.",
    ar: "لم يتم إرسال البطاقة — تحقق من الاتصال وحاول مرة أخرى.",
  },
  checkin_success_title: {
    en: "Check-in sent.",
    ar: "تم إرسال البطاقة.",
  },
  checkin_success_body: {
    en: "The coach received your numbers and notes — the reply lands in your progress history after review.",
    ar: "استلم الكوتش أرقامك وملاحظاتك — هيظهر الرد في سجل التقدم بعد المراجعة.",
  },
  checkin_already_title: {
    en: "Check-in already sent.",
    ar: "البطاقة مُرسلة بالفعل.",
  },
  checkin_already_body: {
    en: "This period was submitted already — its details stay in your progress history.",
    ar: "هذه الفترة تم إرسالها بالفعل — تفاصيلها موجودة في سجل التقدم.",
  },
  checkin_locked_title: { en: "Submitting locked", ar: "الإرسال مقفول" },
  checkin_locked_body: {
    en: "Weekly check-ins need an active subscription — renew your plan to send a new one.",
    ar: "البطاقات الأسبوعية تحتاج اشتراكاً نشطاً — جدّد باقتك لإرسال متابعة جديدة.",
  },
  checkin_readonly_body: {
    en: "Your subscription period has ended — your history stays available read-only and new check-ins are paused until renewal.",
    ar: "انتهت مدة اشتراكك — سجلك يبقى متاحاً للقراءة فقط وإرسال البطاقات متوقف لحد التجديد.",
  },
  checkin_notfound_title: {
    en: "Check-in unavailable",
    ar: "البطاقة غير متاحة",
  },
  checkin_notfound_body: {
    en: "This link isn't available for your account — go back to the portal and pick a check-in from the list.",
    ar: "الرابط ده مش متاح لحسابك — ارجع للبوابة واختر متابعة من القائمة.",
  },
  checkin_go_progress: { en: "Progress history", ar: "سجل التقدم" },
  checkin_summary_weight: {
    en: "Recorded weight: {weight} kg",
    ar: "الوزن المسجل: {weight} كجم",
  },

  progress_title: { en: "Progress & history", ar: "التقدم والسجل" },
  progress_intro: {
    en: "Your past check-ins, measurements and coach notes — everything in one place.",
    ar: "بطاقاتك السابقة والقياسات وملاحظات الكوتش — كل حاجة في مكان واحد.",
  },
  progress_readonly_banner: {
    en: "Your subscription period has ended — history stays readable, while new check-ins are paused until renewal.",
    ar: "انتهت مدة اشتراكك — السجل يبقى متاحاً للقراءة وإرسال بطاقات جديدة متوقف لحد التجديد.",
  },
  progress_empty_title: { en: "No history yet", ar: "لا يوجد سجل حتى الآن" },
  progress_empty_body: {
    en: "Your first weekly card will appear here with weight, measurements and the coach's feedback.",
    ar: "أول بطاقة أسبوعية تبعتها هتظهر هنا مع الوزن والقياسات وملاحظات الكوتش.",
  },
  progress_cta_checkin: { en: "Send a check-in", ar: "أرسل بطاقة جديدة" },
  progress_cta_note: {
    en: "Ready for this week's check-in?",
    ar: "جاهز لبطاقة الأسبوع؟",
  },
  progress_weight_chart_title: { en: "Weight trend", ar: "تطور الوزن" },
  progress_waist_chart_title: { en: "Waist trend", ar: "محيط الوسط" },
  progress_units_kg: { en: "kg", ar: "كجم" },
  progress_units_cm: { en: "cm", ar: "سم" },
  progress_chart_empty: {
    en: "Not enough data for a chart yet.",
    ar: "لا توجد قياسات كافية للرسم بعد.",
  },
  progress_photos_note: {
    en: "Photo links are signed and temporary (10 minutes) and regenerate on every page open — images stay private to you and your coach.",
    ar: "روابط الصور موقّعة ومؤقتة (10 دقايق) وتتولد مع كل فتح للصفحة — الصور خاصة ليك وللكوتش فقط.",
  },
  progress_blocked_title: {
    en: "History unavailable",
    ar: "السجل غير متاح",
  },
  progress_blocked_body: {
    en: "History access is paused with your subscription state — renew or contact the coach to restore it.",
    ar: "الوصول للسجل متوقف مع حالة اشتراكك — جدّد أو تواصل مع الكوتش لاستعادته.",
  },
  progress_error_title: {
    en: "Couldn't load your history",
    ar: "تعذر تحميل السجل",
  },
  progress_error_body: {
    en: "Something went wrong while loading your data — refresh the page, and contact the coach if it persists.",
    ar: "حصلت مشكلة أثناء تحميل بياناتك — حدّث الصفحة، ولو استمرت المشكلة تواصل مع الكوتش.",
  },
  progress_review_none: { en: "Awaiting review", ar: "بانتظار المراجعة" },
  progress_review_pending: { en: "In review", ar: "قيد المراجعة" },
  progress_review_approved: { en: "Approved", ar: "معتمد" },
  progress_review_needs_work: { en: "Needs work", ar: "يحتاج تحسين" },
  progress_review_label: { en: "Coach feedback", ar: "ملاحظات الكوتش" },
  progress_submitted_on: { en: "Submitted {date}", ar: "أُرسلت في {date}" },
  progress_submitted_unknown: {
    en: "Submission date unavailable",
    ar: "تاريخ الإرسال غير متاح",
  },
  progress_metric_weight: { en: "Weight", ar: "الوزن" },
  progress_metric_days: { en: "Training days", ar: "أيام التمرين" },
  progress_metric_workout: { en: "Workout", ar: "التمرين" },
  progress_metric_nutrition: { en: "Nutrition", ar: "التغذية" },
  progress_metric_energy: { en: "Energy", ar: "الطاقة" },
  progress_metric_sleep: { en: "Sleep", ar: "النوم" },
  progress_photo_alt: {
    en: "Progress photo from a past check-in",
    ar: "صورة تقدم من بطاقة سابقة",
  },
  progress_photo_unavailable: {
    en: "Photo unavailable",
    ar: "الصورة غير متاحة",
  },
  followup_error_required: {
    en: "Write a message first.",
    ar: "اكتب رسالة أولاً.",
  },
  followup_error_too_long: {
    en: "Messages are limited to 2000 characters.",
    ar: "الرسائل محدودة بـ 2000 حرف.",
  },
  followup_error_locked: {
    en: "Sending is unavailable right now — your plan doesn't include chat.",
    ar: "الإرسال غير متاح حالياً — باقتك لا تتضمن المحادثة.",
  },
  followup_error_generic: {
    en: "The message wasn't sent — check your connection and try again.",
    ar: "لم تُرسل الرسالة — تحقق من الاتصال وحاول مرة أخرى.",
  },
};

type I18nCtx = { lang: Lang; t: (k: keyof typeof DICT) => string; setLang: (l: Lang) => void };

const Ctx = createContext<I18nCtx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ar");

  useEffect(() => {
    const saved = window.localStorage.getItem("bc_lang");
    if (saved === "ar" || saved === "en") setLangState(saved);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    window.localStorage.setItem("bc_lang", l);
  };

  const t = (k: keyof typeof DICT) => {
    const entry = DICT[k];
    if (!entry) return String(k);
    return lang === "ar" ? entry.ar : entry.en;
  };

  return <Ctx.Provider value={{ lang, t, setLang }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
