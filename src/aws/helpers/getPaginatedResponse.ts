/* eslint-disable @typescript-eslint/ban-ts-comment */
// Import aws-sdk
// import { Paginator } from '@aws-sdk/types';
import { AWSError, Request } from 'aws-sdk';

type NextTokenKey = { [k: string]: any } & { NextToken?: string };

/**
 * Convenience function for fetching larger responses that might
 * get paginated by the AWS api
 * @author Jay Luker
 * @param {function} func
 * @param {object} params
 * @param {string} itemKey
 * @returns {object[]}
 */
const getPaginatedResponse = async <
  TParams extends NextTokenKey,
  TRes extends NextTokenKey,
  TKey extends keyof TRes,
>(
  func: (_params: TParams, ..._args: any[]) => Request<TRes, AWSError>,
  params: TParams,
  itemKey: TKey,
): Promise<Required<TRes>[TKey]> => {
  // @ts-ignore
  const items: Required<TRes>[TKey] = [];
  async function getItems(nextTokenArg?: string) {
    const paramsCopy = { ...params };
    if (nextTokenArg !== undefined) {
      paramsCopy.NextToken = nextTokenArg;
    }

    const resp = await func(paramsCopy).promise();
    if (itemKey in resp) {
      // FIXME: need method of asserting that TRes[TKey] will be an array here
      // @ts-ignore
      items.push(...resp[itemKey]);
    }

    if (resp.NextToken !== undefined) {
      await getItems(resp.NextToken);
    }
  }

  await getItems();
  return items;
};

export default getPaginatedResponse;
