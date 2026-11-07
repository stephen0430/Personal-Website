const DATABASE = 'qxy-draft-media'
const STORE = 'media'
const DRAFT_STORE = 'drafts'
const DRAFT_KEY = 'main'
let databasePromise

const openDatabase = () => {
  if (!globalThis.indexedDB) return Promise.reject(new Error('此浏览器不支持本地图片暂存。'))
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE, 2)
      request.onupgradeneeded = () => {
        const database = request.result
        if (!database.objectStoreNames.contains(STORE)) {
          const store = database.createObjectStore(STORE, { keyPath: 'key' })
          store.createIndex('owner', 'owner', { unique: false })
        }
        if (!database.objectStoreNames.contains(DRAFT_STORE)) database.createObjectStore(DRAFT_STORE, { keyPath: 'key' })
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error || new Error('无法打开本地图片暂存。'))
      request.onblocked = () => reject(new Error('本地图片存储正在升级，请关闭其他管理台标签后重试。'))
    })
  }
  return databasePromise
}

const transact = async (mode, action, storeName = STORE) => {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode)
    const result = action(transaction.objectStore(storeName))
    transaction.oncomplete = () => resolve(result?.result)
    transaction.onerror = () => reject(transaction.error || new Error('本地图片存储失败。'))
    transaction.onabort = () => reject(transaction.error || new Error('本地图片存储已取消。'))
  })
}

export const saveDraftSnapshot = snapshot => transact('readwrite', store => store.put({ ...snapshot, key: DRAFT_KEY }), DRAFT_STORE)

export const getDraftSnapshot = async () => {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const request = database.transaction(DRAFT_STORE, 'readonly').objectStore(DRAFT_STORE).get(DRAFT_KEY)
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error || new Error('无法读取草稿备份。'))
  })
}

export const putDraftMedia = (owner, id, file) => transact('readwrite', store => store.put({
  key: `${owner}:${id}`,
  owner,
  id,
  name: file.name,
  type: file.type,
  size: file.size,
  blob: file
}))

export const getDraftMedia = async (owner, id) => {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE, 'readonly').objectStore(STORE).get(`${owner}:${id}`)
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error || new Error('无法读取暂存图片。'))
  })
}

export const listDraftMedia = async owner => {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE, 'readonly').objectStore(STORE).index('owner').getAll(owner)
    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error || new Error('无法读取暂存图片。'))
  })
}

export const deleteDraftMedia = (owner, id) => transact('readwrite', store => store.delete(`${owner}:${id}`))

export const clearDraftMedia = async owner => {
  const items = await listDraftMedia(owner)
  if (!items.length) return
  await transact('readwrite', store => items.forEach(item => store.delete(item.key)))
}

export const pruneDraftMedia = async (owner, keepIds) => {
  const keep = new Set(keepIds)
  const items = await listDraftMedia(owner)
  const unused = items.filter(item => !keep.has(item.id))
  if (unused.length) await transact('readwrite', store => unused.forEach(item => store.delete(item.key)))
  return unused.map(item => item.id)
}
