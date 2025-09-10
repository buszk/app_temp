let rootHandle = null;

async function verifyPermission(handle, readWrite) {
  const options = {};
  if (readWrite) options.mode = 'readwrite';
  if ((await handle.queryPermission(options)) === 'granted') return true;
  if ((await handle.requestPermission(options)) === 'granted') return true;
  return false;
}

async function getDir(handle, name) {
  return handle.getDirectoryHandle(name, { create: true });
}

async function getFile(handle, name) {
  return handle.getFileHandle(name, { create: true });
}

export const fsapi = {
  isSupported() {
    return typeof window.showDirectoryPicker === 'function';
  },
  getRootName() {
    return rootHandle ? rootHandle.name : '';
  },
  async chooseRoot() {
    if (!this.isSupported()) throw new Error('File System Access API not supported in this browser.');
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    if (!(await verifyPermission(handle, true))) {
      throw new Error('Permission denied for selected directory.');
    }
    rootHandle = handle;
    return rootHandle.name;
  },
  async writeVariant(schoolName, content) {
    if (!rootHandle) throw new Error('No export directory chosen.');
    if (!(await verifyPermission(rootHandle, true))) throw new Error('Permission not granted on export directory.');
    const schoolDir = await getDir(rootHandle, schoolName);
    const fileHandle = await getFile(schoolDir, 'personal_statement.txt');
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  },
  async importAll() {
    if (!rootHandle) throw new Error('No directory chosen to import from.');
    if (!(await verifyPermission(rootHandle, false))) throw new Error('Permission not granted to read directory.');
    const result = {};
    for await (const [name, entry] of rootHandle.entries()) {
      try {
        if (entry.kind === 'directory') {
          const fileHandle = await entry.getFileHandle('personal_statement.txt');
          const file = await fileHandle.getFile();
          const text = await file.text();
          result[name] = text;
        }
      } catch {
        // ignore folders without the expected file
      }
    }
    return result;
  },
};
