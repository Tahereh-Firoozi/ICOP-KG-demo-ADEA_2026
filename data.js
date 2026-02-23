// data.js
// ICOP-informed mini knowledge graph for teaching + formative assessment demo
// (TMJ pain + myofascial pain subset)
// ------------------------------------------------------------

// -------------------- Nodes --------------------
const KG_NODES = [
  // ===== ICOP Level-1 roots (by ICOP chapter numbering) =====
  // 2. Myofascial orofacial pain
  { data: { id: "icop_2", label: "ICOP 2: Myofascial orofacial pain", type: "icop" } },

  // 3. Temporomandibular joint (TMJ) pain
  { data: { id: "icop_3", label: "ICOP 3: Temporomandibular joint (TMJ) pain", type: "icop" } },

  // ===== ICOP Level-2: Primary vs Secondary =====
  // 2.1 Primary myofascial orofacial pain
  { data: { id: "icop_2_1", label: "ICOP 2.1: Primary myofascial pain", type: "icop" } },

  // 2.2 Secondary myofascial orofacial pain
  { data: { id: "icop_2_2", label: "ICOP 2.2: Secondary myofascial pain", type: "icop" } },

  // 3.1 Primary temporomandibular joint pain
  { data: { id: "icop_3_1", label: "ICOP 3.1: Primary TMJ pain", type: "icop" } },

  // 3.2 Secondary temporomandibular joint pain
  { data: { id: "icop_3_2", label: "ICOP 3.2: Secondary TMJ pain", type: "icop" } },

  // ===== ICOP deeper levels (subset) =====
  // --- Myofascial (simple sub-branches; you can expand later) ---
  { data: { id: "icop_2_1_1", label: "ICOP 2.1.1: Acute primary myofascial pain", type: "icop" } },
  { data: { id: "icop_2_1_2", label: "ICOP 2.1.2: Chronic primary myofascial pain", type: "icop" } },

  // Secondary myofascial causes (ICOP lists tendonitis/myositis/spasm)
  { data: { id: "icop_2_2_1", label: "ICOP 2.2.1: Myofascial pain attributed to tendonitis", type: "icop" } },
  { data: { id: "icop_2_2_2", label: "ICOP 2.2.2: Myofascial pain attributed to myositis", type: "icop" } },
  { data: { id: "icop_2_2_3", label: "ICOP 2.2.3: Myofascial pain attributed to muscle spasm", type: "icop" } },

  // --- TMJ pain: Primary (3.1.*) ---
  { data: { id: "icop_3_1_1", label: "ICOP 3.1.1: Acute primary TMJ pain", type: "icop" } },
  { data: { id: "icop_3_1_2", label: "ICOP 3.1.2: Chronic primary TMJ pain", type: "icop" } },

  // --- TMJ pain: Secondary (3.2.*) ---
  // ICOP explicitly defines these subforms:
  { data: { id: "icop_3_2_1", label: "ICOP 3.2.1: TMJ pain attributed to arthritis", type: "icop" } },
  { data: { id: "icop_3_2_2", label: "ICOP 3.2.2: TMJ pain attributed to disc displacement", type: "icop" } },
  { data: { id: "icop_3_2_3", label: "ICOP 3.2.3: TMJ pain attributed to degenerative joint disease", type: "icop" } },
  { data: { id: "icop_3_2_4", label: "ICOP 3.2.4: TMJ pain attributed to subluxation", type: "icop" } },

  // Disc displacement deeper nodes (ICOP 3.2.2.*)
  { data: { id: "icop_3_2_2_1", label: "ICOP 3.2.2.1: Disc displacement w/ reduction", type: "icop" } },
  { data: { id: "icop_3_2_2_1_1", label: "ICOP 3.2.2.1.1: …with intermittent locking", type: "icop" } },
  { data: { id: "icop_3_2_2_2", label: "ICOP 3.2.2.2: Disc displacement w/o reduction", type: "icop" } },

  // Arthritis subtypes (ICOP 3.2.1.*)
  { data: { id: "icop_3_2_1_1", label: "ICOP 3.2.1.1: …non-systemic arthritis", type: "icop" } },
  { data: { id: "icop_3_2_1_2", label: "ICOP 3.2.1.2: …systemic arthritis", type: "icop" } },

  // ===== Symptom / feature nodes =====
  { data: { id: "sx_jaw_pain", label: "Jaw / preauricular pain", type: "symptom" } },
  { data: { id: "sx_preauricular_joint_pain", label: "Preauricular (joint-localized) pain", type: "symptom" } },
  { data: { id: "sx_chewing_worse", label: "Worse with chewing / function", type: "symptom" } },
  { data: { id: "sx_clicking", label: "Clicking / popping / snapping", type: "symptom" } },
  { data: { id: "sx_limited_opening", label: "Limited mouth opening", type: "symptom" } },
  { data: { id: "sx_locking", label: "Locking / catching (open/close)", type: "symptom" } },
  { data: { id: "sx_deviation", label: "Deviation/deflection on opening", type: "symptom" } },
  { data: { id: "sx_joint_tender", label: "TMJ tenderness on palpation", type: "symptom" } },
  { data: { id: "sx_tender_muscle", label: "Masticatory muscle tenderness", type: "symptom" } },
  { data: { id: "sx_morning_stiffness", label: "Morning stiffness", type: "symptom" } },
  { data: { id: "sx_trauma", label: "History of trauma", type: "symptom" } },
];

// -------------------- Edges --------------------
const KG_EDGES = [
  // Roots -> Primary/Secondary
  { data: { id: "e_2_2_1", source: "icop_2", target: "icop_2_1", rel: "parent_of" } },
  { data: { id: "e_2_2_2", source: "icop_2", target: "icop_2_2", rel: "parent_of" } },

  { data: { id: "e_3_3_1", source: "icop_3", target: "icop_3_1", rel: "parent_of" } },
  { data: { id: "e_3_3_2", source: "icop_3", target: "icop_3_2", rel: "parent_of" } },

  // Myofascial expansions
  { data: { id: "e_2_1_a", source: "icop_2_1", target: "icop_2_1_1", rel: "parent_of" } },
  { data: { id: "e_2_1_c", source: "icop_2_1", target: "icop_2_1_2", rel: "parent_of" } },

  { data: { id: "e_2_2_t", source: "icop_2_2", target: "icop_2_2_1", rel: "parent_of" } },
  { data: { id: "e_2_2_m", source: "icop_2_2", target: "icop_2_2_2", rel: "parent_of" } },
  { data: { id: "e_2_2_s", source: "icop_2_2", target: "icop_2_2_3", rel: "parent_of" } },

  // Primary TMJ expansions
  { data: { id: "e_3_1_a", source: "icop_3_1", target: "icop_3_1_1", rel: "parent_of" } },
  { data: { id: "e_3_1_c", source: "icop_3_1", target: "icop_3_1_2", rel: "parent_of" } },

  // Secondary TMJ expansions (3.2.*)
  { data: { id: "e_3_2_ar", source: "icop_3_2", target: "icop_3_2_1", rel: "parent_of" } },
  { data: { id: "e_3_2_dd", source: "icop_3_2", target: "icop_3_2_2", rel: "parent_of" } },
  { data: { id: "e_3_2_djd", source: "icop_3_2", target: "icop_3_2_3", rel: "parent_of" } },
  { data: { id: "e_3_2_sub", source: "icop_3_2", target: "icop_3_2_4", rel: "parent_of" } },

  // Disc displacement deeper
  { data: { id: "e_dd_wr", source: "icop_3_2_2", target: "icop_3_2_2_1", rel: "parent_of" } },
  { data: { id: "e_dd_wr_lock", source: "icop_3_2_2_1", target: "icop_3_2_2_1_1", rel: "parent_of" } },
  { data: { id: "e_dd_wor", source: "icop_3_2_2", target: "icop_3_2_2_2", rel: "parent_of" } },

  // Arthritis deeper
  { data: { id: "e_ar_nonsys", source: "icop_3_2_1", target: "icop_3_2_1_1", rel: "parent_of" } },
  { data: { id: "e_ar_sys", source: "icop_3_2_1", target: "icop_3_2_1_2", rel: "parent_of" } },

  // -------------------- Symptom links (demo associations) --------------------
  // Myofascial (chronic primary)
  { data: { id: "e_myo_sx1", source: "icop_2_1_2", target: "sx_jaw_pain", rel: "has_symptom" } },
  { data: { id: "e_myo_sx2", source: "icop_2_1_2", target: "sx_chewing_worse", rel: "has_symptom" } },
  { data: { id: "e_myo_sx3", source: "icop_2_1_2", target: "sx_tender_muscle", rel: "has_symptom" } },
  { data: { id: "e_myo_sx4", source: "icop_2_1_2", target: "sx_morning_stiffness", rel: "has_symptom" } },

  // Primary TMJ (chronic)
  { data: { id: "e_ptmj_sx1", source: "icop_3_1_2", target: "sx_preauricular_joint_pain", rel: "has_symptom" } },
  { data: { id: "e_ptmj_sx2", source: "icop_3_1_2", target: "sx_chewing_worse", rel: "has_symptom" } },
  { data: { id: "e_ptmj_sx3", source: "icop_3_1_2", target: "sx_joint_tender", rel: "has_symptom" } },

  // Disc displacement w/ reduction
  { data: { id: "e_ddwr_sx1", source: "icop_3_2_2_1", target: "sx_clicking", rel: "has_symptom" } },
  { data: { id: "e_ddwr_sx2", source: "icop_3_2_2_1", target: "sx_chewing_worse", rel: "has_symptom" } },
  { data: { id: "e_ddwr_sx3", source: "icop_3_2_2_1", target: "sx_deviation", rel: "has_symptom" } },

  // …with intermittent locking
  { data: { id: "e_ddwrlock_sx1", source: "icop_3_2_2_1_1", target: "sx_locking", rel: "has_symptom" } },
  { data: { id: "e_ddwrlock_sx2", source: "icop_3_2_2_1_1", target: "sx_limited_opening", rel: "has_symptom" } },

  // Disc displacement w/o reduction
  { data: { id: "e_ddwor_sx1", source: "icop_3_2_2_2", target: "sx_locking", rel: "has_symptom" } },
  { data: { id: "e_ddwor_sx2", source: "icop_3_2_2_2", target: "sx_limited_opening", rel: "has_symptom" } },
  { data: { id: "e_ddwor_sx3", source: "icop_3_2_2_2", target: "sx_chewing_worse", rel: "has_symptom" } },

  // Arthritis
  { data: { id: "e_ar_sx1", source: "icop_3_2_1", target: "sx_preauricular_joint_pain", rel: "has_symptom" } },
  { data: { id: "e_ar_sx2", source: "icop_3_2_1", target: "sx_joint_tender", rel: "has_symptom" } },
  { data: { id: "e_ar_sx3", source: "icop_3_2_1", target: "sx_chewing_worse", rel: "has_symptom" } },

  // DJD (very simplified)
  { data: { id: "e_djd_sx1", source: "icop_3_2_3", target: "sx_preauricular_joint_pain", rel: "has_symptom" } },

  // Subluxation
  { data: { id: "e_sub_sx1", source: "icop_3_2_4", target: "sx_locking", rel: "has_symptom" } },
  { data: { id: "e_sub_sx2", source: "icop_3_2_4", target: "sx_jaw_pain", rel: "has_symptom" } },
];

// -------------------- Case library (retrieval examples) --------------------
// IMPORTANT: diagnosisNodeId should point to the level you want to highlight for teaching.
// With deeper ICOP nodes, pick more specific nodes when you can.
const CASE_LIBRARY = [
  {
    id: "case_001",
    title: "Case 001 (Chronic primary myofascial pain)",
    diagnosisNodeId: "icop_2_1_2",
    text:
      "Unilateral jaw pain. Worse with chewing. Morning stiffness. Muscle tenderness. No strong joint noise."
  },
  {
    id: "case_002",
    title: "Case 002 (Disc displacement w/ reduction)",
    diagnosisNodeId: "icop_3_2_2_1",
    text:
      "Clicking/popping with opening and chewing. Joint noise prominent. Some deviation on opening."
  },
  {
    id: "case_003",
    title: "Case 003 (Chronic primary TMJ pain)",
    diagnosisNodeId: "icop_3_1_2",
    text:
      "Preauricular pain with chewing and palpation. TMJ tenderness. Pain localized to the joint."
  },
  {
    id: "case_004",
    title: "Case 004 (Disc displacement w/ reduction + intermittent locking)",
    diagnosisNodeId: "icop_3_2_2_1_1",
    text:
      "Clicking plus intermittent jaw locking with limited opening that unlocks. Function provokes symptoms."
  },
  {
    id: "case_005",
    title: "Case 005 (Dru: popping + deflection + trauma history)",
    diagnosisNodeId: "icop_3_2_2_1",
    text:
      "Jaw and ear popping predominantly right side. History of trauma to side of head. Deflection to the right on opening. Pain on right lateral capsule and masseter."
  },
  {
    id: "case_006",
    title: "Case 006 (Follow-up: splint + Botox, partial improvement)",
    diagnosisNodeId: "icop_2_1_2",
    text:
      "Follow-up for stabilization splint adjustment. Wears splint most nights; limited benefit. Botox reduced migraines. Overall improvement about 10%. Voluntary opening normal."
  },
  {
    id: "case_007",
    title: "Case 007 (Toni: clicking + episodic difficulty closing)",
    diagnosisNodeId: "icop_3_2_2_1_1",
    text:
      "Clicking present. Infrequent wide-opening episodes with difficulty closing and a sense of dislocation. Deviation on opening. Lateral capsule tenderness and multiple muscle tender points."
  }
];

// -------------------- Student-facing demo notes --------------------
const DEMO_NOTES = [
  {
    id: "demo_001",
    title: "Case 1 — popping + deflection + trauma history)",
    note: `Chief Complaint: Bone growth in the mandible; ongoing TMJ concerns.

History: Jaw joint pain since early 2020; worsening over years. Jaw and ear popping predominantly on the right side. Trauma to side of head ~1 year before onset.

Exam: Significant deflection to the right on opening. Pain on right lateral capsule and masseter.`
  },
  {
    id: "demo_002",
    title: "Case 2 — Splint follow-up + Botox (improving)",
    note: `Follow-up: Third splint adjustment.

Symptoms: Wears stabilization splint most nights; feels limited benefit. Botox through neurologist (4 rounds) reduced migraines. Overall improvement ~10%.

Exam: Voluntary opening normal. Splint adjusted for balance and comfort.`
  },
  {
    id: "demo_003",
    title: "Case 3 — clicking + episodic locking/difficulty closing",
    note: `Chief complaint: Clicking/popping and jaw pain.

History: Preauricular severe stabbing pain infrequent with wide opening/yawning (1–2 times/month). Feels jaw dislocates; once or twice had difficulty closing after opening wide.

Exam: Clicking present. Deviation on opening. Mild lateral capsule tenderness; multiple masticatory muscle tender points.`
  }
];

// -------------------- Optional symptom option list (for assessment UI) --------------------
const SYMPTOM_OPTIONS = [
  { id: "sx_preauricular_joint_pain", label: "Preauricular (joint-localized) pain" },
  { id: "sx_jaw_pain", label: "Jaw / preauricular pain" },
  { id: "sx_chewing_worse", label: "Worse with chewing / function" },
  { id: "sx_clicking", label: "Clicking / popping / snapping" },
  { id: "sx_limited_opening", label: "Limited mouth opening" },
  { id: "sx_locking", label: "Locking / catching" },
  { id: "sx_deviation", label: "Deviation/deflection on opening" },
  { id: "sx_joint_tender", label: "TMJ tenderness on palpation" },
  { id: "sx_tender_muscle", label: "Masticatory muscle tenderness" },
  { id: "sx_morning_stiffness", label: "Morning stiffness" },
  { id: "sx_trauma", label: "History of trauma" }
];

// Confusable alternative mapping for formative feedback (optional fallback)
const CONFUSABLE_MAP = {
  icop_2_1_2: "icop_3_1_2",        // myofascial vs primary TMJ pain (confusable clinically)
  icop_3_1_2: "icop_3_2_2_1",      // primary TMJ pain vs disc displacement w/ reduction
  icop_3_2_2_1: "icop_3_1_2",      // disc displacement w/ reduction vs primary TMJ pain
  icop_3_2_2_1_1: "icop_3_2_2_1",  // intermittent locking variant vs base w/ reduction
  icop_3_2_2_2: "icop_3_2_4"       // w/o reduction vs subluxation (demo-ish)
};
