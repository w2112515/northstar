export function monthsElapsed(startedAt: string, now = Date.now()) {
  const start = new Date(startedAt).getTime();
  return Math.max(0, Math.floor((now - start) / (30.44 * 24 * 3600 * 1000)));
}

export function remainingMonths(startedAt: string, deadline: number, now = Date.now()) {
  return Math.max(1, deadline - monthsElapsed(startedAt, now));
}

export function targetOf(voyage: {
  goalMode: string;
  targetAmount: number;
  monthlyIncome: number;
  deadlineMonths: number;
  startingCapital: number;
}) {
  if (voyage.goalMode === "income") {
    return voyage.startingCapital + voyage.monthlyIncome * voyage.deadlineMonths;
  }
  return voyage.targetAmount;
}
