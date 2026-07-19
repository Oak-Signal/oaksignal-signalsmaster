"use client";

interface RankedQuizInterfaceProps {
  runId: string;
}

export function RankedQuizInterface({ runId }: RankedQuizInterfaceProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[500px]">
      <h2 className="text-2xl font-bold">Ranked Run Quiz</h2>
      <p className="text-muted-foreground mt-2">Active Session: {runId}</p>
    </div>
  );
}
