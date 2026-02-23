// Mini ICOP-like hierarchy + symptom nodes (DEMO subset)
// You can expand nodes/edges as needed.

const KG_NODES = [
  // ICOP hierarchy nodes
  { data: { id: "icop_l1_msk", label: "ICOP L1: Musculoskeletal orofacial pain", type: "icop" } },
  { data: { id: "icop_l2_tmd", label: "ICOP L2: Temporomandibular disorders (TMD)", type: "icop" } },
  { data: { id: "icop_l3_myalgia", label: "ICOP L3: Myalgia", type: "icop" } },
  { data: { id: "icop_l3_arthralgia", label: "ICOP L3: Arthralgia", type: "icop" } },
  { data: { id: "icop_l3_disc", label: "ICOP L3: Disc displacement (w/ reduction)", type: "icop" } },

  // Symptom / feature nodes
  { data: { id: "sx_jaw_pain", label: "Jaw / preauricular pain", type: "symptom" } },
  { data: { id: "sx_chewing_worse", label: "Worse with chewing", type: "symptom" } },
  { data: { id: "sx_clicking", label: "Clicking / joint noise", type: "symptom" } },
  { data: { id: "sx_limited_opening", label: "Limited opening", type: "symptom" } },
  { data: { id: "sx_morning_stiffness", label: "Morning stiffness", type: "symptom" } },
  { data: { id: "sx_tender_muscle", label: "Muscle tenderness", type: "symptom" } },
  { data: { id: "sx_joint_tender", label: "TMJ tenderness", type: "symptom" } },
  { data: { id: "sx_deviation", label: "Deviation/deflection on opening", type: "symptom" } },
  { data: { id: "sx_locking", label: "Locking / difficulty closing", type: "symptom" } },
  { data: { id: "sx_trauma", label: "History of trauma", type: "symptom" } },
  { data: { id: "sx_preauricular_joint_pain", label: "Preauricular (joint-localized) pain", type: "symptom" } },
];

const KG_EDGES = [
  // Hierarchy edges
  { data: { id: "e_l1_l2", source: "icop_l1_msk", target: "icop_l2_tmd", rel: "parent_of" } },
  { data: { id: "e_l2_m", source: "icop_l2_tmd", target: "icop_l3_myalgia", rel: "parent_of" } },
  { data: { id: "e_l2_a", source: "icop_l2_tmd", target: "icop_l3_arthralgia", rel: "parent_of" } },
  { data: { id: "e_l2_d", source: "icop_l2_tmd", target: "icop_l3_disc", rel: "parent_of" } },

  // Symptom links (demo associations)
  { data: { id: "e_myalgia_sx1", source: "icop_l3_myalgia", target: "sx_jaw_pain", rel: "has_symptom" } },
  { data: { id: "e_myalgia_sx2", source: "icop_l3_myalgia", target: "sx_chewing_worse", rel: "has_symptom" } },
  { data: { id: "e_myalgia_sx3", source: "icop_l3_myalgia", target: "sx_morning_stiffness", rel: "has_symptom" } },
  { data: { id: "e_myalgia_sx4", source: "icop_l3_myalgia", target: "sx_tender_muscle", rel: "has_symptom" } },

  { data: { id: "e_arth_sx1", source: "icop_l3_arthralgia", target: "sx_jaw_pain", rel: "has_symptom" } },
  { data: { id: "e_arth_sx2", source: "icop_l3_arthralgia", target: "sx_joint_tender", rel: "has_symptom" } },
  { data: { id: "e_arth_sx3", source: "icop_l3_arthralgia", target: "sx_chewing_worse", rel: "has_symptom" } },

  { data: { id: "e_disc_sx1", source: "icop_l3_disc", target: "sx_clicking", rel: "has_symptom" } },
  { data: { id: "e_disc_sx2", source: "icop_l3_disc", target: "sx_limited_opening", rel: "has_symptom" } },
  { data: { id: "e_disc_sx3", source: "icop_l3_disc", target: "sx_jaw_pain", rel: "has_symptom" } },
  { data: { id: "e_disc_sx4", source: "icop_l3_disc", target: "sx_deviation", rel: "has_symptom" } },
  { data: { id: "e_disc_sx5", source: "icop_l3_disc", target: "sx_locking", rel: "has_symptom" } },
  { data: { id: "e_disc_sx6", source: "icop_l3_disc", target: "sx_trauma", rel: "has_symptom" } },
  { data: { id: "e_arth_sx4", source: "icop_l3_arthralgia", target: "sx_preauricular_joint_pain", rel: "has_symptom" } },
  
];

// Example “case library” (synthetic) used for similarity retrieval.
// diagnosisNodeId tells the graph what to highlight when retrieved.
const CASE_LIBRARY = [
  {
    id: "case_001",
    title: "Case 001 (Myalgia-like)",
    diagnosisNodeId: "icop_l3_myalgia",
    text:
      "Unilateral jaw pain. Worse with chewing. Morning stiffness. Muscle tenderness. No strong joint noise."
  },
  {
    id: "case_002",
    title: "Case 002 (Disc displacement-like)",
    diagnosisNodeId: "icop_l3_disc",
    text:
      "Clicking in TMJ with opening and chewing. Intermittent limitation of opening. Joint noise prominent."
  },
  {
    id: "case_003",
    title: "Case 003 (Arthralgia-like)",
    diagnosisNodeId: "icop_l3_arthralgia",
    text:
      "Preauricular pain with chewing and palpation. TMJ tenderness. Pain localized to the joint."
  },
  {
    id: "case_004",
    title: "Case 004 (Mixed TMD features)",
    diagnosisNodeId: "icop_l3_disc",
    text:
      "Joint noise plus limited opening, pain near TMJ, worse with function. Clicking is frequent."
  }  ,
  {
    id: "case_005",
    title: "Case 005 (Dru: popping + deflection + trauma)",
    diagnosisNodeId: "icop_l3_disc",
    text:
      "Bilateral TMJ concerns since 2020 with worsening. Jaw and ear popping predominantly right side. History of trauma to side of head. Significant deflection to the right on opening. Pain on right lateral capsule and masseter."
  },
  {
    id: "case_006",
    title: "Case 006 (Follow-up: splint + Botox, partial improvement)",
    diagnosisNodeId: "icop_l3_myalgia",
    text:
      "Follow-up visit for stabilization splint adjustment. Wears splint most nights; feels limited benefit. Botox reduced migraines. Overall improvement about 10%. Voluntary opening normal. Splint adjusted for balance and comfort."
  },
  {
    id: "case_007",
    title: "Case 007 (Toni: clicking + episodic locking / difficulty closing)",
    diagnosisNodeId: "icop_l3_arthralgia",
    text:
      "Preauricular stabbing pain infrequent with wide opening/yawning. Feels jaw dislocates; once or twice had difficulty closing after opening wide. Clicking present. Deviation to the left. Mild lateral capsule tenderness and multiple muscle tender points."
  }
];
// Student-facing scenario notes (what appears in the textarea)
const DEMO_NOTES = [
  {
    id: "demo_001",
    title: "Case 1 — Dru (popping + deflection + trauma history)",
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
    title: "Case 3 — Toni (clicking + episodic locking/difficulty closing)",
    note: `Chief complaint: Clicking/popping and jaw pain.

History: Preauricular severe stabbing pain infrequent with wide opening/yawning (1–2 times/month). Feels jaw dislocates; once or twice had difficulty closing after opening wide.

Exam: Clicking present. Deviation on opening. Mild lateral capsule tenderness; multiple masticatory muscle tender points.`
  }

];
  // Confusable alternative mapping for formative feedback
const CONFUSABLE_MAP = {
  icop_l3_myalgia: "icop_l3_arthralgia",
  icop_l3_arthralgia: "icop_l3_myalgia",
  icop_l3_disc: "icop_l3_arthralgia"
}
];
