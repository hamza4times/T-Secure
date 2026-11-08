export const CATEGORIES = Object.freeze({
  credentials: { label: 'Passwords & codes', advice: 'Keep passwords and verification codes to yourself. Call the organization using a number you already trust.' },
  payment: { label: 'Payment pressure', advice: 'Pause before sending money. Gift cards and cryptocurrency are warning signs when demanded as payment.' },
  family: { label: 'Family impersonation', advice: 'Hang up and call your family member on their saved number, even when the voice sounds familiar.' },
  secrecy: { label: 'Requests for secrecy', advice: 'Talk to someone you trust before acting on a request to keep a payment or emergency secret.' },
  urgency: { label: 'Urgency & fear', advice: 'Give yourself time. A genuine organization will let you independently verify the request.' },
  authority: { label: 'Authority impersonation', advice: 'Contact the bank or agency through its official app or a number on your statement.' },
  link: { label: 'Suspicious links', advice: 'Open the official app or type a known website address yourself.' },
  remote: { label: 'Remote access', advice: 'Do not install remote-control software at an unexpected caller’s request.' },
  romance: { label: 'Relationship pressure', advice: 'Discuss unexpected money requests with someone you trust before sending funds.' },
});
export const RISKS = ['low', 'unknown', 'caution', 'high'];
export const ACTIONS = ['pause', 'verify', 'contact', 'recover'];
export function parseCommunication(body) {
  if (!body || !['call', 'message', 'link'].includes(body.channel)) throw new Error('Choose a supported communication channel.');
  if (typeof body.text !== 'string' || !body.text.trim() || body.text.length > 12000) throw new Error('Enter between 1 and 12,000 characters.');
  if (!Number.isSafeInteger(body.sequence) || body.sequence < 0 || body.sequence > 10000) throw new Error('Invalid sequence.');
  if (body.sessionId && !/^[a-zA-Z0-9-]{1,80}$/.test(body.sessionId)) throw new Error('Invalid session.');
  if (body.sender != null && (typeof body.sender !== 'string' || body.sender.length > 40)) throw new Error('Enter a sender of up to 40 characters.');
  return { channel: body.channel, text: body.text.trim(), sequence: body.sequence, sessionId: body.sessionId || null, source: body.source === 'simulation' ? 'simulation' : 'user', sender: body.sender?.trim() || '' };
}
export function validateModelAnalysis(value, text) {
  if (!value || !RISKS.includes(value.risk) || !Array.isArray(value.reasons) || value.reasons.length > 8) throw new Error('Invalid analysis response.');
  const reasons = value.reasons.map((reason) => {
    if (!CATEGORIES[reason.code] || typeof reason.evidence !== 'string' || reason.evidence.length < 3 || reason.evidence.length > 500 || !text.includes(reason.evidence)) throw new Error('Ungrounded analysis evidence.');
    return {code: reason.code, evidence: reason.evidence, title: CATEGORIES[reason.code].label};
  });
  if (['caution', 'high'].includes(value.risk) && reasons.length === 0) throw new Error('Warning requires evidence.');
  return {risk: value.risk, reasons, actions: value.risk === 'low' ? ['verify'] : ['pause','verify','contact']};
}
