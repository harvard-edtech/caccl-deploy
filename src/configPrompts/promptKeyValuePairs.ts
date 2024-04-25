import prompt from './prompt';

const promptKeyValuePairs = async (
  label: string,
  example: string,
  current: Record<string, string> = {},
): Promise<Record<string, string>> => {
  const pairs = { ...current };
  const displayList: string[] = [];
  Object.entries(pairs).forEach(([k, v]) => {
    displayList.push(`${k}=${v}`);
  });
  console.log(`Current ${label}(s):\n${displayList.join('\n')}`);
  const newEntry = await prompt({
    type: 'text',
    name: 'value',
    message: `Enter a new ${label}, e.g. ${example}. Leave empty to continue.`,
    validate: (v) => {
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
