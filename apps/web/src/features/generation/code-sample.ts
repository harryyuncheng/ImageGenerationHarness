export function buildRunCodeExample(requestBody: unknown): string {
  return `const response = await fetch('/api/runs', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(${JSON.stringify(requestBody, null, 2)})
});

const run = await response.json();`;
}
