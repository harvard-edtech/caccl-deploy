import { getAcmCertList } from '../aws/index.js';
import NoPromptChoices from '../shared/errors/NoPromptChoices.js';
import prompt from './prompt.js';

/**
 * Prompt the user for the AWS ACM certificate ARNS from a list of valid certificate ARNs in a profile.
 * @author Jay Luker, Benedikt Arnarsson
 * @param {string} [profile='default'] the AWS profile.
 * @returns {Promise<string>} the certificate ARN.
 */
const promptCertificateArn = async (profile = 'default') => {
  const certList = await getAcmCertList(profile);

  const certChoices = certList.flatMap((cert) => {
    if (!cert.DomainName || !cert.CertificateArn) return [];
    return {
      title: cert.DomainName,
      value: cert.CertificateArn,
    };
  });

  if (certChoices.length === 0) {
    throw new NoPromptChoices('No ACM certificates to choose from');
  }

  const certificateArn = await prompt({
    choices: certChoices,
    message: 'Select the hostname associated with your ACM certificate',
    name: 'value',
    type: 'select',
  });
  return certificateArn.value;
};

export default promptCertificateArn;
