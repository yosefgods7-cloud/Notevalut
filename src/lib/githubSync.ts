import { get, set } from 'idb-keyval';
import { NoteVaultData, Note } from '../types';

const TOKEN_KEY = "github_pat_token";

export async function getGithubToken(): Promise<string | null> {
  return await get(TOKEN_KEY) || null;
}

export async function setGithubToken(token: string) {
  await set(TOKEN_KEY, token);
}

// GitHub API Helpers
async function ghFetch(endpoint: string, token: string, options: RequestInit = {}) {
  const url = `https://api.github.com${endpoint}`;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(options.headers || {})
  };
  
  const response = await fetch(url, { ...options, headers });
  
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`GitHub API error (${response.status}): ${errText}`);
  }
  
  // 204 No Content has no body
  if (response.status === 204) return null;
  return response.json();
}

/**
 * Tests connection to the repository.
 * Throws if repository doesn't exist or token lacks permission.
 */
export async function testGithubConnection(repo: string, branch: string, token: string) {
  const [owner, name] = repo.split('/');
  if (!owner || !name) throw new Error("Invalid repository format. Use owner/repo.");
  const data = await ghFetch(`/repos/${repo}/branches/${branch}`, token);
  if (!data?.commit?.sha) throw new Error(`Branch ${branch} not found`);
  return data;
}

/**
 * Pushes changed notes to GitHub, creating 'notes_index.json' and 'notes/note_id.json' files.
 * Uses the Git database API to commit everything in a single commit.
 */
export async function pushToGithub(data: NoteVaultData, config: any): Promise<number> {
  const token = await getGithubToken();
  if (!token) throw new Error("No GitHub token stored");
  if (!config.repository || !config.branch) throw new Error("Repository or branch not configured");
  
  const { repository, branch } = config;
  const lastSyncTime = config.lastSyncTime || "1970-01-01T00:00:00.000Z";
  
  // Find notes that need to be pushed
  const notesToPush = data.notes.filter(n => (!n.isDeleted) && (n.updatedAt > lastSyncTime));
  if (notesToPush.length === 0) return 0; // Nothing to push
  
  // Get current commit
  const refData = await ghFetch(`/repos/${repository}/git/refs/heads/${branch}`, token);
  const baseCommitSha = refData.object.sha;
  
  // Get the tree of the base commit
  const commitData = await ghFetch(`/repos/${repository}/git/commits/${baseCommitSha}`, token);
  const baseTreeSha = commitData.tree.sha;
  
  // Create blobs for each note file and the index
  const treeItems: any[] = [];
  
  const safeNotes = data.notes.filter(n => !n.isDeleted);
  const notesIndex = {
    updatedAt: new Date().toISOString(),
    count: safeNotes.length,
    notes: safeNotes.reduce((acc, n) => ({ ...acc, [n.id]: { title: n.title, updatedAt: n.updatedAt } }), {})
  };
  
  // Add the index to tree
  treeItems.push({
    path: 'notes_index.json',
    mode: '100644',
    type: 'blob',
    content: JSON.stringify(notesIndex, null, 2)
  });
  
  // Add all changed notes to tree
  for (const note of notesToPush) {
    if (note.isDeleted) continue;
    treeItems.push({
      path: `notes/${note.id}.json`,
      mode: '100644',
      type: 'blob',
      content: JSON.stringify(note, null, 2)
    });
  }
  
  // Delete notes that exist? We only push notes. Deletes are tricky without a full sync.
  // For now, let's keep it simple: we push new notes or modified notes.
  
  // Create tree
  const newTreeData = await ghFetch(`/repos/${repository}/git/trees`, token, {
    method: 'POST',
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: treeItems
    })
  });
  const newTreeSha = newTreeData.sha;
  
  // Create commit
  const nowStr = new Date().toLocaleString();
  const commitMsg = `Sync: ${notesToPush.length} notes updated on ${nowStr}`;
  const newCommitData = await ghFetch(`/repos/${repository}/git/commits`, token, {
    method: 'POST',
    body: JSON.stringify({
      message: commitMsg,
      tree: newTreeSha,
      parents: [baseCommitSha]
    })
  });
  const newCommitSha = newCommitData.sha;
  
  // Update ref
  await ghFetch(`/repos/${repository}/git/refs/heads/${branch}`, token, {
    method: 'PATCH',
    body: JSON.stringify({
      sha: newCommitSha
    })
  });
  
  return notesToPush.length;
}

/**
 * Pulls newer notes from GitHub and updates local data.
 * Returns array of updated notes, or empty array if none.
 */
export async function pullFromGithub(data: NoteVaultData, config: any): Promise<Note[]> {
  const token = await getGithubToken();
  if (!token) throw new Error("No GitHub token stored");
  if (!config.repository || !config.branch) throw new Error("Repository or branch not configured");
  
  const { repository, branch } = config;
  
  // Try to get notes_index.json
  let indexData;
  try {
    const rawRes = await ghFetch(`/repos/${repository}/contents/notes_index.json?ref=${branch}`, token);
    const content = atob(rawRes.content);
    indexData = JSON.parse(content);
  } catch (e) {
    // If notes_index.json doesn't exist, we assume no backup exists yet
    console.log("No notes_index.json found on GitHub, skipping pull");
    return [];
  }
  
  if (!indexData.notes) return [];
  
  const updatedNotes: Note[] = [];
  
  // Compare with local
  for (const [id, remoteInfo] of Object.entries(indexData.notes) as [string, any][]) {
    const localNote = data.notes.find(n => n.id === id);
    if (!localNote || new Date(remoteInfo.updatedAt) > new Date(localNote.updatedAt)) {
      // Pull this note
      try {
        const rawRes = await ghFetch(`/repos/${repository}/contents/notes/${id}.json?ref=${branch}`, token);
        const content = decodeURIComponent(escape(atob(rawRes.content)));
        const noteData = JSON.parse(content);
        updatedNotes.push(noteData);
      } catch(e) {
        console.warn(`Failed to pull note ${id} from GitHub`, e);
      }
    }
  }
  
  return updatedNotes;
}

export function getPendingPushCount(data: NoteVaultData, lastSyncTime?: string): number {
  if (!lastSyncTime) return data.notes.filter(n => !n.isDeleted).length;
  return data.notes.filter(n => (!n.isDeleted) && (n.updatedAt > lastSyncTime)).length;
}
