import { normalizeMobile } from './normalize-mobile';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const cases: [string, string][] = [
  ['9876543210', '+919876543210'],
  ['+91 98765 43210', '+919876543210'],
  ['09876543210', '+919876543210'],
];

for (const [input, e164] of cases) {
  const r = normalizeMobile(input);
  assert(r.ok === true, `expected ok for ${input}`);
  if (r.ok) assert(r.e164 === e164, `${input} -> ${r.e164} expected ${e164}`);
}

const bad = normalizeMobile('12345');
assert(bad.ok === false, 'short number should fail');
