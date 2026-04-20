

import {
  CRYSTAL_SYSTEM_CHOICES,
  CENTRING_TYPE_CHOICES,
  MIRROR_PLANE_CHOICES,
  GLIDE_PLANE_CHOICES,
  SCREW_AXIS_CHOICES,
  SCREW_TYPE_CHOICES,
  CENTRING_EXTINCTION_CHOICES,
  GLIDE_EXTINCTION_CHOICES,
  SCREW_EXTINCTION_CHOICES,
} from "@/data/choices";
import {
  detectMirrorPlaneAxes,
  detectGlidePlaneTypes,
  detectScrewAxisTypes,
  detectScrewTypes,
  detectCentringExtinction,
  detectGlideExtinctions,
  detectScrewExtinctions,
  analyzeScrewLikeOperation,
  type ScrewOperationAnalysis,
  type Axis,
} from "@/logic/symmetry";

export type AnswerValue = "◯" | "✕" | string | string[];

export type Statement = {
  id: string;
  text: string;
  answer: boolean | string | string[];
  choices?: { value: string; label: string }[];
  multiSelect?: boolean;
};
export type QuizHistoryItem = {
  id: string;
  hm: string;
  hall: string;
  score: number;
  total: number;
};

export type SpacegroupEntry = {
  gemmi_index: number;
  international_number: number;
  hm: string;
  xhm: string;
  short_name: string;
  hall: string;
  qualifier: string;
  ext: string;
  centring_type: string;
  crystal_system: string;
  point_group_hm: string;
  is_centrosymmetric: boolean;
  is_enantiomorphic: boolean;
  is_sohncke: boolean;
  is_symmorphic: boolean;
  has_mirror: boolean;
  has_glide: boolean;
  has_screw: boolean;
  n_operations: number;
  operations_xyz: string[];
  basisop_xyz: string;
  spglib_identified: boolean;
  hall_number: number | null;
  spglib_international: string | null;
  spglib_international_full: string | null;
  spglib_hall_symbol: string | null;
  spglib_choice: string | null;
  pointgroup_international: string | null;
  pointgroup_schoenflies: string | null;
  arithmetic_crystal_class_number: number | null;
  arithmetic_crystal_class_symbol: string | null;
};

export function tfLabel(value: boolean): "◯" | "✕" {
  return value ? "◯" : "✕";
}

export function pickRandomEntry(entries: SpacegroupEntry[]): SpacegroupEntry {
  return entries[Math.floor(Math.random() * entries.length)];
}

export function crystalSystemLabel(value: string): string {
  const found = CRYSTAL_SYSTEM_CHOICES.find((c) => c.value === value);
  return found ? found.label : value;
}

export function centringTypeLabel(value: string): string {
  const found = CENTRING_TYPE_CHOICES.find((c) => c.value === value);
  return found ? found.label : value;
}

export function mirrorPlaneLabel(value: string): string {
  const found = MIRROR_PLANE_CHOICES.find((c) => c.value === value);
  return found ? found.label : value;
}

export function glidePlaneLabel(value: string): string {
  const found = GLIDE_PLANE_CHOICES.find((c) => c.value === value);
  return found ? found.label : value;
}

export function screwAxisLabel(value: string): string {
  const found = SCREW_AXIS_CHOICES.find((c) => c.value === value);
  return found ? found.label : value;
}

export function screwTypeLabel(value: string): string {
  const found = SCREW_TYPE_CHOICES.find((c) => c.value === value);
  return found ? found.label : value;
}

export function centringExtinctionLabel(value: string | string[]): string {
  if (Array.isArray(value)) {
    return value
      .map((v) => {
        const found = CENTRING_EXTINCTION_CHOICES.find((c) => c.value === v);
        return found ? found.label : v;
      })
      .join(" / ");
  }
  const found = CENTRING_EXTINCTION_CHOICES.find((c) => c.value === value);
  return found ? found.label : value;
}

export function glideExtinctionLabel(value: string | string[]): string {
  if (Array.isArray(value)) {
    return value
      .map((v) => {
        const found = GLIDE_EXTINCTION_CHOICES.find((c) => c.value === v);
        return found ? found.label : v;
      })
      .join(" / ");
  }
  const found = GLIDE_EXTINCTION_CHOICES.find((c) => c.value === value);
  return found ? found.label : value;
}

export function screwExtinctionLabel(value: string | string[]): string {
  if (Array.isArray(value)) {
    return value
      .map((v) => {
        const found = SCREW_EXTINCTION_CHOICES.find((c) => c.value === v);
        return found ? found.label : v;
      })
      .join(" / ");
  }
  const found = SCREW_EXTINCTION_CHOICES.find((c) => c.value === value);
  return found ? found.label : value;
}

function screwExtinctionMod(screwType: ScrewOperationAnalysis["screwType"]): number {
  switch (screwType) {
    case "21":
      return 2;
    case "31":
    case "32":
      return 3;
    case "41":
    case "43":
      return 4;
    case "42":
      return 2;
    case "61":
    case "65":
      return 6;
    case "62":
    case "64":
      return 3;
    case "63":
      return 2;
    default:
      return 1;
  }
}

function screwReflectionLabel(axis: Axis): string {
  return axis === "x" ? "h00" : axis === "y" ? "0k0" : "00l";
}

function screwIndexLabel(axis: Axis): string {
  return axis === "x" ? "h" : axis === "y" ? "k" : "l";
}

export function getExtinctionConditions(entry: SpacegroupEntry): string[] {
  const conditions: string[] = [];

  switch (entry.centring_type) {
    case "A":
      conditions.push("A 格子: k + l = 2n");
      break;
    case "B":
      conditions.push("B 格子: h + l = 2n");
      break;
    case "C":
      conditions.push("C 格子: h + k = 2n");
      break;
    case "I":
      conditions.push("I 格子: h + k + l = 2n");
      break;
    case "F":
      conditions.push("F 格子: h + k = 2n");
      conditions.push("F 格子: h + l = 2n");
      conditions.push("F 格子: k + l = 2n");
      break;
    case "R":
      conditions.push("R 格子: -h + k + l = 3n（hexagonal setting の代表例）");
      break;
    default:
      break;
  }

  const seenScrew = new Set<string>();
  for (const op of entry.operations_xyz) {
    const screw = analyzeScrewLikeOperation(op);
    if (!screw) continue;
    const key = `${screw.axis}-${screw.screwType}`;
    if (seenScrew.has(key)) continue;
    seenScrew.add(key);

    const mod = screwExtinctionMod(screw.screwType);
    const reflection = screwReflectionLabel(screw.axis);
    const index = screwIndexLabel(screw.axis);
    conditions.push(`${screw.screwType[0]}_${screw.screwType.slice(1)} screw: ${reflection} で ${index} = ${mod}n`);
  }

  if (conditions.length === 0) {
    conditions.push("代表的な消滅条件なし");
  }

  return conditions;
}

export function makeQuiz(entry: SpacegroupEntry): Statement[] {
  return [
    {
      id: "crystal-system-choice",
      text: "この空間群の結晶系を選んでください。",
      answer: entry.crystal_system,
      choices: CRYSTAL_SYSTEM_CHOICES.map((choice) => ({ ...choice })),
    },
    {
      id: "centring",
      text: "この空間群の格子形式（centring type）を選んでください。",
      answer: entry.centring_type,
      choices: CENTRING_TYPE_CHOICES.map((choice) => ({ ...choice })),
    },
    {
      id: "inversion",
      text: "この空間群は反転中心を持つ。",
      answer: entry.is_centrosymmetric,
    },
    {
      id: "mirror",
      text: "この空間群の鏡映面はどの軸に垂直かをすべて選んでください。",
      answer: detectMirrorPlaneAxes(entry),
      choices: MIRROR_PLANE_CHOICES.map((choice) => ({ ...choice })),
      multiSelect: true,
    },
    {
      id: "glide",
      text: "この空間群に含まれる glide plane の種類をすべて選んでください。",
      answer: detectGlidePlaneTypes(entry),
      choices: GLIDE_PLANE_CHOICES.map((choice) => ({ ...choice })),
      multiSelect: true,
    },
    {
      id: "screw",
      text: "この空間群のらせん軸はどの方向かをすべて選んでください。",
      answer: detectScrewAxisTypes(entry),
      choices: SCREW_AXIS_CHOICES.map((choice) => ({ ...choice })),
      multiSelect: true,
    },
    {
      id: "screw-type",
      text: "この空間群に含まれるらせん軸の種類をすべて選んでください。",
      answer: detectScrewTypes(entry),
      choices: SCREW_TYPE_CHOICES.map((choice) => ({ ...choice })),
      multiSelect: true,
    },
    {
      id: "centring-extinction",
      text: "格子タイプに由来する消滅則をすべて選んでください。",
      answer: detectCentringExtinction(entry),
      choices: CENTRING_EXTINCTION_CHOICES.map((c) => ({ ...c })),
      multiSelect: true,
    },
    {
      id: "glide-extinction",
      text: "映進面に由来する消滅則をすべて選んでください。",
      answer: detectGlideExtinctions(entry),
      choices: GLIDE_EXTINCTION_CHOICES.map((c) => ({ ...c })),
      multiSelect: true,
    },
    {
      id: "screw-extinction",
      text: "らせん軸に由来する消滅則をすべて選んでください。",
      answer: detectScrewExtinctions(entry),
      choices: SCREW_EXTINCTION_CHOICES.map((c) => ({ ...c })),
      multiSelect: true,
    },
  ];
}