import { useEffect, useMemo, useState } from "react";
import { Menu, Home, List, Box } from "lucide-react";

import type { AnswerValue, QuizHistoryItem, Statement, SpacegroupEntry } from "@/logic/quiz";
import {
  makeQuiz,
  tfLabel,
  pickRandomEntry,
  getExtinctionConditions,
} from "@/logic/quiz";
import QuizPage from "@/components/QuizPage";
import SpacegroupListPage from "@/components/SpacegroupListPage";
import Symmetry3DPage from "@/components/Symmetry3DPage";

type SpacegroupData = {
  meta: {
    enumeration_source: string;
    itb_only: boolean;
    n_entries: number;
    description: string;
  };
  entries: SpacegroupEntry[];
};

type ViewMode = "quiz" | "list" | "symmetry";



export default function SpacegroupQuizApp() {
  const [data, setData] = useState<SpacegroupData>({ meta: { enumeration_source: "", itb_only: false, n_entries: 0, description: "" }, entries: [] });
  const [entry, setEntry] = useState<SpacegroupEntry | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerValue | null>>({});
  const [submitted, setSubmitted] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("quiz");
  const [menuOpen, setMenuOpen] = useState(false);
  const [quizHistory, setQuizHistory] = useState<QuizHistoryItem[]>([]);
  const [quizPool, setQuizPool] = useState<SpacegroupEntry[] | null>(null);
  const [quizContextLabel, setQuizContextLabel] = useState<string | null>(null);

  function archiveCurrentQuizResult() {
    if (!entry || !submitted) return;

    const existingKey = `${entry.hm}__${entry.hall}__${score}__${statements.length}`;
    if (
      quizHistory[0] &&
      `${quizHistory[0].hm}__${quizHistory[0].hall}__${quizHistory[0].score}__${quizHistory[0].total}` === existingKey
    ) {
      return;
    }

    const item: QuizHistoryItem = {
      id: `${entry.hm}-${entry.hall}-${Date.now()}`,
      hm: entry.hm,
      hall: entry.hall,
      score,
      total: statements.length,
    };

    setQuizHistory((prev) => [item, ...prev]);
  }

  function getActiveQuizPool() {
    return quizPool && quizPool.length > 0 ? quizPool : data.entries;
  }

  function goToNextQuiz() {
    archiveCurrentQuizResult();
    setEntry(pickRandomEntry(getActiveQuizPool()));
    setViewMode("quiz");
    setMenuOpen(false);
  }

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
          setQuizPool(null);
          setQuizContextLabel(null);
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
    archiveCurrentQuizResult();
    setEntry(pickRandomEntry(getActiveQuizPool()));
    if (!quizPool) {
      setQuizContextLabel(null);
    }
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
    setQuizPool(null);
    setQuizContextLabel(null);
    setMenuOpen(false);
  }

  function switchToList() {
    setViewMode("list");
    setMenuOpen(false);
  }

  function switchToSymmetry3D() {
    setViewMode("symmetry");
    setMenuOpen(false);
  }

function openQuizForEntry(selectedEntry: SpacegroupEntry, scopedEntries?: SpacegroupEntry[], contextLabel?: string) {
  setEntry(selectedEntry);
  setQuizPool(scopedEntries && scopedEntries.length > 0 ? scopedEntries : null);
  setQuizContextLabel(contextLabel ?? null);
  setViewMode("quiz");
  setMenuOpen(false);
}

  function openSymmetry3DForEntry(selectedEntry: SpacegroupEntry) {
    setEntry(selectedEntry);
    setViewMode("symmetry");
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
                    viewMode === "list" ? "bg-slate-100 text-slate-900" : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <List className="h-4 w-4" />
                  <span>Space Group 一覧</span>
                </button>
                <button
                  type="button"
                  onClick={switchToSymmetry3D}
                  className={`mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition ${
                    viewMode === "symmetry" ? "bg-slate-100 text-slate-900" : "text-slate-700 hover:bg-slate-100"
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

      {viewMode === "list" ? (
        <div className="mx-auto max-w-6xl">
          <SpacegroupListPage
            entries={data.entries}
            onStartQuiz={openQuizForEntry}
            onOpenSymmetry={openSymmetry3DForEntry}
          />
        </div>
      ) : viewMode === "symmetry" ? (
        <div className="mx-auto max-w-6xl">
          <Symmetry3DPage entry={entry} />
        </div>
      ) : (
        <div className="mx-auto max-w-6xl">
          <QuizPage
            entry={entry}
            statements={statements}
            answers={answers}
            submitted={submitted}
            score={score}
            allAnswered={allAnswered}
            extinctionConditions={extinctionConditions}
            quizHistory={quizHistory}
            quizContextLabel={quizContextLabel}
            onSelectAnswer={selectAnswer}
            onSubmit={() => setSubmitted(true)}
            onNewQuiz={newQuiz}
            onNextQuiz={goToNextQuiz}
            isStatementCorrect={isStatementCorrect}
          />
        </div>
      )}
    </div>
  );
}
