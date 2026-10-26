// Explicit opt-in: query metadata only, and never print titles, cwd values, IDs or transcripts.
const assert = require('node:assert/strict');
const { CodexClient } = require('../dist/client.js');
async function main() {
  if (!process.env.CODEX_LIVE_BINARY) throw new Error('Set CODEX_LIVE_BINARY explicitly.');
  const client = new CodexClient(process.env.CODEX_LIVE_BINARY);
  try {
    const first = await client.list(undefined, '', null);
    const project = await client.list([process.cwd()], '', null);
    assert(project.chats.every(chat => chat.cwd === process.cwd()));
    let searchChecked = false;
    if (first.chats[0]) {
      const term = first.chats[0].title.slice(0, 4);
      await client.list(undefined, term, null);
      searchChecked = true;
    }
    if (first.nextCursor) await client.list(undefined, '', first.nextCursor);
    console.log(JSON.stringify({ liveProtocol: 'passed', firstPageCount: first.chats.length,
      currentProjectCount: project.chats.length, paginationChecked: Boolean(first.nextCursor), searchChecked }));
  } finally { client.dispose(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
