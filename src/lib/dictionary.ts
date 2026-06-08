import { get, set } from 'idb-keyval';
import nspell from 'nspell';

const DICT_KEY = 'personal-dictionary';
const AFF_URL = 'https://cdn.jsdelivr.net/npm/dictionary-en@4.0.0/index.aff';
const DIC_URL = 'https://cdn.jsdelivr.net/npm/dictionary-en@4.0.0/index.dic';

let spellcheckerInstance: nspell | null = null;
let customWordsSet = new Set<string>();

export async function getPersonalDictionary(): Promise<string[]> {
  const words = await get<string[]>(DICT_KEY);
  return words || [];
}

export async function addWordToDictionary(word: string): Promise<void> {
  const words = await getPersonalDictionary();
  if (!words.includes(word)) {
    words.push(word);
    words.sort((a, b) => a.localeCompare(b));
    await set(DICT_KEY, words);
    customWordsSet.add(word.toLowerCase());
    if (spellcheckerInstance) {
      spellcheckerInstance.personal(word);
    }
  }
}

export async function removeWordFromDictionary(word: string): Promise<void> {
  const words = await getPersonalDictionary();
  const index = words.indexOf(word);
  if (index !== -1) {
    words.splice(index, 1);
    await set(DICT_KEY, words);
    customWordsSet.delete(word.toLowerCase());
    // nspell doesn't support removing a personal word directly without re-initializing
    // We could re-initialize, but it's simpler to just clear the instance and force reload 
    // or we can handle it in wrapper isCorrect. Let's just unload and reload.
    spellcheckerInstance = null;
  }
}

export async function clearPersonalDictionary(): Promise<void> {
  await set(DICT_KEY, []);
  customWordsSet.clear();
  spellcheckerInstance = null;
}

export async function loadSpellchecker(): Promise<void> {
  if (spellcheckerInstance) return;

  const [affRes, dicRes] = await Promise.all([
    fetch(AFF_URL),
    fetch(DIC_URL)
  ]);
  
  const affText = await affRes.text();
  const dicText = await dicRes.text();

  spellcheckerInstance = nspell(affText, dicText);
  
  const customWords = await getPersonalDictionary();
  customWordsSet = new Set(customWords.map((w) => w.toLowerCase()));
  
  for (const word of customWords) {
    spellcheckerInstance.personal(word);
  }
}

export function unloadSpellchecker() {
  spellcheckerInstance = null;
}

export function isSpelledCorrectly(word: string): boolean {
  if (customWordsSet.has(word.toLowerCase())) return true;
  if (!spellcheckerInstance) return true; // Fail open if not loaded
  return spellcheckerInstance.correct(word);
}

export function getSuggestions(word: string): string[] {
  if (!spellcheckerInstance) return [];
  return spellcheckerInstance.suggest(word);
}
