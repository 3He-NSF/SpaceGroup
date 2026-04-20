export type Axis = "x" | "y" | "z";

export type ParsedOperation = {
  matrix: [number, number, number][];
  translation: [number, number, number];
};

export type PlaneOperationAnalysis = {
  kind: "mirror" | "glide";
  normalAxis: Axis;
  glideType?: "a" | "b" | "c" | "n" | "d";
};

export type ScrewOperationAnalysis = {
  axis: Axis;
  screwType: "21" | "31" | "32" | "41" | "42" | "43" | "61" | "62" | "63" | "64" | "65";
};

function frac01(x: number): number {
  const y = x - Math.floor(x);
  return Math.abs(y) < 1e-8 ? 0 : y;
}

function parseFraction(token: string): number {
  if (token.includes("/")) {
    const [n, d] = token.split("/").map(Number);
    return n / d;
  }
  return Number(token);
}

function parseCoordinateExpression(expr: string): { coeffs: [number, number, number]; constant: number } {
  const terms = expr.replace(/-/g, "+-").split("+").filter((t) => t);

  let cx = 0;
  let cy = 0;
  let cz = 0;
  let c = 0;

  for (const t of terms) {
    if (t.includes("x")) cx += t.startsWith("-") ? -1 : 1;
    else if (t.includes("y")) cy += t.startsWith("-") ? -1 : 1;
    else if (t.includes("z")) cz += t.startsWith("-") ? -1 : 1;
    else c += parseFraction(t);
  }

  return { coeffs: [cx, cy, cz], constant: c };
}

export function parseOperation(op: string): ParsedOperation | null {
  const parts = op.split(",").map((s) => s.trim());
  if (parts.length !== 3) return null;

  const rows: [number, number, number][] = [];
  const trans: number[] = [];

  for (const p of parts) {
    const parsed = parseCoordinateExpression(p);
    rows.push(parsed.coeffs);
    trans.push(frac01(parsed.constant));
  }

  return {
    matrix: rows,
    translation: trans as [number, number, number],
  };
}

function gcd2(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  if (x === 0) return y;
  if (y === 0) return x;
  while (y !== 0) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}

function gcd3(a: number, b: number, c: number): number {
  return gcd2(gcd2(a, b), c);
}

function cross(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) {
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

  if ((nx === 1 || nx === -1) && ny === 0 && nz === 0) return "x軸";
  if (nx === 0 && (ny === 1 || ny === -1) && nz === 0) return "y軸";
  if (nx === 0 && ny === 0 && (nz === 1 || nz === -1)) return "z軸";

  return `[${nx} ${ny} ${nz}] 方向`;
}

function matrixEquals(a: [number, number, number][], b: [number, number, number][]) {
  return a.every((row, i) => row.every((v, j) => v === b[i][j]));
}

function isIntegerTranslationVector(v: [number, number, number]): boolean {
  return v.every((x) => Math.abs(frac01(x)) < 1e-8);
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

export function analyzePlaneLikeOperation(op: string): PlaneOperationAnalysis | null {
  const parsed = parseOperation(op);
  if (!parsed) return null;

  const candidates: { normalAxis: Axis; matrix: [number, number, number][] }[] = [
    { normalAxis: "x", matrix: [[-1, 0, 0], [0, 1, 0], [0, 0, 1]] },
    { normalAxis: "y", matrix: [[1, 0, 0], [0, -1, 0], [0, 0, 1]] },
    { normalAxis: "z", matrix: [[1, 0, 0], [0, 1, 0], [0, 0, -1]] },
  ];

  const matched = candidates.find((candidate) => matrixEquals(parsed.matrix, candidate.matrix));
  if (!matched) return null;

  const normalAxis = matched.normalAxis;
  const translation = parsed.translation;

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

export function analyzeScrewLikeOperation(op: string): ScrewOperationAnalysis | null {
  const parsed = parseOperation(op);
  if (!parsed) return null;

  const translation = parsed.translation;
  const mod1 = (v: number) => ((v % 1) + 1) % 1;
  const eps = 1e-6;
  const detectTypeFromTranslation = <T extends readonly ScrewOperationAnalysis["screwType"][]>(
    value: number,
    allowed: T
  ): T[number] | null => {
    const t = mod1(value);
    const mapping: Record<ScrewOperationAnalysis["screwType"], number> = {
      "21": 1 / 2,
      "31": 1 / 3,
      "32": 2 / 3,
      "41": 1 / 4,
      "42": 1 / 2,
      "43": 3 / 4,
      "61": 1 / 6,
      "62": 2 / 6,
      "63": 3 / 6,
      "64": 4 / 6,
      "65": 5 / 6,
    };
    for (const key of allowed) {
      if (Math.abs(t - mapping[key]) < eps) return key;
    }
    return null;
  };

  const aroundZ2 = matrixEquals(parsed.matrix, [[-1, 0, 0], [0, -1, 0], [0, 0, 1]]);
  const aroundY2 = matrixEquals(parsed.matrix, [[-1, 0, 0], [0, 1, 0], [0, 0, -1]]);
  const aroundX2 = matrixEquals(parsed.matrix, [[1, 0, 0], [0, -1, 0], [0, 0, -1]]);

  if (aroundZ2) {
    const screwType = detectTypeFromTranslation(translation[2], ["21"] as const);
    if (screwType) return { axis: "z", screwType };
  }
  if (aroundY2) {
    const screwType = detectTypeFromTranslation(translation[1], ["21"] as const);
    if (screwType) return { axis: "y", screwType };
  }
  if (aroundX2) {
    const screwType = detectTypeFromTranslation(translation[0], ["21"] as const);
    if (screwType) return { axis: "x", screwType };
  }

  const aroundZ4_90 = matrixEquals(parsed.matrix, [[0, -1, 0], [1, 0, 0], [0, 0, 1]]);
  const aroundZ4_180 = matrixEquals(parsed.matrix, [[-1, 0, 0], [0, -1, 0], [0, 0, 1]]);
  const aroundZ4_270 = matrixEquals(parsed.matrix, [[0, 1, 0], [-1, 0, 0], [0, 0, 1]]);

  if (aroundZ4_90 || aroundZ4_180 || aroundZ4_270) {
    const screwType = detectTypeFromTranslation(translation[2], ["41", "42", "43"] as const);
    if (screwType) return { axis: "z", screwType };
  }

  const aroundZ3_120 = matrixEquals(parsed.matrix, [[0, -1, 0], [1, -1, 0], [0, 0, 1]]);
  const aroundZ3_240 = matrixEquals(parsed.matrix, [[-1, 1, 0], [-1, 0, 0], [0, 0, 1]]);

  if (aroundZ3_120 || aroundZ3_240) {
    const screwType = detectTypeFromTranslation(translation[2], ["31", "32"] as const);
    if (screwType) return { axis: "z", screwType };
  }

  const aroundZ6_60 = matrixEquals(parsed.matrix, [[0, -1, 0], [1, 1, 0], [0, 0, 1]]);
  const aroundZ6_120 = matrixEquals(parsed.matrix, [[-1, -1, 0], [1, 0, 0], [0, 0, 1]]);
  const aroundZ6_180 = matrixEquals(parsed.matrix, [[-1, 0, 0], [0, -1, 0], [0, 0, 1]]);
  const aroundZ6_240 = matrixEquals(parsed.matrix, [[0, 1, 0], [-1, -1, 0], [0, 0, 1]]);
  const aroundZ6_300 = matrixEquals(parsed.matrix, [[1, 1, 0], [-1, 0, 0], [0, 0, 1]]);

  if (aroundZ6_60 || aroundZ6_120 || aroundZ6_180 || aroundZ6_240 || aroundZ6_300) {
    const screwType = detectTypeFromTranslation(translation[2], ["61", "62", "63", "64", "65"] as const);
    if (screwType) return { axis: "z", screwType };
  }

  return null;
}

export function getInversionCenter(op: string): { x: number; y: number; z: number } | null {
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

export function getRotoinversionAxisDirection(op: string): string | null {
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

export function getRotationAxisAndOrder(op: string): { axisDirection: string; order: number } | null {
  const parsed = parseOperation(op);
  if (!parsed) return null;

  const determinant =
    parsed.matrix[0][0] * (parsed.matrix[1][1] * parsed.matrix[2][2] - parsed.matrix[1][2] * parsed.matrix[2][1]) -
    parsed.matrix[0][1] * (parsed.matrix[1][0] * parsed.matrix[2][2] - parsed.matrix[1][2] * parsed.matrix[2][0]) +
    parsed.matrix[0][2] * (parsed.matrix[1][0] * parsed.matrix[2][1] - parsed.matrix[1][1] * parsed.matrix[2][0]);

  if (determinant !== 1) return null;

  const trace = parsed.matrix[0][0] + parsed.matrix[1][1] + parsed.matrix[2][2];
  let order: number | null = null;
  if (trace === -1) order = 2;
  else if (trace === 0) order = 3;
  else if (trace === 1) order = 4;
  else if (trace === 2) order = 6;

  if (!order) return null;

  const mMinusI = parsed.matrix.map((row, i) => [
    row[0] - (i === 0 ? 1 : 0),
    row[1] - (i === 1 ? 1 : 0),
    row[2] - (i === 2 ? 1 : 0),
  ]) as [number, number, number][];

  const rows = mMinusI.map((r) => ({ x: r[0], y: r[1], z: r[2] }));
  const candidates = [
    cross(rows[0], rows[1]),
    cross(rows[0], rows[2]),
    cross(rows[1], rows[2]),
  ];

  const axis = candidates.find((v) => norm2(v) > 0);
  if (!axis) return null;

  const axisDirection = formatAxisDirection(axis);
  return { axisDirection, order };
}

export function classifyOperation(op: string): {
  kind: "identity" | "translation" | "inversion" | "mirror" | "glide" | "rotation" | "screw" | "rotoinversion" | "unknown";
  detail: string;
  axisDirection?: string;
} {
  const parsed = parseOperation(op);
  if (!parsed) {
    return { kind: "unknown", detail: "分類できません" };
  }

  const determinant =
    parsed.matrix[0][0] * (parsed.matrix[1][1] * parsed.matrix[2][2] - parsed.matrix[1][2] * parsed.matrix[2][1]) -
    parsed.matrix[0][1] * (parsed.matrix[1][0] * parsed.matrix[2][2] - parsed.matrix[1][2] * parsed.matrix[2][0]) +
    parsed.matrix[0][2] * (parsed.matrix[1][0] * parsed.matrix[2][1] - parsed.matrix[1][1] * parsed.matrix[2][0]);
  const trace = parsed.matrix[0][0] + parsed.matrix[1][1] + parsed.matrix[2][2];
  const approx = (a: number, b: number) => Math.abs(a - b) < 1e-8;

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

  if (matrixEquals(parsed.matrix, identity)) {
    if (isIntegerTranslationVector(parsed.translation)) {
      return { kind: "identity", detail: "恒等操作" };
    }
    return { kind: "translation", detail: "並進操作" };
  }

  if (matrixEquals(parsed.matrix, inversion)) {
    return { kind: "inversion", detail: "反転操作" };
  }

  const plane = analyzePlaneLikeOperation(op);
  if (plane) {
    if (plane.kind === "mirror") {
      return { kind: "mirror", detail: `${plane.normalAxis}軸に垂直な鏡映面` };
    }
    return { kind: "glide", detail: `${plane.glideType}-glide（${plane.normalAxis}軸に垂直）` };
  }

  const screw = analyzeScrewLikeOperation(op);
  if (screw) {
    return {
      kind: "screw",
      detail: `${screw.axis}軸方向の ${screw.screwType[0]}_${screw.screwType.slice(1)} の螺旋操作`,
    };
  }

  if (determinant === 1) {
    const hasTranslation = !isIntegerTranslationVector(parsed.translation);
    const rotationInfo = getRotationAxisAndOrder(op);
    if (rotationInfo) {
      return {
        kind: "rotation",
        detail: `${rotationInfo.axisDirection} の ${rotationInfo.order} 回回転操作${hasTranslation ? "（並進付き）" : ""}`,
      };
    }
    return {
      kind: "rotation",
      detail: hasTranslation ? "回転操作（並進付き）" : "回転操作",
    };
  }

  if (approx(determinant, -1) && approx(trace, 1)) {
    const axisDirection = getRotoinversionAxisDirection(op);
    return {
      kind: "mirror",
      detail: axisDirection
        ? `鏡映操作 / mirror（${axisDirection} に垂直）`
        : "鏡映操作 / mirror",
      axisDirection: axisDirection ?? undefined,
    };
  }

  if (approx(determinant, -1)) {
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

export function detectMirrorPlaneAxes(entry: { operations_xyz: string[] }): string[] {
  const axes = new Set<Axis>();
  for (const op of entry.operations_xyz) {
    const analysis = analyzePlaneLikeOperation(op);
    if (analysis?.kind === "mirror") {
      axes.add(analysis.normalAxis);
    }
  }
  return axes.size === 0 ? ["none"] : Array.from(axes).sort();
}

export function detectGlidePlaneTypes(entry: { operations_xyz: string[] }): string[] {
  const glideTypes = new Set<"a" | "b" | "c" | "n" | "d">();
  for (const op of entry.operations_xyz) {
    const analysis = analyzePlaneLikeOperation(op);
    if (analysis?.kind === "glide" && analysis.glideType) {
      glideTypes.add(analysis.glideType);
    }
  }
  return glideTypes.size === 0 ? ["none"] : Array.from(glideTypes).sort();
}

export function detectScrewAxisTypes(entry: { operations_xyz: string[] }): string[] {
  const axes = new Set<Axis>();
  for (const op of entry.operations_xyz) {
    const analysis = analyzeScrewLikeOperation(op);
    if (analysis) {
      axes.add(analysis.axis);
    }
  }
  return axes.size === 0 ? ["none"] : Array.from(axes).sort();
}

export function detectScrewTypes(entry: { operations_xyz: string[] }): string[] {
  const types = new Set<ScrewOperationAnalysis["screwType"]>();
  for (const op of entry.operations_xyz) {
    const analysis = analyzeScrewLikeOperation(op);
    if (analysis) {
      types.add(analysis.screwType);
    }
  }
  return types.size === 0 ? ["none"] : Array.from(types).sort();
}

export function detectCentringExtinction(entry: { centring_type: string }): string[] {
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

export function detectGlideExtinctions(entry: { operations_xyz: string[] }): string[] {
  const results = new Set<string>();

  for (const op of entry.operations_xyz) {
    const plane = analyzePlaneLikeOperation(op);
    if (!plane || plane.kind !== "glide" || !plane.glideType) continue;

    if (plane.normalAxis === "z") {
      if (plane.glideType === "a" || plane.glideType === "n" || plane.glideType === "d") {
        results.add("hk0:h=2n");
      }
      if (plane.glideType === "b") {
        results.add("hk0:k=2n");
      }
    }

    if (plane.normalAxis === "y") {
      if (plane.glideType === "a" || plane.glideType === "n" || plane.glideType === "d") {
        results.add("h0l:h=2n");
      }
      if (plane.glideType === "c") {
        results.add("h0l:l=2n");
      }
    }

    if (plane.normalAxis === "x") {
      if (plane.glideType === "b" || plane.glideType === "n" || plane.glideType === "d") {
        results.add("0kl:k=2n");
      }
      if (plane.glideType === "c") {
        results.add("0kl:l=2n");
      }
    }
  }

  return results.size === 0 ? ["none"] : Array.from(results).sort();
}

export function detectScrewExtinctions(entry: { operations_xyz: string[] }): string[] {
  const results = new Set<string>();

  for (const op of entry.operations_xyz) {
    const screw = analyzeScrewLikeOperation(op);
    if (!screw) continue;

    if (screw.axis === "x") {
      if (screw.screwType === "21" || screw.screwType === "42") results.add("h00:h=2n");
      if (screw.screwType === "41" || screw.screwType === "43") results.add("h00:h=4n");
    }

    if (screw.axis === "y") {
      if (screw.screwType === "21" || screw.screwType === "42") results.add("0k0:k=2n");
      if (screw.screwType === "41" || screw.screwType === "43") results.add("0k0:k=4n");
    }

    if (screw.axis === "z") {
      if (screw.screwType === "61" || screw.screwType === "65") results.add("000l:l=6n");
      if (screw.screwType === "31" || screw.screwType === "32" || screw.screwType === "62" || screw.screwType === "64") results.add("00l:l=3n");
      if (screw.screwType === "41" || screw.screwType === "43") results.add("00l:l=4n");
      if (screw.screwType === "21" || screw.screwType === "42" || screw.screwType === "63") results.add("00l:l=2n");
    }
  }

  return results.size === 0 ? ["none"] : Array.from(results).sort();
}