// Import prompts
import { Choice } from 'prompts';

// Import aws
import prompt from './prompt.js';
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

// Import helpers

const promptAppImage = async (assumedRole: AssumedRole) => {
  const inputType = await prompt({
    type: 'select',
    name: 'value',
    message: 'How would you like to select your image?',
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
  });
  let appImage;
  switch (inputType.value) {
    case 'string': {
      const inputString = await prompt({
        type: 'text',
        name: 'value',
        message: 'Enter the image id',
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

      if (!repoChoices.length) {
        throw new NoPromptChoices('No ECR repositories');
      }

      const repoChoice = await prompt({
        type: 'select',
        name: 'value',
        message: 'Select the ECR repo',
        choices: repoChoices,
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
          region: getCurrentRegion(),
          account: image.registryId,
          repoName: repoChoice.value,
          imageTag: releaseTag,
        });

        if (releaseTag) {
          choices.push({
            title: releaseTag,
            value: appImageValue,
          });
        }
        return choices;
      }, []);

      if (!imageTagsChoices.length) {
        throw new NoPromptChoices('No valid image tags to choose from');
      }

      const imageTagChoice = await prompt({
        type: 'select',
        name: 'value',
        message: 'Select a release tag',
        choices: imageTagsChoices,
      });
      appImage = imageTagChoice.value;
      break;
    }
    default:
      break;
  }
  return appImage;
};

export default promptAppImage;
