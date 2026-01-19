export default function updateLocalStorage(storageKey, newValue) {
  const storedValue = localStorage.getItem(storageKey);

  if (storedValue !== null) {
    localStorage.removeItem(storageKey);
  }

  localStorage.setItem(storageKey, newValue);
}