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
  login_title_welcome: { en: "Welcome back.", ar: "أهلاً بعودتك." },
  login_title_recovery: { en: "Recover access", ar: "استعادة الوصول" },
  login_label_email: { en: "Email", ar: "البريد الإلكتروني" },
  login_label_password: { en: "Password", ar: "كلمة المرور" },
  login_submit: { en: "Sign In", ar: "تسجيل الدخول" },
  login_forgot: { en: "Forgot your password?", ar: "نسيت كلمة المرور؟" },
  login_notice_not_connected: {
    en: "Client area is not connected to Supabase Authentication yet — this experience is ready for future integration. Please contact the coach.",
    ar: "منطقة العملاء غير متصلة بـ Supabase Authentication بعد — هذه التجربة جاهزة للتكامل مستقبلاً. يرجى التواصل مع الكوتش.",
  },
  login_notice_recovery_simulated: {
    en: "Recovery link simulated. An email would be dispatched when authentication is live.",
    ar: "رابط الاستعادة تجريبي. ستُرسل رسالة البريد الإلكتروني عند تشغيل نظام المصادقة الفعلي.",
  },
  login_label_account_email: { en: "Account email", ar: "بريد الحساب" },
  login_submit_recovery: { en: "Send Recovery Link", ar: "أرسل رابط الاستعادة" },
  login_back_to_signin: { en: "Back to sign in", ar: "العودة لتسجيل الدخول" },
  login_status_prefix: {
    en: "Account status: this portal is prepared for Supabase Authentication integration. New here?",
    ar: "حالة الحساب: هذه البوابة مهيأة للتكامل مع Supabase Authentication. جديد هنا؟",
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
  why_title: { en: "Why Belghamdi?", ar: "ليه بالغامدي؟" },
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
    en: "I'm Coach Belghamdi — for years I've been training thousands of the Arabic community every week, and my goal is simple: make correct training accessible to everyone, at a price everyone can afford.",
    ar: "أنا الكابتن بالغامدي، من سنين بشغّل مع آلاف من الناس كل أسبوع، وهدفي بسيط: أخلي التمرين الصح في متناول الكل، وبسعر يستاهله كل واحد.",
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
    en: "Belghamdi Coaching exists to bring scientific training to people who want real outcomes — structured programming, honest accountability, and progress you can measure week over week.",
    ar: "بالغامدي كوتشينج موجود عشان يجيب التدريب العلمي لكل الناس اللي عايزة نتيجة حقيقية — برمجة منظمة، ومتابعة صادقة، وتقدم تراه بعينك أسبوع ورا أسبوع.",
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
  about_quote_by: { en: "— Coach Belghamdi", ar: "— الكابتن بالغامدي" },

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
