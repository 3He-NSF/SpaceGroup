import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RefreshCw, CheckCircle2, XCircle, Trophy, HelpCircle } from "lucide-react";

type TF = "T" | "F";

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
  answer: boolean;
};

const defaultData: SpacegroupData = {
  meta: {
    enumeration_source: "embedded-sample",
    itb_only: false,
    n_entries: 4,
    description: "Fallback sample data bundled in the app.",
  },
  entries: [
    {
      gemmi_index: 1,
      international_number: 1,
      hm: "P 1",
      xhm: "P 1",
      short_name: "P1",
      hall: "P 1",
      qualifier: "",
      ext: "",
      centring_type: "P",
      crystal_system: "triclinic",
      point_group_hm: "1",
      is_centrosymmetric: false,
      is_enantiomorphic: false,
      is_sohncke: true,
      is_symmorphic: true,
      has_mirror: false,
      has_glide: false,
      has_screw: false,
      n_operations: 1,
      operations_xyz: ["x,y,z"],
      basisop_xyz: "x,y,z",
      spglib_identified: true,
      hall_number: 1,
      spglib_international: "P 1",
      spglib_international_full: "P 1",
      spglib_hall_symbol: "P 1",
      spglib_choice: "",
      pointgroup_international: "1",
      pointgroup_schoenflies: "C1",
      arithmetic_crystal_class_number: 1,
      arithmetic_crystal_class_symbol: "1P",
    },
    {
      gemmi_index: 6,
      international_number: 4,
      hm: "P 1 21 1",
      xhm: "P 1 21 1",
      short_name: "P21",
      hall: "P 2yb",
      qualifier: "b",
      ext: "",
      centring_type: "P",
      crystal_system: "monoclinic",
      point_group_hm: "2",
      is_centrosymmetric: false,
      is_enantiomorphic: false,
      is_sohncke: true,
      is_symmorphic: false,
      has_mirror: false,
      has_glide: false,
      has_screw: true,
      n_operations: 2,
      operations_xyz: ["x,y,z", "-x,y+1/2,-z"],
      basisop_xyz: "x,y,z",
      spglib_identified: true,
      hall_number: 6,
      spglib_international: "P 2_1 = P 1 2_1 1",
      spglib_international_full: "P 1 2_1 1",
      spglib_hall_symbol: "P 2yb",
      spglib_choice: "b",
      pointgroup_international: "2",
      pointgroup_schoenflies: "C2",
      arithmetic_crystal_class_number: 3,
      arithmetic_crystal_class_symbol: "2P",
    },
    {
      gemmi_index: 18,
      international_number: 6,
      hm: "P 1 m 1",
      xhm: "P 1 m 1",
      short_name: "Pm",
      hall: "P -2y",
      qualifier: "b",
      ext: "",
      centring_type: "P",
      crystal_system: "monoclinic",
      point_group_hm: "m",
      is_centrosymmetric: false,
      is_enantiomorphic: false,
      is_sohncke: false,
      is_symmorphic: true,
      has_mirror: true,
      has_glide: false,
      has_screw: false,
      n_operations: 2,
      operations_xyz: ["x,y,z", "x,-y,z"],
      basisop_xyz: "x,y,z",
      spglib_identified: true,
      hall_number: 18,
      spglib_international: "P m = P 1 m 1",
      spglib_international_full: "P 1 m 1",
      spglib_hall_symbol: "P -2y",
      spglib_choice: "b",
      pointgroup_international: "m",
      pointgroup_schoenflies: "Cs",
      arithmetic_crystal_class_number: 5,
      arithmetic_crystal_class_symbol: "mP",
    },
    {
      gemmi_index: 21,
      international_number: 7,
      hm: "P 1 c 1",
      xhm: "P 1 c 1",
      short_name: "Pc",
      hall: "P -2yc",
      qualifier: "b1",
      ext: "",
      centring_type: "P",
      crystal_system: "monoclinic",
      point_group_hm: "m",
      is_centrosymmetric: false,
      is_enantiomorphic: false,
      is_sohncke: false,
      is_symmorphic: false,
      has_mirror: false,
      has_glide: true,
      has_screw: false,
      n_operations: 2,
      operations_xyz: ["x,y,z", "x,-y,z+1/2"],
      basisop_xyz: "x,y,z",
      spglib_identified: true,
      hall_number: 21,
      spglib_international: "P c = P 1 c 1",
      spglib_international_full: "P 1 c 1",
      spglib_hall_symbol: "P -2yc",
      spglib_choice: "b1",
      pointgroup_international: "m",
      pointgroup_schoenflies: "Cs",
      arithmetic_crystal_class_number: 5,
      arithmetic_crystal_class_symbol: "mP",
    },
  ],
};

function shuffle<T>(array: T[]): T[] {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function makeQuiz(entry: SpacegroupEntry): Statement[] {
  return [
    {
      id: "crystal-system",
      text: `この空間群は ${entry.crystal_system} crystal system に属する。`,
      answer: true,
    },
    {
      id: "centring",
      text: `centring type は ${entry.centring_type} である。`,
      answer: true,
    },
    {
      id: "inversion",
      text: "反転中心を持つ。",
      answer: entry.is_centrosymmetric,
    },
    {
      id: "mirror",
      text: "mirror plane を含む。",
      answer: entry.has_mirror,
    },
    {
      id: "glide",
      text: "glide plane を含む。",
      answer: entry.has_glide,
    },
    {
      id: "screw",
      text: "screw axis を含む。",
      answer: entry.has_screw,
    },
  ];
}

function tfLabel(v: boolean): TF {
  return v ? "T" : "F";
}

function pickRandomEntry(entries: SpacegroupEntry[]): SpacegroupEntry {
  return entries[Math.floor(Math.random() * entries.length)];
}

export default function SpacegroupQuizApp() {
  const [data, setData] = useState<SpacegroupData>(defaultData);
  const [entry, setEntry] = useState<SpacegroupEntry>(defaultData.entries[0]);
  const [answers, setAnswers] = useState<Record<string, TF | null>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loadMessage, setLoadMessage] = useState<string>("同梱サンプルデータを使用中");

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
          setLoadMessage(`my_settings.json を読み込みました (${json.entries.length} settings)`);
        }
      } catch {
        if (!active) return;
        setLoadMessage("my_settings.json が見つからなかったため、同梱サンプルデータを使用中");
      }
    }

    void loadData();
    return () => {
      active = false;
    };
  }, []);

  const statements = useMemo(() => makeQuiz(entry), [entry]);

  useEffect(() => {
    const next: Record<string, TF | null> = {};
    for (const st of statements) next[st.id] = null;
    setAnswers(next);
    setSubmitted(false);
  }, [statements]);

  const score = statements.reduce((acc, st) => {
    if (!submitted) return acc;
    return acc + (answers[st.id] === tfLabel(st.answer) ? 1 : 0);
  }, 0);

  const allAnswered = statements.every((st) => answers[st.id] !== null);

  function newQuiz() {
    setEntry(pickRandomEntry(data.entries));
  }

  function selectAnswer(statementId: string, value: TF) {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [statementId]: value }));
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.5fr_0.8fr]">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-2xl md:text-3xl">Space Group True / False Quiz</CardTitle>
                  <CardDescription className="mt-2 text-sm md:text-base">
                    空間群の性質について、各文を T / F で答えるクイズです。
                  </CardDescription>
                </div>
                <Button onClick={newQuiz} className="rounded-2xl">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  別の問題
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 text-sm">
                <Badge variant="secondary" className="rounded-xl px-3 py-1">
                  {loadMessage}
                </Badge>
                <Badge variant="outline" className="rounded-xl px-3 py-1">
                  total: {data.entries.length}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="rounded-2xl border bg-white p-5">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge className="rounded-xl px-3 py-1 text-base">{entry.hm}</Badge>
                  {entry.qualifier && <Badge variant="outline">qualifier: {entry.qualifier}</Badge>}
                  {entry.spglib_choice && <Badge variant="outline">choice: {entry.spglib_choice}</Badge>}
                </div>
                <p className="text-lg font-medium">この空間群について、各文が正しいか誤りか答えてください。</p>
              </div>

              <div className="space-y-4">
                {statements.map((statement, index) => {
                  const selected = answers[statement.id];
                  const isCorrect = submitted && selected === tfLabel(statement.answer);
                  const isWrong = submitted && selected !== null && selected !== tfLabel(statement.answer);

                  return (
                    <motion.div
                      key={statement.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.04 }}
                    >
                      <Card className="rounded-2xl border shadow-sm">
                        <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
                          <div className="flex-1">
                            <p className="text-sm text-slate-500">Q{index + 1}</p>
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
                                <span className="text-slate-500">正答: {tfLabel(statement.answer)}</span>
                              </div>
                            )}
                          </div>

                          <div className="flex gap-2">
                            <Button
                              variant={selected === "T" ? "default" : "outline"}
                              className="min-w-20 rounded-2xl"
                              onClick={() => selectAnswer(statement.id, "T")}
                              disabled={submitted}
                            >
                              T
                            </Button>
                            <Button
                              variant={selected === "F" ? "default" : "outline"}
                              className="min-w-20 rounded-2xl"
                              onClick={() => selectAnswer(statement.id, "F")}
                              disabled={submitted}
                            >
                              F
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-3">
                <Button onClick={() => setSubmitted(true)} disabled={!allAnswered || submitted} className="rounded-2xl">
                  採点する
                </Button>
                <Button variant="outline" onClick={newQuiz} className="rounded-2xl">
                  問題を更新
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
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
                <CardTitle className="text-xl">出題中の setting 情報</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <InfoRow label="HM" value={entry.hm} />
                <InfoRow label="Short name" value={entry.short_name} />
                <InfoRow label="Hall" value={entry.hall} />
                <InfoRow label="No." value={String(entry.international_number)} />
                <InfoRow label="Crystal system" value={entry.crystal_system} />
                <InfoRow label="Centring" value={entry.centring_type} />
                <InfoRow label="Point group" value={entry.point_group_hm} />
                {entry.spglib_choice && <InfoRow label="Choice" value={entry.spglib_choice} />}
                <Separator />
                <details className="rounded-xl border p-3">
                  <summary className="cursor-pointer font-medium">操作を表示</summary>
                  <div className="mt-3 space-y-1 font-mono text-xs">
                    {entry.operations_xyz.map((op, i) => (
                      <div key={`${op}-${i}`}>{op}</div>
                    ))}
                  </div>
                </details>
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <HelpCircle className="h-5 w-5" />
                  GitHub Pages で公開する方法
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm leading-6 text-slate-600">
                <p>1. このファイルを React + TypeScript プロジェクトの <span className="font-mono">src/App.tsx</span> に置く</p>
                <p>2. <span className="font-mono">public/my_settings.json</span> に JSON を置く</p>
                <p>3. Vite ならビルドして <span className="font-mono">dist</span> を GitHub Pages に公開する</p>
                <p>4. リポジトリ名がルートでない場合は base path を Vite 側で設定する</p>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3">
      <div className="text-slate-500">{label}</div>
      <div className="font-medium break-all">{value}</div>
    </div>
  );
}
