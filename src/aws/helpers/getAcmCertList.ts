import {
  ACMClient,
  type CertificateSummary,
  ListCertificatesCommand,
} from '@aws-sdk/client-acm';

import getPaginatedResponseV2 from './getPaginatedResponseV2.js';

/**
 * Fetch data on available ACM certificates
 * @author Jay Luker, Benedikt Arnarsson
 * @param {string} [profile='default'] AWS profile.
 * @returns {CertificateSummary[]} list of certificate information.
 */
const getAcmCertList = async (
  profile = 'default',
): Promise<CertificateSummary[]> => {
  const client = new ACMClient({ profile });
  return getPaginatedResponseV2(async (_input) => {
    const command = new ListCertificatesCommand(_input);
    const res = await client.send(command);
    return {
      NextToken: res.NextToken,
      items: res.CertificateSummaryList,
    };
  }, {});
};

export default getAcmCertList;
