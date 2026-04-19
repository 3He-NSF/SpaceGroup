import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent, type WheelEvent as ReactWheelEvent } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { RefreshCw, CheckCircle2, XCircle, Trophy, ChevronDown, Send, Menu, Home, List, Box } from "lucide-react";

type AnswerValue = "◯" | "✕" | string | string[];

type SpacegroupEntry = {
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

type SpacegroupData = {
  meta: {
    enumeration_source: string;
    itb_only: boolean;
    n_entries: number;
    description: string;
  };
  entries: SpacegroupEntry[];
};

type Statement = {
  id: string;
  text: string;
  answer: boolean | string | string[];
  choices?: { value: string; label: string }[];
  multiSelect?: boolean;
};

type ViewMode = "quiz" | "spacegroup-list" | "symmetry-3d";

type Axis = "x" | "y" | "z";

type ParsedOperation = {
  matrix: [number, number, number][];
  translation: [number, number, number];
};

type PlaneOperationAnalysis = {
  kind: "mirror" | "glide";
  normalAxis: Axis;
  glideType?: "a" | "b" | "c" | "n" | "d";
};

type ScrewOperationAnalysis = {
  axis: Axis;
  screwType: "21" | "31" | "32" | "41" | "42" | "43" | "61" | "62" | "63" | "64" | "65";
};

function formatScrewTypeText(value: ScrewOperationAnalysis["screwType"]): string {
  return `${value[0]}_${value.slice(1)}`;
}


const CRYSTAL_SYSTEM_CHOICES = [
  { value: "triclinic", label: "三斜晶系 / triclinic" },
  { value: "monoclinic", label: "単斜晶系 / monoclinic" },
  { value: "orthorhombic", label: "斜方晶系 / orthorhombic" },
  { value: "tetragonal", label: "正方晶系 / tetragonal" },
  { value: "trigonal", label: "三方晶系 / trigonal" },
  { value: "hexagonal", label: "六方晶系 / hexagonal" },
  { value: "cubic", label: "立方晶系 / cubic" },
] as const;

const CENTRING_TYPE_CHOICES = [
  { value: "P", label: "P / primitive" },
  { value: "A", label: "A / A-centered" },
  { value: "B", label: "B / B-centered" },
  { value: "C", label: "C / C-centered" },
  { value: "I", label: "I / body-centered" },
  { value: "F", label: "F / face-centered" },
  { value: "R", label: "R / rhombohedral" },
] as const;

const MIRROR_PLANE_CHOICES = [
  { value: "x", label: "x軸に垂直（yz 面）" },
  { value: "y", label: "y軸に垂直（xz 面）" },
  { value: "z", label: "z軸に垂直（xy 面）" },
  { value: "none", label: "鏡映面なし" },
] as const;

const GLIDE_PLANE_CHOICES = [
  { value: "a", label: "a-glide" },
  { value: "b", label: "b-glide" },
  { value: "c", label: "c-glide" },
  { value: "n", label: "n-glide" },
  { value: "d", label: "d-glide" },
  { value: "none", label: "映進面なし" },
] as const;

const SCREW_AXIS_CHOICES = [
  { value: "x", label: "x 軸方向" },
  { value: "y", label: "y 軸方向" },
  { value: "z", label: "z 軸方向" },
  { value: "none", label: "らせん軸なし" },
] as const;


const SCREW_TYPE_CHOICES = [
  { value: "21", label: "2₁" },
  { value: "31", label: "3₁" },
  { value: "32", label: "3₂" },
  { value: "41", label: "4₁" },
  { value: "42", label: "4₂" },
  { value: "43", label: "4₃" },
  { value: "61", label: "6₁" },
  { value: "62", label: "6₂" },
  { value: "63", label: "6₃" },
  { value: "64", label: "6₄" },
  { value: "65", label: "6₅" },
  { value: "none", label: "らせん軸なし" },
] as const;


const CENTRING_EXTINCTION_CHOICES = [
  { value: "none", label: "消滅則なし" },
  { value: "h+k=2n", label: "h + k = 2n" },
  { value: "h+l=2n", label: "h + l = 2n" },
  { value: "k+l=2n", label: "k + l = 2n" },
  { value: "h+k+l=2n", label: "h + k + l = 2n" },
  { value: "-h+k+l=3n", label: "-h + k + l = 3n" },
] as const;

const GLIDE_EXTINCTION_CHOICES = [
  { value: "none", label: "該当なし" },
  { value: "hk0:h=2n", label: "hk0: h = 2n" },
  { value: "hk0:k=2n", label: "hk0: k = 2n" },
  { value: "h0l:h=2n", label: "h0l: h = 2n" },
  { value: "h0l:l=2n", label: "h0l: l = 2n" },
  { value: "0kl:k=2n", label: "0kl: k = 2n" },
  { value: "0kl:l=2n", label: "0kl: l = 2n" },
] as const;

const SCREW_EXTINCTION_CHOICES = [
  { value: "none", label: "該当なし" },
  { value: "h00:h=2n", label: "h00: h = 2n" },
  { value: "h00:h=4n", label: "h00: h = 4n" },
  { value: "0k0:k=2n", label: "0k0: k = 2n" },
  { value: "0k0:k=4n", label: "0k0: k = 4n" },
  { value: "00l:l=2n", label: "00l: l = 2n" },
  { value: "00l:l=4n", label: "00l: l = 4n" },
  { value: "00l:l=3n", label: "00l: l = 3n" },
  { value: "000l:l=6n", label: "000l: l = 6n" },
] as const;

function parseFractionString(token: string): number {
  const normalized = token.replace(/\s+/g, "");
  if (!normalized) return 0;
  const sign = normalized.startsWith("-") ? -1 : 1;
  const body = normalized.startsWith("-") || normalized.startsWith("+") ? normalized.slice(1) : normalized;
  if (!body) return 0;
  if (body.includes("/")) {
    const [num, den] = body.split("/").map(Number);
    if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return 0;
    return sign * (num / den);
  }
  const value = Number(body);
  return Number.isFinite(value) ? sign * value : 0;
}

function parseOperationComponent(component: string): { coeffs: [number, number, number]; translation: number } {
  const normalized = component.replace(/\s+/g, "").toLowerCase();
  const coeffs: [number, number, number] = [0, 0, 0];
  let translation = 0;
  let i = 0;

  while (i < normalized.length) {
    let sign = 1;
    if (normalized[i] === "+") {
      i += 1;
    } else if (normalized[i] === "-") {
      sign = -1;
      i += 1;
    }

    const ch = normalized[i];
    if (ch === "x" || ch === "y" || ch === "z") {
      const axisIndex = ch === "x" ? 0 : ch === "y" ? 1 : 2;
      coeffs[axisIndex] += sign;
      i += 1;
      continue;
    }

    let j = i;
    while (j < normalized.length && normalized[j] !== "+" && normalized[j] !== "-") {
      j += 1;
    }
    const token = normalized.slice(i, j);
    translation += sign * parseFractionString(token);
    i = j;
  }

  return { coeffs, translation };
}

function parseOperation(op: string): ParsedOperation | null {
  const parts = op.split(",").map((part) => part.trim());
  if (parts.length !== 3) return null;

  const parsed = parts.map(parseOperationComponent);
  return {
    matrix: parsed.map((item) => item.coeffs) as [number, number, number][],
    translation: [parsed[0].translation, parsed[1].translation, parsed[2].translation],
  };
}

function classifyGlideFromTranslation(
  tx: number,
  ty: number,
  tz: number,
  normalAxis?: Axis
): "a" | "b" | "c" | "n" | "d" | null {
  const mod1 = (v: number) => ((v % 1) + 1) % 1;
  const eps = 1e-6;
  const isHalf = (v: number) => Math.abs(mod1(v) - 0.5) < eps;
  const isQuarter = (v: number) =>
    Math.abs(mod1(v) - 0.25) < eps || Math.abs(mod1(v) - 0.75) < eps;
  const isZero = (v: number) => Math.abs(mod1(v)) < eps;

  const values =
    normalAxis === "x"
      ? { a: 0, b: ty, c: tz }
      : normalAxis === "y"
        ? { a: tx, b: 0, c: tz }
        : normalAxis === "z"
          ? { a: tx, b: ty, c: 0 }
          : { a: tx, b: ty, c: tz };

  const ha = isHalf(values.a);
  const hb = isHalf(values.b);
  const hc = isHalf(values.c);
  const qa = isQuarter(values.a);
  const qb = isQuarter(values.b);
  const qc = isQuarter(values.c);
  const za = isZero(values.a);
  const zb = isZero(values.b);
  const zc = isZero(values.c);

  if (ha && zb && zc) return "a";
  if (za && hb && zc) return "b";
  if (za && zb && hc) return "c";
  if ((ha && hb && zc) || (ha && zb && hc) || (za && hb && hc)) return "n";
  if ((qa && qb && zc) || (qa && zb && qc) || (za && qb && qc) || (qa && qb && qc)) return "d";

  return null;
}

function analyzePlaneLikeOperation(op: string): PlaneOperationAnalysis | null {
  const parsed = parseOperation(op);
  if (!parsed) return null;

  const { matrix, translation } = parsed;
  const identityRows: [number, number, number][] = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  const flippedRows: [number, number, number][] = [
    [-1, 0, 0],
    [0, -1, 0],
    [0, 0, -1],
  ];

  const normalAxes: Axis[] = [];
  for (let row = 0; row < 3; row += 1) {
    const r = matrix[row];
    const isIdentity = r[0] === identityRows[row][0] && r[1] === identityRows[row][1] && r[2] === identityRows[row][2];
    const isFlipped = r[0] === flippedRows[row][0] && r[1] === flippedRows[row][1] && r[2] === flippedRows[row][2];

    if (isFlipped) {
      normalAxes.push(row === 0 ? "x" : row === 1 ? "y" : "z");
    } else if (!isIdentity) {
      return null;
    }
  }

  if (normalAxes.length !== 1) return null;
  const normalAxis = normalAxes[0];
  const glideType = classifyGlideFromTranslation(
    translation[0],
    translation[1],
    translation[2],
    normalAxis
  );

  if (glideType) {
    return { kind: "glide", normalAxis, glideType };
  }

  const mod1 = (v: number) => ((v % 1) + 1) % 1;
  const isZero = (v: number) => Math.abs(mod1(v)) < 1e-6;

  const inPlaneTranslationIsZero =
    normalAxis === "x"
      ? isZero(translation[1]) && isZero(translation[2])
      : normalAxis === "y"
        ? isZero(translation[0]) && isZero(translation[2])
        : isZero(translation[0]) && isZero(translation[1]);

  if (inPlaneTranslationIsZero) {
    return { kind: "mirror", normalAxis };
  }

  return null;
}


function detectMirrorPlaneAxes(entry: SpacegroupEntry): string[] {
  const axes = new Set<Axis>();
  for (const op of entry.operations_xyz) {
    const analysis = analyzePlaneLikeOperation(op);
    if (analysis?.kind === "mirror") {
      axes.add(analysis.normalAxis);
    }
  }
  return axes.size === 0 ? ["none"] : Array.from(axes).sort();
}


function detectGlidePlaneTypes(entry: SpacegroupEntry): string[] {
  const glideTypes = new Set<"a" | "b" | "c" | "n" | "d">();
  for (const op of entry.operations_xyz) {
    const analysis = analyzePlaneLikeOperation(op);
    if (analysis?.kind === "glide" && analysis.glideType) {
      glideTypes.add(analysis.glideType);
    }
  }
  return glideTypes.size === 0 ? ["none"] : Array.from(glideTypes).sort();
}

function analyzeScrewLikeOperation(op: string): ScrewOperationAnalysis | null {
  const parsed = parseOperation(op);
  if (!parsed) return null;

  const { matrix, translation } = parsed;
  const mod1 = (v: number) => ((v % 1) + 1) % 1;
  const eps = 1e-6;
  const approx = (a: number, b: number) => Math.abs(mod1(a) - mod1(b)) < eps;

  const detectTypeFromTranslation = (value: number, allowed: readonly string[]): ScrewOperationAnalysis["screwType"] | null => {
    for (const key of allowed) {
      const n = Number(key[0]);
      const m = Number(key.slice(1));
      if (approx(value, m / n)) {
        return key as ScrewOperationAnalysis["screwType"];
      }
    }
    return null;
  };

  const aroundZ2 =
    matrix[0][0] === -1 && matrix[0][1] === 0 && matrix[0][2] === 0 &&
    matrix[1][0] === 0 && matrix[1][1] === -1 && matrix[1][2] === 0 &&
    matrix[2][0] === 0 && matrix[2][1] === 0 && matrix[2][2] === 1;
  if (aroundZ2) {
    const screwType = detectTypeFromTranslation(translation[2], ["21"] as const);
    if (screwType) return { axis: "z", screwType };
  }

  const aroundY2 =
    matrix[0][0] === -1 && matrix[0][1] === 0 && matrix[0][2] === 0 &&
    matrix[1][0] === 0 && matrix[1][1] === 1 && matrix[1][2] === 0 &&
    matrix[2][0] === 0 && matrix[2][1] === 0 && matrix[2][2] === -1;
  if (aroundY2) {
    const screwType = detectTypeFromTranslation(translation[1], ["21"] as const);
    if (screwType) return { axis: "y", screwType };
  }

  const aroundX2 =
    matrix[0][0] === 1 && matrix[0][1] === 0 && matrix[0][2] === 0 &&
    matrix[1][0] === 0 && matrix[1][1] === -1 && matrix[1][2] === 0 &&
    matrix[2][0] === 0 && matrix[2][1] === 0 && matrix[2][2] === -1;
  if (aroundX2) {
    const screwType = detectTypeFromTranslation(translation[0], ["21"] as const);
    if (screwType) return { axis: "x", screwType };
  }

  const aroundZ4_90 =
    matrix[0][0] === 0 && matrix[0][1] === -1 && matrix[0][2] === 0 &&
    matrix[1][0] === 1 && matrix[1][1] === 0 && matrix[1][2] === 0 &&
    matrix[2][0] === 0 && matrix[2][1] === 0 && matrix[2][2] === 1;
  const aroundZ4_180 =
    matrix[0][0] === -1 && matrix[0][1] === 0 && matrix[0][2] === 0 &&
    matrix[1][0] === 0 && matrix[1][1] === -1 && matrix[1][2] === 0 &&
    matrix[2][0] === 0 && matrix[2][1] === 0 && matrix[2][2] === 1;
  const aroundZ4_270 =
    matrix[0][0] === 0 && matrix[0][1] === 1 && matrix[0][2] === 0 &&
    matrix[1][0] === -1 && matrix[1][1] === 0 && matrix[1][2] === 0 &&
    matrix[2][0] === 0 && matrix[2][1] === 0 && matrix[2][2] === 1;
  if (aroundZ4_90 || aroundZ4_180 || aroundZ4_270) {
    const screwType = detectTypeFromTranslation(translation[2], ["41", "42", "43"] as const);
    if (screwType) return { axis: "z", screwType };
  }

  const aroundZ3_120 =
    matrix[0][0] === 0 && matrix[0][1] === -1 && matrix[0][2] === 0 &&
    matrix[1][0] === 1 && matrix[1][1] === -1 && matrix[1][2] === 0 &&
    matrix[2][0] === 0 && matrix[2][1] === 0 && matrix[2][2] === 1;
  const aroundZ3_240 =
    matrix[0][0] === -1 && matrix[0][1] === 1 && matrix[0][2] === 0 &&
    matrix[1][0] === -1 && matrix[1][1] === 0 && matrix[1][2] === 0 &&
    matrix[2][0] === 0 && matrix[2][1] === 0 && matrix[2][2] === 1;
  if (aroundZ3_120 || aroundZ3_240) {
    const screwType = detectTypeFromTranslation(translation[2], ["31", "32"] as const);
    if (screwType) return { axis: "z", screwType };
  }

  const aroundZ6_60 =
    matrix[0][0] === 0 && matrix[0][1] === -1 && matrix[0][2] === 0 &&
    matrix[1][0] === 1 && matrix[1][1] === 1 && matrix[1][2] === 0 &&
    matrix[2][0] === 0 && matrix[2][1] === 0 && matrix[2][2] === 1;
  const aroundZ6_120 =
    matrix[0][0] === -1 && matrix[0][1] === -1 && matrix[0][2] === 0 &&
    matrix[1][0] === 1 && matrix[1][1] === 0 && matrix[1][2] === 0 &&
    matrix[2][0] === 0 && matrix[2][1] === 0 && matrix[2][2] === 1;
  const aroundZ6_180 =
    matrix[0][0] === -1 && matrix[0][1] === 0 && matrix[0][2] === 0 &&
    matrix[1][0] === 0 && matrix[1][1] === -1 && matrix[1][2] === 0 &&
    matrix[2][0] === 0 && matrix[2][1] === 0 && matrix[2][2] === 1;
  const aroundZ6_240 =
    matrix[0][0] === 0 && matrix[0][1] === 1 && matrix[0][2] === 0 &&
    matrix[1][0] === -1 && matrix[1][1] === 1 && matrix[1][2] === 0 &&
    matrix[2][0] === 0 && matrix[2][1] === 0 && matrix[2][2] === 1;
  const aroundZ6_300 =
    matrix[0][0] === 1 && matrix[0][1] === 1 && matrix[0][2] === 0 &&
    matrix[1][0] === -1 && matrix[1][1] === 0 && matrix[1][2] === 0 &&
    matrix[2][0] === 0 && matrix[2][1] === 0 && matrix[2][2] === 1;
  if (aroundZ6_60 || aroundZ6_120 || aroundZ6_180 || aroundZ6_240 || aroundZ6_300) {
    const screwType = detectTypeFromTranslation(translation[2], ["61", "62", "63", "64", "65"] as const);
    if (screwType) return { axis: "z", screwType };
  }

  return null;
}

function detectScrewTypes(entry: SpacegroupEntry): string[] {
  const types = new Set<ScrewOperationAnalysis["screwType"]>();
  for (const op of entry.operations_xyz) {
    const analysis = analyzeScrewLikeOperation(op);
    if (analysis) {
      types.add(analysis.screwType);
    }
  }
  return types.size === 0 ? ["none"] : Array.from(types).sort();
}


function detectScrewAxisTypes(entry: SpacegroupEntry): string[] {
  const axes = new Set<Axis>();
  for (const op of entry.operations_xyz) {
    const analysis = analyzeScrewLikeOperation(op);
    if (analysis) {
      axes.add(analysis.axis);
    }
  }
  return axes.size === 0 ? ["none"] : Array.from(axes).sort();
}



function detectCentringExtinction(entry: SpacegroupEntry): string[] {
  switch (entry.centring_type) {
    case "A":
      return ["k+l=2n"];
    case "B":
      return ["h+l=2n"];
    case "C":
      return ["h+k=2n"];
    case "I":
      return ["h+k+l=2n"];
    case "F":
      return ["h+k=2n", "h+l=2n", "k+l=2n"];
    case "R":
      return ["-h+k+l=3n"];
    default:
      return ["none"];
  }
}

function detectGlideExtinction(entry: SpacegroupEntry): string {
  for (const op of entry.operations_xyz) {
    const plane = analyzePlaneLikeOperation(op);
    if (!plane || plane.kind !== "glide" || !plane.glideType) continue;

    if (plane.normalAxis === "z") {
      if (plane.glideType === "a" || plane.glideType === "n" || plane.glideType === "d") {
        return "hk0:h=2n";
      }
      if (plane.glideType === "b") {
        return "hk0:k=2n";
      }
      if (plane.glideType === "c") {
        return "none";
      }
    }

    if (plane.normalAxis === "y") {
      if (plane.glideType === "a" || plane.glideType === "n" || plane.glideType === "d") {
        return "h0l:h=2n";
      }
      if (plane.glideType === "c") {
        return "h0l:l=2n";
      }
      if (plane.glideType === "b") {
        return "none";
      }
    }

    if (plane.normalAxis === "x") {
      if (plane.glideType === "b" || plane.glideType === "n" || plane.glideType === "d") {
        return "0kl:k=2n";
      }
      if (plane.glideType === "c") {
        return "0kl:l=2n";
      }
      if (plane.glideType === "a") {
        return "none";
      }
    }
  }

  return "none";
}

function detectScrewExtinction(entry: SpacegroupEntry): string {
  let fallback: string = "none";

  for (const op of entry.operations_xyz) {
    const screw = analyzeScrewLikeOperation(op);
    if (!screw) continue;

    if (screw.axis === "x") {
      if (screw.screwType === "21" || screw.screwType === "42") return "h00:h=2n";
      if (screw.screwType === "41" || screw.screwType === "43") return "h00:h=4n";
    }

    if (screw.axis === "y") {
      if (screw.screwType === "21" || screw.screwType === "42") return "0k0:k=2n";
      if (screw.screwType === "41" || screw.screwType === "43") return "0k0:k=4n";
    }

    if (screw.axis === "z") {
      if (screw.screwType === "61" || screw.screwType === "65") return "000l:l=6n";
      if (screw.screwType === "31" || screw.screwType === "32" || screw.screwType === "62" || screw.screwType === "64") return "00l:l=3n";
      if (screw.screwType === "41" || screw.screwType === "43") return "00l:l=4n";
      if (screw.screwType === "21" || screw.screwType === "42" || screw.screwType === "63") {
        fallback = "00l:l=2n";
      }
    }
  }

  return fallback;
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

function getExtinctionConditions(entry: SpacegroupEntry): string[] {
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
    conditions.push(`${formatScrewTypeText(screw.screwType)} screw: ${reflection} で ${index} = ${mod}n`);
  }

  if (conditions.length === 0) {
    conditions.push("代表的な消滅条件なし");
  }

  return conditions;
}

function matrixEquals(
  a: [number, number, number][],
  b: [number, number, number][]
): boolean {
  return a.every((row, i) => row.every((value, j) => value === b[i][j]));
}

function isIntegerTranslationVector(values: [number, number, number]): boolean {
  const mod1 = (v: number) => ((v % 1) + 1) % 1;
  return values.every((value) => Math.abs(mod1(value)) < 1e-6);
}

function classifyOperation(op: string): {
  kind: "identity" | "translation" | "inversion" | "mirror" | "glide" | "rotation" | "screw" | "rotoinversion" | "unknown";
  detail: string;
  axisDirection?: string;
} {
  const parsed = parseOperation(op);
  if (!parsed) {
    return { kind: "unknown", detail: "分類できません" };
  }

  const identity: [number, number, number][] = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  const inversion: [number, number, number][] = [
    [-1, 0, 0],
    [0, -1, 0],
    [0, 0, -1],
  ];

  const plane = analyzePlaneLikeOperation(op);
  if (plane?.kind === "mirror") {
    return {
      kind: "mirror",
      detail: `${plane.normalAxis} 軸に垂直な mirror plane`,
    };
  }
  if (plane?.kind === "glide") {
    return {
      kind: "glide",
      detail: `${plane.glideType}-glide（${plane.normalAxis} 軸に垂直）`,
    };
  }

  const screw = analyzeScrewLikeOperation(op);
  if (screw) {
    return {
      kind: "screw",
      detail: `${screw.axis} 軸方向の ${formatScrewTypeText(screw.screwType)} の螺旋操作`,
    };
  }

  if (matrixEquals(parsed.matrix, identity)) {
    if (isIntegerTranslationVector(parsed.translation)) {
      return { kind: "identity", detail: "恒等操作" };
    }
    return {
      kind: "translation",
      detail: `並進 (${parsed.translation.map((v) => v.toFixed(3)).join(", ")})`,
    };
  }

  if (matrixEquals(parsed.matrix, inversion)) {
    return { kind: "inversion", detail: "反転操作" };
  }

  const determinant =
    parsed.matrix[0][0] * (parsed.matrix[1][1] * parsed.matrix[2][2] - parsed.matrix[1][2] * parsed.matrix[2][1]) -
    parsed.matrix[0][1] * (parsed.matrix[1][0] * parsed.matrix[2][2] - parsed.matrix[1][2] * parsed.matrix[2][0]) +
    parsed.matrix[0][2] * (parsed.matrix[1][0] * parsed.matrix[2][1] - parsed.matrix[1][1] * parsed.matrix[2][0]);

  if (determinant === 1) {
    const hasTranslation = !isIntegerTranslationVector(parsed.translation);
    return {
      kind: "rotation",
      detail: hasTranslation ? "回転操作（並進付き）" : "回転操作",
    };
  }

  if (determinant === -1) {
    const axisDirection = getRotoinversionAxisDirection(op);
    return {
      kind: "rotoinversion",
      detail: axisDirection
        ? `回反操作 / rotoinversion（${axisDirection}）`
        : "回反操作 / rotoinversion",
      axisDirection: axisDirection ?? undefined,
    };
  }

  return { kind: "unknown", detail: "分類できません" };
}

function gcd2(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x || 1;
}

function gcd3(a: number, b: number, c: number): number {
  return gcd2(gcd2(a, b), c);
}

function cross(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number }
) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function norm2(v: { x: number; y: number; z: number }) {
  return v.x * v.x + v.y * v.y + v.z * v.z;
}

function formatAxisDirection(v: { x: number; y: number; z: number }): string {
  const rounded = {
    x: Math.round(v.x),
    y: Math.round(v.y),
    z: Math.round(v.z),
  };

  const g = gcd3(rounded.x, rounded.y, rounded.z) || 1;
  const nx = rounded.x / g;
  const ny = rounded.y / g;
  const nz = rounded.z / g;

  if ((nx === 1 || nx === -1) && ny === 0 && nz === 0) return "x 軸方向";
  if (nx === 0 && (ny === 1 || ny === -1) && nz === 0) return "y 軸方向";
  if (nx === 0 && ny === 0 && (nz === 1 || nz === -1)) return "z 軸方向";

  return `[${nx} ${ny} ${nz}] 方向`;
}

function getRotoinversionAxisDirection(op: string): string | null {
  const parsed = parseOperation(op);
  if (!parsed) return null;

  const determinant =
    parsed.matrix[0][0] * (parsed.matrix[1][1] * parsed.matrix[2][2] - parsed.matrix[1][2] * parsed.matrix[2][1]) -
    parsed.matrix[0][1] * (parsed.matrix[1][0] * parsed.matrix[2][2] - parsed.matrix[1][2] * parsed.matrix[2][0]) +
    parsed.matrix[0][2] * (parsed.matrix[1][0] * parsed.matrix[2][1] - parsed.matrix[1][1] * parsed.matrix[2][0]);

  if (determinant !== -1) return null;

  const mPlusI = parsed.matrix.map((row, i) => [
    row[0] + (i === 0 ? 1 : 0),
    row[1] + (i === 1 ? 1 : 0),
    row[2] + (i === 2 ? 1 : 0),
  ]) as [number, number, number][];

  const rows = mPlusI.map((r) => ({ x: r[0], y: r[1], z: r[2] }));
  const candidates = [
    cross(rows[0], rows[1]),
    cross(rows[0], rows[2]),
    cross(rows[1], rows[2]),
  ];

  const axis = candidates.find((v) => norm2(v) > 0);
  if (!axis) return null;

  return formatAxisDirection(axis);
}

function getInversionCenter(op: string): { x: number; y: number; z: number } | null {
  const parsed = parseOperation(op);
  if (!parsed) return null;

  const inversion: [number, number, number][] = [
    [-1, 0, 0],
    [0, -1, 0],
    [0, 0, -1],
  ];

  if (!matrixEquals(parsed.matrix, inversion)) return null;

  return {
    x: frac01(parsed.translation[0] / 2),
    y: frac01(parsed.translation[1] / 2),
    z: frac01(parsed.translation[2] / 2),
  };
}

function getPlaneVisualization(op: string): {
  kind: "mirror" | "glide";
  normalAxis: Axis;
  planeCoord: number;
  corners: { x: number; y: number; z: number }[];
  glideVector?: { x: number; y: number; z: number };
  center: { x: number; y: number; z: number };
} | null {
  const parsed = parseOperation(op);
  const analysis = analyzePlaneLikeOperation(op);
  if (!parsed || !analysis) return null;

  const mod1 = (v: number) => ((v % 1) + 1) % 1;
  const half = (v: number) => mod1(v / 2);

  if (analysis.normalAxis === "x") {
    const planeCoord = half(parsed.translation[0]);
    return {
      kind: analysis.kind,
      normalAxis: "x",
      planeCoord,
      corners: [
        { x: planeCoord, y: 0, z: 0 },
        { x: planeCoord, y: 1, z: 0 },
        { x: planeCoord, y: 1, z: 1 },
        { x: planeCoord, y: 0, z: 1 },
      ],
      glideVector: analysis.kind === "glide"
        ? { x: 0, y: mod1(parsed.translation[1]), z: mod1(parsed.translation[2]) }
        : undefined,
      center: { x: planeCoord, y: 0.5, z: 0.5 },
    };
  }

  if (analysis.normalAxis === "y") {
    const planeCoord = half(parsed.translation[1]);
    return {
      kind: analysis.kind,
      normalAxis: "y",
      planeCoord,
      corners: [
        { x: 0, y: planeCoord, z: 0 },
        { x: 1, y: planeCoord, z: 0 },
        { x: 1, y: planeCoord, z: 1 },
        { x: 0, y: planeCoord, z: 1 },
      ],
      glideVector: analysis.kind === "glide"
        ? { x: mod1(parsed.translation[0]), y: 0, z: mod1(parsed.translation[2]) }
        : undefined,
      center: { x: 0.5, y: planeCoord, z: 0.5 },
    };
  }

  const planeCoord = half(parsed.translation[2]);
  return {
    kind: analysis.kind,
    normalAxis: "z",
    planeCoord,
    corners: [
      { x: 0, y: 0, z: planeCoord },
      { x: 1, y: 0, z: planeCoord },
      { x: 1, y: 1, z: planeCoord },
      { x: 0, y: 1, z: planeCoord },
    ],
    glideVector: analysis.kind === "glide"
      ? { x: mod1(parsed.translation[0]), y: mod1(parsed.translation[1]), z: 0 }
      : undefined,
    center: { x: 0.5, y: 0.5, z: planeCoord },
  };
}

function projectFractionalPoint(
  point: { x: number; y: number; z: number },
  lattice: {
    a: { x: number; y: number; z: number };
    b: { x: number; y: number; z: number };
    c: { x: number; y: number; z: number };
  },
  rotX: number,
  rotY: number,
  centerX: number,
  centerY: number,
  scale: number
) {
  const cart = fractionalToCartesian(point, lattice);
  const p = projectPoint(cart, rotX, rotY);
  return {
    ...p,
    sx: centerX + p.x * scale,
    sy: centerY + p.y * scale,
  };
}

function makeQuiz(entry: SpacegroupEntry): Statement[] {
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
      text: "映進面に由来する代表的な消滅則を選んでください。",
      answer: detectGlideExtinction(entry),
      choices: GLIDE_EXTINCTION_CHOICES.map((c) => ({ ...c })),
    },
    {
      id: "screw-extinction",
      text: "らせん軸に由来する代表的な消滅則を選んでください。",
      answer: detectScrewExtinction(entry),
      choices: SCREW_EXTINCTION_CHOICES.map((c) => ({ ...c })),
    },
    // extinction question removed
  ];
}

function tfLabel(v: boolean): "◯" | "✕" {
  return v ? "◯" : "✕";
}

function crystalSystemLabel(value: string): string {
  const found = CRYSTAL_SYSTEM_CHOICES.find((choice) => choice.value === value);
  return found ? found.label : value;
}

function centringTypeLabel(value: string): string {
  const found = CENTRING_TYPE_CHOICES.find((choice) => choice.value === value);
  return found ? found.label : value;
}

function mirrorPlaneLabel(value: string): string {
  const found = MIRROR_PLANE_CHOICES.find((choice) => choice.value === value);
  return found ? found.label : value;
}

function glidePlaneLabel(value: string): string {
  const found = GLIDE_PLANE_CHOICES.find((choice) => choice.value === value);
  return found ? found.label : value;
}

function screwAxisLabel(value: string): string {
  const found = SCREW_AXIS_CHOICES.find((choice) => choice.value === value);
  return found ? found.label : value;
}

function screwTypeLabel(value: string): string {
  const found = SCREW_TYPE_CHOICES.find((choice) => choice.value === value);
  return found ? found.label : value;
}


function centringExtinctionLabel(value: string | string[]): string {
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
function glideExtinctionLabel(value: string): string {
  const found = GLIDE_EXTINCTION_CHOICES.find((c) => c.value === value);
  return found ? found.label : value;
}

function screwExtinctionLabel(value: string): string {
  const found = SCREW_EXTINCTION_CHOICES.find((c) => c.value === value);
  return found ? found.label : value;
}

function pickRandomEntry(entries: SpacegroupEntry[]): SpacegroupEntry {
  return entries[Math.floor(Math.random() * entries.length)];
}

function frac01(value: number): number {
  return ((value % 1) + 1) % 1;
}

function applyOperationToPoint(op: string, point: { x: number; y: number; z: number }) {
  const parsed = parseOperation(op);
  if (!parsed) return null;

  const vector = [point.x, point.y, point.z];
  const next = parsed.matrix.map((row, i) => {
    const linear = row[0] * vector[0] + row[1] * vector[1] + row[2] * vector[2];
    return frac01(linear + parsed.translation[i]);
  });

  return { x: next[0], y: next[1], z: next[2] };
}

function rotatePoint(point: { x: number; y: number; z: number }, rotXDeg: number, rotYDeg: number) {
  const rx = (rotXDeg * Math.PI) / 180;
  const ry = (rotYDeg * Math.PI) / 180;

  const cosX = Math.cos(rx);
  const sinX = Math.sin(rx);
  const cosY = Math.cos(ry);
  const sinY = Math.sin(ry);

  const y1 = point.y * cosX - point.z * sinX;
  const z1 = point.y * sinX + point.z * cosX;
  const x2 = point.x * cosY + z1 * sinY;
  const z2 = -point.x * sinY + z1 * cosY;

  return { x: x2, y: y1, z: z2 };
}

function projectPoint(point: { x: number; y: number; z: number }, rotXDeg: number, rotYDeg: number) {
  const centered = { x: point.x - 0.5, y: point.y - 0.5, z: point.z - 0.5 };
  const rotated = rotatePoint(centered, rotXDeg, rotYDeg);
  const perspective = 1 / (1.9 - rotated.z * 0.9);
  return {
    x: rotated.x * perspective,
    y: -rotated.y * perspective,
    depth: rotated.z,
    scale: perspective,
  };
}

function getRepresentativeLatticeVectors(crystalSystem: string) {
  switch (crystalSystem) {
    case "triclinic":
      return {
        a: { x: 1.0, y: 0.0, z: 0.0 },
        b: { x: 0.32, y: 0.92, z: 0.0 },
        c: { x: 0.18, y: 0.24, z: 0.88 },
      };
    case "monoclinic":
      return {
        a: { x: 1.0, y: 0.0, z: 0.0 },
        b: { x: 0.0, y: 1.0, z: 0.0 },
        c: { x: 0.28, y: 0.0, z: 0.92 },
      };
    case "orthorhombic":
      return {
        a: { x: 1.0, y: 0.0, z: 0.0 },
        b: { x: 0.0, y: 0.78, z: 0.0 },
        c: { x: 0.0, y: 0.0, z: 1.08 },
      };
    case "tetragonal":
      return {
        a: { x: 1.0, y: 0.0, z: 0.0 },
        b: { x: 0.0, y: 1.0, z: 0.0 },
        c: { x: 0.0, y: 0.0, z: 1.28 },
      };
    case "trigonal":
      return {
        a: { x: 1.0, y: 0.0, z: 0.0 },
        b: { x: -0.5, y: 0.866, z: 0.0 },
        c: { x: 0.0, y: 0.0, z: 1.05 },
      };
    case "hexagonal":
      return {
        a: { x: 1.0, y: 0.0, z: 0.0 },
        b: { x: -0.5, y: 0.866, z: 0.0 },
        c: { x: 0.0, y: 0.0, z: 1.35 },
      };
    case "cubic":
    default:
      return {
        a: { x: 1.0, y: 0.0, z: 0.0 },
        b: { x: 0.0, y: 1.0, z: 0.0 },
        c: { x: 0.0, y: 0.0, z: 1.0 },
      };
  }
}

function fractionalToCartesian(
  point: { x: number; y: number; z: number },
  lattice: {
    a: { x: number; y: number; z: number };
    b: { x: number; y: number; z: number };
    c: { x: number; y: number; z: number };
  }
) {
  return {
    x: point.x * lattice.a.x + point.y * lattice.b.x + point.z * lattice.c.x,
    y: point.x * lattice.a.y + point.y * lattice.b.y + point.z * lattice.c.y,
    z: point.x * lattice.a.z + point.y * lattice.b.z + point.z * lattice.c.z,
  };
}

function Symmetry3DPage({ entry }: { entry: SpacegroupEntry }) {
  const [seedX, setSeedX] = useState(0.17);
  const [seedY, setSeedY] = useState(0.29);
  const [seedZ, setSeedZ] = useState(0.41);
  const [rotX, setRotX] = useState(-90);
  const [rotY, setRotY] = useState(0);
  const [zoom, setZoom] = useState(3);
  const [selectedOp, setSelectedOp] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [lastPos, setLastPos] = useState<{ x: number; y: number } | null>(null);

  const width = 760;
  const height = 560;
  const scale = 400 * (zoom/2);
  const centerX = width / 2;
  const centerY = height / 2;
  const lattice = useMemo(() => getRepresentativeLatticeVectors(entry.crystal_system), [entry.crystal_system]);

  const equivalentPoints = useMemo(() => {
    const seen = new Set<string>();
    const points: { x: number; y: number; z: number; op: string }[] = [];

    for (const op of entry.operations_xyz) {
      const next = applyOperationToPoint(op, { x: seedX, y: seedY, z: seedZ });
      if (!next) continue;
      const key = `${next.x.toFixed(4)}_${next.y.toFixed(4)}_${next.z.toFixed(4)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      points.push({ ...next, op });
    }

    return points;
  }, [entry, seedX, seedY, seedZ]);

  useEffect(() => {
    setSelectedOp(null);
  }, [entry, seedX, seedY, seedZ]);

  const selectedOperationInfo = useMemo(() => {
    if (!selectedOp) return null;
    return classifyOperation(selectedOp);
  }, [selectedOp]);

  const projectedRotationAxis = useMemo(() => {
    if (!selectedOp) return null;
    const parsed = parseOperation(selectedOp);
    if (!parsed) return null;

    const axisIndex = parsed.matrix.findIndex(
      (row) =>
        (row[0] === 1 && row[1] === 0 && row[2] === 0) ||
        (row[0] === 0 && row[1] === 1 && row[2] === 0) ||
        (row[0] === 0 && row[1] === 0 && row[2] === 1)
    );

    if (axisIndex === -1) return null;

    const axisVec =
      axisIndex === 0
        ? lattice.a
        : axisIndex === 1
        ? lattice.b
        : lattice.c;

    const center = { x: 0.5, y: 0.5, z: 0.5 };
    const p0 = fractionalToCartesian(center, lattice);
    const p1 = {
      x: p0.x + axisVec.x,
      y: p0.y + axisVec.y,
      z: p0.z + axisVec.z,
    };
    const p2 = {
      x: p0.x - axisVec.x,
      y: p0.y - axisVec.y,
      z: p0.z - axisVec.z,
    };

    const proj0 = projectPoint(p1, rotX, rotY);
    const proj1 = projectPoint(p2, rotX, rotY);

    return {
      x1: centerX + proj0.x * scale,
      y1: centerY + proj0.y * scale,
      x2: centerX + proj1.x * scale,
      y2: centerY + proj1.y * scale,
    };
  }, [selectedOp, lattice, rotX, rotY, centerX, centerY, scale]);

  const projectedInversionCenter = useMemo(() => {
    if (!selectedOp) return null;
    const center = getInversionCenter(selectedOp);
    if (!center) return null;
    const cart = fractionalToCartesian(center, lattice);
    const p = projectPoint(cart, rotX, rotY);
    return {
      ...center,
      ...p,
      sx: centerX + p.x * scale,
      sy: centerY + p.y * scale,
    };
  }, [selectedOp, lattice, rotX, rotY, centerX, centerY, scale]);

  const projectedPlane = useMemo(() => {
    if (!selectedOp) return null;
    const plane = getPlaneVisualization(selectedOp);
    if (!plane) return null;

    const projectedCorners = plane.corners.map((corner) =>
      projectFractionalPoint(corner, lattice, rotX, rotY, centerX, centerY, scale)
    );
    const projectedCenter = projectFractionalPoint(plane.center, lattice, rotX, rotY, centerX, centerY, scale);

    const projectedGlideArrow = plane.glideVector
      ? (() => {
          const end = {
            x: plane.center.x + plane.glideVector.x,
            y: plane.center.y + plane.glideVector.y,
            z: plane.center.z + plane.glideVector.z,
          };
          return {
            start: projectedCenter,
            end: projectFractionalPoint(end, lattice, rotX, rotY, centerX, centerY, scale),
          };
        })()
      : null;

    return {
      ...plane,
      projectedCorners,
      projectedCenter,
      projectedGlideArrow,
    };
  }, [selectedOp, lattice, rotX, rotY, centerX, centerY, scale]);

  const planePolygonPoints = useMemo(() => {
    if (!projectedPlane) return "";
    return projectedPlane.projectedCorners.map((corner) => `${corner.sx},${corner.sy}`).join(" ");
  }, [projectedPlane]);

  const cellVertices = useMemo(
    () => [
      fractionalToCartesian({ x: 0, y: 0, z: 0 }, lattice),
      fractionalToCartesian({ x: 1, y: 0, z: 0 }, lattice),
      fractionalToCartesian({ x: 1, y: 1, z: 0 }, lattice),
      fractionalToCartesian({ x: 0, y: 1, z: 0 }, lattice),
      fractionalToCartesian({ x: 0, y: 0, z: 1 }, lattice),
      fractionalToCartesian({ x: 1, y: 0, z: 1 }, lattice),
      fractionalToCartesian({ x: 1, y: 1, z: 1 }, lattice),
      fractionalToCartesian({ x: 0, y: 1, z: 1 }, lattice),
    ],
    [lattice]
  );

  const cellEdges = useMemo(
    () => [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7],
    ],
    []
  );

  const projectedVertices = cellVertices.map((vertex) => {
    const p = projectPoint(vertex, rotX, rotY);
    return {
      ...p,
      sx: centerX + p.x * scale,
      sy: centerY + p.y * scale,
    };
  });

  const projectedSeed = useMemo(() => {
    const cart = fractionalToCartesian({ x: seedX, y: seedY, z: seedZ }, lattice);
    const p = projectPoint(cart, rotX, rotY);
    return {
      ...p,
      sx: centerX + p.x * scale,
      sy: centerY + p.y * scale,
    };
  }, [seedX, seedY, seedZ, rotX, rotY, scale, centerX, centerY, lattice]);

  const projectedPoints = equivalentPoints
    .map((point) => {
      const cart = fractionalToCartesian(point, lattice);
      const p = projectPoint(cart, rotX, rotY);
      return {
        ...point,
        ...p,
        sx: centerX + p.x * scale,
        sy: centerY + p.y * scale,
      };
    })
    .sort((a, b) => a.depth - b.depth);

  const axisEndpoints = [
    { label: "a", color: "#ef4444", point: lattice.a },
    { label: "b", color: "#22c55e", point: lattice.b },
    { label: "c", color: "#3b82f6", point: lattice.c },
  ].map((axis) => {
    const origin = projectPoint({ x: 0, y: 0, z: 0 }, rotX, rotY);
    const end = projectPoint(axis.point, rotX, rotY);
    return {
      ...axis,
      x1: centerX + origin.x * scale,
      y1: centerY + origin.y * scale,
      x2: centerX + end.x * scale,
      y2: centerY + end.y * scale,
    };
  });

  function handleMouseDown(e: ReactMouseEvent<SVGSVGElement>) {
    setIsDragging(true);
    setLastPos({ x: e.clientX, y: e.clientY });
  }

  function handleMouseMove(e: ReactMouseEvent<SVGSVGElement>) {
    if (!isDragging || !lastPos) return;
    const dx = e.clientX - lastPos.x;
    const dy = e.clientY - lastPos.y;

    setRotY((prev) => prev + dx * 0.5);
    setRotX((prev) => prev + dy * 0.5);

    setLastPos({ x: e.clientX, y: e.clientY });
  }

  function handleMouseUp() {
    setIsDragging(false);
    setLastPos(null);
  }

  function handleWheel(e: ReactWheelEvent<SVGSVGElement>) {
    e.preventDefault();
    setZoom((prev) => {
      const next = prev * (1 - e.deltaY * 0.001);
      return Math.min(8, Math.max(0.3, next));
    });
  }

  return (
    <div className="mx-auto grid max-w-6xl items-start gap-6 lg:grid-cols-[1.25fr_0.75fr]">
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl md:text-3xl">3D対称表示</CardTitle>
          <CardDescription className="mt-2 text-sm md:text-base">
            一般位置の1点に対して対称操作を適用し、単位胞内の等価点を表示します。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border bg-white p-4">
            <div className="text-sm text-slate-500">表示中の空間群</div>
            <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-end md:gap-6">
              <div>
                <div className="text-sm text-slate-500">Hermann–Mauguin 記号：</div>
                <div className="text-2xl font-bold tracking-tight md:text-3xl">{entry.hm}</div>
              </div>
              <div>
                <div className="text-sm text-slate-500">Hall 記号：</div>
                <div className="font-mono text-sm md:text-base">{entry.hall}</div>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border bg-white">
            <div className="select-none">
              <svg
                viewBox={`0 0 ${width} ${height}`}
                className="h-[620px] w-full bg-slate-50"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
                style={{ cursor: isDragging ? "grabbing" : "grab" }}
              >
                {cellEdges.map(([a, b], index) => (
                  <line
                    key={`edge-${index}`}
                    x1={projectedVertices[a].sx}
                    y1={projectedVertices[a].sy}
                    x2={projectedVertices[b].sx}
                    y2={projectedVertices[b].sy}
                    stroke="#94a3b8"
                    strokeWidth="1.6"
                  />
                ))}

                {axisEndpoints.map((axis) => (
                  <g key={axis.label}>
                    <line x1={axis.x1} y1={axis.y1} x2={axis.x2} y2={axis.y2} stroke={axis.color} strokeWidth="2.5" />
                    <text x={axis.x2 + 6} y={axis.y2 - 6} fill={axis.color} fontSize="16" fontWeight="700">
                      {axis.label}
                    </text>
                  </g>
                ))}
                {selectedOperationInfo?.kind === "rotation" && projectedRotationAxis && (
                  <g>
                    <line
                      x1={projectedRotationAxis.x1}
                      y1={projectedRotationAxis.y1}
                      x2={projectedRotationAxis.x2}
                      y2={projectedRotationAxis.y2}
                      stroke="#9333ea"
                      strokeWidth="3"
                      strokeDasharray="6 4"
                      opacity="0.9"
                    />
                    <text
                      x={projectedRotationAxis.x1 + 6}
                      y={projectedRotationAxis.y1 - 6}
                      fill="#7e22ce"
                      fontSize="14"
                      fontWeight="700"
                    >
                      rotation axis
                    </text>
                  </g>
                )}
                {(selectedOperationInfo?.kind === "mirror" || selectedOperationInfo?.kind === "glide") && projectedPlane && (
                  <g>
                    <polygon
                      points={planePolygonPoints}
                      fill={selectedOperationInfo.kind === "mirror" ? "#38bdf8" : "#f59e0b"}
                      opacity="0.18"
                      stroke={selectedOperationInfo.kind === "mirror" ? "#0284c7" : "#d97706"}
                      strokeWidth="2"
                    />
                    <text
                      x={projectedPlane.projectedCenter.sx + 10}
                      y={projectedPlane.projectedCenter.sy - 10}
                      fill={selectedOperationInfo.kind === "mirror" ? "#0369a1" : "#b45309"}
                      fontSize="14"
                      fontWeight="700"
                    >
                      {selectedOperationInfo.kind === "mirror" ? "mirror plane" : "glide plane"}
                    </text>
                  </g>
                )}

                {selectedOp &&
                  projectedPoints
                    .filter((point) => point.op === selectedOp)
                    .map((point, index) => (
                      <g key={`trail-${point.op}-${index}`}>
                        <line
                          x1={projectedSeed.sx}
                          y1={projectedSeed.sy}
                          x2={point.sx}
                          y2={point.sy}
                          stroke="#dc2626"
                          strokeWidth="2.5"
                          strokeDasharray="8 6"
                          opacity="0.9"
                        />
                        <circle
                          cx={projectedSeed.sx}
                          cy={projectedSeed.sy}
                          r="6"
                          fill="#f59e0b"
                          opacity="0.95"
                        />
                      </g>
                    ))}

                {projectedInversionCenter && (
                  <g>
                    <circle
                      cx={projectedInversionCenter.sx}
                      cy={projectedInversionCenter.sy}
                      r="8"
                      fill="#a855f7"
                      opacity="0.95"
                    />
                    <circle
                      cx={projectedInversionCenter.sx}
                      cy={projectedInversionCenter.sy}
                      r="14"
                      fill="transparent"
                      stroke="#a855f7"
                      strokeWidth="2"
                      opacity="0.8"
                    />
                    <text
                      x={projectedInversionCenter.sx + 10}
                      y={projectedInversionCenter.sy - 10}
                      fill="#7e22ce"
                      fontSize="14"
                      fontWeight="700"
                    >
                      inversion center
                    </text>
                  </g>
                )}

                {projectedPoints.map((point, index) => {
                  const r = 4 + point.scale * 3.8;
                  const isSelected = selectedOp === point.op;
                  return (
                    <g
                      key={`${point.op}-${index}`}
                      onClick={() => setSelectedOp(point.op)}
                      style={{ cursor: "pointer" }}
                    >
                      <circle
                        cx={point.sx}
                        cy={point.sy}
                        r={r}
                        fill={isSelected ? "#dc2626" : "#0f172a"}
                        opacity="0.95"
                      />
                      <circle
                        cx={point.sx}
                        cy={point.sy}
                        r={isSelected ? r + 5 : r + 3}
                        fill="transparent"
                        stroke={isSelected ? "#dc2626" : "#94a3b8"}
                        strokeWidth={isSelected ? "2" : "1"}
                        opacity={isSelected ? "0.95" : "0.45"}
                      />
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
          <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 shadow-sm">
            <div className="text-sm font-semibold text-amber-900">操作の分類</div>
            {selectedOperationInfo ? (
              <>
                <div className="mt-2 text-lg font-bold text-slate-900">
                  {selectedOperationInfo.kind === "screw" ? "screw" : selectedOperationInfo.kind}
                </div>
                <div className="mt-1 text-sm text-slate-700">{selectedOperationInfo.detail}</div>
                {selectedOperationInfo.kind === "rotoinversion" && selectedOperationInfo.axisDirection && (
                  <div className="mt-2 text-sm text-slate-700">
                    回反軸: {selectedOperationInfo.axisDirection}
                  </div>
                )}
                {projectedInversionCenter && (
                  <div className="mt-2 text-sm text-slate-700">
                    反転中心: ({projectedInversionCenter.x.toFixed(3)}, {projectedInversionCenter.y.toFixed(3)}, {projectedInversionCenter.z.toFixed(3)})
                  </div>
                )}
                {projectedPlane && (
                  <div className="mt-2 text-sm text-slate-700">
                    {selectedOperationInfo.kind === "mirror"
                      ? `鏡映面: ${projectedPlane.normalAxis} 軸に垂直, 位置 ${projectedPlane.planeCoord.toFixed(3)}`
                      : `映進面: ${projectedPlane.normalAxis} 軸に垂直, 位置 ${projectedPlane.planeCoord.toFixed(3)}`}
                  </div>
                )}
              </>
            ) : (
              <div className="mt-2 text-sm text-slate-600">点をクリックすると分類が表示されます</div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6 lg:sticky lg:top-24">
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">表示パラメータ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <div className="mb-2 text-sm font-medium text-slate-700">初期点 x = {seedX.toFixed(2)}</div>
              <input type="range" min="0" max="1" step="0.01" value={seedX} onChange={(e) => setSeedX(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <div className="mb-2 text-sm font-medium text-slate-700">初期点 y = {seedY.toFixed(2)}</div>
              <input type="range" min="0" max="1" step="0.01" value={seedY} onChange={(e) => setSeedY(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <div className="mb-2 text-sm font-medium text-slate-700">初期点 z = {seedZ.toFixed(2)}</div>
              <input type="range" min="0" max="1" step="0.01" value={seedZ} onChange={(e) => setSeedZ(Number(e.target.value))} className="w-full" />
            </div>
            <Separator className="" />
            <div>
              <div className="mb-2 text-sm font-medium text-slate-700">
                拡大率 = {(zoom/2).toFixed(2)}
              </div>
              <input type="range" min="1.5" max="6.0" step="0.01" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-full" />
            </div>
            <Separator className="" />
            <div>
              <div className="mb-2 text-sm font-medium text-slate-700">回転 X = {rotX}°</div>
              <input type="range" min="-180" max="180" step="1" value={rotX} onChange={(e) => setRotX(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <div className="mb-2 text-sm font-medium text-slate-700">回転 Y = {rotY}°</div>
              <input type="range" min="-180" max="180" step="1" value={rotY} onChange={(e) => setRotY(Number(e.target.value))} className="w-full" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">等価点</CardTitle>
            <CardDescription>重複を除いた一般位置の等価点を表示しています。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-xl border p-3">
              <div className="text-slate-500">点の数</div>
              <div className="mt-1 text-2xl font-semibold">{projectedPoints.length}</div>
              <div className="mt-3 text-sm text-slate-500">
                {selectedOp ? `選択中の対称操作: ${selectedOp}` : "点をクリックすると対応する対称操作と軌跡を強調表示します。"}
              </div>
            </div>
            <div className="max-h-[320px] space-y-2 overflow-auto rounded-xl border p-3">
              {equivalentPoints.map((point, index) => {
                const isSelected = selectedOp === point.op;
                return (
                  <button
                    key={`${point.op}-${index}`}
                    type="button"
                    onClick={() => setSelectedOp(point.op)}
                    className={`block w-full rounded-lg border p-2 text-left transition ${
                      isSelected ? "border-rose-300 bg-rose-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className={`font-mono text-xs ${isSelected ? "text-rose-700" : "text-slate-500"}`}>{point.op}</div>
                    <div className="mt-1 text-sm font-medium">
                      ({point.x.toFixed(3)}, {point.y.toFixed(3)}, {point.z.toFixed(3)})
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SpacegroupListPage({
  entries,
  onSelectQuiz,
  onSelectSymmetry3D,
}: {
  entries: SpacegroupEntry[];
  onSelectQuiz: (entry: SpacegroupEntry) => void;
  onSelectSymmetry3D: (entry: SpacegroupEntry) => void;
}) {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-2xl md:text-3xl">Space Group 一覧</CardTitle>
        <CardDescription className="mt-2 text-sm md:text-base">
          登録されている空間群を一覧表示しています。各行からクイズページまたは 3D 対称表示ページを開けます。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-2xl border bg-white">
          <table className="min-w-full border-collapse text-sm md:text-base">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="border-b px-4 py-3 font-medium text-slate-600">No.</th>
                <th className="border-b px-4 py-3 font-medium text-slate-600">Hermann–Mauguin</th>
                <th className="border-b px-4 py-3 font-medium text-slate-600">Hall</th>
                <th className="border-b px-4 py-3 font-medium text-slate-600">結晶系</th>
                <th className="border-b px-4 py-3 font-medium text-slate-600">点群</th>
                <th className="border-b px-4 py-3 font-medium text-slate-600">移動</th>
              </tr>
            </thead>
            <tbody>
              {[...entries].sort((a, b) => a.international_number - b.international_number).map((item) => (
                <tr
                  key={`${item.international_number}-${item.hm}-${item.hall}`}
                  className="odd:bg-white even:bg-slate-50/50 hover:bg-slate-100"
                >
                  <td className="border-b px-4 py-3 align-top">{item.international_number}</td>
                  <td className="border-b px-4 py-3 align-top font-medium">{item.hm}</td>
                  <td className="border-b px-4 py-3 align-top font-mono text-xs md:text-sm">{item.hall}</td>
                  <td className="border-b px-4 py-3 align-top">{item.crystal_system}</td>
                  <td className="border-b px-4 py-3 align-top">{item.point_group_hm}</td>
                  <td className="border-b px-4 py-3 align-top">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectQuiz(item)}
                        className="rounded-xl border bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100"
                      >
                        クイズ
                      </button>
                      <button
                        type="button"
                        onClick={() => onSelectSymmetry3D(item)}
                        className="rounded-xl border bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100"
                      >
                        3D表示
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SpacegroupQuizApp() {
  const [data, setData] = useState<SpacegroupData>({ meta: { enumeration_source: "", itb_only: false, n_entries: 0, description: "" }, entries: [] });
  const [entry, setEntry] = useState<SpacegroupEntry | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerValue | null>>({});
  const [submitted, setSubmitted] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("quiz");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}my_settings.json`, { cache: "no-store" });
        if (!res.ok) throw new Error("JSON not found");
        const json = (await res.json()) as SpacegroupData;
        if (!active) return;
        if (json.entries?.length) {
          setData(json);
          setEntry(pickRandomEntry(json.entries));
        }
      } catch {
        if (!active) return;
      }
    }

    void loadData();
    return () => {
      active = false;
    };
  }, []);

  const statements = useMemo(() => (entry ? makeQuiz(entry) : []), [entry]);
  const extinctionConditions = useMemo(() => (entry ? getExtinctionConditions(entry) : []), [entry]);

  useEffect(() => {
    const next: Record<string, AnswerValue | null> = {};
    for (const st of statements) {
      if (st.multiSelect) {
        next[st.id] = st.choices?.some((choice) => choice.value === "none") ? ["none"] : [];
      } else if (st.choices?.some((choice) => choice.value === "none")) {
        next[st.id] = "none";
      } else {
        next[st.id] = null;
      }
    }
    setAnswers(next);
    setSubmitted(false);
  }, [statements]);


  const score = statements.reduce((acc, st) => {
    if (!submitted) return acc;
    return acc + (isStatementCorrect(st) ? 1 : 0);
  }, 0);

    const allAnswered = statements.every((st) => {
    const value = answers[st.id];
    if (st.multiSelect) {
      return Array.isArray(value) && value.length > 0;
    }
    return value !== null;
  });

  function newQuiz() {
    setEntry(pickRandomEntry(data.entries));
    setViewMode("quiz");
    setMenuOpen(false);
  }

    function selectAnswer(statementId: string, value: AnswerValue) {
    if (submitted) return;
    const statement = statements.find((st) => st.id === statementId);
    if (!statement) return;

    if (statement.multiSelect && typeof value === "string") {
      setAnswers((prev) => {
        const current = Array.isArray(prev[statementId]) ? [...(prev[statementId] as string[])] : [];
        const hasNoneChoice = statement.choices?.some((choice) => choice.value === "none");

        if (value === "none") {
          return {
            ...prev,
            [statementId]: ["none"],
          };
        }

        let nextValues = current.filter((v) => v !== "none");
        const exists = nextValues.includes(value);
        nextValues = exists ? nextValues.filter((v) => v !== value) : [...nextValues, value];

        if (nextValues.length === 0 && hasNoneChoice) {
          nextValues = ["none"];
        }

        return {
          ...prev,
          [statementId]: nextValues,
        };
      });
      return;
    }

    setAnswers((prev) => ({
      ...prev,
      [statementId]: prev[statementId] === value ? null : value,
    }));
  }

  function isStatementCorrect(statement: Statement) {
    const selected = answers[statement.id];
    if (selected === null) return false;
    if (typeof statement.answer === "boolean") {
      return selected === tfLabel(statement.answer);
    }
    if (Array.isArray(statement.answer)) {
      if (!Array.isArray(selected)) return false;
      const a = [...statement.answer].sort();
      const b = [...selected].sort();
      return a.length === b.length && a.every((value, index) => value === b[index]);
    }
    return selected === statement.answer;
  }

  function switchToQuiz() {
    setViewMode("quiz");
    setMenuOpen(false);
  }

  function switchToList() {
    setViewMode("spacegroup-list");
    setMenuOpen(false);
  }

  function switchToSymmetry3D() {
    setViewMode("symmetry-3d");
    setMenuOpen(false);
  }

  function openQuizForEntry(selectedEntry: SpacegroupEntry) {
    setEntry(selectedEntry);
    setViewMode("quiz");
    setMenuOpen(false);
  }

  function openSymmetry3DForEntry(selectedEntry: SpacegroupEntry) {
    setEntry(selectedEntry);
    setViewMode("symmetry-3d");
    setMenuOpen(false);
  }

  if (!entry) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="sticky top-0 z-30 mx-auto mb-6 max-w-6xl bg-slate-50/95 pt-2 pb-4 backdrop-blur">
        <div className="relative flex items-center justify-between rounded-2xl border bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
          <div>
            <p className="text-lg font-semibold text-slate-900 md:text-xl">Space Group App</p>
            <p className="text-sm text-slate-500">クイズと一覧を切り替えて使えます。</p>
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-2xl border bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100"
              aria-label="メニューを開く"
            >
              <Menu className="h-4 w-4" />
              <span>メニュー</span>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full z-30 mt-2 min-w-[220px] rounded-2xl border bg-white p-2 shadow-lg">
                <button
                  type="button"
                  onClick={switchToQuiz}
                  className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition ${
                    viewMode === "quiz" ? "bg-slate-100 text-slate-900" : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <Home className="h-4 w-4" />
                  <span>クイズページ</span>
                </button>
                <button
                  type="button"
                  onClick={switchToList}
                  className={`mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition ${
                    viewMode === "spacegroup-list" ? "bg-slate-100 text-slate-900" : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <List className="h-4 w-4" />
                  <span>Space Group 一覧</span>
                </button>
                <button
                  type="button"
                  onClick={switchToSymmetry3D}
                  className={`mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition ${
                    viewMode === "symmetry-3d" ? "bg-slate-100 text-slate-900" : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <Box className="h-4 w-4" />
                  <span>3D対称表示</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {viewMode === "spacegroup-list" ? (
        <div className="mx-auto max-w-6xl">
          <SpacegroupListPage
            entries={data.entries}
            onSelectQuiz={openQuizForEntry}
            onSelectSymmetry3D={openSymmetry3DForEntry}
          />
        </div>
      ) : viewMode === "symmetry-3d" ? (
        <Symmetry3DPage entry={entry} />
      ) : (
        <div className="mx-auto grid max-w-6xl items-start gap-6 lg:grid-cols-[1.5fr_0.8fr]">
          <div>
            <Card className="overflow-visible rounded-2xl shadow-sm">
              <div className="sticky top-24 z-20 space-y-4 border-b bg-slate-50/95 pb-4 backdrop-blur">
                <CardHeader className="space-y-4 rounded-2xl bg-white/90 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-2xl md:text-3xl">Space Group Quiz</CardTitle>
                    <CardDescription className="mt-2 text-sm md:text-base">
                      空間群の性質について答えるクイズです。
                    </CardDescription>
                  </div>
                  <button
                    type="button"
                    onClick={newQuiz}
                    className="inline-flex items-center gap-2 rounded-2xl border bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100"
                    aria-label="別の問題を出題"
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span>問題を切り替える</span>
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>
                </CardHeader>

                <div className="rounded-2xl border bg-white p-5 shadow-sm">
                  <p className="text-sm text-slate-500">今回の出題空間群</p>
                  <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-end md:gap-6">
                    <div>
                      <p className="text-sm text-slate-500">Hermann–Mauguin 記号：</p>
                      <div className="text-3xl font-bold tracking-tight md:text-4xl">{entry.hm}</div>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Hall 記号：</p>
                      <div className="font-mono text-base md:text-lg">{entry.hall}</div>
                    </div>
                  </div>
                  <p className="mt-4 text-lg font-medium">この空間群について答えてください。</p>
                </div>
              </div>

              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <CardContent className="space-y-6">

                <div className="space-y-4">
                  {statements.map((statement, index) => {
                    const selected = answers[statement.id];
                    const isChoiceSelected = (choiceValue: string) =>
                      statement.multiSelect
                        ? Array.isArray(selected) && selected.includes(choiceValue)
                        : selected === choiceValue;
                    const correctAnswer =
                      typeof statement.answer === "boolean"
                        ? tfLabel(statement.answer)
                        : statement.id === "crystal-system-choice"
                          ? crystalSystemLabel(statement.answer as string)
                          : statement.id === "centring"
                            ? centringTypeLabel(statement.answer as string)
                            : statement.id === "mirror"
                              ? mirrorPlaneLabel(statement.answer as string)
                              : statement.id === "glide"
                                ? glidePlaneLabel(statement.answer as string)
                                : statement.id === "screw"
                                  ? screwAxisLabel(statement.answer as string)
                                  : statement.id === "screw-type"
                                    ? screwTypeLabel(statement.answer as string)
                                    : statement.id === "centring-extinction"
                                      ? centringExtinctionLabel(statement.answer)
                                      : statement.id === "glide-extinction"
                                        ? glideExtinctionLabel(statement.answer as string)
                                        : statement.id === "screw-extinction"
                                          ? screwExtinctionLabel(statement.answer as string)
                                          : statement.answer;
                    const isCorrect = submitted && isStatementCorrect(statement);
                    const isWrong = submitted && selected !== null && !isStatementCorrect(statement);

                    return (
                      <motion.div
                        key={statement.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.04 }}
                      >
                        <Card className="rounded-2xl border shadow-sm">
                            <CardContent className="flex flex-col gap-4 p-5">
                              <div className="flex-1">
                                <p className="text-lg font-semibold text-slate-500 md:text-xl">Q{index + 1}</p>
                                <p className="mt-1 text-base md:text-lg">{statement.text}</p>
                                {submitted && (
                                  <div className="mt-3 flex items-center gap-2 text-sm">
                                    {isCorrect && (
                                      <span className="inline-flex items-center gap-1 text-emerald-600">
                                        <CheckCircle2 className="h-4 w-4" /> 正解
                                      </span>
                                    )}
                                    {isWrong && (
                                      <span className="inline-flex items-center gap-1 text-rose-600">
                                        <XCircle className="h-4 w-4" /> 不正解
                                      </span>
                                    )}
                                    <span className="text-slate-500">正答: {correctAnswer}</span>
                                  </div>
                                )}
                              </div>

                              <div className="mt-2">
                                {statement.choices ? (
                                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                    {statement.choices.map((choice) => (
                                      <Button
                                        key={choice.value}
                                        variant={isChoiceSelected(choice.value) ? "default" : "outline"}
                                        className={`w-full rounded-2xl transition-colors ${
                                          isChoiceSelected(choice.value)
                                            ? "bg-slate-900 text-white border-slate-900 ring-2 ring-slate-300"
                                            : "bg-white text-slate-700 hover:bg-slate-100"
                                        }`}
                                        onClick={() => selectAnswer(statement.id, choice.value)}
                                        disabled={submitted}
                                      >
                                        <span className="flex items-center justify-between gap-3 text-base md:text-lg">
                                          <span>{choice.label}</span>
                                          {isChoiceSelected(choice.value) && <span className="text-xs font-semibold"></span>}
                                        </span>
                                      </Button>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="flex gap-2">
                                    <Button
                                      variant={selected === "◯" ? "default" : "outline"}
                                      className={`flex-1 rounded-2xl transition-colors ${
                                        selected === "◯"
                                          ? "bg-slate-900 text-white border-slate-900 ring-2 ring-slate-300"
                                          : "bg-white text-slate-700 hover:bg-slate-100"
                                      }`}
                                      onClick={() => selectAnswer(statement.id, "◯")}
                                      disabled={submitted}
                                    >
                                      <span className="flex items-center justify-center gap-2 text-base md:text-lg">
                                        <span>◯</span>
                                        {selected === "◯" && <span className="text-xs font-semibold"></span>}
                                      </span>
                                    </Button>
                                    <Button
                                      variant={selected === "✕" ? "default" : "outline"}
                                      className={`flex-1 rounded-2xl transition-colors ${
                                        selected === "✕"
                                          ? "bg-slate-900 text-white border-slate-900 ring-2 ring-slate-300"
                                          : "bg-white text-slate-700 hover:bg-slate-100"
                                      }`}
                                      onClick={() => selectAnswer(statement.id, "✕")}
                                      disabled={submitted}
                                    >
                                      <span className="flex items-center justify-center gap-2 text-base md:text-lg">
                                        <span>✕</span>
                                        {selected === "✕" && <span className="text-xs font-semibold"></span>}
                                      </span>
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setSubmitted(true)}
                    disabled={!allAnswered || submitted}
                    className={`inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-medium shadow-sm transition ${
                      !allAnswered || submitted
                        ? "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400"
                        : "border border-slate-900 bg-slate-900 text-white hover:bg-slate-800"
                    }`}
                    aria-label="採点する"
                  >
                    <Send className="h-4 w-4" />
                    <span>回答を送信して採点</span>
                  </button>
                </div>
                </CardContent>
              </motion.div>
            </Card>
          </div>

          <motion.div className="self-start lg:sticky lg:top-24" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <div className="space-y-6">
              <Card className="rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Trophy className="h-5 w-5" />
                    結果
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-2xl border p-4">
                    <p className="text-sm text-slate-500">スコア</p>
                    <p className="mt-1 text-3xl font-semibold">
                      {submitted ? `${score} / ${statements.length}` : "- / -"}
                    </p>
                  </div>
                  <p className="text-sm text-slate-500">
                    {submitted ? "各設問の正誤は左側に表示されます。" : "すべて回答してから採点できます。"}
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl">座標軸の対応</CardTitle>
                </CardHeader>
                <CardContent>
                  <AxisConventionGuide />
                </CardContent>
              </Card>

              {submitted && (
              <Card className="rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl">出題中の設定情報</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <InfoRow label="Hermann–Mauguin 記号" value={entry.hm} />
                  <InfoRow label="短縮名" value={entry.short_name} />
                  <InfoRow label="Hall 記号" value={entry.hall} />
                  <InfoRow label="国際表番号" value={String(entry.international_number)} />
                  <InfoRow label="結晶系" value={entry.crystal_system} />
                  <InfoRow label="格子形式" value={entry.centring_type} />
                  <InfoRow label="点群" value={entry.point_group_hm} />
                  <Separator className="" />
                  <div className="rounded-xl border p-3">
                    <div className="font-medium text-slate-900">主な消滅条件</div>
                    <div className="mt-2 space-y-1 text-sm text-slate-700">
                      {extinctionConditions.map((condition, index) => (
                        <div key={`${condition}-${index}`}>• {condition}</div>
                      ))}
                    </div>
                  </div>
                  <details className="rounded-xl border p-3">
                    <summary className="cursor-pointer font-medium">設定の詳細と対称操作を表示</summary>
                    <div className="mt-3 space-y-2 text-sm">
                      {entry.qualifier && <InfoRow label="修飾子" value={entry.qualifier} />}
                      {entry.spglib_choice && <InfoRow label="設定の選択" value={entry.spglib_choice} />}
                    </div>
                    <div className="mt-3 space-y-1 font-mono text-xs">
                      {entry.operations_xyz.map((op, i) => (
                        <div key={`${op}-${i}`}>{op}</div>
                      ))}
                    </div>
                  </details>
                </CardContent>
              </Card>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function AxisConventionGuide() {
  return (
    <div className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-700">
      <p className="font-medium text-slate-900">座標軸の対応</p>
      <div className="mt-2 space-y-1">
        <p>x → a 軸方向</p>
        <p>y → b 軸方向</p>
        <p>z → c 軸方向</p>
      </div>
      <div className="mt-3 space-y-1 text-slate-600">
        <p>例: x, y, -z は z が反転しているので、c 軸に垂直な mirror plane（xy 面）を表します。</p>
        <p>例: x, y, -z+1/2 は c-glide を表します。</p>
        <p>例: x+1/2, y+1/2, -z は n-glide を表します。</p>
        <p>例: -x, -y, z+1/2 は z 軸方向のらせん軸を表します。</p>
        <p>例: -x, -y, z+5/6 は 6₅ screw を表します。</p>
        <p>回折の指数では、おおむね H, K, L がそれぞれ a*, b*, c* に対応します。</p>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[180px_1fr] gap-3">
      <div className="text-slate-500">{label}</div>
      <div className="font-medium break-all">{value}</div>
    </div>
  );
}
