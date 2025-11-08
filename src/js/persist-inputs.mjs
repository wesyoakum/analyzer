const DEFAULT_STORAGE_KEY = 'analyzer.inputs.v2';
const SKIP_INPUT_TYPES = new Set([
  'button',
  'file',
  'hidden',
  'image',
  'password',
  'reset',
  'submit'
]);

function isPersistable(el) {
  if (!el || !el.id || el.disabled) return false;
  if (el.dataset && el.dataset.persist === 'off') return false;
  if (el.tagName === 'INPUT' && SKIP_INPUT_TYPES.has(el.type)) return false;
  return true;
}

function readValue(el) {
  if (!el) return undefined;
  if (el.tagName === 'INPUT') {
    const type = el.type;
    if (type === 'checkbox') {
      return el.checked;
    }
    if (type === 'radio') {
      return el.checked ? el.value : undefined;
    }
    if (type === 'number') {
      return el.value;
    }
    return el.value;
  }
  if (el.tagName === 'SELECT') {
    if (el.multiple) {
      return Array.from(el.options).filter(opt => opt.selected).map(opt => opt.value);
    }
    return el.value;
  }
  return el.value;
}

function applyValue(el, stored) {
  if (el.tagName === 'INPUT') {
    const type = el.type;
    if (type === 'checkbox') {
      el.checked = Boolean(stored);
      return;
    }
    if (type === 'radio') {
      el.checked = stored === el.value;
      return;
    }
  }
  if (stored == null) return;
  if (el.tagName === 'SELECT' && el.multiple && Array.isArray(stored)) {
    const values = new Set(stored.map(String));
    Array.from(el.options).forEach(opt => {
      opt.selected = values.has(opt.value);
    });
    return;
  }
  el.value = stored;
}

function parseState(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    console.warn('Unable to parse persisted inputs:', err);
    return {};
  }
}

function loadState(storage, key) {
  try {
    return parseState(storage.getItem(key));
  } catch (err) {
    console.warn('Unable to read persisted inputs:', err);
    return {};
  }
}

function serializeState(storage, key, state) {
  try {
    storage.setItem(key, JSON.stringify(state));
  } catch (err) {
    console.warn('Unable to persist inputs:', err);
  }
}

function getStorage() {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const { localStorage } = window;
    const probe = `${DEFAULT_STORAGE_KEY}__probe__`;
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch (err) {
    console.warn('Input persistence disabled:', err);
    return null;
  }
}

function eventNamesFor(el) {
  if (el.tagName === 'SELECT') return ['change'];
  if (el.tagName === 'TEXTAREA') return ['input', 'change'];
  if (el.tagName !== 'INPUT') return ['input', 'change'];

  switch (el.type) {
    case 'checkbox':
    case 'radio':
    case 'range':
    case 'color':
      return ['change'];
    default:
      return ['input', 'change'];
  }
}

export function setupInputPersistence({ storageKey = DEFAULT_STORAGE_KEY } = {}) {
  const storage = getStorage();
  if (!storage) return;

  const targets = Array.from(document.querySelectorAll('input[id], select[id], textarea[id]'))
    .filter(isPersistable);
  if (!targets.length) return;
  const targetSet = new Set(targets);

  let state = loadState(storage, storageKey);
  targets.forEach(el => {
    applyValue(el, state[el.id]);
  });

  let pending = false;
  const flush = () => {
    pending = false;
    const next = {};
    targets.forEach(el => {
      if (!isPersistable(el)) return;
      const value = readValue(el);
      if (value !== undefined) {
        next[el.id] = value;
      }
    });
    state = next;
    serializeState(storage, storageKey, state);
  };

  const schedule = (immediate = false) => {
    if (immediate) {
      flush();
      return;
    }
    if (pending) return;
    pending = true;
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(flush);
    } else {
      setTimeout(flush, 0);
    }
  };

  const handler = (event) => {
    if (!targetSet.has(event.target)) return;
    schedule();
  };

  targets.forEach(el => {
    eventNamesFor(el).forEach(evt => {
      el.addEventListener(evt, handler);
    });
  });

  window.addEventListener('beforeunload', () => schedule(true));
  window.addEventListener('storage', evt => {
    if (evt.storageArea !== storage) return;
    if (evt.key && evt.key !== storageKey) return;
    const raw = evt.key === storageKey ? evt.newValue : storage.getItem(storageKey);
    state = parseState(raw);
    targets.forEach(el => {
      applyValue(el, state[el.id]);
    });
  });

  schedule();
}