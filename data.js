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
  }
];
