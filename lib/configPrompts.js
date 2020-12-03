const prompts = require('prompts');
const chalk = require('chalk');
const figlet = require('figlet');
const aws = require('./aws');
const { conf } = require('./conf');
const { looksLikeSemver } = require('./helpers');
const { UserCancel } = require('./errors');

const prompt = async (question, exitOnCancel = true) => {
  return prompts(
    question,
    {
      onCancel: () => {
        if (exitOnCancel) {
          throw new UserCancel('bye!');
        }
      },
    }
  );
};

const promptFuncs = {
  confirm: async (message, initial = true) => {
    const response = await prompt({
      type: 'confirm',
      name: 'yesorno',
      initial,
      message,
    });
    return response.yesorno;
  },

  confirmProductionOp: async (yes = false) => {
    if (yes) {
      return true;
    }
    const prodAccounts = conf.get('productionAccounts');
    if (prodAccounts === undefined || !prodAccounts.length) {
      return true;
    }
    const accountId = await aws.getAccountId();
    if (!prodAccounts.includes(accountId)) {
      return true;
    }
    console.log(chalk.redBright(figlet.textSync('Production Account!')));
    try {
      const ok = await promptFuncs.confirm('\nPlease confirm you wish to proceed\n', false);
      return ok;
    } catch (err) {
      if (err.name === UserCancel.name) {
        return false;
      }
      throw err;
    }
  },

  promptAppName: async () => {
    const appName = await prompt({
      type: 'text',
      name: 'value',
      message: 'Enter a name for your app',
      validate: (v) => {
        return !(/^[a-z0-9.\-_]+$/i).test(v)
          ? 'app name can only contain alphanumeric and/or the characters ".-_"'
          : true;
      },
    });
    return appName.value;
  },

  promptInfraStackName: async () => {
    const infraStacks = await aws.getInfraStackList();

    if (infraStacks.length === 1) {
      return infraStacks[0];
    }

    const infraStackChoices = infraStacks.map((value) => {
      return {
        title: value,
        value,
      };
    });
    const infraStackName = await prompt({
      type: 'select',
      name: 'value',
      message: 'Select a base infrastructure stack to deploy to',
      choices: infraStackChoices,
    });
    return infraStackName.value;
  },

  promptCertificateArn: async () => {
    const certificateArn = await prompt({
      type: 'text',
      name: 'value',
      message: 'Enter the full ARN of your ACM certificate',
      validate: (v) => {
        if (v === undefined || !v.startsWith('arn:aws:acm')) {
          return 'invalid ARN value';
        }
        const currentRegion = aws.getCurrentRegion();
        const arnRegion = v.split(':')[3];
        if (arnRegion !== currentRegion) {
          return `ARN region mismatch: ${arnRegion} vs ${currentRegion}`;
        }
        return true;
      },
    });
    return certificateArn.value;
  },

  promptAppImage: async () => {
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
        const repoList = await aws.getRepoList();
        const repoChoices = repoList.map((value) => {
          return {
            title: value,
            value,
          };
        });
        const repoChoice = await prompt({
          type: 'select',
          name: 'value',
          message: 'Select the ECR repo',
          choices: repoChoices,
        });

        const images = await aws.getRepoImageList(repoChoice.value);
        const imageTagsChoices = images.reduce((collect, image) => {
          const releaseTag = image.imageTags.find((tag) => {
            return looksLikeSemver(tag);
          });

          const appImageValue = aws.createEcrArn({
            region: aws.getCurrentRegion(),
            account: image.registryId,
            repoName: repoChoice.value,
            imageTag: releaseTag,
          });

          return (releaseTag !== undefined)
            ? [...collect, {
              title: releaseTag,
              value: appImageValue,
            }]
            : collect;
        }, []);
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
  },

  promptKeyValuePairs: async (label, example, current = {}) => {
    const pairs = { ...current };
    const displayList = [];
    Object.entries(pairs).forEach(([k, v]) => {
      displayList.push(`${k}=${v}`);
    });
    console.log(`Current ${label}(s):\n${displayList.join('\n')}`);
    const newEntry = await prompt({
      type: 'text',
      name: 'value',
      message: `Enter a new ${label}, e.g. ${example}. Leave empty to continue.`,
      validate: (v) => {
        return v !== '' && v.split('=').length !== 2
          ? 'invalid entry format'
          : true;
      },
    });
    if (newEntry.value !== '') {
      const [newKey, newValue] = newEntry.value.split('=');
      pairs[newKey] = newValue;
      return promptFuncs.promptKeyValuePairs(label, example, pairs);
    }
    return pairs;
  },
};

module.exports = promptFuncs;
