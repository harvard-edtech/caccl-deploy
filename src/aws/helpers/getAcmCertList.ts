// Import aws-sdk
import AWS, { ACM } from 'aws-sdk';

// Import helpers
import getPaginatedResponse from './getPaginatedResponse.js';

/**
 * Fetch data on available ACM certificates
 * @author Jay Luker
 * @returns {ACM.CertificateSummaryList}
 */
const getAcmCertList = async (): Promise<ACM.CertificateSummaryList> => {
  const acm = new AWS.ACM();
  return getPaginatedResponse(
    acm.listCertificates.bind(acm),
    {},
    'CertificateSummaryList',
  );
};

export default getAcmCertList;
