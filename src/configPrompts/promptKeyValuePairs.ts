// Import prompt
// Import logger
import logger from '../logger.js';
import prompt from './prompt.js';

/**
 * Prompt the user for a set of key/value pairs.
 * @author Jay Luker
 * @param {string} label object name for the key/value pairs.
 * @param {string} example what the object or key/value paris should look like.
 * @param {Record<string, string>} current  current values of the object or key/value pairs.
 * @returns new values for the object or key/value pairs.
 */
const promptKeyValuePairs = async (
  label: string,
  example: string,
  current: Record<string, string> = {},
): Promise<Record<string, string>> => {
  const pairs = { ...current };
  const displayList: string[] = [];
  for (const [k, v] of Object.entries(pairs)) {
    displayList.push(`${k}=${v}`);
  }

  logger.log(`Current ${label}(s):\n${displayList.join('\n')}`);
  const newEntry = await prompt({
    message: `Enter a new ${label}, e.g. ${example}. Leave empty to continue.`,
    name: 'value',
    type: 'text',
    validate(v) {
      return v !== '' && v.split('=').length !== 2
        ? 'invalid entry format'
        : true;
    },
  });
  if (newEntry.value !== '') {
    const [newKey, newValue] = newEntry.value.split('=');
    pairs[newKey] = newValue;
    return promptKeyValuePairs(label, example, pairs);
  }

  return pairs;
};

export default promptKeyValuePairs;
