import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { RefreshCw, CheckCircle2, XCircle, Trophy, ChevronDown, Send, Menu, Home, List } from "lucide-react";

type AnswerValue = "◯" | "✕" | string;

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
  answer: boolean | string;
  choices?: { value: string; label: string }[];
};

type ViewMode = "quiz" | "spacegroup-list";

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
  { value: "multiple", label: "複数の軸方向" },
  { value: "none", label: "鏡映面なし" },
] as const;

const GLIDE_PLANE_CHOICES = [
  { value: "a", label: "a-glide" },
  { value: "b", label: "b-glide" },
  { value: "c", label: "c-glide" },
  { value: "n", label: "n-glide" },
  { value: "d", label: "d-glide" },
  { value: "multiple", label: "複数種類の glide" },
  { value: "none", label: "映進面なし" },
] as const;

const SCREW_AXIS_CHOICES = [
  { value: "x", label: "x 軸方向" },
  { value: "y", label: "y 軸方向" },
  { value: "z", label: "z 軸方向" },
  { value: "multiple", label: "複数の軸方向" },
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
  { value: "multiple", label: "複数種類のらせん軸" },
  { value: "none", label: "らせん軸なし" },
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

function classifyGlideFromTranslation(tx: number, ty: number, tz: number): "a" | "b" | "c" | "n" | "d" | null {
  const mod1 = (v: number) => ((v % 1) + 1) % 1;
  const eps = 1e-6;
  const isHalf = (v: number) => Math.abs(mod1(v) - 0.5) < eps;
  const isQuarter = (v: number) => Math.abs(mod1(v) - 0.25) < eps || Math.abs(mod1(v) - 0.75) < eps;
  const isZero = (v: number) => Math.abs(mod1(v)) < eps;

  const hx = isHalf(tx);
  const hy = isHalf(ty);
  const hz = isHalf(tz);
  const qx = isQuarter(tx);
  const qy = isQuarter(ty);
  const qz = isQuarter(tz);
  const zx = isZero(tx);
  const zy = isZero(ty);
  const zz = isZero(tz);

  if (hx && zy && zz) return "a";
  if (zx && hy && zz) return "b";
  if (zx && zy && hz) return "c";
  if ((hx && hy && zz) || (hx && zy && hz) || (zx && hy && hz)) return "n";
  if ((qx && qy && zz) || (qx && zy && qz) || (zx && qy && qz) || (qx && qy && qz)) return "d";
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
  const glideType = classifyGlideFromTranslation(translation[0], translation[1], translation[2]);

  if (glideType) {
    return { kind: "glide", normalAxis, glideType };
  }

  const mod1 = (v: number) => ((v % 1) + 1) % 1;
  const isIntegerTranslation = translation.every((value) => Math.abs(mod1(value)) < 1e-6);
  if (isIntegerTranslation) {
    return { kind: "mirror", normalAxis };
  }

  return null;
}

function detectMirrorPlaneType(entry: SpacegroupEntry): "x" | "y" | "z" | "multiple" | "none" {
  const axes = new Set<Axis>();
  for (const op of entry.operations_xyz) {
    const analysis = analyzePlaneLikeOperation(op);
    if (analysis?.kind === "mirror") {
      axes.add(analysis.normalAxis);
    }
  }
  if (axes.size === 0) return "none";
  if (axes.size >= 2) return "multiple";
  return Array.from(axes)[0];
}

function detectGlidePlaneType(entry: SpacegroupEntry): "a" | "b" | "c" | "n" | "d" | "multiple" | "none" {
  const glideTypes = new Set<"a" | "b" | "c" | "n" | "d">();
  for (const op of entry.operations_xyz) {
    const analysis = analyzePlaneLikeOperation(op);
    if (analysis?.kind === "glide" && analysis.glideType) {
      glideTypes.add(analysis.glideType);
    }
  }
  if (glideTypes.size === 0) return "none";
  if (glideTypes.size >= 2) return "multiple";
  return Array.from(glideTypes)[0];
}

function analyzeScrewLikeOperation(op: string): ScrewOperationAnalysis | null {
  const parsed = parseOperation(op);
  if (!parsed) return null;

  const { matrix, translation } = parsed;
  const mod1 = (v: number) => ((v % 1) + 1) % 1;
  const eps = 1e-6;
  const isZero = (v: number) => Math.abs(mod1(v)) < eps;
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
  if (aroundZ2 && isZero(translation[0]) && isZero(translation[1])) {
    const screwType = detectTypeFromTranslation(translation[2], ["21"] as const);
    if (screwType) return { axis: "z", screwType };
  }

  const aroundY2 =
    matrix[0][0] === -1 && matrix[0][1] === 0 && matrix[0][2] === 0 &&
    matrix[1][0] === 0 && matrix[1][1] === 1 && matrix[1][2] === 0 &&
    matrix[2][0] === 0 && matrix[2][1] === 0 && matrix[2][2] === -1;
  if (aroundY2 && isZero(translation[0]) && isZero(translation[2])) {
    const screwType = detectTypeFromTranslation(translation[1], ["21"] as const);
    if (screwType) return { axis: "y", screwType };
  }

  const aroundX2 =
    matrix[0][0] === 1 && matrix[0][1] === 0 && matrix[0][2] === 0 &&
    matrix[1][0] === 0 && matrix[1][1] === -1 && matrix[1][2] === 0 &&
    matrix[2][0] === 0 && matrix[2][1] === 0 && matrix[2][2] === -1;
  if (aroundX2 && isZero(translation[1]) && isZero(translation[2])) {
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
  if ((aroundZ4_90 || aroundZ4_180 || aroundZ4_270) && isZero(translation[0]) && isZero(translation[1])) {
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
  if ((aroundZ3_120 || aroundZ3_240) && isZero(translation[0]) && isZero(translation[1])) {
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
  if ((aroundZ6_60 || aroundZ6_120 || aroundZ6_180 || aroundZ6_240 || aroundZ6_300) && isZero(translation[0]) && isZero(translation[1])) {
    const screwType = detectTypeFromTranslation(translation[2], ["61", "62", "63", "64", "65"] as const);
    if (screwType) return { axis: "z", screwType };
  }

  return null;
}
function detectScrewType(entry: SpacegroupEntry): "21" | "31" | "32" | "41" | "42" | "43" | "61" | "62" | "63" | "64" | "65" | "multiple" | "none" {
  const types = new Set<ScrewOperationAnalysis["screwType"]>();
  for (const op of entry.operations_xyz) {
    const analysis = analyzeScrewLikeOperation(op);
    if (analysis) {
      types.add(analysis.screwType);
    }
  }
  if (types.size === 0) return "none";
  if (types.size >= 2) return "multiple";
  return Array.from(types)[0];
}

function detectScrewAxisType(entry: SpacegroupEntry): "x" | "y" | "z" | "multiple" | "none" {
  const axes = new Set<Axis>();
  for (const op of entry.operations_xyz) {
    const analysis = analyzeScrewLikeOperation(op);
    if (analysis) {
      axes.add(analysis.axis);
    }
  }
  if (axes.size === 0) return "none";
  if (axes.size >= 2) return "multiple";
  return Array.from(axes)[0];
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
      text: "この空間群の鏡映面はどの軸に垂直かを選んでください。",
      answer: detectMirrorPlaneType(entry),
      choices: MIRROR_PLANE_CHOICES.map((choice) => ({ ...choice })),
    },
    {
      id: "glide",
      text: "この空間群に含まれる glide plane の種類を選んでください。",
      answer: detectGlidePlaneType(entry),
      choices: GLIDE_PLANE_CHOICES.map((choice) => ({ ...choice })),
    },
    {
      id: "screw",
      text: "この空間群のらせん軸はどの方向かを選んでください。",
      answer: detectScrewAxisType(entry),
      choices: SCREW_AXIS_CHOICES.map((choice) => ({ ...choice })),
    },
    {
      id: "screw-type",
      text: "この空間群に含まれるらせん軸の種類を選んでください。",
      answer: detectScrewType(entry),
      choices: SCREW_TYPE_CHOICES.map((choice) => ({ ...choice })),
    },
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

function pickRandomEntry(entries: SpacegroupEntry[]): SpacegroupEntry {
  return entries[Math.floor(Math.random() * entries.length)];
}

function SpacegroupListPage({
  entries,
  onSelectEntry,
}: {
  entries: SpacegroupEntry[];
  onSelectEntry: (entry: SpacegroupEntry) => void;
}) {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-2xl md:text-3xl">Space Group 一覧</CardTitle>
        <CardDescription className="mt-2 text-sm md:text-base">
          登録されている空間群を一覧表示しています。
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
              </tr>
            </thead>
            <tbody>
              {[...entries].sort((a, b) => a.international_number - b.international_number).map((item) => (
                <tr
                  key={`${item.international_number}-${item.hm}-${item.hall}`}
                  className="cursor-pointer odd:bg-white even:bg-slate-50/50 hover:bg-slate-100"
                  onClick={() => onSelectEntry(item)}
                >
                  <td className="border-b px-4 py-3 align-top">{item.international_number}</td>
                  <td className="border-b px-4 py-3 align-top font-medium">{item.hm}</td>
                  <td className="border-b px-4 py-3 align-top font-mono text-xs md:text-sm">{item.hall}</td>
                  <td className="border-b px-4 py-3 align-top">{item.crystal_system}</td>
                  <td className="border-b px-4 py-3 align-top">{item.point_group_hm}</td>
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
        const res = await fetch("./my_settings.json", { cache: "no-store" });
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

  useEffect(() => {
    const next: Record<string, AnswerValue | null> = {};
    for (const st of statements) next[st.id] = null;
    setAnswers(next);
    setSubmitted(false);
  }, [statements]);

  const score = statements.reduce((acc, st) => {
    if (!submitted) return acc;
    return acc + (isStatementCorrect(st) ? 1 : 0);
  }, 0);

  const allAnswered = statements.every((st) => answers[st.id] !== null);

  function newQuiz() {
    setEntry(pickRandomEntry(data.entries));
    setViewMode("quiz");
    setMenuOpen(false);
  }

  function selectAnswer(statementId: string, value: AnswerValue) {
    if (submitted) return;
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

  function openQuizForEntry(selectedEntry: SpacegroupEntry) {
    setEntry(selectedEntry);
    setViewMode("quiz");
    setMenuOpen(false);
  }

  if (!entry) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto mb-6 max-w-6xl">
        <div className="relative flex items-center justify-between rounded-2xl border bg-white px-4 py-3 shadow-sm">
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
              </div>
            )}
          </div>
        </div>
      </div>

      {viewMode === "spacegroup-list" ? (
        <div className="mx-auto max-w-6xl">
          <SpacegroupListPage entries={data.entries} onSelectEntry={openQuizForEntry} />
        </div>
      ) : (
        <div className="mx-auto grid max-w-6xl items-start gap-6 lg:grid-cols-[1.5fr_0.8fr]">
          <div>
            <Card className="overflow-visible rounded-2xl shadow-sm">
              <div className="sticky top-0 z-20 space-y-4 border-b bg-slate-50/95 pb-4 backdrop-blur">
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
                    const correctAnswer =
                      typeof statement.answer === "boolean"
                        ? tfLabel(statement.answer)
                        : statement.id === "crystal-system-choice"
                          ? crystalSystemLabel(statement.answer)
                          : statement.id === "centring"
                            ? centringTypeLabel(statement.answer)
                            : statement.id === "mirror"
                              ? mirrorPlaneLabel(statement.answer)
                              : statement.id === "glide"
                                ? glidePlaneLabel(statement.answer)
                                : statement.id === "screw"
                                  ? screwAxisLabel(statement.answer)
                                  : statement.id === "screw-type"
                                    ? screwTypeLabel(statement.answer)
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
                                        variant={selected === choice.value ? "default" : "outline"}
                                        className={`w-full rounded-2xl transition-colors ${
                                          selected === choice.value
                                            ? "bg-slate-900 text-white border-slate-900 ring-2 ring-slate-300"
                                            : "bg-white text-slate-700 hover:bg-slate-100"
                                        }`}
                                        onClick={() => selectAnswer(statement.id, choice.value)}
                                        disabled={submitted}
                                      >
                                        <span className="flex items-center justify-between gap-3 text-base md:text-lg">
                                          <span>{choice.label}</span>
                                          {selected === choice.value && <span className="text-xs font-semibold"></span>}
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

          <motion.div className="self-start lg:sticky lg:top-4" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
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
