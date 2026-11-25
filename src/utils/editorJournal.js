// The encryption key exists only in memory. Opening the journal after a
// restart requires a verified session for this account and role.
let database;
function openDatabase() {
  if (!database) {
    database = new Promise((resolve, reject) => {
      const request = indexedDB.open("gymdrobe-editor-drafts", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("entries");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }).catch(error => { database = null; throw error; });
  }
  return database;
}

export async function openEditorJournal(scope, material) {
  const db = await openDatabase();
  const key = await crypto.subtle.importKey("raw", Uint8Array.from(atob(material), c => c.charCodeAt(0)), "AES-GCM", false, ["encrypt", "decrypt"]);
  const additionalData = new TextEncoder().encode(scope);
  const record = await new Promise((resolve, reject) => {
    const query = db.transaction("entries").objectStore("entries").get(scope);
    query.onsuccess = () => resolve(query.result);
    query.onerror = () => reject(query.error);
  });
  let revision = record?.revision;
  let value = null;
  if (record?.bytes) {
    const bytes = await crypto.subtle.decrypt({ name: "AES-GCM", iv: record.iv, additionalData }, key, record.bytes);
    value = JSON.parse(new TextDecoder().decode(bytes));
  }
  async function write(value) {
    const next = { revision: crypto.randomUUID() };
    if (value !== null) {
      next.iv = crypto.getRandomValues(new Uint8Array(12));
      next.bytes = await crypto.subtle.encrypt({ name: "AES-GCM", iv: next.iv, additionalData }, key, new TextEncoder().encode(JSON.stringify(value)));
    }
    await new Promise((resolve, reject) => {
      const tx = db.transaction("entries", "readwrite");
      const store = tx.objectStore("entries");
      const query = store.get(scope);
      let conflict = false;
      query.onsuccess = () => {
        if (query.result?.revision !== revision) {
          conflict = true;
          tx.abort();
        } else {
          store.put(next, scope);
        }
      };
      tx.oncomplete = () => { revision = next.revision; resolve(); };
      tx.onabort = () => reject(conflict ? new Error("Another window changed this draft. Your entries are still on screen. Reopen the editor to review the saved version.") : tx.error);
      tx.onerror = () => reject(tx.error);
    });
  }
  let tail = Promise.resolve();
  return { value, write(value) {
    const result = tail.then(() => write(value));
    tail = result.catch(() => {});
    return result;
  } };
}
