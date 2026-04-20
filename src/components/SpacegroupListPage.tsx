import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SpacegroupEntry } from "@/logic/quiz";
import { GLIDE_PLANE_CHOICES, MIRROR_PLANE_CHOICES, SCREW_TYPE_CHOICES } from "@/data/choices";
import { analyzePlaneLikeOperation, analyzeScrewLikeOperation } from "@/logic/symmetry";

type SpacegroupListPageProps = {
  entries: SpacegroupEntry[];
  onStartQuiz: (entry: SpacegroupEntry, pool: SpacegroupEntry[], contextLabel?: string) => void;
  onOpenSymmetry: (entry: SpacegroupEntry) => void;
};

function getEntryGlideTypes(entry: SpacegroupEntry) {
  const types = new Set<string>();
  for (const op of entry.operations_xyz) {
    const analysis = analyzePlaneLikeOperation(op);
    if (analysis?.glideType) {
      types.add(analysis.glideType);
    }
  }
  return Array.from(types).sort();
}

function getEntryScrewTypes(entry: SpacegroupEntry) {
  const types = new Set<string>();
  for (const op of entry.operations_xyz) {
    const analysis = analyzeScrewLikeOperation(op);
    if (analysis?.screwType) {
      types.add(analysis.screwType);
    }
  }
  return Array.from(types).sort();
}
function getEntryMirrorTypes(entry: SpacegroupEntry) {
  const types = new Set<string>();
  for (const op of entry.operations_xyz) {
    const analysis = analyzePlaneLikeOperation(op);
    if (analysis?.kind === "mirror" && analysis.normalAxis) {
      types.add(analysis.normalAxis);
    }
  }
  return Array.from(types).sort();
}
function formatSelectedFilterLabels(
  selectedValues: string[],
  options: { value: string; label: string }[],
  allSelectedPredicate: boolean
) {
  if (selectedValues.length === 0 || allSelectedPredicate) {
    return "すべて";
  }

  if (selectedValues.length === 1) {
    const labelMap = new Map(options.map((option) => [option.value, option.label]));
    return labelMap.get(selectedValues[0]) ?? selectedValues[0];
  }

  return `${selectedValues.length}件選択`;
}

const CRYSTAL_LABEL_OPTIONS = [
  { value: "triclinic", label: "三斜晶系" },
  { value: "monoclinic", label: "単斜晶系" },
  { value: "orthorhombic", label: "斜方晶系" },
  { value: "tetragonal", label: "正方晶系" },
  { value: "trigonal", label: "三方晶系" },
  { value: "hexagonal", label: "六方晶系" },
  { value: "cubic", label: "立方晶系" },
] as const;

function formatContextPart(
  prefix: string,
  selectedValues: string[],
  options: { value: string; label: string }[],
  allSelectedPredicate: boolean
) {
  if (selectedValues.length === 0 || allSelectedPredicate) {
    return null;
  }
  return `${prefix} ${formatSelectedFilterLabels(selectedValues, options, allSelectedPredicate)}`;
}

function buildQuizContextLabel(args: {
  crystalFilter: string[];
  centringFilter: string[];
  mirrorTypeFilter: string[];
  glideTypeFilter: string[];
  screwTypeFilter: string[];
  inversionFilter: "all" | "with" | "without";
}) {
  const centringOptions = [
    { value: "P", label: "P" },
    { value: "A", label: "A" },
    { value: "B", label: "B" },
    { value: "C", label: "C" },
    { value: "I", label: "I" },
    { value: "F", label: "F" },
    { value: "R", label: "R" },
  ];

  const mirrorOptions = [
    { value: "none", label: "なし" },
    ...MIRROR_PLANE_CHOICES.filter((choice) => choice.value !== "none").map((choice) => ({
      value: choice.value,
      label: choice.label,
    })),
  ];

  const glideOptions = [
    { value: "none", label: "なし" },
    ...GLIDE_PLANE_CHOICES.filter((choice) => choice.value !== "none").map((choice) => ({
      value: choice.value,
      label: choice.label,
    })),
  ];

  const screwOptions = [
    { value: "none", label: "なし" },
    ...SCREW_TYPE_CHOICES.filter((choice) => choice.value !== "none").map((choice) => ({
      value: choice.value,
      label: choice.label,
    })),
  ];

  const parts = [
    formatContextPart(
      "結晶系",
      args.crystalFilter,
      CRYSTAL_LABEL_OPTIONS as unknown as { value: string; label: string }[],
      args.crystalFilter.length === CRYSTAL_LABEL_OPTIONS.length
    ),
    formatContextPart(
      "格子形式",
      args.centringFilter,
      centringOptions,
      args.centringFilter.length === centringOptions.length
    ),
    formatContextPart(
      "mirror",
      args.mirrorTypeFilter,
      mirrorOptions,
      args.mirrorTypeFilter.length === mirrorOptions.filter((item) => item.value !== "none").length
    ),
    formatContextPart(
      "glide",
      args.glideTypeFilter,
      glideOptions,
      args.glideTypeFilter.length === glideOptions.filter((item) => item.value !== "none").length
    ),
    formatContextPart(
      "screw",
      args.screwTypeFilter,
      screwOptions,
      args.screwTypeFilter.length === screwOptions.filter((item) => item.value !== "none").length
    ),
    args.inversionFilter === "with"
      ? "反転中心 あり"
      : args.inversionFilter === "without"
        ? "反転中心 なし"
        : null,
  ].filter((value): value is string => Boolean(value));

  return parts.length > 0 ? parts.join(" / ") : "すべて";
}

export default function SpacegroupListPage({
  entries,
  onStartQuiz,
  onOpenSymmetry,
}: SpacegroupListPageProps) {
  const [crystalFilter, setCrystalFilter] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [centringFilter, setCentringFilter] = useState<string[]>([]);
  const [mirrorTypeFilter, setMirrorTypeFilter] = useState<string[]>([]);
  const [inversionFilter, setInversionFilter] = useState<"all" | "with" | "without">("all");
  const [glideTypeFilter, setGlideTypeFilter] = useState<string[]>([]);
  const [screwTypeFilter, setScrewTypeFilter] = useState<string[]>([]);
  const centringOptions = useMemo(() => {
    return [
      { value: "all", label: "すべて" },
      ...Array.from(new Set(entries.map((e) => e.centring_type)))
        .sort()
        .map((value) => ({ value, label: value })),
    ];
  }, [entries]);
  const crystalOptions = useMemo(() => {
  return [
    { value: "all", label: "すべて" },
    { value: "triclinic", label: "三斜晶系" },
    { value: "monoclinic", label: "単斜晶系" },
    { value: "orthorhombic", label: "斜方晶系" },
    { value: "tetragonal", label: "正方晶系" },
    { value: "trigonal", label: "三方晶系" },
    { value: "hexagonal", label: "六方晶系" },
    { value: "cubic", label: "立方晶系" },
  ];
}, []);

const mirrorTypeOptions = useMemo(() => {
  return [
    { value: "all", label: "すべて" },
    { value: "none", label: "なし" },
    ...MIRROR_PLANE_CHOICES.filter((choice) => choice.value !== "none").map((choice) => ({
      value: choice.value,
      label: choice.label,
    })),
  ];
}, []);

  const glideTypeOptions = useMemo(() => {
    return [
        { value: "all", label: "すべて" },
        { value: "none", label: "なし" },
        ...GLIDE_PLANE_CHOICES.filter((choice) => choice.value !== "none").map((choice) => ({
        value: choice.value,
        label: choice.label,
        })),
    ];
  }, []);

  const screwTypeOptions = useMemo(() => {
    return [
      { value: "all", label: "すべて" },
      { value: "none", label: "なし" },
      ...SCREW_TYPE_CHOICES.filter((choice) => choice.value !== "none").map((choice) => ({
        value: choice.value,
        label: choice.label,
      })),
    ];
  }, []);

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return entries.filter((e) => {
      if (q) {
        const target = [
          String(e.international_number),
          e.hm,
          e.hall,
          e.crystal_system,
          e.point_group_hm,
          e.centring_type,
        ]
          .join(" ")
          .toLowerCase();
        if (!target.includes(q)) return false;
      }

        if (crystalFilter.length > 0) {
        const matchesCrystalFilter = crystalFilter.some((value) =>
            value === "all" ? true : e.crystal_system === value
        );
        if (!matchesCrystalFilter) return false;
        }
      if (centringFilter.length > 0) {
        const matchesCentringFilter = centringFilter.some((value) =>
          value === "all" ? true : e.centring_type === value
        );
        if (!matchesCentringFilter) return false;
      }

        if (mirrorTypeFilter.length > 0) {
        const entryMirrorTypes = getEntryMirrorTypes(e);
        const matchesMirrorFilter = mirrorTypeFilter.some((value) =>
            value === "all"
            ? true
            : value === "none"
                ? entryMirrorTypes.length === 0
                : entryMirrorTypes.includes(value)
        );
        if (!matchesMirrorFilter) return false;
        }

    if (glideTypeFilter.length > 0) {
    const entryGlideTypes = getEntryGlideTypes(e);
    const matchesGlideFilter = glideTypeFilter.some((value) =>
        value === "all"
        ? true
        : value === "none"
            ? entryGlideTypes.length === 0
            : entryGlideTypes.includes(value)
    );
    if (!matchesGlideFilter) return false;
    }

      if (screwTypeFilter.length > 0) {
        const entryScrewTypes = getEntryScrewTypes(e);
        const matchesScrewFilter = screwTypeFilter.some((value) =>
          value === "all"
            ? true
            : value === "none"
              ? entryScrewTypes.length === 0
              : entryScrewTypes.includes(value)
        );
        if (!matchesScrewFilter) return false;
      }

      if (inversionFilter === "with" && !e.is_centrosymmetric) return false;
      if (inversionFilter === "without" && e.is_centrosymmetric) return false;

      return true;
    });
  }, [
    entries,
    searchQuery,
    crystalFilter,
    centringFilter,
    mirrorTypeFilter,
    glideTypeFilter,
    screwTypeFilter,
    inversionFilter,
  ]);

  const sortedEntries = useMemo(() => {
    return [...filteredEntries].sort(
      (a, b) => a.international_number - b.international_number
    );
  }, [filteredEntries]);

    const quizContextLabel = useMemo(() => {
    return buildQuizContextLabel({
      crystalFilter,
      centringFilter,
      mirrorTypeFilter,
      glideTypeFilter,
      screwTypeFilter,
      inversionFilter,
    });
  }, [
    crystalFilter,
    centringFilter,
    mirrorTypeFilter,
    glideTypeFilter,
    screwTypeFilter,
    inversionFilter,
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            SpaceGroup一覧
          </CardTitle>
          <CardDescription>
            空間群を選んで、クイズまたは3D対称表示へ進めます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <input
              type="text"
              className="min-w-[220px] rounded-xl border px-3 py-2 text-sm"
              placeholder="番号 / HM / Hall / 点群で検索"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
<details className="relative rounded-xl border bg-white px-3 py-2 text-sm">
  <summary className="cursor-pointer select-none text-slate-700">
結晶系: {formatSelectedFilterLabels(
  crystalFilter,
  crystalOptions,
  crystalFilter.length === crystalOptions.filter((item) => item.value !== "all").length
)}
  </summary>
  <div className="absolute left-0 top-full z-20 mt-2 min-w-[220px] rounded-xl border bg-white p-3 shadow-lg">
    <div className="grid gap-2">
      {crystalOptions.map((option) => {
        const checked =
          option.value === "all"
            ? crystalFilter.length === crystalOptions.filter((item) => item.value !== "all").length
            : crystalFilter.includes(option.value);
        return (
          <label key={option.value} className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => {
                if (e.target.checked) {
                  setCrystalFilter((prev) => {
                    const selectableValues = crystalOptions
                      .filter((item) => item.value !== "all")
                      .map((item) => item.value);

                    if (option.value === "all") {
                      return selectableValues;
                    }
                    return prev.includes(option.value) ? prev : [...prev, option.value];
                  });
                } else {
                  setCrystalFilter((prev) => {
                    if (option.value === "all") {
                      return [];
                    }
                    return prev.filter((value) => value !== option.value && value !== "all");
                  });
                }
              }}
            />
            <span>{option.label}</span>
          </label>
        );
      })}
    </div>
  </div>
</details>
 <details className="relative rounded-xl border bg-white px-3 py-2 text-sm">
              <summary className="cursor-pointer select-none text-slate-700">
格子形式: {formatSelectedFilterLabels(
  centringFilter,
  centringOptions,
  centringFilter.length === centringOptions.filter((item) => item.value !== "all").length
)}
              </summary>
              <div className="absolute left-0 top-full z-20 mt-2 min-w-[180px] rounded-xl border bg-white p-3 shadow-lg">
                <div className="grid gap-2">
                  {centringOptions.map((option) => {
                    const checked =
                      option.value === "all"
                        ? centringFilter.length === centringOptions.filter((item) => item.value !== "all").length
                        : centringFilter.includes(option.value);
                    return (
                      <label key={option.value} className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCentringFilter((prev) => {
                                const selectableValues = centringOptions
                                  .filter((item) => item.value !== "all")
                                  .map((item) => item.value);

                                if (option.value === "all") {
                                  return selectableValues;
                                }
                                return prev.includes(option.value) ? prev : [...prev, option.value];
                              });
                            } else {
                              setCentringFilter((prev) => {
                                if (option.value === "all") {
                                  return [];
                                }
                                return prev.filter((value) => value !== option.value && value !== "all");
                              });
                            }
                          }}
                        />
                        <span>{option.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </details>
            <details className="relative rounded-xl border bg-white px-3 py-2 text-sm">
  <summary className="cursor-pointer select-none text-slate-700">
mirror種類: {formatSelectedFilterLabels(
  mirrorTypeFilter,
  mirrorTypeOptions,
  mirrorTypeFilter.length === mirrorTypeOptions.filter((item) => item.value !== "all" && item.value !== "none").length
)}
  </summary>
  <div className="absolute left-0 top-full z-20 mt-2 min-w-[220px] rounded-xl border bg-white p-3 shadow-lg">
    <div className="grid gap-2">
      {mirrorTypeOptions.map((option) => {
        const checked =
          option.value === "all"
            ? mirrorTypeFilter.length === mirrorTypeOptions.filter((item) => item.value !== "all" && item.value !== "none").length && !mirrorTypeFilter.includes("none")
            : mirrorTypeFilter.includes(option.value);
        return (
          <label key={option.value} className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => {
                if (e.target.checked) {
                  setMirrorTypeFilter((prev) => {
                    const selectableValues = mirrorTypeOptions
                      .filter((item) => item.value !== "all" && item.value !== "none")
                      .map((item) => item.value);

                    if (option.value === "all") {
                      return selectableValues;
                    }
                    if (option.value === "none") {
                      return ["none"];
                    }
                    const withoutSpecial = prev.filter((value) => value !== "none" && value !== "all");
                    return withoutSpecial.includes(option.value)
                      ? withoutSpecial
                      : [...withoutSpecial, option.value];
                  });
                } else {
                  setMirrorTypeFilter((prev) => {
                    if (option.value === "all") {
                      return [];
                    }
                    return prev.filter((value) => value !== option.value && value !== "all");
                  });
                }
              }}
            />
            <span>{option.label}</span>
          </label>
        );
      })}
    </div>
  </div>
</details>
            <details className="relative rounded-xl border bg-white px-3 py-2 text-sm">
              <summary className="cursor-pointer select-none text-slate-700">
glide種類: {formatSelectedFilterLabels(
  glideTypeFilter,
  glideTypeOptions,
  glideTypeFilter.length === glideTypeOptions.filter((item) => item.value !== "all" && item.value !== "none").length
)}
              </summary>
              <div className="absolute left-0 top-full z-20 mt-2 min-w-[180px] rounded-xl border bg-white p-3 shadow-lg">
                <div className="grid gap-2">
                  {glideTypeOptions.map((option) => {
                    const checked =
                      option.value === "all"
                        ? glideTypeFilter.length === glideTypeOptions.filter((item) => item.value !== "all" && item.value !== "none").length && !glideTypeFilter.includes("none")
                        : glideTypeFilter.includes(option.value);
                    return (
                      <label key={option.value} className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setGlideTypeFilter((prev) => {
                                const selectableValues = glideTypeOptions
                                  .filter((item) => item.value !== "all" && item.value !== "none")
                                  .map((item) => item.value);

                                if (option.value === "all") {
                                  return selectableValues;
                                }
                                if (option.value === "none") {
                                  return ["none"];
                                }
                                const withoutSpecial = prev.filter((value) => value !== "none" && value !== "all");
                                return withoutSpecial.includes(option.value)
                                  ? withoutSpecial
                                  : [...withoutSpecial, option.value];
                              });
                            } else {
                              setGlideTypeFilter((prev) => {
                                if (option.value === "all") {
                                  return [];
                                }
                                return prev.filter((value) => value !== option.value && value !== "all");
                              });
                            }
                          }}
                        />
                        <span>{option.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </details>
            <details className="relative rounded-xl border bg-white px-3 py-2 text-sm">
              <summary className="cursor-pointer select-none text-slate-700">
screw種類: {formatSelectedFilterLabels(
  screwTypeFilter,
  screwTypeOptions,
  screwTypeFilter.length === screwTypeOptions.filter((item) => item.value !== "all" && item.value !== "none").length
)}
              </summary>
              <div className="absolute left-0 top-full z-20 mt-2 min-w-[180px] rounded-xl border bg-white p-3 shadow-lg">
                <div className="grid gap-2">
                  {screwTypeOptions.map((option) => {
                    const checked =
                      option.value === "all"
                        ? screwTypeFilter.length === screwTypeOptions.filter((item) => item.value !== "all" && item.value !== "none").length && !screwTypeFilter.includes("none")
                        : screwTypeFilter.includes(option.value);
                    return (
                      <label key={option.value} className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setScrewTypeFilter((prev) => {
                                const selectableValues = screwTypeOptions
                                  .filter((item) => item.value !== "all" && item.value !== "none")
                                  .map((item) => item.value);

                                if (option.value === "all") {
                                  return selectableValues;
                                }
                                if (option.value === "none") {
                                  return ["none"];
                                }
                                const withoutSpecial = prev.filter((value) => value !== "none" && value !== "all");
                                return withoutSpecial.includes(option.value)
                                  ? withoutSpecial
                                  : [...withoutSpecial, option.value];
                              });
                            } else {
                              setScrewTypeFilter((prev) => {
                                if (option.value === "all") {
                                  return [];
                                }
                                return prev.filter((value) => value !== option.value && value !== "all");
                              });
                            }
                          }}
                        />
                        <span>{option.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </details>
            <label className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm text-slate-700">
            <span>反転中心:</span>
            <select
                className="bg-transparent text-sm outline-none"
                value={inversionFilter}
                onChange={(e) => setInversionFilter(e.target.value as "all" | "with" | "without")}
            >
                <option value="all">すべて</option>
                <option value="with">あり</option>
                <option value="without">なし</option>
            </select>
            </label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => {
                setSearchQuery("");
                setCrystalFilter([]);
                setCentringFilter([]);
                setMirrorTypeFilter([]);
                setGlideTypeFilter([]);
                setScrewTypeFilter([]);
                setInversionFilter("all");
              }}
            >
              リセット
            </Button>

            <div className="ml-auto flex items-center gap-3">
              <div className="text-sm text-slate-500">
                {filteredEntries.length} 件
              </div>
              <Button
                type="button"
                variant="default"
                size="sm"
                className="rounded-xl"
                disabled={filteredEntries.length === 0}
                onClick={() => {
                const random = filteredEntries[Math.floor(Math.random() * filteredEntries.length)];
                onStartQuiz(random, filteredEntries, quizContextLabel);
                }}
              >
                クイズへ
              </Button>
            </div>
          </div>
            <div className="max-h-[70vh] overflow-auto rounded-2xl border">
            <table className="min-w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50">
                <tr>
                <th className="border-b bg-slate-50 px-4 py-3 text-left font-semibold text-slate-700">No.</th>
                <th className="border-b bg-slate-50 px-4 py-3 text-left font-semibold text-slate-700">HM</th>
                <th className="border-b bg-slate-50 px-4 py-3 text-left font-semibold text-slate-700">Hall</th>
                <th className="border-b bg-slate-50 px-4 py-3 text-left font-semibold text-slate-700">Crystal system</th>
                <th className="border-b bg-slate-50 px-4 py-3 text-left font-semibold text-slate-700">Point group</th>
                <th className="border-b bg-slate-50 px-4 py-3 text-left font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedEntries.map((item) => (
                  <tr key={`${item.international_number}-${item.hm}-${item.hall}`} className="align-top hover:bg-slate-50/60">
                    <td className="border-b px-4 py-3">{item.international_number}</td>
                    <td className="border-b px-4 py-3 font-semibold text-slate-900">{item.hm}</td>
                    <td className="border-b px-4 py-3 font-mono text-xs text-slate-600">{item.hall}</td>
                    <td className="border-b px-4 py-3">{item.crystal_system}</td>
                    <td className="border-b px-4 py-3">{item.point_group_hm}</td>
                    <td className="border-b px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="rounded-xl"
                          onClick={() => onStartQuiz(item, filteredEntries, quizContextLabel)}
                        >
                          クイズ
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="rounded-xl"
                          onClick={() => onOpenSymmetry(item)}
                        >
                          3D表示
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
