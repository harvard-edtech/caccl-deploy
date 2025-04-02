type NextTokenKey = {
  NextToken?: string;
};

type NextTokenResponse<TOutput> = {
  items?: Array<TOutput>;
} & NextTokenKey;

/**
 * Get all paginated responses from an AWS SDK API with `NextToken` as the next token key.
 * @author Benedikt Arnarsson
 * @param paginator function to fetch the paginated resources.
 * @param input initial input to the paginator function.
 * @returns all pages of the paginated resource.
 */
const getPaginatedResponseV2 = async <TInput extends NextTokenKey, TOutput>(
  paginator: (_input: TInput) => Promise<NextTokenResponse<TOutput>>,
  input: TInput,
): Promise<Array<TOutput>> => {
  // TODO: possibility for async-generator if we yield res.items
  let res = await paginator(input);
  if (!res.items) {
    return [];
  }

  const { items } = res;
  // eslint-disable-next-line unicorn/consistent-destructuring
  while (res.NextToken) {
    const { NextToken } = res;
    res = await paginator({
      ...input,
      NextToken,
    });
    if (!res.items) {
      continue;
    }

    items.push(...res.items);
  }

  return items;
};

export default getPaginatedResponseV2;
