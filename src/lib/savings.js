// "Money saved vs a paid AI subscription" — a lightweight, honest marketing
// hook shown in Settings. We estimate cost-per-message from a well-known
// paid plan's advertised monthly price divided by a conservative estimate
// of typical monthly usage for an engaged user, rather than claiming any
// precise/inflated per-message dollar figure.
const REFERENCE_PLAN_NAME = 'ChatGPT Plus';
const REFERENCE_MONTHLY_INR = 1999; // approx. India pricing at time of writing
const ASSUMED_MESSAGES_PER_MONTH = 300; // conservative estimate for a regular daily user
const COST_PER_MESSAGE_INR = REFERENCE_MONTHLY_INR / ASSUMED_MESSAGES_PER_MONTH;

export function estimateSavingsInr(lifetimeMessageCount) {
  const total = Math.max(0, lifetimeMessageCount || 0);
  return Math.round(total * COST_PER_MESSAGE_INR);
}

export function formatInr(amount) {
  return `₹${amount.toLocaleString('en-IN')}`;
}

export const SAVINGS_REFERENCE = {
  planName: REFERENCE_PLAN_NAME,
  monthlyInr: REFERENCE_MONTHLY_INR,
};
