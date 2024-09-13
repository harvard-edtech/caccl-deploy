// Import aws
import { getAcmCertList } from '../aws/index.js';
// Import shared errors
import NoPromptChoices from '../shared/errors/NoPromptChoices.js';
import prompt from './prompt.js';

// Import helpers

const promptCertificateArn = async () => {
  const certList = await getAcmCertList();

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
