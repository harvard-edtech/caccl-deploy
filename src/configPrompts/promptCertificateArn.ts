// Import aws
import prompt from './prompt.js';
import { getAcmCertList } from '../aws/index.js';

// Import shared errors
import NoPromptChoices from '../shared/errors/NoPromptChoices.js';

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

  if (!certChoices.length) {
    throw new NoPromptChoices('No ACM certificates to choose from');
  }

  const certificateArn = await prompt({
    type: 'select',
    name: 'value',
    message: 'Select the hostname associated with your ACM certificate',
    choices: certChoices,
  });
  return certificateArn.value;
};

export default promptCertificateArn;
