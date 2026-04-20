import { CheckCircle2, RefreshCw, Send, Trophy, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { AnswerValue, QuizHistoryItem, SpacegroupEntry, Statement } from "@/logic/quiz";
import {
  tfLabel,
  crystalSystemLabel,
  centringTypeLabel,
  mirrorPlaneLabel,
  glidePlaneLabel,
  screwAxisLabel,
  centringExtinctionLabel,
  glideExtinctionLabel,
  screwExtinctionLabel,
} from "@/logic/quiz";

type QuizPageProps = {
  entry: SpacegroupEntry;
  statements: Statement[];
  answers: Record<string, AnswerValue | null>;
  submitted: boolean;
  score: number;
  allAnswered: boolean;
  extinctionConditions: string[];
  quizHistory: QuizHistoryItem[];
  quizContextLabel?: string | null;
  onSelectAnswer: (statementId: string, value: AnswerValue) => void;
  onSubmit: () => void;
  onNewQuiz: () => void;
  onNextQuiz: () => void;
  isStatementCorrect: (statement: Statement) => boolean;
};

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[180px_1fr] gap-3 text-sm">
      <div className="text-slate-500">{label}</div>
      <div className="font-medium break-all text-slate-900">{value}</div>
    </div>
  );
}

function renderScrewTypeLabel(value: string) {
  const match = value.match(/^([1-9])([1-9])$/);
  if (!match) return value;
  return (
    <>
      {match[1]}
      <sub>{match[2]}</sub>
    </>
  );
}

function choiceLabelFromAnswer(value: string) {
  return value === "none" ? "らせん軸なし" : value;
}

export default function QuizPage({
  entry,
  statements,
  answers,
  submitted,
  score,
  allAnswered,
  extinctionConditions,
  quizHistory,
  quizContextLabel,
  onSelectAnswer,
  onSubmit,
  onNewQuiz,
  onNextQuiz,
  isStatementCorrect,
}: QuizPageProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <Card className="overflow-visible rounded-2xl shadow-sm">
        <div className="sticky top-24 z-20 space-y-4 border-b bg-slate-50/95 pb-4 backdrop-blur">
          <CardHeader className="space-y-4 rounded-2xl bg-white/90 shadow-sm">
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
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
                  <p className="mt-4 text-lg font-medium text-slate-900">この空間群について答えてください。</p>
                  {quizContextLabel && (
                    <p className="mt-2 text-sm text-slate-600">出題対象: {quizContextLabel}</p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl"
                  aria-label="別の問題を出題"
                  onClick={onNewQuiz}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  問題を切り替える
                </Button>
              </div>
            </div>
          </CardHeader>
        </div>

        <CardContent className="space-y-6 pt-6">
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
                      ? Array.isArray(statement.answer)
                        ? statement.answer.map((v) => mirrorPlaneLabel(v)).join(" / ")
                        : mirrorPlaneLabel(statement.answer as string)
                      : statement.id === "glide"
                        ? Array.isArray(statement.answer)
                          ? statement.answer.map((v) => glidePlaneLabel(v)).join(" / ")
                          : glidePlaneLabel(statement.answer as string)
                        : statement.id === "screw"
                          ? Array.isArray(statement.answer)
                            ? statement.answer.map((v) => screwAxisLabel(v)).join(" / ")
                            : screwAxisLabel(statement.answer as string)
                          : statement.id === "screw-type"
                            ? Array.isArray(statement.answer)
                              ? statement.answer.map((v) => String(v)).join(" / ")
                              : String(statement.answer)
                            : statement.id === "centring-extinction"
                              ? centringExtinctionLabel(statement.answer)
                              : statement.id === "glide-extinction"
                                ? glideExtinctionLabel(statement.answer)
                                : statement.id === "screw-extinction"
                                  ? screwExtinctionLabel(statement.answer)
                                  : String(statement.answer);

            return (
              <div key={statement.id} className="rounded-2xl border p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">Q{index + 1}</div>
                    <div className="mt-1 text-lg font-medium leading-relaxed text-slate-900">{statement.text}</div>
                  </div>
                  {submitted ? (
                    isStatementCorrect(statement) ? (
                      <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-emerald-600" />
                    ) : (
                      <XCircle className="mt-1 h-5 w-5 shrink-0 text-rose-500" />
                    )
                  ) : null}
                </div>

                {statement.choices ? (
                    <div
                        className={
                            statement.id === "screw-type"
                            ? "mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4"
                            : "mt-4 grid gap-3 sm:grid-cols-2"
                        }
                        >
                    {statement.choices.map((choice) => (
                      <Button
                        key={choice.value}
                        type="button"
                        variant={isChoiceSelected(choice.value) ? "default" : "outline"}
                        className={`h-auto justify-between rounded-2xl px-4 py-3 text-left text-base whitespace-normal ${
                          isChoiceSelected(choice.value) ? "ring-2 ring-offset-2" : "hover:bg-slate-50"
                        }`}
                        onClick={() => onSelectAnswer(statement.id, choice.value)}
                        disabled={submitted}
                      >
                        <span>
                        {statement.id === "screw-type"
                            ? choice.value === "none"
                            ? choice.label
                            : renderScrewTypeLabel(choice.value)
                            : choice.label}
                        </span>
                      </Button>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 flex gap-3">
                    {(["◯", "✕"] as const).map((mark) => {
                      const isSelected = selected === mark;
                      return (
                        <Button
                          key={mark}
                          type="button"
                          variant={isSelected ? "default" : "outline"}
                          className={`h-14 w-24 rounded-2xl text-xl ${
                            isSelected ? "ring-2 ring-offset-2" : "hover:bg-slate-50"
                          }`}
                          onClick={() => onSelectAnswer(statement.id, mark)}
                          disabled={submitted}
                        >
                          {mark}
                        </Button>
                      );
                    })}
                  </div>
                )}

                {submitted && !isStatementCorrect(statement) ? (
                  <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                    正答: <span className="font-semibold">
                      {statement.id === "screw-type"
                        ? Array.isArray(statement.answer)
                          ? statement.answer.map((v, i) => (
                              <span key={`${String(v)}-${i}`}>
                                {i > 0 ? " / " : ""}
                                {String(v) === "none" ? choiceLabelFromAnswer(String(v)) : renderScrewTypeLabel(String(v))}
                              </span>
                            ))
                          : String(statement.answer) === "none"
                            ? choiceLabelFromAnswer(String(statement.answer))
                            : renderScrewTypeLabel(String(statement.answer))
                        : correctAnswer}
                    </span>
                  </div>
                ) : null}
              </div>
            );
          })}

          <div className="flex flex-wrap gap-3 pt-2">
            <Button type="button" className="rounded-2xl" onClick={onSubmit} disabled={!allAnswered || submitted}>
              <Send className="mr-2 h-4 w-4" />
              回答を送信して採点
            </Button>
            <Button type="button" variant="outline" className="rounded-2xl" onClick={onNextQuiz} disabled={!submitted}>
              次の問題へ
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="sticky top-24 space-y-6 self-start">
        <Card className="rounded-2xl shadow-sm">
          <CardContent>
            <div className="flex items-center gap-3 rounded-2xl border p-4">
              <div className="rounded-2xl bg-amber-50 p-3 text-amber-600">
                <Trophy className="h-6 w-6" />
              </div>
              <div>
                <div className="text-sm text-slate-500">スコア</div>
                <div className="text-2xl font-semibold text-slate-900">
                  {submitted ? `${score} / ${statements.length}` : "- / -"}
                </div>
                <div className="text-sm text-slate-500">
                  {submitted ? "" : "すべて回答してから採点できます。"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardContent>
            <details className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-700">
              <summary className="cursor-pointer font-medium text-slate-900">座標軸の対応</summary>
              <div className="mt-3">
                <div className="space-y-1">
                  <p>x → a 軸方向</p>
                  <p>y → b 軸方向</p>
                  <p>z → c 軸方向</p>
                </div>
                <div className="mt-3 space-y-1 text-slate-600">
                  <p>例: x, y, -z は z が反転しており、c 軸に垂直な鏡映面（xy 面）を表す。</p>
                  <p>例: x, y, -z+1/2 は c-glide を表す。</p>
                  <p>例: x+1/2, y+1/2, -z は n-glide を表す。</p>
                  <p>例: -x, -y, z+1/2 は z 軸方向のらせん軸を表す。</p>
                  <p>例: -x, -y, z+5/6 は 6₅ screw を表す。</p>
                  <p>回折の指数では、H, K, L がそれぞれ a*, b*, c* に対応する。</p>
                </div>
              </div>
            </details>
          </CardContent>
        </Card>

        {submitted && (
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl">出題中の設定情報</CardTitle>
              <CardDescription>この空間群の基本情報と消滅条件です。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <InfoRow label="短縮名" value={entry.short_name} />
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
  <summary className="cursor-pointer font-medium text-slate-700">対称操作を表示</summary>
      <div className="mt-2 space-y-1 font-mono text-sm text-slate-700">
        {entry.operations_xyz.map((operation, index) => (
          <div key={`${operation}-${index}`}>{operation}</div>
        ))}
    </div>
</details>
            </CardContent>
          </Card>
        )}

        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">これまでの結果</CardTitle>
            <CardDescription>問題を切り替えたときの空間群とスコアを表示します。</CardDescription>
          </CardHeader>
          <CardContent>
            {quizHistory.length === 0 ? (
              <div className="rounded-xl border p-3 text-sm text-slate-500">まだ履歴はありません。</div>
            ) : (
              <div className="max-h-[320px] space-y-2 overflow-auto rounded-xl border p-3">
                {quizHistory.map((item) => (
                  <div key={item.id} className="rounded-xl border bg-white p-3">
                    <div className="text-sm font-semibold text-slate-900">{item.hm}</div>
                    <div className="mt-1 font-mono text-xs text-slate-500">{item.hall}</div>
                    <div className="mt-2 text-sm text-slate-700">
                      スコア: <span className="font-semibold">{item.score} / {item.total}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}