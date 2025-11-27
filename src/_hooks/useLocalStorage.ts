import { useState, useEffect } from 'react';

/**
 * A custom hook that provides state management with localStorage persistence
 * @param key - The localStorage key to store the value under
 * @param defaultValue - The default value to use if no stored value exists
 * @returns A tuple of [value, setValue] similar to useState
 */
export function useLocalStorage<T>(key: string, defaultValue: T): [T, (value: T) => void] {
  // Always start with the default value to avoid hydration mismatch
  const [storedValue, setStoredValue] = useState<T>(defaultValue);

  // After mounting, check localStorage and update if different
  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item !== null) {
        const parsedItem = JSON.parse(item);
        setStoredValue(parsedItem);
      }
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
    }
  }, [key]);

  // Return a wrapped version of useState's setter function that persists the new value to localStorage
  const setValue = (value: T) => {
    try {
      setStoredValue(value);
      
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue];
}