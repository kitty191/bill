import {
  loadEntryDraftRaw,
  saveEntryDraftRaw,
  clearEntryDraftRaw,
} from './ledgerStore';
import { parseEntryDraft, type EntryDraft } from '../domain/entryDraft';

// All autosaves and explicit consumption share one queue. Cancellation cannot
// be followed by an older asynchronous autosave resurrecting the draft.
let writes = Promise.resolve();
function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const task = writes.then(operation);
  writes = task.then(
    () => {},
    () => {},
  );
  return task;
}
export const saveEntryDraft = (draft: EntryDraft) =>
  enqueue(() =>
    saveEntryDraftRaw(JSON.stringify(parseEntryDraft(JSON.stringify(draft)))),
  );
export const clearEntryDraft = (id?: string) =>
  enqueue(() => clearEntryDraftRaw(id));
export const loadEntryDraft = () =>
  enqueue(async () => {
    const raw = await loadEntryDraftRaw();
    return raw === null ? null : parseEntryDraft(raw);
  });
