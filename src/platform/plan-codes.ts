export function isTrialPlanCode(code: string): boolean {
  return code.endsWith('_trial');
}
