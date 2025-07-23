import { type Choice } from 'prompts';

import {
  createEcrArn,
  getCurrentRegion,
  getRepoImageList,
  getRepoList,
} from '../aws/index.js';
import NoPromptChoices from '../shared/errors/NoPromptChoices.js';
import looksLikeSemver from '../shared/helpers/looksLikeSemver.js';
import { type CacclDeployContext } from '../types/CacclDeployContext.js';
import prompt from './prompt.js';

/**
 * Prompt the user for the app image name.
 * @author Jay Luker, Benedikt Arnarsson
 * @param {CacclDeployContext} context CACCL deploy context.
 * @returns {Promise<string>} app image name
 */
const promptAppImage = async (context: CacclDeployContext): Promise<string> => {
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
      const repoList = await getRepoList(context);
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

      const region = await getCurrentRegion();
      const images = await getRepoImageList(context, repoChoice.value);
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
          region,
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
