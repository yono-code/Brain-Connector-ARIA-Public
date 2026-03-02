// ブラウザ・Node.js 両環境で crypto.randomUUID() が使用可能（Node.js 14.17+）

function shortUuid(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 8);
}

export function generateTaskId(): string {
  return `task-${shortUuid()}`;
}

export function generateNodeId(): string {
  return `node-${shortUuid()}`;
}

export function generateEdgeId(): string {
  return `edge-${shortUuid()}`;
}

export function generateAdrId(): string {
  return `adr-${shortUuid()}`;
}
