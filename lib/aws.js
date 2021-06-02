/* eslint-disable no-use-before-define */
const SharedIniFile = require('aws-sdk/lib/shared-ini').iniLoader;
const { camelCase } = require('camel-case');

const { sleep, looksLikeSemver, readFile } = require('./helpers');
const { ExistingSecretWontDelete, CfnStackNotFound, AwsProfileNotFound } = require('./errors');

let AWS;
let assumedRoleArn;
let assumedRoleCredentials;

try {
  process.env.AWS_SDK_LOAD_CONFIG = 1;
  // eslint-disable-next-line global-require
  AWS = require('aws-sdk');
} catch (err) {
  // ingore if error is due to missing credentials;
  if (process.env.NODE_ENV !== 'test'
      && (err.code !== 'ENOENT' || !err.message.includes('.aws/credentials'))
   ) {
    throw err;
  }
}

const aws = {

  EC2_INSTANCE_CONNECT_USER: 'ec2-user',

  /**
   * checks that the AWS package interface has the configuration it needs
   * @returns {boolean}
   */
  isConfigured: () => {
    try {
      return [AWS, AWS.config.credentials, AWS.config.region].every((thing) => {
        return thing !== undefined && thing !== null;
      });
    } catch (err) {
      return false;
    }
  },
  /**
   * Split an ECR ARN value into parts. For example the ARN
   * "arn:aws:ecr:us-east-1:12345678901:repository/foo/tool:1.0.0"
   * would return
   * {
   *   service: ecr,
   *   region: us-east-1,
   *   account: 12345678901,
   *   repoName: foo/tool,
   *   imageTag: 1.0.0
   * }
   * @param  {string} arn - an ECR ARN value
   * @returns {object} an object representing the parsed ECR image ARN
   */
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

  /**
   * Transforms an ECR ARN value into it's URI form
   * for example, this:
   *   arn:aws:ecr:us-east-1:12345678901:repository/foo/tool:1.0.0
   * becomes this:
   *   12345678901.dkr.ecr.us-east-1.amazonaws.com/foo/toool
   * @param {string} arn - an ECR ARN value
   * @returns {string} and ECR image URI
   */
  ecrArnToImageId: (arn) => {
    const parsedArn = aws.parseEcrArn(arn);
    const host = [parsedArn.account, 'dkr.ecr', parsedArn.region, 'amazonaws.com'].join('.');
    return `${host}/${parsedArn.repoName}:${parsedArn.imageTag}`;
  },

  /**
   * Reassembles the result of `parseEcrArn` into a string
   * @param {object} arnObj
   * @returns {string} an ECR image ARN
   */
  createEcrArn: (arnObj) => {
    return ['arn:aws:ecr', arnObj.region, arnObj.account, `repository/${arnObj.repoName}`, arnObj.imageTag].join(':');
  },

  /**
   * Initialize the aws-sdk library with credentials from a
   * specific profile.
   * @param {string} profileName
   */
  initProfile: (profileName) => {
    const awsCredentials = SharedIniFile.loadFrom();

    if (awsCredentials[profileName] === undefined) {
      throw new AwsProfileNotFound(`Tried to init a non-existent profile: '${profileName}'`);
    }
    const profileCreds = awsCredentials[profileName];

    AWS.config.update({
      credentials: new AWS.Credentials({
        accessKeyId: profileCreds.aws_access_key_id,
        secretAccessKey: profileCreds.aws_secret_access_key,
      }),
    });
  },

  /**
   * Set an IAM role for AWS clients to assume
   * @param {string} roleArn
   */
  setAssumedRoleArn: (roleArn) => {
    assumedRoleArn = roleArn;
  },

  /**
   * @returns {string} the AWS account id of the current user
   */
  getAccountId: async () => {
    const sts = new AWS.STS();
    const identity = await sts.getCallerIdentity({}).promise();
    return identity.Account;
  },

  /**
   * Returns the configured region.
   * The region can be set in a couple of ways:
   *   - the usual env vars, AWS_REGION, etc
   *   - a region configured in the user's AWS profile/credentials
   * @returns {string}
   */
  getCurrentRegion: () => {
    return AWS.config.region;
  },

  /**
   * Returns a list of available infrastructure stacks. It assumes
   * any CloudFormation stack with an output named `InfraStackName`
   * is a compatible stack.
   * @returns {string[]}
   */
  getInfraStackList: async () => {
    const cfn = new AWS.CloudFormation();
    const stackList = [];
    const stacks = await getPaginatedResponse(cfn.describeStacks.bind(cfn), {}, 'Stacks');
    stacks.forEach((stack) => {
      if (stack.Outputs) {
        const ouptutKeys = stack.Outputs.map((o) => {
          return o.OutputKey;
        });
        if (ouptutKeys.indexOf('InfraStackName') >= 0) {
          stackList.push(stack.StackName);
        }
      }
    });
    return stackList;
  },

  /**
   * Return all the unqique app parameter namespaces, i.e., all the
   * distinct values that come after `/[prefix]` in the hierarchy.
   *
   * The SSM API doesn't have a great way to search/filter for parameter
   * store entries
   *
   * @param {string} prefix - name prefix used by the app CloudFormation stacks
   * @returns {string[]}
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

    const paramEntries = await getPaginatedResponse(
      ssm.describeParameters.bind(ssm),
      searchParams,
      'Parameters'
    );
    const filtered = paramEntries.filter((p) => {
      return p.Name.startsWith(prefix);
    });
    return filtered.map((p) => {
      return p.Name.split('/')[2];
    });
  },

  /**
   * @returns {string[]} - array of ECR repository names
   */
  getRepoList: async () => {
    const ecr = await getAssumedRoleClient(AWS.ECR);
    const edtechAppRepos = [];

    const repos = await getPaginatedResponse(ecr.describeRepositories.bind(ecr), {}, 'repositories');

    for (let i = 0; i < repos.length; i += 1) {
      const r = repos[i];
      const tagResp = await ecr
        .listTagsForResource({
          resourceArn: r.repositoryArn,
        })
        .promise();

      const isAnEdtechAppRepo = tagResp.tags.some((t) => {
        return t.Key === 'product' && t.Value === 'edtech-apps';
      });

      if (isAnEdtechAppRepo) {
        edtechAppRepos.push(r.repositoryName);
      }
    }
    return edtechAppRepos;
  },

  /**
   * @param {string} repo - ECR repository name, e.g. 'hdce/fooapp'
   * @param {boolean} all - return all tags; don't filter for master, stage,
   *   tags that look like semver, etc
   * @returns {object[]}
   */
  getRepoImageList: async (repo, all) => {
    const ecr = await getAssumedRoleClient(AWS.ECR);
    const images = await getPaginatedResponse(
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
      return images.filter((i) => {
        return i.imageTags.some((t) => {
          return looksLikeSemver(t) || ['master', 'stage'].includes(t);
        });
      });
    }
    return images;
  },

  /**
   * Confirms that a repo/tag combo exists
   * @param {string} repoName - ECR repository name
   * @param {string} tag - ECR image tag
   * @returns {boolean}
   */
  imageTagExists: async (repoName, tag) => {
    const imageList = await aws.getRepoImageList(repoName, true);
    return imageList.some((i) => {
      return i.imageTags.includes(tag);
    });
  },

  /**
   * Confirms that a tag is the latest for a repo
   * @param {string} repoName
   * @param {string} tag
   * @returns {boolean}
   */
  isLatestTag: async (repoName, tag) => {
    const imageList = await aws.getRepoImageList(repoName);
    return imageList.length && imageList[0].imageTags.includes(tag);
  },

  /**
   * Confirm that a secretsmanager entry exists
   * @param {string} secretName
   * @returns {boolean}
   */
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

    const resp = await sm.listSecrets(params).promise();
    return resp.SecretList.length > 0;
  },

  /**
   * Fetch the secret value for a secretsmanager entry
   * @param {string} secretArn
   * @returns {string}
   */
  resolveSecret: async (secretArn) => {
    const sm = new AWS.SecretsManager();
    const resp = await sm
      .getSecretValue({
        SecretId: secretArn,
      })
      .promise();
    return resp.SecretString;
  },

  /**
   * creates or updates a secrets manager entry
    * NOTE: the update + tagging operation is NOT atomic! I wish the
    *   sdk made this easier
    * @param {object} [secretOpts={}] - secret entry options
    * @param {string} [secretOpts.Name] - name of the secrets manager entry
    * @param {string} [secretOpts.Description] - description of the entry
    * @param {string} [secretOpts.SecretString] - value of the secret
    * @param {array} [tags=[]] - aws tags [{ Name: '...', Value: '...'}]
    * @returns {string} - the secretsmanager entry ARN
    */
  putSecret: async (secretOpts, tags, retries = 0) => {
    const sm = new AWS.SecretsManager();

    const { Name: SecretId, Description, SecretString } = secretOpts;

    let secretResp;
    try {
      const exists = await aws.secretExists(SecretId);
      if (exists) {
        secretResp = await sm
          .updateSecret({
            SecretId,
            Description,
            SecretString,
          })
          .promise();

        console.log(`secretsmanager entry ${SecretId} updated`);

        if (tags.length) {
          await sm
            .tagResource({
              SecretId,
              Tags: tags,
            })
            .promise();
          console.log(`secretsmanager entry ${SecretId} tagged`);
        }
      } else {
        secretResp = await sm
          .createSecret({
            Name: SecretId,
            Description,
            SecretString,
            Tags: tags,
          })
          .promise();
        console.log(`secretsmanager entry ${SecretId} created`);
      }
    } catch (err) {
      if (err.message.includes('already scheduled for deletion')) {
        if (retries < 5) {
          // eslint-disable-next-line no-param-reassign
          retries += 1;
          await sleep(2 ** retries * 1000);
          return aws.putSecret(secretOpts, tags, retries);
        }
        console.error('putSecret failed after 5 retries');
        throw new ExistingSecretWontDelete(`Failed to overwrite existing secret ${SecretId}`);
      }
      throw err;
    }
    return secretResp.ARN;
  },

  /**
   * delete one or more secretsmanager entries
   * @param {string[]} secretArns
   */
  deleteSecrets: async (secretArns) => {
    const sm = new AWS.SecretsManager();
    for (let i = 0; i < secretArns.length; i += 1) {
      await sm
        .deleteSecret({
          SecretId: secretArns[i],
          ForceDeleteWithoutRecovery: true,
        })
        .promise();
      console.log(`secret ${secretArns[i]} deleted`);
    }
  },

  /**
   * @param {object} opts - the parameter details, name, value, etc
   * @param {object[]} tags - aws resource tags
   * @returns {object}
   */
  putSsmParameter: async (opts, tags = []) => {
    const ssm = new AWS.SSM();
    const paramOptions = { ...opts };

    const paramResp = await ssm.putParameter(paramOptions).promise();
    if (tags.length) {
      await ssm
        .addTagsToResource({
          ResourceId: paramOptions.Name,
          ResourceType: 'Parameter',
          Tags: tags,
        })
        .promise();
    }
    return paramResp;
  },

  /**
   * Delete one or more parameter store entries
   * @param {string[]} paramNames
   */
  deleteSsmParameters: async (paramNames) => {
    const ssm = new AWS.SSM();
    const maxParams = 10;
    let idx = 0;
    while (idx < paramNames.length) {
      const paramNamesSlice = paramNames.slice(idx, maxParams + idx);
      idx += maxParams;
      await ssm
        .deleteParameters({
          Names: paramNamesSlice,
        })
        .promise();
      paramNamesSlice.forEach((name) => {
        console.log(`ssm parameter ${name} deleted`);
      });
    }
  },

  /**
   * Fetch a set of parameter store entries based on a name prefix,
   *  e.g. `/caccl-deploy/foo-app`
   * @param {string} prefix
   * @returns {object[]}
   */
  getSsmParametersByPrefix: async (prefix) => {
    const ssm = new AWS.SSM();
    return getPaginatedResponse(
      ssm.getParametersByPath.bind(ssm),
      {
        Path: prefix,
        Recursive: true,
      },
      'Parameters'
    );
  },

  /**
   * Fetch a single parameter store entry
   * @param {string} paramName
   * @returns {object}
   */
  getSsmParameter: async (paramName) => {
    const ssm = new AWS.SSM();
    return ssm
      .getParameter({
        Name: paramName,
      })
      .promise();
  },

  /**
   * Confirm that a CloudFormation stack exists
   * @param {string} stackName
   * @return {boolean}
   */
  cfnStackExists: async (stackName) => {
    try {
      await aws.getCfnStackExports(stackName);
      return true;
    } catch (err) {
      if (!(err instanceof CfnStackNotFound)) {
        throw err;
      }
    }
    return false;
  },

  /**
   * Return a list of Cloudformation stacks with names matching a prefix
   * @param {string} stackPrefix
   * @returns {string[]}
   */
  getCfnStacks: async (stackPrefix) => {
    const cfn = new AWS.CloudFormation();
    const resp = await getPaginatedResponse(cfn.describeStacks.bind(cfn), {}, 'Stacks');

    return resp.filter((s) => {
      return s.StackName.startsWith(stackPrefix);
    });
  },

  /**
   * Returns an array of objects representing a Cloudformation stack's exports
   * @param {string} stackName
   * @returns {object[]}
   */
  getCfnStackExports: async (stackName) => {
    const cnf = new AWS.CloudFormation();
    let exports;
    try {
      const resp = await cnf
        .describeStacks({
          StackName: stackName,
        })
        .promise();
      if (resp.Stacks === undefined || !resp.Stacks.length) {
        throw new CfnStackNotFound(`Unable to find stack ${stackName}`);
      }
      exports = resp.Stacks[0].Outputs.reduce((obj, output) => {
        if (output.ExportName === undefined) {
          return { ...obj };
        }
        const outputKey = camelCase(output.ExportName.replace(`${stackName}-`, ''));
        return {
          ...obj,
          [outputKey]: output.OutputValue,
        };
      }, {});
    } catch (err) {
      if (err.message.includes('does not exist')) {
        throw new CfnStackNotFound(`Cloudformation stack ${stackName} does not exist`);
      }
      throw err;
    }
    return exports;
  },

  /**
   * Fetch data on available ACM certificates
   * @returns {object[]}
   */
  getAcmCertList: async () => {
    const acm = new AWS.ACM();
    return getPaginatedResponse(acm.listCertificates.bind(acm), {}, 'CertificateSummaryList');
  },

  /**
   *
   * @param {string} cluster
   * @param {string} serviceName
   * @param {string} taskDefName
   * @param {string} execOptions.command - the command to be executed in
   *  the app container context
   * @param {number} execOptions.timeout - number of seconds to allow the
   *  task to complete
   * @param {array} execOptions.environment - an array of environment
   *  variable additions or overrides in the form
   *  { name: <name>, value: <value> }
   * @returns {string} - the arn of the started task
   */
  execTask: async (execOptions) => {
    const ecs = new AWS.ECS();

    const {
      clusterName,
      serviceName,
      taskDefName,
      command,
      timeOut = 20,
      environment = [],
    } = execOptions;

    const service = await aws.getService(clusterName, serviceName);

    // re-use networking config from the service description
    const { networkConfiguration } = service;

    const execResp = await ecs.runTask({
      cluster: clusterName,
      taskDefinition: taskDefName,
      networkConfiguration,
      launchType: 'FARGATE',
      platformVersion: '1.3.0',
      overrides: {
        containerOverrides: [
          {
            name: 'AppContainer',
            command: ['/bin/sh', '-c', command],
            environment,
          },
          {
            name: 'ProxyContainer',
            command: ['/bin/sh', '-c', `sleep ${timeOut}; echo bye!`],
          },
        ],
      },
    }).promise();

    return execResp.tasks[0].taskArn;
  },

  /**
   * Fetches the data for an ECS service
   * @param {string} cluster
   * @param {string} service
   * @returns {object}
   */
  getService: async (cluster, service) => {
    const ecs = new AWS.ECS();
    const resp = await ecs
      .describeServices({
        cluster,
        services: [service],
      }).promise();

    if (!resp.services) {
      throw new Error(`service ${service} not found`);
    }

    return resp.services[0];
  },

  /**
   * Fetches the data for an ECS task definition
   * @param {string} taskDefName
   * @returns {string}
   */
  getTaskDefinition: async (taskDefName) => {
    const ecs = new AWS.ECS();
    const resp = await ecs
      .describeTaskDefinition({
        taskDefinition: taskDefName,
      })
      .promise();

    if (resp.taskDefinition === undefined) {
      throw new Error(`task def ${taskDefName} not found`);
    }

    return resp.taskDefinition;
  },

  /**
   * Updates a Fargate task definition, replacing the app container's
   *   ECR image URI value
   * @param {string} taskDefName
   * @param {string} imageArn
   * @returns {string} - the full ARN (incl family:revision) of the newly
   *   registered task definition
   */
  updateTaskDefAppImage: async (taskDefName, imageArn) => {
    const ecs = new AWS.ECS();
    const taskDefinition = await aws.getTaskDefinition(taskDefName);

    // get existing tag set to include with the new task def
    const tagResp = await ecs
      .listTagsForResource({
        resourceArn: taskDefinition.taskDefinitionArn,
      })
      .promise();

    /**
     * tasks have multiple container definitions (app, proxy, etc), so we need
     * to get the index for the one we're changing ('AppContainer')
     */
    const containerIdx = taskDefinition.containerDefinitions.findIndex((cd) => {
      return cd.name === 'AppContainer';
    });
    const newImageId = aws.ecrArnToImageId(imageArn);

    // use a copy of the task definition object for the update
    const newTaskDef = JSON.parse(JSON.stringify(taskDefinition));

    // replace the image id with our new one
    newTaskDef.containerDefinitions[containerIdx].image = newImageId;

    // add the tags from our tag set request
    newTaskDef.tags = tagResp.tags;

    /**
     * delete invalid params that are returned by `returnTaskDefinition` but
     * not allowed by `registerTaskDefinition`
     */
    const registerTaskDefinitionParams = [
      'containerDefinitions',
      'cpu',
      'executionRoleArn',
      'family',
      'memory',
      'networkMode',
      'placementConstraints',
      'requiresCompatibilities',
      'taskRoleArn',
      'volumes',
    ];
    Object.keys(newTaskDef).forEach((k) => {
      if (!registerTaskDefinitionParams.includes(k)) {
        delete newTaskDef[k];
      }
    });

    const registerResp = await ecs.registerTaskDefinition(newTaskDef).promise();
    console.log('done');

    return registerResp.taskDefinition.taskDefinitionArn;
  },

  /**
   * Restart an app's ECS service
   * @param {string} cluster
   * @param {string} service
   * @param {boolean} wait
   */
  restartEcsServcie: async (cluster, service, restartOpts) => {
    const { newTaskDefArn, wait } = restartOpts;
    const ecs = new AWS.ECS();
    console.log(
      [
        'Console link for monitoring: ',
        `https://console.aws.amazon.com/ecs/home?region=${aws.getCurrentRegion()}`,
        `#/clusters/${cluster}/`,
        `services/${service}/tasks`,
      ].join('')
    );

    const updateServiceParams = {
      cluster,
      service,
      forceNewDeployment: true,
    };

    if (newTaskDefArn) {
      updateServiceParams.taskDefinition = newTaskDefArn;
    }

    // execute the service deployment
    await ecs.updateService(updateServiceParams).promise();

    // return immediately if
    if (!wait) {
      return;
    }
    let allDone = false;
    ecs
      .waitFor('servicesStable', {
        cluster,
        services: [service],
      })
      .promise()
      .then(() => {
        allDone = true;
      });

    let counter = 0;
    while (!allDone) {
      console.log('Waiting for deployment to stablize...');
      counter += 1;
      await sleep(2 ** counter * 1000);
    }
    console.log('all done!');
  },

  sendSSHPublicKey: async (opts) => {
    const {
      instanceAz,
      instanceId,
      sshKeyPath,
    } = opts;
    const ec2ic = new AWS.EC2InstanceConnect();
    const resp = await ec2ic.sendSSHPublicKey({
      AvailabilityZone: instanceAz,
      InstanceId: instanceId,
      InstanceOSUser: aws.EC2_INSTANCE_CONNECT_USER,
      SSHPublicKey: readFile(sshKeyPath),
    }).promise();
    return resp;
  },
};

/**
 * Returns an AWS service client that has been reconfigured with
 * temporary credentials from assuming an IAM role
 * @param {class} ClientClass
 * @returns {object}
 */
const getAssumedRoleClient = async (ClientClass) => {
  const client = new ClientClass();
  if (assumedRoleArn === undefined
    || assumedRoleArn.includes(await aws.getAccountId())) {
    return client;
  }
  if (assumedRoleCredentials === undefined) {
    const sts = new AWS.STS();
    const resp = await sts
      .assumeRole({
        RoleArn: assumedRoleArn,
        RoleSessionName: 'caccl-deploy-assume-role-session',
      })
      .promise();
    assumedRoleCredentials = resp.Credentials;
  }
  client.config.update({
    accessKeyId: assumedRoleCredentials.AccessKeyId,
    secretAccessKey: assumedRoleCredentials.SecretAccessKey,
    sessionToken: assumedRoleCredentials.SessionToken,
  });
  return client;
};

/**
 * Convenience function for fetching larger responses that might
 * get paginated by the AWS api
 * @param {function} func
 * @param {object} params
 * @param {string} itemKey
 * @returns {object[]}
 */
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

module.exports = aws;
