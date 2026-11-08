import { httpError } from './auth.js';
// Benchmarking spends provider quota, so it is limited to listed developer emails.
// With no list configured it is available only on a local development server.
export function requireDeveloper(user) {
  const allowed=(process.env.BENCHMARK_ALLOWED_EMAILS||'').split(',').map((e)=>e.trim().toLowerCase()).filter(Boolean);
  const local=process.env.NODE_ENV!=='production'&&!process.env.VERCEL;
  if (allowed.length ? !allowed.includes(String(user.email||'').toLowerCase()) : !local) throw httpError(403,'Model benchmarking is limited to project developers.');
}
