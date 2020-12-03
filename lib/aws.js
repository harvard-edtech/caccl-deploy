/* eslint-disable no-use-before-define */
const untilidfy = require('untildify');
const { camelCase } = require('camel-case');
const AWS = require('aws-sdk');
const SharedIniFile = require('aws-sdk/lib/shared-ini').iniLoader;
const { sleep, looksLikeSemver } = require('./helpers');
const { ExistingSecretWontDelete, CfnStackNotFound } = require('./errors');

let awsProfiles;
let awsCredentials;
let assumedRoleArn;
let assumedRoleCredentials;

try {
  // try loading the profiles/creds
  awsCredentials = SharedIniFile.loadFrom();
  awsProfiles = SharedIniFile.loadFrom({
    filename: untilidfy('~/.aws/config'),
  });
} catch (err) {
  // ingore if error is due to missing credentials;
  if (err.code !== 'ENOENT' || !err.message.includes('.aws/credentials')) {
    throw err;
  }
  awsProfiles = {};
  awsCredentials = {};
}

const aws = {

  parseEcrArn: (arn) => {
    const parts = arn.split(':');
    const [relativeId, imageTag] = parts.slice(-2);
    const repoName = relativeId.replace('repository/', '');
    return {
      service: parts[2],
      region: parts[3],
      account: parts[4],
      repoName,
      imageTag,
    };
  },

  // 542186135646.dkr.ecr.us-east-1.amazonaws.com/hdce/tool-playground:master
  ecrArnToImageId: (arn) => {
    const parsedArn = aws.parseEcrArn(arn);
    const host = [
      parsedArn.account,
      'dkr.ecr',
      parsedArn.region,
      'amazonaws.com',
    ].join('.');
    return `${host}/${parsedArn.repoName}:${parsedArn.imageTag}`;
  },

  createEcrArn: (arnObj) => {
    return [
      'arn:aws:ecr',
      arnObj.region,
      arnObj.account,
      `repository/${arnObj.repoName}`,
      arnObj.imageTag,
    ].join(':');
  },

  initProfile: (profileName) => {
    if (awsCredentials[profileName] === undefined) {
      throw new Error(`Tried to init a non-existent profile: ${profileName}`);
    }

    const profileCreds = awsCredentials[profileName];

    const awsConfig = {
      credentials: new AWS.Credentials({
        accessKeyId: profileCreds.aws_access_key_id,
        secretAccessKey: profileCreds.aws_secret_access_key,
      }),
      // set a default in case the profile region isn't configured
      region: process.env.AWS_REGION || 'us-east-1',
    };

    /**
     * depending on the user's environment/setup the profile keys can either be
     * just the profile name or the profile name prefixed with 'profile' :p
     */
    const profileConfig = awsProfiles[profileName] || awsProfiles[`profile ${profileName}`];

    if (profileConfig !== undefined && profileConfig.region !== undefined) {
      awsConfig.region = profileConfig.region;
    }

    AWS.config.update(awsConfig);
  },

  setAssumedRoleArn: (roleArn) => {
    assumedRoleArn = roleArn;
  },

  getAccountId: async () => {
    const sts = new AWS.STS();
    let identity;
    try {
      identity = await sts.getCallerIdentity({}).promise();
    } catch (err) {
      console.log(err);
      return err;
    }
    return identity.Account;
  },

  getCurrentRegion: () => {
    return AWS.config.region;
  },

  getInfraStackList: async () => {
    const cfn = new AWS.CloudFormation();
    const stackList = [];

    try {
      const stacks = await getPaginatedResponse(
        cfn.describeStacks.bind(cfn), {}, 'Stacks'
      );
      stacks.forEach((stack) => {
        if (stack.Outputs !== undefined) {
          if (stack.Outputs.some((output) => {
            return output.OutputKey === 'InfraStackName';
          })) {
            stackList.push(stack.StackName);
          }
        }
      });
    } catch (err) {
      console.log(err);
      return err;
    }
    return stackList;
  },

  /**
   * Return all the unqique app parameter namespaces, i.e., all the
   * distinct values that come after `/[prefix]` in the hierarchy.
   *
   * There is probably a better way to implement this; hopefully
   * I will get a chance to return to it. The core of the problem is
   * that describeParameters doesn't allow multiple filters
   * on the same Key, so, e.g., we can't also do a
   * 'Name' 'StartsWith' '/[prefix]' here. If we searched only by the prefix
   * then you're talking about potentially hundreds of params and a
   * multi-request, paginated response, which seems like an amount of
   * overhead I'd rather not deal with.
   */
  getAppList: async (prefix) => {
    const ssm = new AWS.SSM();
    const searchParams = {
      MaxResults: 50, // lord i hope we never have this many apps
      ParameterFilters: [
        {
          Key: 'Name',
          Option: 'Contains',
          // making an assumption that all configurations will include this
          Values: ['/infraStackName'],
        },
      ],
    };

    let appNames = [];
    try {
      const paramEntries = await getPaginatedResponse(
        ssm.describeParameters.bind(ssm),
        searchParams,
        'Parameters'
      );
      const filtered = paramEntries.filter((p) => {
        return p.Name.startsWith(prefix);
      });
      appNames = filtered.map((p) => {
        return p.Name.split('/')[2];
      });
    } catch (err) {
      console.log(err);
      return err;
    }
    return appNames;
  },

  getRepoList: async () => {
    const ecr = await getAssumedRoleClient(AWS.ECR);
    const edtechAppRepos = [];

    try {
      const repos = await getPaginatedResponse(
        ecr.describeRepositories.bind(ecr),
        {},
        'repositories'
      );

      for (let i = 0; i < repos.length; i += 1) {
        const r = repos[i];
        const tagResp = await ecr.listTagsForResource({
          resourceArn: r.repositoryArn,
        }).promise();

        const isAnEdtechAppRepo = tagResp.tags.some((t) => {
          return t.Key === 'product' && t.Value === 'edtech-apps';
        });

        if (isAnEdtechAppRepo) {
          edtechAppRepos.push(r.repositoryName);
        }
      }
    } catch (err) {
      console.log(err);
      return err;
    }
    return edtechAppRepos;
  },

  getRepoImageList: async (repo, all = false) => {
    const ecr = await getAssumedRoleClient(AWS.ECR);
    let images = [];
    try {
      images = await getPaginatedResponse(
        ecr.describeImages.bind(ecr),
        {
          repositoryName: repo,
          maxResults: 1000,
          filter: {
            tagStatus: 'TAGGED',
          },
        },
        'imageDetails'
      );
    } catch (err) {
      console.log(err);
      return err;
    }

    // sort the images by the date they were pushed to ECR
    images.sort((a, b) => {
      if (a.imagePushedAt < b.imagePushedAt) {
        return 1;
      }
      if (a.imagePushedAt > b.imagePushedAt) {
        return -1;
      }
      return 0;
    });

    if (!all) {
      // find the latest semver tagged image
      images = images.filter((i) => {
        return i.imageTags.some((t) => {
          return looksLikeSemver(t) || ['master', 'stage'].includes(t);
        });
      });
    }
    return images;
  },

  imageTagExists: async (repoName, tag) => {
    const imageList = await aws.getRepoImageList(repoName, true);
    return imageList.some((i) => {
      return i.imageTags.includes(tag);
    });
  },

  isLatestTag: async (repoName, tag) => {
    const imageList = await aws.getRepoImageList(repoName);
    return imageList.length && imageList[0].imageTags.includes(tag);
  },

  secretExists: async (secretName) => {
    const sm = new AWS.SecretsManager();
    const params = {
      Filters: [
        {
          Key: 'name',
          Values: [secretName],
        },
      ],
    };

    let resp;
    try {
      resp = await sm.listSecrets(params).promise();
    } catch (err) {
      console.error(err);
      return err;
    }
    return resp.SecretList.length > 0;
  },

  resolveSecret: async (secretArn) => {
    const sm = new AWS.SecretsManager();
    let resp;
    try {
      resp = await sm.getSecretValue({
        SecretId: secretArn,
      }).promise();
    } catch (err) {
      console.log(err);
      return err;
    }
    return resp.SecretString;
  },

  putSecret: async (secretOpts, tags, retries = 0) => {
    /**
     * creates or updates a secrets manager entry
     * NOTE: the update + tagging operation is NOT atomic! I wish the
     *   sdk made this easier
     * @param {object} [secretOpts={}] - secret entry options
     * @param {string} [secretOpts.Name] - name of the secrets manager entry
     * @param {string} [secretOpts.Description] - description of the entry
     * @param {string} [secretOpts.SecretString] - value of the secret
     * @param {array} [tags=[]] - aws tags [{ Name: '...', Value: '...'}]
     */
    const sm = new AWS.SecretsManager();

    const {
      Name: SecretId,
      Description,
      SecretString,
    } = secretOpts;

    let secretResp;
    try {
      const exists = await aws.secretExists(SecretId);
      if (exists) {
        secretResp = await sm.updateSecret({
          SecretId,
          Description,
          SecretString,
        }).promise();

        console.log(`secretsmanager entry ${SecretId} updated`);

        if (tags.length) {
          await sm.tagResource({
            SecretId,
            Tags: tags,
          }).promise();
          console.log(`secretsmanager entry ${SecretId} tagged`);
        }
      } else {
        secretResp = await sm.createSecret({
          Name: SecretId,
          Description,
          SecretString,
          Tags: tags,
        }).promise();
        console.log(`secretsmanager entry ${SecretId} created`);
      }
    } catch (err) {
      if (err.message.includes('already scheduled for deletion')) {
        if (retries < 5) {
          // eslint-disable-next-line no-param-reassign
          retries += 1;
          await sleep((2 ** retries) * 1000);
          return aws.putSecret(secretOpts, tags, retries);
        }
        console.error('putSecret failed after 5 retries');
        throw new ExistingSecretWontDelete(
          `Failed to overwrite existing secret ${SecretId}`
        );
      }
      console.error(err);
      return err;
    }
    return secretResp.ARN;
  },

  deleteSecrets: async (secretArns) => {
    const sm = new AWS.SecretsManager();
    try {
      for (let i = 0; i < secretArns.length; i += 1) {
        await sm.deleteSecret({
          SecretId: secretArns[i],
          ForceDeleteWithoutRecovery: true,
        }).promise();
        console.log(`secret ${secretArns[i]} deleted`);
      }
    } catch (err) {
      console.error(err);
      return err;
    }
  },

  putSsmParameter: async (opts, tags = []) => {
    const ssm = new AWS.SSM();
    const paramOptions = { ...opts };

    let paramResp;
    try {
      paramResp = await ssm.putParameter(paramOptions).promise();
      if (tags.length) {
        await ssm.addTagsToResource({
          ResourceId: paramOptions.Name,
          ResourceType: 'Parameter',
          Tags: tags,
        }).promise();
      }
    } catch (err) {
      console.error(err);
      return err;
    }
    return paramResp;
  },

  deleteSsmParameters: async (paramNames) => {
    const ssm = new AWS.SSM();
    const maxParams = 10;
    let idx = 0;
    try {
      while (idx < paramNames.length) {
        const paramNamesSlice = paramNames.slice(idx, maxParams + idx);
        idx += maxParams;
        await ssm.deleteParameters({
          Names: paramNamesSlice,
        }).promise();
        paramNamesSlice.forEach((name) => {
          console.log(`ssm parameter ${name} deleted`);
        });
      }
    } catch (err) {
      console.error(err);
      return err;
    }
  },

  getSsmParametersByPrefix: async (prefix) => {
    const ssm = new AWS.SSM();
    let paramEntries;
    try {
      paramEntries = await getPaginatedResponse(
        ssm.getParametersByPath.bind(ssm),
        {
          Path: prefix,
          Recursive: true,
        },
        'Parameters'
      );
    } catch (err) {
      console.log(err);
      return err;
    }
    return paramEntries;
  },

  getSsmParameter: async (paramName) => {
    const ssm = new AWS.SSM();
    let parameter;
    try {
      parameter = await ssm.getParameter({
        Name: paramName,
      }).promise();
    } catch (err) {
      console.log(err);
      return err;
    }
    return parameter;
  },

  getCfnStacks: async (stackPrefix) => {
    const cfn = new AWS.CloudFormation();
    let stacks;
    try {
      const resp = await getPaginatedResponse(
        cfn.listStacks.bind(cfn),
        {},
        'StackSummaries'
      );

      stacks = resp.filter((s) => {
        return s.StackName.startsWith(stackPrefix);
      });
    } catch (err) {
      console.log(err);
      return err;
    }
    return stacks;
  },

  getCfnStackExports: async (stackName) => {
    const cnf = new AWS.CloudFormation();
    let exports;
    try {
      const resp = await cnf.describeStacks({
        StackName: stackName,
      }).promise();
      if (resp.Stacks === undefined || !resp.Stacks.length) {
        throw new CfnStackNotFound(`Unable to find stack ${stackName}`);
      }
      exports = resp.Stacks[0].Outputs.reduce((obj, output) => {
        if (output.ExportName === undefined) {
          return { ...obj };
        }
        const outputKey = camelCase(
          output.ExportName.replace(`${stackName}-`, '')
        );
        return {
          ...obj,
          [outputKey]: output.OutputValue,
        };
      }, {});
    } catch (err) {
      if (err.message.includes('does not exist')) {
        throw new CfnStackNotFound(
          `Cloudformation stack ${stackName} does not exist`
        );
      }
      console.log(err);
      return err;
    }
    return exports;
  },

  updateTaskDefAppImage: async (taskDefName, imageArn) => {
    const ecs = new AWS.ECS();
    try {
      const resp = await ecs.describeTaskDefinition({
        taskDefinition: taskDefName,
      }).promise();
      if (resp.taskDefinition === undefined) {
        throw new Error(`task def ${taskDefName} not found`);
      }

      const { taskDefinition } = resp;

      // get existing tag set to include with the new task def
      const tagResp = await ecs.listTagsForResource({
        resourceArn: taskDefinition.taskDefinitionArn,
      }).promise();

      const containerIdx = taskDefinition.containerDefinitions
        .findIndex((cd) => {
          return cd.name === 'AppContainer';
        });
      const newImageId = aws.ecrArnToImageId(imageArn);

      const newTaskDef = JSON.parse(JSON.stringify(taskDefinition));
      newTaskDef.containerDefinitions[containerIdx].image = newImageId;
      newTaskDef.tags = tagResp.tags;

      // delete invalid params
      delete newTaskDef.revision;
      delete newTaskDef.status;
      delete newTaskDef.taskDefinitionArn;
      delete newTaskDef.requiresAttributes;
      delete newTaskDef.compatibilities;

      await ecs.registerTaskDefinition(newTaskDef).promise();
      console.log('done');
    } catch (err) {
      console.log(err);
      return err;
    }
  },

  restartEcsServcie: async (cluster, service, wait = true) => {
    const ecs = new AWS.ECS();
    console.log([
      'Console link for monitoring: ',
      `https://console.aws.amazon.com/ecs/home?region=${aws.getCurrentRegion()}`,
      `#/clusters/${cluster}/`,
      `services/${service}/tasks`,
    ].join(''));
    try {
      // execute the service deployment
      await ecs.updateService({
        cluster,
        service,
        forceNewDeployment: true,
      }).promise();

      // return immediately if
      if (!wait) {
        return;
      }
      let allDone = false;
      ecs.waitFor('servicesStable', {
        cluster,
        services: [service],
      }).promise()
        .then(() => {
          allDone = true;
        });

      let counter = 0;
      while (!allDone) {
        console.log('Waiting for deployment to stablize...');
        counter += 1;
        await sleep((2 ** counter) * 1000);
      }
      console.log('all done!');
    } catch (err) {
      console.log(err);
      return err;
    }
  },

  suggestCidrBlock: async () => {
    const takenCidrBlocks = await getTakenCidrBlocks();
    const possibleCidrBlocks = [...Array(254).keys()].map((i) => {
      return `10.2.${i}`;
    });
    const availableCidrBlocks = possibleCidrBlocks.filter((cb) => {
      return !takenCidrBlocks.includes(cb);
    });
    if (availableCidrBlocks.length) {
      // return a random pick
      const randomIdx = Math.floor(Math.random() * availableCidrBlocks.length);
      const randomPick = availableCidrBlocks[randomIdx];
      return `${randomPick}.0/24`;
    }
  },
};

module.exports = aws;

const getAssumedRoleClient = async (ClientClass) => {
  const client = new ClientClass();
  if (assumedRoleArn === undefined
      || assumedRoleArn.includes(await aws.getAccountId())) {
    return client;
  }
  if (assumedRoleCredentials === undefined) {
    try {
      const sts = new AWS.STS();
      const resp = await sts.assumeRole({
        RoleArn: assumedRoleArn,
        RoleSessionName: 'caccl-deploy-assume-role-session',
      }).promise();
      assumedRoleCredentials = resp.Credentials;
    } catch (err) {
      console.log(err);
      return err;
    }
  }
  client.config.update({
    accessKeyId: assumedRoleCredentials.AccessKeyId,
    secretAccessKey: assumedRoleCredentials.SecretAccessKey,
    sessionToken: assumedRoleCredentials.SessionToken,
  });
  return client;
};

const getPaginatedResponse = async (func, params, itemKey) => {
  const items = [];
  async function getItems(nextTokenArg) {
    const paramsCopy = { ...params };
    if (nextTokenArg !== undefined) {
      paramsCopy.NextToken = nextTokenArg;
    }
    const resp = await func(paramsCopy).promise();
    if (itemKey in resp) {
      items.push(...resp[itemKey]);
    }
    if (resp.NextToken !== undefined) {
      await getItems(resp.NextToken);
    }
  }
  await getItems();
  return items;
};

const getTakenCidrBlocks = async () => {
  const ec2 = new AWS.EC2();
  const takenBlocks = [];
  async function fetchBlocks(nextToken) {
    const params = nextToken !== undefined ? { NextToken: nextToken } : {};
    const vpcResp = await ec2.describeVpcs(params).promise();
    vpcResp.Vpcs.forEach((vpc) => {
      vpc.CidrBlockAssociationSet.forEach((cbaSet) => {
        const truncatedBlock = cbaSet.CidrBlock.slice(0, cbaSet.CidrBlock.lastIndexOf('.'));
        if (!takenBlocks.includes(truncatedBlock)) {
          takenBlocks.push(truncatedBlock);
        }
      });
    });
    if (vpcResp.NextToken !== undefined) {
      await fetchBlocks(vpcResp.NextToken);
    }
  }
  await fetchBlocks();
  return takenBlocks;
};
