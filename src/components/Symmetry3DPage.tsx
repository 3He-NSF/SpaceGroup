import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent, type WheelEvent as ReactWheelEvent } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { SpacegroupEntry } from "@/logic/quiz";
import { parseOperation, classifyOperation, getInversionCenter } from "@/logic/symmetry";

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

function getPlaneVisualization(op: string): {
  kind: "mirror" | "glide";
  normalAxis: "x" | "y" | "z";
  planeCoord: number;
  corners: { x: number; y: number; z: number }[];
  glideVector?: { x: number; y: number; z: number };
  center: { x: number; y: number; z: number };
} | null {
  const parsed = parseOperation(op);
  if (!parsed) return null;

  const matrix = parsed.matrix;
  const translation = parsed.translation;
  const mod1 = (v: number) => ((v % 1) + 1) % 1;
  const half = (v: number) => mod1(v / 2);
  const approx = (a: number, b: number) => Math.abs(mod1(a) - mod1(b)) < 1e-6;

  const classifyGlide = (
    tx: number,
    ty: number,
    tz: number,
    normalAxis: "x" | "y" | "z"
  ): "a" | "b" | "c" | "n" | "d" | null => {
    const values =
      normalAxis === "x"
        ? { a: 0, b: ty, c: tz }
        : normalAxis === "y"
          ? { a: tx, b: 0, c: tz }
          : { a: tx, b: ty, c: 0 };

    const ha = approx(values.a, 0.5);
    const hb = approx(values.b, 0.5);
    const hc = approx(values.c, 0.5);
    const qa = approx(values.a, 0.25) || approx(values.a, 0.75);
    const qb = approx(values.b, 0.25) || approx(values.b, 0.75);
    const qc = approx(values.c, 0.25) || approx(values.c, 0.75);
    const za = approx(values.a, 0);
    const zb = approx(values.b, 0);
    const zc = approx(values.c, 0);

    if (ha && zb && zc) return "a";
    if (za && hb && zc) return "b";
    if (za && zb && hc) return "c";
    if ((ha && hb && zc) || (ha && zb && hc) || (za && hb && hc)) return "n";
    if ((qa && qb && zc) || (qa && zb && qc) || (za && qb && qc) || (qa && qb && qc)) return "d";
    return null;
  };

  const candidates: { normalAxis: "x" | "y" | "z"; matrix: [number, number, number][] }[] = [
    { normalAxis: "x", matrix: [[-1, 0, 0], [0, 1, 0], [0, 0, 1]] },
    { normalAxis: "y", matrix: [[1, 0, 0], [0, -1, 0], [0, 0, 1]] },
    { normalAxis: "z", matrix: [[1, 0, 0], [0, 1, 0], [0, 0, -1]] },
  ];

  const matched = candidates.find((candidate) =>
    candidate.matrix.every((row, i) => row.every((v, j) => v === matrix[i][j]))
  );
  if (!matched) return null;

  const normalAxis = matched.normalAxis;
  const glideType = classifyGlide(translation[0], translation[1], translation[2], normalAxis);
  const kind: "mirror" | "glide" = glideType ? "glide" : "mirror";

  if (normalAxis === "x") {
    const planeCoord = half(translation[0]);
    return {
      kind,
      normalAxis: "x",
      planeCoord,
      corners: [
        { x: planeCoord, y: 0, z: 0 },
        { x: planeCoord, y: 1, z: 0 },
        { x: planeCoord, y: 1, z: 1 },
        { x: planeCoord, y: 0, z: 1 },
      ],
      glideVector: kind === "glide"
        ? { x: 0, y: mod1(translation[1]), z: mod1(translation[2]) }
        : undefined,
      center: { x: planeCoord, y: 0.5, z: 0.5 },
    };
  }

  if (normalAxis === "y") {
    const planeCoord = half(translation[1]);
    return {
      kind,
      normalAxis: "y",
      planeCoord,
      corners: [
        { x: 0, y: planeCoord, z: 0 },
        { x: 1, y: planeCoord, z: 0 },
        { x: 1, y: planeCoord, z: 1 },
        { x: 0, y: planeCoord, z: 1 },
      ],
      glideVector: kind === "glide"
        ? { x: mod1(translation[0]), y: 0, z: mod1(translation[2]) }
        : undefined,
      center: { x: 0.5, y: planeCoord, z: 0.5 },
    };
  }

  const planeCoord = half(translation[2]);
  return {
    kind,
    normalAxis: "z",
    planeCoord,
    corners: [
      { x: 0, y: 0, z: planeCoord },
      { x: 1, y: 0, z: planeCoord },
      { x: 1, y: 1, z: planeCoord },
      { x: 0, y: 1, z: planeCoord },
    ],
    glideVector: kind === "glide"
      ? { x: mod1(translation[0]), y: mod1(translation[1]), z: 0 }
      : undefined,
    center: { x: 0.5, y: 0.5, z: planeCoord },
  };
}

export default function Symmetry3DPage({ entry }: { entry: SpacegroupEntry }) {
  const [seedX, setSeedX] = useState(0.1);
  const [seedY, setSeedY] = useState(0.1);
  const [seedZ, setSeedZ] = useState(0.1);
  const [rotX, setRotX] = useState(-90);
  const [rotY, setRotY] = useState(0);
  const [zoom, setZoom] = useState(3);
  const [selectedOp, setSelectedOp] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [lastPos, setLastPos] = useState<{ x: number; y: number } | null>(null);

  const width = 760;
  const height = 560;
  const scale = 400 * (zoom / 2);
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
                        <circle cx={projectedSeed.sx} cy={projectedSeed.sy} r="6" fill="#f59e0b" opacity="0.95" />
                      </g>
                    ))}

                {projectedInversionCenter && (
                  <g>
                    <circle cx={projectedInversionCenter.sx} cy={projectedInversionCenter.sy} r="8" fill="#a855f7" opacity="0.95" />
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
                    <g key={`${point.op}-${index}`} onClick={() => setSelectedOp(point.op)} style={{ cursor: "pointer" }}>
                      <circle cx={point.sx} cy={point.sy} r={r} fill={isSelected ? "#dc2626" : "#0f172a"} opacity="0.95" />
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
              <div className="mb-2 text-sm font-medium text-slate-700">拡大率 = {(zoom / 2).toFixed(2)}</div>
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