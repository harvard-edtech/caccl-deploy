// Import prompts
import { Choice } from 'prompts';

import {
  AssumedRole,
  createEcrArn,
  getCurrentRegion,
  getRepoImageList,
  getRepoList,
} from '../aws/index.js';
// Import shared errors
import NoPromptChoices from '../shared/errors/NoPromptChoices.js';
// Import shared helpers
import looksLikeSemver from '../shared/helpers/looksLikeSemver.js';
import prompt from './prompt.js';
// Import aws

// Import helpers

const promptAppImage = async (assumedRole: AssumedRole) => {
  const inputType = await prompt({
    choices: [
      {
        title: 'Select from a list of ECR repos',
        value: 'select',
      },
      {
        title: 'Enter image id string',
        value: 'string',
      },
    ],
    message: 'How would you like to select your image?',
    name: 'value',
    type: 'select',
  });
  let appImage;
  switch (inputType.value) {
    case 'string': {
      const inputString = await prompt({
        message: 'Enter the image id',
        name: 'value',
        type: 'text',
      });
      appImage = inputString.value;
      break;
    }

    case 'select': {
      // TODO: deal with AssumedRole
      const repoList = await getRepoList(assumedRole);
      const repoChoices = repoList.flatMap((value) => {
        if (!value) return [];
        return {
          title: value,
          value,
        };
      });

      if (repoChoices.length === 0) {
        throw new NoPromptChoices('No ECR repositories');
      }

      const repoChoice = await prompt({
        choices: repoChoices,
        message: 'Select the ECR repo',
        name: 'value',
        type: 'select',
      });

      const images = await getRepoImageList(assumedRole, repoChoice.value);
      const imageTagsChoices = images.reduce((choices: Choice[], image) => {
        const releaseTag =
          image.imageTags &&
          image.imageTags.find((tag) => {
            return looksLikeSemver(tag);
          });

        if (!releaseTag) return choices;

        if (!image.registryId) {
          throw new Error('Could not get ECR image registry ID.');
        }

        const appImageValue = createEcrArn({
          account: image.registryId,
          imageTag: releaseTag,
          region: getCurrentRegion(),
          repoName: repoChoice.value,
        });

        if (releaseTag) {
          choices.push({
            title: releaseTag,
            value: appImageValue,
          });
        }

        return choices;
      }, []);

      if (imageTagsChoices.length === 0) {
        throw new NoPromptChoices('No valid image tags to choose from');
      }

      const imageTagChoice = await prompt({
        choices: imageTagsChoices,
        message: 'Select a release tag',
        name: 'value',
        type: 'select',
      });
      appImage = imageTagChoice.value;
      break;
    }

    default: {
      break;
    }
  }

  return appImage;
};

export default promptAppImage;
