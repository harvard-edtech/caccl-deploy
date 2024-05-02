'use strict';
var __create = Object.create;
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __pow = Math.pow;
var __defNormalProp = (obj, key, value) =>
  key in obj
    ? __defProp(obj, key, {
        enumerable: true,
        configurable: true,
        writable: true,
        value,
      })
    : (obj[key] = value);
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop)) __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop)) __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __commonJS = (cb, mod) =>
  function __require() {
    return (
      mod ||
        (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod),
      mod.exports
    );
  };
var __copyProps = (to, from, except, desc) => {
  if ((from && typeof from === 'object') || typeof from === 'function') {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, {
          get: () => from[key],
          enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable,
        });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (
  (target = mod != null ? __create(__getProtoOf(mod)) : {}),
  __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule
      ? __defProp(target, 'default', { value: mod, enumerable: true })
      : target,
    mod,
  )
);
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) =>
      x.done
        ? resolve(x.value)
        : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// lib/errors.js
var require_errors = __commonJS({
  'lib/errors.js'(exports2, module2) {
    'use strict';
    var CacclDeployError2 = class extends Error {
      constructor(message) {
        super(message);
        this.name = this.constructor.name;
      }
    };
    var AwsProfileNotFound2 = class extends CacclDeployError2 {};
    var AppNotFound2 = class extends CacclDeployError2 {};
    var ExistingSecretWontDelete2 = class extends CacclDeployError2 {};
    var CfnStackNotFound2 = class extends CacclDeployError2 {};
    var UserCancel2 = class extends CacclDeployError2 {};
    var NoPromptChoices2 = class extends CacclDeployError2 {};
    module2.exports = {
      AwsProfileNotFound: AwsProfileNotFound2,
      AppNotFound: AppNotFound2,
      ExistingSecretWontDelete: ExistingSecretWontDelete2,
      CfnStackNotFound: CfnStackNotFound2,
      UserCancel: UserCancel2,
      NoPromptChoices: NoPromptChoices2,
    };
  },
});

// lib/helpers.js
var require_helpers = __commonJS({
  'lib/helpers.js'(exports2, module2) {
    'use strict';
    var fs2 = require('fs');
    var path2 = require('path');
    var semver2 = require('semver');
    var LOOKS_LIKE_SEMVER_REGEX2 = new RegExp(
      [
        '(?<Major>0|(?:[1-9]\\d*))',
        '(?:\\.(?<Minor>0|(?:[1-9]\\d*))',
        '(?:\\.(?<Patch>0|(?:[1-9]\\d*))))',
      ].join(''),
    );
    module2.exports = {
      readJson: (filePath) => {
        return JSON.parse(fs2.readFileSync(path2.resolve(filePath), 'utf8'));
      },
      readFile: (filePath) => {
        return fs2.readFileSync(require.resolve(filePath), 'utf8');
      },
      tagsForAws: (tags = {}) => {
        return Object.entries(tags).map(([k, v]) => {
          return { Key: k, Value: v };
        });
      },
      sleep: (ms) => {
        return new Promise((resolve) => {
          setTimeout(resolve, ms);
        });
      },
      looksLikeSemver: (s) => {
        return LOOKS_LIKE_SEMVER_REGEX2.test(s);
      },
      validSSMParamName: (name) => {
        return /^([a-z0-9:/_-]+)$/i.test(name);
      },
      warnAboutVersionDiff: (versionString1, versionString2) => {
        let v1;
        let v2;
        if (
          [versionString1, versionString2].filter((v) => {
            return v.includes('branch=');
          }).length === 1
        ) {
          return true;
        }
        try {
          v1 = versionString1.match(new RegExp('^package=(?<version>[^:]+)'))
            .groups.version;
          v2 = versionString2.match(new RegExp('^package=(?<version>[^:]+)'))
            .groups.version;
        } catch (err) {
          if (err instanceof TypeError) {
            return true;
          }
          throw err;
        }
        if (v1 === v2) return false;
        if (!semver2.valid(v1) || !semver2.valid(v2)) {
          return true;
        }
        return !semver2.satisfies(v1, `${v2.slice(0, -1)}x`);
      },
    };
  },
});

// lib/aws.js
var require_aws = __commonJS({
  'lib/aws.js'(exports2, module2) {
    'use strict';
    var SharedIniFile2 = require('aws-sdk/lib/shared-ini').iniLoader;
    var { camelCase: camelCase2 } = require('camel-case');
    var {
      ExistingSecretWontDelete: ExistingSecretWontDelete2,
      CfnStackNotFound: CfnStackNotFound2,
      AwsProfileNotFound: AwsProfileNotFound2,
    } = require_errors();
    var {
      sleep: sleep2,
      looksLikeSemver: looksLikeSemver2,
      readFile: readFile2,
    } = require_helpers();
    var AWS26;
    var assumedRoleArn;
    var assumedRoleCredentials;
    try {
      process.env.AWS_SDK_LOAD_CONFIG = 1;
      AWS26 = require('aws-sdk');
    } catch (err) {
      if (
        process.env.NODE_ENV !== 'test' &&
        (err.code !== 'ENOENT' || !err.message.includes('.aws/credentials'))
      ) {
        throw err;
      }
    }
    var aws = {
      EC2_INSTANCE_CONNECT_USER: 'ec2-user',
      /**
       * checks that the AWS package interface has the configuration it needs
       * @returns {boolean}
       */
      isConfigured: () => {
        try {
          return [AWS26, AWS26.config.credentials, AWS26.config.region].every(
            (thing) => {
              return thing !== void 0 && thing !== null;
            },
          );
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
        const host = [
          parsedArn.account,
          'dkr.ecr',
          parsedArn.region,
          'amazonaws.com',
        ].join('.');
        return `${host}/${parsedArn.repoName}:${parsedArn.imageTag}`;
      },
      /**
       * Reassembles the result of `parseEcrArn` into a string
       * @param {object} arnObj
       * @returns {string} an ECR image ARN
       */
      createEcrArn: (arnObj) => {
        return [
          'arn:aws:ecr',
          arnObj.region,
          arnObj.account,
          `repository/${arnObj.repoName}`,
          arnObj.imageTag,
        ].join(':');
      },
      /**
       * Initialize the aws-sdk library with credentials from a
       * specific profile.
       * @param {string} profileName
       */
      initProfile: (profileName) => {
        const awsCredentials = SharedIniFile2.loadFrom();
        if (awsCredentials[profileName] === void 0) {
          throw new AwsProfileNotFound2(
            `Tried to init a non-existent profile: '${profileName}'`,
          );
        }
        const profileCreds = awsCredentials[profileName];
        AWS26.config.update({
          credentials: new AWS26.Credentials({
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
      getAccountId: () =>
        __async(exports2, null, function* () {
          const sts = new AWS26.STS();
          const identity = yield sts.getCallerIdentity({}).promise();
          return identity.Account;
        }),
      /**
       * Returns the configured region.
       * The region can be set in a couple of ways:
       *   - the usual env vars, AWS_REGION, etc
       *   - a region configured in the user's AWS profile/credentials
       * @returns {string}
       */
      getCurrentRegion: () => {
        return AWS26.config.region;
      },
      /**
       * Returns a list of available infrastructure stacks. It assumes
       * any CloudFormation stack with an output named `InfraStackName`
       * is a compatible stack.
       * @returns {string[]}
       */
      getInfraStackList: () =>
        __async(exports2, null, function* () {
          const cfn = new AWS26.CloudFormation();
          const stackList = [];
          const stacks = yield getPaginatedResponse2(
            cfn.describeStacks.bind(cfn),
            {},
            'Stacks',
          );
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
        }),
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
      getAppList: (prefix) =>
        __async(exports2, null, function* () {
          const ssm = new AWS26.SSM();
          const searchParams = {
            MaxResults: 50,
            // lord i hope we never have this many apps
            ParameterFilters: [
              {
                Key: 'Name',
                Option: 'Contains',
                // making an assumption that all configurations will include this
                Values: ['/infraStackName'],
              },
            ],
          };
          const paramEntries = yield getPaginatedResponse2(
            ssm.describeParameters.bind(ssm),
            searchParams,
            'Parameters',
          );
          const filtered = paramEntries.filter((p) => {
            return p.Name.startsWith(prefix);
          });
          return filtered.map((p) => {
            return p.Name.split('/')[2];
          });
        }),
      /**
       * @returns {string[]} - array of ECR repository names
       */
      getRepoList: () =>
        __async(exports2, null, function* () {
          const ecr = yield getAssumedRoleClient(AWS26.ECR);
          const edtechAppRepos = [];
          const repos = yield getPaginatedResponse2(
            ecr.describeRepositories.bind(ecr),
            {},
            'repositories',
          );
          for (let i = 0; i < repos.length; i += 1) {
            const r = repos[i];
            const tagResp = yield ecr
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
        }),
      /**
       * @param {string} repo - ECR repository name, e.g. 'hdce/fooapp'
       * @param {boolean} all - return all tags; don't filter for master, stage,
       *   tags that look like semver, etc
       * @returns {object[]}
       */
      getRepoImageList: (repo, all) =>
        __async(exports2, null, function* () {
          const ecr = yield getAssumedRoleClient(AWS26.ECR);
          const images = yield getPaginatedResponse2(
            ecr.describeImages.bind(ecr),
            {
              repositoryName: repo,
              maxResults: 1e3,
              filter: {
                tagStatus: 'TAGGED',
              },
            },
            'imageDetails',
          );
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
            return images.filter((i) => {
              return i.imageTags.some((t) => {
                return (
                  looksLikeSemver2(t) || ['main', 'master', 'stage'].includes(t)
                );
              });
            });
          }
          return images;
        }),
      /**
       * Confirms that a repo/tag combo exists
       * @param {string} repoName - ECR repository name
       * @param {string} tag - ECR image tag
       * @returns {boolean}
       */
      imageTagExists: (repoName, tag) =>
        __async(exports2, null, function* () {
          const imageList = yield aws.getRepoImageList(repoName, true);
          return imageList.some((i) => {
            return i.imageTags.includes(tag);
          });
        }),
      /**
       * Confirms that a tag is the latest for a repo
       * @param {string} repoName
       * @param {string} tag
       * @returns {boolean}
       */
      isLatestTag: (repoName, tag) =>
        __async(exports2, null, function* () {
          const imageList = yield aws.getRepoImageList(repoName);
          return imageList.length && imageList[0].imageTags.includes(tag);
        }),
      /**
       * Confirm that a secretsmanager entry exists
       * @param {string} secretName
       * @returns {boolean}
       */
      secretExists: (secretName) =>
        __async(exports2, null, function* () {
          const sm = new AWS26.SecretsManager();
          const params = {
            Filters: [
              {
                Key: 'name',
                Values: [secretName],
              },
            ],
          };
          const resp = yield sm.listSecrets(params).promise();
          return resp.SecretList.length > 0;
        }),
      /**
       * Fetch the secret value for a secretsmanager entry
       * @param {string} secretArn
       * @returns {string}
       */
      resolveSecret: (secretArn) =>
        __async(exports2, null, function* () {
          const sm = new AWS26.SecretsManager();
          const resp = yield sm
            .getSecretValue({
              SecretId: secretArn,
            })
            .promise();
          return resp.SecretString;
        }),
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
      putSecret: (secretOpts, tags, retries = 0) =>
        __async(exports2, null, function* () {
          const sm = new AWS26.SecretsManager();
          const { Name: SecretId, Description, SecretString } = secretOpts;
          let secretResp;
          try {
            const exists = yield aws.secretExists(SecretId);
            if (exists) {
              secretResp = yield sm
                .updateSecret({
                  SecretId,
                  Description,
                  SecretString,
                })
                .promise();
              console.log(`secretsmanager entry ${SecretId} updated`);
              if (tags.length) {
                yield sm
                  .tagResource({
                    SecretId,
                    Tags: tags,
                  })
                  .promise();
                console.log(`secretsmanager entry ${SecretId} tagged`);
              }
            } else {
              secretResp = yield sm
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
                retries += 1;
                yield sleep2(__pow(2, retries) * 1e3);
                return aws.putSecret(secretOpts, tags, retries);
              }
              console.error('putSecret failed after 5 retries');
              throw new ExistingSecretWontDelete2(
                `Failed to overwrite existing secret ${SecretId}`,
              );
            }
            throw err;
          }
          return secretResp.ARN;
        }),
      /**
       * delete one or more secretsmanager entries
       * @param {string[]} secretArns
       */
      deleteSecrets: (secretArns) =>
        __async(exports2, null, function* () {
          const sm = new AWS26.SecretsManager();
          for (let i = 0; i < secretArns.length; i += 1) {
            yield sm
              .deleteSecret({
                SecretId: secretArns[i],
                ForceDeleteWithoutRecovery: true,
              })
              .promise();
            console.log(`secret ${secretArns[i]} deleted`);
          }
        }),
      /**
       * @param {object} opts - the parameter details, name, value, etc
       * @param {object[]} tags - aws resource tags
       * @returns {object}
       */
      putSsmParameter: (_0, ..._1) =>
        __async(exports2, [_0, ..._1], function* (opts, tags = []) {
          const ssm = new AWS26.SSM();
          const paramOptions = __spreadValues({}, opts);
          const paramResp = yield ssm.putParameter(paramOptions).promise();
          if (tags.length) {
            yield ssm
              .addTagsToResource({
                ResourceId: paramOptions.Name,
                ResourceType: 'Parameter',
                Tags: tags,
              })
              .promise();
          }
          return paramResp;
        }),
      /**
       * Delete one or more parameter store entries
       * @param {string[]} paramNames
       */
      deleteSsmParameters: (paramNames) =>
        __async(exports2, null, function* () {
          const ssm = new AWS26.SSM();
          const maxParams = 10;
          let idx = 0;
          while (idx < paramNames.length) {
            const paramNamesSlice = paramNames.slice(idx, maxParams + idx);
            idx += maxParams;
            yield ssm
              .deleteParameters({
                Names: paramNamesSlice,
              })
              .promise();
            paramNamesSlice.forEach((name) => {
              console.log(`ssm parameter ${name} deleted`);
            });
          }
        }),
      /**
       * Fetch a set of parameter store entries based on a name prefix,
       *  e.g. `/caccl-deploy/foo-app`
       * @param {string} prefix
       * @returns {object[]}
       */
      getSsmParametersByPrefix: (prefix) =>
        __async(exports2, null, function* () {
          const ssm = new AWS26.SSM();
          return getPaginatedResponse2(
            ssm.getParametersByPath.bind(ssm),
            {
              Path: prefix,
              Recursive: true,
            },
            'Parameters',
          );
        }),
      /**
       * Fetch a single parameter store entry
       * @param {string} paramName
       * @returns {object}
       */
      getSsmParameter: (paramName) =>
        __async(exports2, null, function* () {
          const ssm = new AWS26.SSM();
          return ssm
            .getParameter({
              Name: paramName,
            })
            .promise();
        }),
      /**
       * Confirm that a CloudFormation stack exists
       * @param {string} stackName
       * @return {boolean}
       */
      cfnStackExists: (stackName) =>
        __async(exports2, null, function* () {
          try {
            yield aws.getCfnStackExports(stackName);
            return true;
          } catch (err) {
            if (!(err instanceof CfnStackNotFound2)) {
              throw err;
            }
          }
          return false;
        }),
      /**
       * Return a list of Cloudformation stacks with names matching a prefix
       * @param {string} stackPrefix
       * @returns {string[]}
       */
      getCfnStacks: (stackPrefix) =>
        __async(exports2, null, function* () {
          const cfn = new AWS26.CloudFormation();
          const resp = yield getPaginatedResponse2(
            cfn.describeStacks.bind(cfn),
            {},
            'Stacks',
          );
          return resp.filter((s) => {
            return s.StackName.startsWith(stackPrefix);
          });
        }),
      /**
       * Returns an array of objects representing a Cloudformation stack's exports
       * @param {string} stackName
       * @returns {object[]}
       */
      getCfnStackExports: (stackName) =>
        __async(exports2, null, function* () {
          const cnf = new AWS26.CloudFormation();
          let exports3;
          try {
            const resp = yield cnf
              .describeStacks({
                StackName: stackName,
              })
              .promise();
            if (resp.Stacks === void 0 || !resp.Stacks.length) {
              throw new CfnStackNotFound2(`Unable to find stack ${stackName}`);
            }
            exports3 = resp.Stacks[0].Outputs.reduce((obj, output) => {
              if (output.ExportName === void 0) {
                return __spreadValues({}, obj);
              }
              const outputKey = camelCase2(
                output.ExportName.replace(`${stackName}-`, ''),
              );
              return __spreadProps(__spreadValues({}, obj), {
                [outputKey]: output.OutputValue,
              });
            }, {});
          } catch (err) {
            if (err.message.includes('does not exist')) {
              throw new CfnStackNotFound2(
                `Cloudformation stack ${stackName} does not exist`,
              );
            }
            throw err;
          }
          return exports3;
        }),
      /**
       * Fetch data on available ACM certificates
       * @returns {object[]}
       */
      getAcmCertList: () =>
        __async(exports2, null, function* () {
          const acm = new AWS26.ACM();
          return getPaginatedResponse2(
            acm.listCertificates.bind(acm),
            {},
            'CertificateSummaryList',
          );
        }),
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
      execTask: (execOptions) =>
        __async(exports2, null, function* () {
          const ecs = new AWS26.ECS();
          const {
            clusterName,
            serviceName,
            taskDefName,
            command,
            environment = [],
          } = execOptions;
          const service = yield aws.getService(clusterName, serviceName);
          const { networkConfiguration } = service;
          const execResp = yield ecs
            .runTask({
              cluster: clusterName,
              taskDefinition: taskDefName,
              networkConfiguration,
              launchType: 'FARGATE',
              platformVersion: '1.3.0',
              overrides: {
                containerOverrides: [
                  {
                    name: 'AppOnlyContainer',
                    command: ['/bin/sh', '-c', command],
                    environment,
                  },
                ],
              },
            })
            .promise();
          return execResp.tasks[0].taskArn;
        }),
      /**
       * Fetches the data for an ECS service
       * @param {string} cluster
       * @param {string} service
       * @returns {object}
       */
      getService: (cluster, service) =>
        __async(exports2, null, function* () {
          const ecs = new AWS26.ECS();
          const resp = yield ecs
            .describeServices({
              cluster,
              services: [service],
            })
            .promise();
          if (!resp.services) {
            throw new Error(`service ${service} not found`);
          }
          return resp.services[0];
        }),
      /**
       * Fetches the data for an ECS task definition
       * @param {string} taskDefName
       * @returns {string}
       */
      getTaskDefinition: (taskDefName) =>
        __async(exports2, null, function* () {
          const ecs = new AWS26.ECS();
          const resp = yield ecs
            .describeTaskDefinition({
              taskDefinition: taskDefName,
            })
            .promise();
          if (resp.taskDefinition === void 0) {
            throw new Error(`task def ${taskDefName} not found`);
          }
          return resp.taskDefinition;
        }),
      /**
       * Updates a Fargate task definition, replacing the app container's
       *   ECR image URI value
       * @param {string} taskDefName
       * @param {string} imageArn
       * @returns {string} - the full ARN (incl family:revision) of the newly
       *   registered task definition
       */
      updateTaskDefAppImage: (taskDefName, imageArn, containerDefName) =>
        __async(exports2, null, function* () {
          const ecs = new AWS26.ECS();
          const taskDefinition = yield aws.getTaskDefinition(taskDefName);
          const tagResp = yield ecs
            .listTagsForResource({
              resourceArn: taskDefinition.taskDefinitionArn,
            })
            .promise();
          const containerIdx = taskDefinition.containerDefinitions.findIndex(
            (cd) => {
              return cd.name === containerDefName;
            },
          );
          const newImageId = aws.ecrArnToImageId(imageArn);
          const newTaskDef = JSON.parse(JSON.stringify(taskDefinition));
          newTaskDef.containerDefinitions[containerIdx].image = newImageId;
          newTaskDef.tags = tagResp.tags;
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
          const registerResp = yield ecs
            .registerTaskDefinition(newTaskDef)
            .promise();
          console.log('done');
          return registerResp.taskDefinition.taskDefinitionArn;
        }),
      /**
       * Restart an app's ECS service
       * @param {string} cluster
       * @param {string} service
       * @param {boolean} wait
       */
      restartEcsService: (cluster, service, restartOpts) =>
        __async(exports2, null, function* () {
          const { newTaskDefArn, wait } = restartOpts;
          const ecs = new AWS26.ECS();
          console.log(
            [
              'Console link for monitoring: ',
              `https://console.aws.amazon.com/ecs/home?region=${aws.getCurrentRegion()}`,
              `#/clusters/${cluster}/`,
              `services/${service}/tasks`,
            ].join(''),
          );
          const updateServiceParams = {
            cluster,
            service,
            forceNewDeployment: true,
          };
          if (newTaskDefArn) {
            updateServiceParams.taskDefinition = newTaskDefArn;
          }
          yield ecs.updateService(updateServiceParams).promise();
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
            yield sleep2(__pow(2, counter) * 1e3);
          }
          console.log('all done!');
        }),
      sendSSHPublicKey: (opts) =>
        __async(exports2, null, function* () {
          const { instanceAz, instanceId, sshKeyPath } = opts;
          const ec2ic = new AWS26.EC2InstanceConnect();
          const resp = yield ec2ic
            .sendSSHPublicKey({
              AvailabilityZone: instanceAz,
              InstanceId: instanceId,
              InstanceOSUser: aws.EC2_INSTANCE_CONNECT_USER,
              SSHPublicKey: readFile2(sshKeyPath),
            })
            .promise();
          return resp;
        }),
    };
    var getAssumedRoleClient = (ClientClass) =>
      __async(exports2, null, function* () {
        const client = new ClientClass();
        if (
          assumedRoleArn === void 0 ||
          assumedRoleArn.includes(yield aws.getAccountId())
        ) {
          return client;
        }
        if (assumedRoleCredentials === void 0) {
          const sts = new AWS26.STS();
          const resp = yield sts
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
      });
    var getPaginatedResponse2 = (func, params, itemKey) =>
      __async(exports2, null, function* () {
        const items = [];
        function getItems(nextTokenArg) {
          return __async(this, null, function* () {
            const paramsCopy = __spreadValues({}, params);
            if (nextTokenArg !== void 0) {
              paramsCopy.NextToken = nextTokenArg;
            }
            const resp = yield func(paramsCopy).promise();
            if (itemKey in resp) {
              items.push(...resp[itemKey]);
            }
            if (resp.NextToken !== void 0) {
              yield getItems(resp.NextToken);
            }
          });
        }
        yield getItems();
        return items;
      });
    module2.exports = aws;
  },
});

// src/cli.ts
var import_chalk4 = __toESM(require('chalk'));
var import_figlet3 = __toESM(require('figlet'));

// src/aws/classes/AssumedRole.ts
var import_aws_sdk2 = __toESM(require('aws-sdk'));

// src/aws/helpers/getAccountId.ts
var import_aws_sdk = __toESM(require('aws-sdk'));

// src/shared/errors/CacclDeployError.ts
var CacclDeployError = class extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
  }
};
var CacclDeployError_default = CacclDeployError;

// src/shared/errors/AwsAccountNotFound.ts
var AwsAccountNotFound = class extends CacclDeployError_default {};
var AwsAccountNotFound_default = AwsAccountNotFound;

// src/aws/helpers/getAccountId.ts
var getAccountId = () =>
  __async(void 0, null, function* () {
    const sts = new import_aws_sdk.default.STS();
    const identity = yield sts.getCallerIdentity({}).promise();
    const accountId = identity.Account;
    if (!accountId) {
      throw new AwsAccountNotFound_default(
        'Could not retrieve users account ID.',
      );
    }
    return accountId;
  });
var getAccountId_default = getAccountId;

// src/aws/classes/AssumedRole.ts
var AssumedRole = class {
  constructor() {
    this.assumedRoleArn = void 0;
  }
  /**
   * Set an IAM role for AWS clients to assume
   * @param {string} roleArn
   */
  setAssumedRoleArn(roleArn) {
    this.assumedRoleArn = roleArn;
  }
  /**
   * Returns an AWS service client that has been reconfigured with
   * temporary credentials from assuming an IAM role
   * @param {class} ClientClass
   * @returns {object}
   */
  getAssumedRoleClient(ClientClass) {
    return __async(this, null, function* () {
      const client = new ClientClass();
      if (
        this.assumedRoleArn === void 0 ||
        this.assumedRoleArn.includes(yield getAccountId_default())
      ) {
        return client;
      }
      if (this.assumedRoleCredentials === void 0) {
        const sts = new import_aws_sdk2.default.STS();
        const resp = yield sts
          .assumeRole({
            RoleArn: this.assumedRoleArn,
            RoleSessionName: 'caccl-deploy-assume-role-session',
          })
          .promise();
        const credentials = resp.Credentials;
        if (!credentials) {
          throw new Error(
            `Could not retrieve credentials for assumed role: ${this.assumedRoleArn}`,
          );
        }
        this.assumedRoleCredentials = credentials;
      }
      client.config.update({
        accessKeyId: this.assumedRoleCredentials.AccessKeyId,
        secretAccessKey: this.assumedRoleCredentials.SecretAccessKey,
        sessionToken: this.assumedRoleCredentials.SessionToken,
      });
      return client;
    });
  }
};
var AssumedRole_default = AssumedRole;

// src/aws/constants/EC2_INSTANCE_CONNECT_USER.ts
var EC2_INSTANCE_CONNECT_USER = 'ec2-user';
var EC2_INSTANCE_CONNECT_USER_default = EC2_INSTANCE_CONNECT_USER;

// src/aws/helpers/getCfnStackExports.ts
var import_aws_sdk3 = __toESM(require('aws-sdk'));
var import_camel_case = require('camel-case');

// src/shared/errors/CfnStackNotFound.ts
var CfnStackNotFound = class extends CacclDeployError_default {};
var CfnStackNotFound_default = CfnStackNotFound;

// src/aws/helpers/getCfnStackExports.ts
var getCfnStackExports = (stackName) =>
  __async(void 0, null, function* () {
    const cnf = new import_aws_sdk3.default.CloudFormation();
    let exports2 = {};
    try {
      const resp = yield cnf
        .describeStacks({
          StackName: stackName,
        })
        .promise();
      if (
        resp.Stacks === void 0 ||
        !resp.Stacks.length ||
        !resp.Stacks[0].Outputs
      ) {
        throw new CfnStackNotFound_default(`Unable to find stack ${stackName}`);
      }
      exports2 = resp.Stacks[0].Outputs.reduce((obj, output) => {
        if (!output.ExportName || !output.OutputValue) {
          return __spreadValues({}, obj);
        }
        const outputKey = (0, import_camel_case.camelCase)(
          output.ExportName.replace(`${stackName}-`, ''),
        );
        return __spreadProps(__spreadValues({}, obj), {
          [outputKey]: output.OutputValue,
        });
      }, {});
    } catch (err) {
      if (err instanceof Error && err.message.includes('does not exist')) {
        throw new CfnStackNotFound_default(
          `Cloudformation stack ${stackName} does not exist`,
        );
      }
      throw err;
    }
    return exports2;
  });
var getCfnStackExports_default = getCfnStackExports;

// src/aws/helpers/cfnStackExists.ts
var cfnStackExists = (stackName) =>
  __async(void 0, null, function* () {
    try {
      yield getCfnStackExports_default(stackName);
      return true;
    } catch (err) {
      if (!(err instanceof CfnStackNotFound_default)) {
        throw err;
      }
    }
    return false;
  });
var cfnStackExists_default = cfnStackExists;

// src/aws/helpers/createEcrArn.ts
var createEcrArn = (ecrImage) => {
  return [
    'arn:aws:ecr',
    ecrImage.region,
    ecrImage.account,
    `repository/${ecrImage.repoName}`,
    ecrImage.imageTag,
  ].join(':');
};
var createEcrArn_default = createEcrArn;

// src/aws/helpers/deleteSecrets.ts
var import_aws_sdk4 = __toESM(require('aws-sdk'));
var deleteSecrets = (secretArns) =>
  __async(void 0, null, function* () {
    const sm = new import_aws_sdk4.default.SecretsManager();
    for (let i = 0; i < secretArns.length; i += 1) {
      yield sm
        .deleteSecret({
          SecretId: secretArns[i],
          ForceDeleteWithoutRecovery: true,
        })
        .promise();
      console.log(`secret ${secretArns[i]} deleted`);
    }
  });
var deleteSecrets_default = deleteSecrets;

// src/aws/helpers/deleteSsmParameters.ts
var import_aws_sdk5 = __toESM(require('aws-sdk'));
var deleteSsmParameters = (paramNames) =>
  __async(void 0, null, function* () {
    const ssm = new import_aws_sdk5.default.SSM();
    const maxParams = 10;
    let idx = 0;
    while (idx < paramNames.length) {
      const paramNamesSlice = paramNames.slice(idx, maxParams + idx);
      idx += maxParams;
      yield ssm
        .deleteParameters({
          Names: paramNamesSlice,
        })
        .promise();
      paramNamesSlice.forEach((name) => {
        console.log(`ssm parameter ${name} deleted`);
      });
    }
  });
var deleteSsmParameters_default = deleteSsmParameters;

// src/aws/helpers/parseEcrArn.ts
var parseEcrArn = (arn) => {
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
};
var parseEcrArn_default = parseEcrArn;

// src/aws/helpers/ecrArnToImageId.ts
var ecrArnToImageId = (arn) => {
  const parsedArn = parseEcrArn_default(arn);
  const host = [
    parsedArn.account,
    'dkr.ecr',
    parsedArn.region,
    'amazonaws.com',
  ].join('.');
  return `${host}/${parsedArn.repoName}:${parsedArn.imageTag}`;
};
var ecrArnToImageId_default = ecrArnToImageId;

// src/aws/helpers/execTask.ts
var import_aws_sdk7 = __toESM(require('aws-sdk'));

// src/aws/helpers/getService.ts
var import_aws_sdk6 = __toESM(require('aws-sdk'));
var getService = (cluster, service) =>
  __async(void 0, null, function* () {
    const ecs = new import_aws_sdk6.default.ECS();
    const resp = yield ecs
      .describeServices({
        cluster,
        services: [service],
      })
      .promise();
    if (!resp.services) {
      throw new Error(`service ${service} not found`);
    }
    return resp.services[0];
  });
var getService_default = getService;

// src/aws/helpers/execTask.ts
var execTask = (execOptions) =>
  __async(void 0, null, function* () {
    const ecs = new import_aws_sdk7.default.ECS();
    const {
      clusterName,
      serviceName,
      taskDefName,
      command,
      environment = [],
    } = execOptions;
    const service = yield getService_default(clusterName, serviceName);
    const { networkConfiguration } = service;
    const execResp = yield ecs
      .runTask({
        cluster: clusterName,
        taskDefinition: taskDefName,
        networkConfiguration,
        launchType: 'FARGATE',
        platformVersion: '1.3.0',
        overrides: {
          containerOverrides: [
            {
              name: 'AppOnlyContainer',
              command: ['/bin/sh', '-c', command],
              environment,
            },
          ],
        },
      })
      .promise();
    if (!execResp.tasks) return void 0;
    return execResp.tasks[0].taskArn;
  });
var execTask_default = execTask;

// src/aws/helpers/getAcmCertList.ts
var import_aws_sdk8 = __toESM(require('aws-sdk'));

// src/aws/helpers/getPaginatedResponse.ts
var getPaginatedResponse = (func, params, itemKey) =>
  __async(void 0, null, function* () {
    const items = [];
    function getItems(nextTokenArg) {
      return __async(this, null, function* () {
        const paramsCopy = __spreadValues({}, params);
        if (nextTokenArg !== void 0) {
          paramsCopy.NextToken = nextTokenArg;
        }
        const resp = yield func(paramsCopy).promise();
        if (itemKey in resp) {
          items.push(...resp[itemKey]);
        }
        if (resp.NextToken !== void 0) {
          yield getItems(resp.NextToken);
        }
      });
    }
    yield getItems();
    return items;
  });
var getPaginatedResponse_default = getPaginatedResponse;

// src/aws/helpers/getAcmCertList.ts
var getAcmCertList = () =>
  __async(void 0, null, function* () {
    const acm = new import_aws_sdk8.default.ACM();
    return getPaginatedResponse_default(
      acm.listCertificates.bind(acm),
      {},
      'CertificateSummaryList',
    );
  });
var getAcmCertList_default = getAcmCertList;

// src/aws/helpers/getAppList.ts
var import_aws_sdk9 = __toESM(require('aws-sdk'));
var getAppList = (prefix) =>
  __async(void 0, null, function* () {
    const ssm = new import_aws_sdk9.default.SSM();
    const searchParams = {
      MaxResults: 50,
      // lord i hope we never have this many apps
      ParameterFilters: [
        {
          Key: 'Name',
          Option: 'Contains',
          // making an assumption that all configurations will include this
          Values: ['/infraStackName'],
        },
      ],
    };
    const paramEntries = yield getPaginatedResponse_default(
      ssm.describeParameters.bind(ssm),
      searchParams,
      'Parameters',
    );
    return paramEntries.flatMap((param) => {
      if (!param.Name || param.Name.startsWith(prefix)) return [];
      return param.Name.split('/')[2];
    });
  });
var getAppList_default = getAppList;

// src/aws/helpers/getCfnStacks.ts
var import_aws_sdk10 = __toESM(require('aws-sdk'));
var getCfnStacks = (stackPrefix) =>
  __async(void 0, null, function* () {
    const cfn = new import_aws_sdk10.default.CloudFormation();
    const resp = yield getPaginatedResponse_default(
      cfn.describeStacks.bind(cfn),
      {},
      'Stacks',
    );
    return resp.filter((s) => {
      return s.StackName.startsWith(stackPrefix);
    });
  });
var getCfnStacks_default = getCfnStacks;

// src/aws/helpers/getCurrentRegion.ts
var import_aws_sdk11 = __toESM(require('aws-sdk'));
var getCurrentRegion = () => {
  const { region } = import_aws_sdk11.default.config;
  if (!region) {
    throw new Error('Could not get current AWS region.');
  }
  return region;
};
var getCurrentRegion_default = getCurrentRegion;

// src/aws/helpers/getInfraStackList.ts
var import_aws_sdk12 = __toESM(require('aws-sdk'));
var getInfraStackList = () =>
  __async(void 0, null, function* () {
    const cfn = new import_aws_sdk12.default.CloudFormation();
    const stacks = yield getPaginatedResponse_default(
      cfn.describeStacks.bind(cfn),
      {},
      'Stacks',
    );
    return stacks.flatMap((stack) => {
      if (stack.Outputs) {
        const outputKeys = stack.Outputs.map((output) => {
          return output.OutputKey;
        });
        if (outputKeys.indexOf('InfraStackName') >= 0) {
          return stack.StackName;
        }
      }
      return [];
    });
  });
var getInfraStackList_default = getInfraStackList;

// src/aws/helpers/getRepoImageList.ts
var import_aws_sdk13 = __toESM(require('aws-sdk'));

// src/shared/helpers/looksLikeSemver.ts
var LOOKS_LIKE_SEMVER_REGEX = new RegExp(
  [
    '(?<Major>0|(?:[1-9]\\d*))',
    '(?:\\.(?<Minor>0|(?:[1-9]\\d*))',
    '(?:\\.(?<Patch>0|(?:[1-9]\\d*))))',
  ].join(''),
);
var looksLikeSemver = (str) => {
  return LOOKS_LIKE_SEMVER_REGEX.test(str);
};
var looksLikeSemver_default = looksLikeSemver;

// src/aws/helpers/getRepoImageList.ts
var getRepoImageList = (assumedRole, repo, all) =>
  __async(void 0, null, function* () {
    const ecr = yield assumedRole.getAssumedRoleClient(
      import_aws_sdk13.default.ECR,
    );
    const images = yield getPaginatedResponse_default(
      ecr.describeImages.bind(ecr),
      {
        repositoryName: repo,
        maxResults: 1e3,
        filter: {
          tagStatus: 'TAGGED',
        },
      },
      'imageDetails',
    );
    images.sort((a, b) => {
      if (!a.imagePushedAt) return 1;
      if (!b.imagePushedAt) return -1;
      if (a.imagePushedAt < b.imagePushedAt) {
        return 1;
      }
      if (a.imagePushedAt > b.imagePushedAt) {
        return -1;
      }
      return 0;
    });
    if (!all) {
      return images.filter((i) => {
        if (!i.imageTags) return false;
        return i.imageTags.some((t) => {
          return (
            looksLikeSemver_default(t) ||
            ['main', 'master', 'stage'].includes(t)
          );
        });
      });
    }
    return images;
  });
var getRepoImageList_default = getRepoImageList;

// src/aws/helpers/getRepoList.ts
var import_aws_sdk14 = __toESM(require('aws-sdk'));
var getRepoList = (assumedRole) =>
  __async(void 0, null, function* () {
    const ecr = yield assumedRole.getAssumedRoleClient(
      import_aws_sdk14.default.ECR,
    );
    const repos = yield getPaginatedResponse_default(
      ecr.describeRepositories.bind(ecr),
      {},
      'repositories',
    );
    const unflattenedRes = yield Promise.all(
      repos.map((repo) =>
        __async(void 0, null, function* () {
          const emptyArr = [];
          if (!repo.repositoryArn) return emptyArr;
          const tagResp = yield ecr
            .listTagsForResource({
              resourceArn: repo.repositoryArn,
            })
            .promise();
          if (!tagResp.tags) return emptyArr;
          const isAnEdtechAppRepo = tagResp.tags.some((t) => {
            return t.Key === 'product' && t.Value === 'edtech-apps';
          });
          if (isAnEdtechAppRepo && repo.repositoryName) {
            return [repo.repositoryName];
          }
          return emptyArr;
        }),
      ),
    );
    return unflattenedRes.flat();
  });
var getRepoList_default = getRepoList;

// src/aws/helpers/getSsmParametersByPrefix.ts
var import_aws_sdk15 = __toESM(require('aws-sdk'));
var getSsmParametersByPrefix = (prefix) =>
  __async(void 0, null, function* () {
    const ssm = new import_aws_sdk15.default.SSM();
    yield ssm.getParametersByPath().promise();
    return getPaginatedResponse_default(
      ssm.getParametersByPath.bind(ssm),
      {
        Path: prefix,
        Recursive: true,
      },
      'Parameters',
    );
  });
var getSsmParametersByPrefix_default = getSsmParametersByPrefix;

// src/aws/helpers/getTaskDefinition.ts
var import_aws_sdk16 = __toESM(require('aws-sdk'));
var getTaskDefinition = (taskDefName) =>
  __async(void 0, null, function* () {
    const ecs = new import_aws_sdk16.default.ECS();
    const resp = yield ecs
      .describeTaskDefinition({
        taskDefinition: taskDefName,
      })
      .promise();
    if (resp.taskDefinition === void 0) {
      throw new Error(`task def ${taskDefName} not found`);
    }
    return resp.taskDefinition;
  });
var getTaskDefinition_default = getTaskDefinition;

// src/aws/helpers/imageTagExists.ts
var imageTagExists = (assumedRole, repoName, tag) =>
  __async(void 0, null, function* () {
    const imageList = yield getRepoImageList_default(
      assumedRole,
      repoName,
      true,
    );
    return imageList.some((i) => {
      if (!i.imageTags) return false;
      return i.imageTags.includes(tag);
    });
  });
var imageTagExists_default = imageTagExists;

// src/aws/helpers/initProfile.ts
var import_aws_sdk17 = __toESM(require('aws-sdk'));
var import_shared_ini = require('aws-sdk/lib/shared-ini');

// src/shared/errors/AwsProfileNotFound.ts
var AwsProfileNotFound = class extends CacclDeployError_default {};
var AwsProfileNotFound_default = AwsProfileNotFound;

// src/aws/helpers/initProfile.ts
var initProfile = (profileName) => {
  const awsCredentials = import_shared_ini.iniLoader.loadFrom({});
  if (awsCredentials[profileName] === void 0) {
    throw new AwsProfileNotFound_default(
      `Tried to init a non-existent profile: '${profileName}'`,
    );
  }
  const profileCreds = awsCredentials[profileName];
  import_aws_sdk17.default.config.update({
    credentials: new import_aws_sdk17.default.Credentials({
      accessKeyId: profileCreds.aws_access_key_id,
      secretAccessKey: profileCreds.aws_secret_access_key,
    }),
  });
};
var initProfile_default = initProfile;

// src/aws/helpers/isConfigured.ts
var import_aws_sdk18 = __toESM(require('aws-sdk'));
var isConfigured = () => {
  try {
    return [
      import_aws_sdk18.default,
      import_aws_sdk18.default.config.credentials,
      import_aws_sdk18.default.config.region,
    ].every((thing) => {
      return thing !== void 0 && thing !== null;
    });
  } catch (err) {
    return false;
  }
};
var isConfigured_default = isConfigured;

// src/aws/helpers/isLatestTag.ts
var isLatestTag = (assumedRole, repoName, tag) =>
  __async(void 0, null, function* () {
    const imageList = yield getRepoImageList_default(assumedRole, repoName);
    return (
      !!imageList.length &&
      !!imageList[0].imageTags &&
      imageList[0].imageTags.includes(tag)
    );
  });
var isLatestTag_default = isLatestTag;

// src/aws/helpers/putSecret.ts
var import_aws_sdk20 = __toESM(require('aws-sdk'));

// src/aws/helpers/secretExists.ts
var import_aws_sdk19 = __toESM(require('aws-sdk'));
var secretExists = (secretName) =>
  __async(void 0, null, function* () {
    const sm = new import_aws_sdk19.default.SecretsManager();
    const params = {
      Filters: [
        {
          Key: 'name',
          Values: [secretName],
        },
      ],
    };
    const resp = yield sm.listSecrets(params).promise();
    return !!resp.SecretList && resp.SecretList.length > 0;
  });
var secretExists_default = secretExists;

// src/shared/errors/ExistingSecretWontDelete.ts
var ExistingSecretWontDelete = class extends CacclDeployError_default {};
var ExistingSecretWontDelete_default = ExistingSecretWontDelete;

// src/shared/errors/SecretNotCreated.ts
var SecretNotCreated = class extends CacclDeployError_default {};
var SecretNotCreated_default = SecretNotCreated;

// src/shared/helpers/sleep.ts
var sleep = (ms) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};
var sleep_default = sleep;

// src/aws/helpers/putSecret.ts
var putSecret = (secretOpts, tags, retries = 0) =>
  __async(void 0, null, function* () {
    const sm = new import_aws_sdk20.default.SecretsManager();
    const { Name: SecretId, Description, SecretString } = secretOpts;
    let secretResp;
    try {
      const exists = yield secretExists_default(SecretId);
      if (exists) {
        secretResp = yield sm
          .updateSecret({
            SecretId,
            Description,
            SecretString,
          })
          .promise();
        console.log(`secretsmanager entry ${SecretId} updated`);
        if (tags.length) {
          yield sm
            .tagResource({
              SecretId,
              Tags: tags,
            })
            .promise();
          console.log(`secretsmanager entry ${SecretId} tagged`);
        }
      } else {
        secretResp = yield sm
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
      if (!(err instanceof Error)) throw err;
      if (err.message.includes('already scheduled for deletion')) {
        if (retries < 5) {
          retries += 1;
          yield sleep_default(__pow(2, retries) * 1e3);
          return putSecret(secretOpts, tags, retries);
        }
        console.error('putSecret failed after 5 retries');
        throw new ExistingSecretWontDelete_default(
          `Failed to overwrite existing secret ${SecretId}`,
        );
      }
      throw err;
    }
    if (!secretResp.ARN)
      throw new SecretNotCreated_default(`Could not create secret ${SecretId}`);
    return secretResp.ARN;
  });
var putSecret_default = putSecret;

// src/aws/helpers/putSsmParameter.ts
var import_aws_sdk21 = __toESM(require('aws-sdk'));
var putSsmParameter = (_0, ..._1) =>
  __async(void 0, [_0, ..._1], function* (opts, tags = []) {
    const ssm = new import_aws_sdk21.default.SSM();
    const paramOptions = __spreadValues({}, opts);
    const paramResp = yield ssm.putParameter(paramOptions).promise();
    if (tags.length) {
      yield ssm
        .addTagsToResource({
          ResourceId: paramOptions.Name,
          ResourceType: 'Parameter',
          Tags: tags,
        })
        .promise();
    }
    return paramResp;
  });
var putSsmParameter_default = putSsmParameter;

// src/aws/helpers/resolveSecret.ts
var import_aws_sdk22 = __toESM(require('aws-sdk'));

// src/shared/errors/SecretNotFound.ts
var SecretNotFound = class extends CacclDeployError_default {};
var SecretNotFound_default = SecretNotFound;

// src/aws/helpers/resolveSecret.ts
var resolveSecret = (secretArn) =>
  __async(void 0, null, function* () {
    const sm = new import_aws_sdk22.default.SecretsManager();
    const resp = yield sm
      .getSecretValue({
        SecretId: secretArn,
      })
      .promise();
    if (!resp.SecretString)
      throw new SecretNotFound_default(
        `Could not find value for secret: arn=${secretArn}`,
      );
    return resp.SecretString;
  });
var resolveSecret_default = resolveSecret;

// src/aws/helpers/restartEcsService.ts
var import_aws_sdk23 = __toESM(require('aws-sdk'));
var restartEcsService = (restartOpts) =>
  __async(void 0, null, function* () {
    const { cluster, service, newTaskDefArn, wait } = restartOpts;
    const ecs = new import_aws_sdk23.default.ECS();
    console.log(
      [
        'Console link for monitoring: ',
        `https://console.aws.amazon.com/ecs/home?region=${getCurrentRegion_default()}`,
        `#/clusters/${cluster}/`,
        `services/${service}/tasks`,
      ].join(''),
    );
    const updateServiceParams = {
      cluster,
      service,
      forceNewDeployment: true,
    };
    if (newTaskDefArn) {
      updateServiceParams.taskDefinition = newTaskDefArn;
    }
    yield ecs.updateService(updateServiceParams).promise();
    if (!wait) {
      return;
    }
    let allDone = false;
    yield ecs
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
      yield sleep_default(__pow(2, counter) * 1e3);
    }
    console.log('all done!');
  });
var restartEcsService_default = restartEcsService;

// src/aws/helpers/sendSSHPublicKey.ts
var import_aws_sdk24 = __toESM(require('aws-sdk'));

// src/shared/helpers/readFile.ts
var import_fs = __toESM(require('fs'));
var import_path = __toESM(require('path'));
var readFile = (filePath) => {
  const resolvedPath = import_path.default.resolve(filePath);
  return import_fs.default.readFileSync(resolvedPath, 'utf8');
};
var readFile_default = readFile;

// src/aws/helpers/sendSSHPublicKey.ts
var sendSSHPublicKey = (opts) =>
  __async(void 0, null, function* () {
    const { instanceAz, instanceId, sshKeyPath } = opts;
    const ec2ic = new import_aws_sdk24.default.EC2InstanceConnect();
    const resp = yield ec2ic
      .sendSSHPublicKey({
        AvailabilityZone: instanceAz,
        InstanceId: instanceId,
        InstanceOSUser: EC2_INSTANCE_CONNECT_USER_default,
        SSHPublicKey: readFile_default(sshKeyPath),
      })
      .promise();
    return resp;
  });
var sendSSHPublicKey_default = sendSSHPublicKey;

// src/aws/helpers/updateTaskDefAppImage.ts
var import_aws_sdk25 = __toESM(require('aws-sdk'));
var updateTaskDefAppImage = (taskDefName, imageArn, containerDefName) =>
  __async(void 0, null, function* () {
    var _a;
    const ecs = new import_aws_sdk25.default.ECS();
    const taskDefinition = yield getTaskDefinition_default(taskDefName);
    if (!taskDefinition.taskDefinitionArn)
      throw new Error('Could not get task definition ARN');
    const tagResp = yield ecs
      .listTagsForResource({
        resourceArn: taskDefinition.taskDefinitionArn,
      })
      .promise();
    if (!taskDefinition.containerDefinitions)
      throw new Error('Could not retrieve container definitions');
    const containerIdx = taskDefinition.containerDefinitions.findIndex((cd) => {
      return cd.name === containerDefName;
    });
    const newImageId = ecrArnToImageId_default(imageArn);
    const newTaskDef = JSON.parse(JSON.stringify(taskDefinition));
    newTaskDef.containerDefinitions[containerIdx].image = newImageId;
    newTaskDef.tags = tagResp.tags;
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
    const registerResp = yield ecs.registerTaskDefinition(newTaskDef).promise();
    console.log('done');
    return (_a = registerResp.taskDefinition) == null
      ? void 0
      : _a.taskDefinitionArn;
  });
var updateTaskDefAppImage_default = updateTaskDefAppImage;

// src/aws/index.ts
process.env.AWS_SDK_LOAD_CONFIG = '1';

// src/commands/operations/appsOperation.ts
var import_table = require('table');

// src/deployConfig/index.ts
var import_flat2 = __toESM(require('flat'));
var import_object_hash = require('object-hash');

// types/CacclCacheOptions.ts
var import_zod = require('zod');
var CacclCacheOptions = import_zod.z.object({
  engine: import_zod.z.string(),
  numCacheNodes: import_zod.z.number().optional(),
  cacheNodeType: import_zod.z.string().optional(),
});
var CacclCacheOptions_default = CacclCacheOptions;

// types/CacclDbEngine.ts
var import_zod2 = require('zod');
var CacclDbEngine = import_zod2.z.enum(['docdb', 'mysql']);
var CacclDbEngine_default = CacclDbEngine;

// types/CacclDbOptions.ts
var import_zod3 = require('zod');
var CacclDbOptions = import_zod3.z.object({
  // currently either 'docdb' or 'mysql'
  engine: CacclDbEngine_default,
  // see the aws docs for supported types
  instanceType: import_zod3.z.string().optional(),
  // > 1 will get you multi-az
  instanceCount: import_zod3.z.number().optional(),
  // use a non-default engine version (shouldn't be necessary)
  engineVersion: import_zod3.z.string().optional(),
  // use a non-default parameter group family (also unnecessary)
  parameterGroupFamily: import_zod3.z.string().optional(),
  // only used by docdb, turns on extra profiling
  profiler: import_zod3.z.boolean().optional(),
  // only used by mysql, provisioning will create the named database
  databaseName: import_zod3.z.string().optional(),
  // removal policy controls what happens to the db if it's replaced or otherwise stops being managed by CloudFormation
  removalPolicy: import_zod3.z.string().optional(),
});
var CacclDbOptions_default = CacclDbOptions;

// types/CacclDeployStackPropsData.ts
var import_zod8 = require('zod');

// types/DeployConfigData.ts
var import_zod7 = require('zod');

// types/CacclLoadBalancerExtraOptions.ts
var import_zod4 = require('zod');
var CacclLoadBalancerExtraOptions = import_zod4.z.object({
  healthCheckPath: import_zod4.z.string().optional(),
  targetDeregistrationDelay: import_zod4.z.number().optional(),
});
var CacclLoadBalancerExtraOptions_default = CacclLoadBalancerExtraOptions;

// types/CacclNotificationsProps.ts
var import_zod5 = require('zod');
var CacclNotificationsProps = import_zod5.z.object({
  email: import_zod5.z
    .union([import_zod5.z.string(), import_zod5.z.string().array()])
    .optional(),
  slack: import_zod5.z.string().optional(),
});
var CacclNotificationsProps_default = CacclNotificationsProps;

// types/CacclScheduledTask.ts
var import_zod6 = require('zod');
var CacclScheduledTask = import_zod6.z.object({
  description: import_zod6.z.string().optional(),
  schedule: import_zod6.z.string(),
  command: import_zod6.z.string(),
});
var CacclScheduledTask_default = CacclScheduledTask;

// types/DeployConfigData.ts
var DeployConfigData = import_zod7.z.object({
  //
  appImage: import_zod7.z.string(),
  proxyImage: import_zod7.z.string().optional(),
  taskCpu: import_zod7.z.number().optional(),
  taskMemory: import_zod7.z.number().optional(),
  logRetentionDays: import_zod7.z.number().optional(),
  gitRepoVolume: import_zod7.z
    .object({})
    .catchall(import_zod7.z.string())
    .optional(),
  // CloudFormation infrastructure stack name
  infraStackName: import_zod7.z.string(),
  // Container image ARN
  notifications: CacclNotificationsProps_default.optional(),
  certificateArn: import_zod7.z.string().optional(),
  appEnvironment: import_zod7.z
    .object({})
    .catchall(import_zod7.z.string())
    .optional(),
  tags: import_zod7.z.object({}).catchall(import_zod7.z.string()).optional(),
  scheduledTasks: import_zod7.z
    .object({})
    .catchall(CacclScheduledTask_default)
    .optional(),
  taskCount: import_zod7.z.string(),
  firewallSgId: import_zod7.z.string().optional(),
  lbOptions: CacclLoadBalancerExtraOptions_default.optional(),
  cacheOptions: CacclCacheOptions_default.optional(),
  dbOptions: CacclDbOptions_default.optional(),
  enableExecuteCommand: import_zod7.z
    .union([import_zod7.z.string(), import_zod7.z.boolean()])
    .optional(),
  // DEPRECATED:
  docDb: import_zod7.z.any(),
  docDbInstanceCount: import_zod7.z.number().optional(),
  docDbInstanceType: import_zod7.z.string().optional(),
  docDbProfiler: import_zod7.z.boolean().optional(),
});
var DeployConfigData_default = DeployConfigData;

// types/CacclDeployStackPropsData.ts
var CacclDeployStackPropsData = import_zod8.z.object({
  stackName: import_zod8.z.string(),
  vpcId: import_zod8.z.string().optional(),
  ecsClusterName: import_zod8.z.string().optional(),
  albLogBucketName: import_zod8.z.string().optional(),
  awsRegion: import_zod8.z.string().optional(),
  awsAccountId: import_zod8.z.string().optional(),
  cacclDeployVersion: import_zod8.z.string(),
  deployConfigHash: import_zod8.z.string(),
  deployConfig: DeployConfigData_default,
});

// src/deployConfig/helpers/create.ts
var create = (data) => {
  return DeployConfigData_default.parse(data);
};
var create_default = create;

// src/deployConfig/helpers/fromFlattened.ts
var import_flat = __toESM(require('flat'));
var fromFlattened = (flattenedData) => {
  const unflattened = import_flat.default.unflatten(flattenedData, {
    delimiter: '/',
  });
  return create_default(unflattened);
};
var fromFlattened_default = fromFlattened;

// src/deployConfig/helpers/wipeConfig.ts
var wipeConfig = (ssmPrefix, flattenedConfig) =>
  __async(void 0, null, function* () {
    const paramsToDelete = Object.keys(flattenedConfig).map((k) => {
      return `${ssmPrefix}/${k}`;
    });
    const secretsToDelete = Object.values(flattenedConfig).reduce((arns, v) => {
      if (v.toString().startsWith('arn:aws:secretsmanager')) {
        arns.push(v);
      }
      return arns;
    }, []);
    yield deleteSsmParameters_default(paramsToDelete);
    yield deleteSecrets_default(secretsToDelete);
  });
var wipeConfig_default = wipeConfig;

// src/configPrompts/prompt.ts
var import_prompts = __toESM(require('prompts'));

// src/shared/errors/UserCancel.ts
var UserCancel = class extends CacclDeployError_default {};
var UserCancel_default = UserCancel;

// src/configPrompts/prompt.ts
var prompt = (question, continueOnCancel) =>
  __async(void 0, null, function* () {
    return (0, import_prompts.default)(question, {
      onCancel: () => {
        if (!continueOnCancel) {
          throw new UserCancel_default('');
        }
      },
    });
  });
var prompt_default = prompt;

// src/configPrompts/confirm.ts
var confirm = (message, defaultsToYes) =>
  __async(void 0, null, function* () {
    const response = yield prompt_default({
      type: 'confirm',
      name: 'yesorno',
      initial: defaultsToYes,
      message,
    });
    return response.yesorno;
  });
var confirm_default = confirm;

// src/configPrompts/confirmProductionOp.ts
var import_chalk = __toESM(require('chalk'));
var import_figlet = __toESM(require('figlet'));

// src/conf.ts
var import_conf = __toESM(require('conf'));
var confOpts = {
  schema: {
    ssmRootPrefix: {
      type: 'string',
    },
    ecrAccessRoleArn: {
      type: 'string',
    },
    cfnStackPrefix: {
      type: 'string',
    },
    productionAccounts: {
      type: 'array',
    },
  },
};
if (process.env.CACCL_DEPLOY_CONF_DIR !== void 0) {
  confOpts.cwd = process.env.CACCL_DEPLOY_CONF_DIR;
}
var conf = new import_conf.default(confOpts);
var configDefaults = {
  ssmRootPrefix: '/caccl-deploy',
  cfnStackPrefix: 'CacclDeploy-',
  productionAccounts: [],
};
var setConfigDefaults = () => {
  Object.entries(configDefaults).forEach(([k, v]) => {
    conf.set(k, v);
  });
};

// src/configPrompts/confirmProductionOp.ts
var confirmProductionOp = (yes) =>
  __async(void 0, null, function* () {
    if (yes) {
      return true;
    }
    const prodAccounts = conf.get('productionAccounts');
    if (prodAccounts === void 0 || !prodAccounts.length) {
      return true;
    }
    const accountId = yield getAccountId_default();
    if (!prodAccounts.includes(accountId)) {
      return true;
    }
    console.log(
      import_chalk.default.redBright(
        import_figlet.default.textSync('Production Account!'),
      ),
    );
    try {
      const ok = yield confirm_default(
        '\nPlease confirm you wish to proceed\n',
      );
      return ok;
    } catch (err) {
      if (err instanceof UserCancel_default) {
        return false;
      }
      throw err;
    }
  });
var confirmProductionOp_default = confirmProductionOp;

// src/shared/errors/NoPromptChoices.ts
var NoPromptChoices = class extends CacclDeployError_default {};
var NoPromptChoices_default = NoPromptChoices;

// src/configPrompts/promptAppImage.ts
var promptAppImage = (assumedRole) =>
  __async(void 0, null, function* () {
    const inputType = yield prompt_default({
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
        const inputString = yield prompt_default({
          type: 'text',
          name: 'value',
          message: 'Enter the image id',
        });
        appImage = inputString.value;
        break;
      }
      case 'select': {
        const repoList = yield getRepoList_default(assumedRole);
        const repoChoices = repoList.flatMap((value) => {
          if (!value) return [];
          return {
            title: value,
            value,
          };
        });
        if (!repoChoices.length) {
          throw new NoPromptChoices_default('No ECR repositories');
        }
        const repoChoice = yield prompt_default({
          type: 'select',
          name: 'value',
          message: 'Select the ECR repo',
          choices: repoChoices,
        });
        const images = yield getRepoImageList_default(
          assumedRole,
          repoChoice.value,
        );
        const imageTagsChoices = images.reduce((choices, image) => {
          const releaseTag =
            image.imageTags &&
            image.imageTags.find((tag) => {
              return looksLikeSemver_default(tag);
            });
          if (!releaseTag) return choices;
          if (!image.registryId) {
            throw new Error('Could not get ECR image registry ID.');
          }
          const appImageValue = createEcrArn_default({
            region: getCurrentRegion_default(),
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
          throw new NoPromptChoices_default(
            'No valid image tags to choose from',
          );
        }
        const imageTagChoice = yield prompt_default({
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
  });
var promptAppImage_default = promptAppImage;

// src/shared/helpers/validSSMParamName.ts
var validSSMParamName = (name) => {
  return /^([a-z0-9:/_-]+)$/i.test(name);
};
var validSSMParamName_default = validSSMParamName;

// src/configPrompts/promptAppName.ts
var promptAppName = () =>
  __async(void 0, null, function* () {
    const appName = yield prompt_default({
      type: 'text',
      name: 'value',
      message: 'Enter a name for your app',
      validate: (v) => {
        return !validSSMParamName_default(v)
          ? 'app name can only contain alphanumeric and/or the characters ".-_"'
          : true;
      },
    });
    return appName.value;
  });
var promptAppName_default = promptAppName;

// src/configPrompts/promptCertificateArn.ts
var promptCertificateArn = () =>
  __async(void 0, null, function* () {
    const certList = yield getAcmCertList_default();
    const certChoices = certList.flatMap((cert) => {
      if (!cert.DomainName || !cert.CertificateArn) return [];
      return {
        title: cert.DomainName,
        value: cert.CertificateArn,
      };
    });
    if (!certChoices.length) {
      throw new NoPromptChoices_default('No ACM certificates to choose from');
    }
    const certificateArn = yield prompt_default({
      type: 'select',
      name: 'value',
      message: 'Select the hostname associated with your ACM certificate',
      choices: certChoices,
    });
    return certificateArn.value;
  });
var promptCertificateArn_default = promptCertificateArn;

// src/configPrompts/promptInfraStackName.ts
var promptInfraStackName = () =>
  __async(void 0, null, function* () {
    const infraStacks = yield getInfraStackList_default();
    if (infraStacks.length === 1) {
      return infraStacks[0];
    }
    const infraStackChoices = infraStacks.map((value) => {
      return {
        title: value,
        value,
      };
    });
    if (!infraStackChoices.length) {
      throw new NoPromptChoices_default('No infrastructure stacks');
    }
    const infraStackName = yield prompt_default({
      type: 'select',
      name: 'value',
      message: 'Select a base infrastructure stack to deploy to',
      choices: infraStackChoices,
    });
    return infraStackName.value;
  });
var promptInfraStackName_default = promptInfraStackName;

// src/configPrompts/promptKeyValuePairs.ts
var promptKeyValuePairs = (_0, _1, ..._2) =>
  __async(void 0, [_0, _1, ..._2], function* (label, example, current = {}) {
    const pairs = __spreadValues({}, current);
    const displayList = [];
    Object.entries(pairs).forEach(([k, v]) => {
      displayList.push(`${k}=${v}`);
    });
    console.log(`Current ${label}(s):
${displayList.join('\n')}`);
    const newEntry = yield prompt_default({
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
      return promptKeyValuePairs(label, example, pairs);
    }
    return pairs;
  });
var promptKeyValuePairs_default = promptKeyValuePairs;

// src/shared/errors/AppNotFound.ts
var AppNotFound = class extends CacclDeployError_default {};
var AppNotFound_default = AppNotFound;

// src/shared/helpers/readJson.ts
var readJson = (filePath) => {
  return JSON.parse(readFile_default(filePath));
};
var readJson_default = readJson;

// src/deployConfig/index.ts
var DeployConfig;
((DeployConfig2) => {
  DeployConfig2.fromFile = (file) => {
    const configData = readJson_default(file);
    delete configData.appName;
    return create_default(configData);
  };
  DeployConfig2.fromUrl = (url) =>
    __async(void 0, null, function* () {
      const resp = yield fetch(url);
      const configData = yield resp.json();
      return create_default(configData);
    });
  DeployConfig2.fromSsmParams = (appPrefix, keepSecretArns) =>
    __async(void 0, null, function* () {
      const ssmParams = yield getSsmParametersByPrefix_default(appPrefix);
      if (!ssmParams.length) {
        throw new AppNotFound_default(
          `No configuration found using app prefix ${appPrefix}`,
        );
      }
      const flattened = {};
      for (let i = 0; i < ssmParams.length; i += 1) {
        const param = ssmParams[i];
        if (!param.Name || !param.Value) continue;
        const paramName = param.Name.split('/').slice(3).join('/');
        const value =
          keepSecretArns || !param.Value.startsWith('arn:aws:secretsmanager')
            ? param.Value
            : yield resolveSecret_default(param.Value);
        flattened[paramName] = value;
      }
      return fromFlattened_default(flattened);
    });
  DeployConfig2.generate = (_0, ..._1) =>
    __async(void 0, [_0, ..._1], function* (assumedRole, baseConfig = {}) {
      const newConfig = __spreadValues({}, baseConfig);
      if (newConfig.infraStackName === void 0) {
        newConfig.infraStackName = yield promptInfraStackName_default();
      }
      if (newConfig.certificateArn === void 0) {
        newConfig.certificateArn = yield promptCertificateArn_default();
      }
      if (newConfig.appImage === void 0) {
        newConfig.appImage = yield promptAppImage_default(assumedRole);
      }
      newConfig.tags = yield promptKeyValuePairs_default(
        'tag',
        'foo=bar',
        newConfig.tags,
      );
      newConfig.appEnvironment = yield promptKeyValuePairs_default(
        'env var',
        'FOOBAR=baz',
        newConfig.appEnvironment,
      );
      console.log('\nYour new config:\n');
      console.log(JSON.stringify(newConfig, null, 2));
      console.log('\n');
      return create_default(newConfig);
    });
  DeployConfig2.flatten = (deployConfig) => {
    return (0, import_flat2.default)(deployConfig, {
      delimiter: '/',
      safe: false,
    });
  };
  DeployConfig2.toString = (deployConfig, pretty, flattened) => {
    const output = flattened
      ? (0, DeployConfig2.flatten)(deployConfig)
      : deployConfig;
    return JSON.stringify(output, null, pretty ? '	' : '');
  };
  DeployConfig2.toHash = (deployConfig) => {
    return (0, import_object_hash.sha1)(deployConfig);
  };
  DeployConfig2.tagsForAws = (deployConfig) => {
    if (
      deployConfig.tags === void 0 ||
      !Object.keys(deployConfig.tags).length
    ) {
      return [];
    }
    return Object.entries(deployConfig.tags).map(([Key, Value]) => {
      return { Key, Value };
    });
  };
  DeployConfig2.syncToSsm = (deployConfig, appPrefix, params) =>
    __async(void 0, null, function* () {
      const flattened =
        params === void 0 ? (0, DeployConfig2.flatten)(deployConfig) : params;
      const paramEntries = Object.entries(flattened);
      const awsTags = (0, DeployConfig2.tagsForAws)(deployConfig);
      for (let i = 0; i < paramEntries.length; i += 1) {
        const [flattenedName, rawValue] = paramEntries[i];
        if (!rawValue || typeof rawValue === 'object') {
          continue;
        }
        const paramName = `${appPrefix}/${flattenedName}`;
        let paramValue = rawValue.toString();
        let isSecret = false;
        if (
          flattenedName.startsWith('appEnvironment') &&
          typeof rawValue === 'string' &&
          !rawValue.startsWith('arn:aws:secretsmanager')
        ) {
          try {
            paramValue = yield putSecret_default(
              {
                Name: paramName,
                SecretString: rawValue,
                Description: 'Created and managed by caccl-deploy.',
              },
              awsTags,
            );
          } catch (err) {
            if (err instanceof ExistingSecretWontDelete_default) {
              console.log(err.message);
              console.log('Aborting import and cleaning up.');
              yield wipeConfig_default(appPrefix, flattened);
              return;
            }
          }
          isSecret = true;
        }
        const paramDescription = [
          'Created and managed by caccl-deploy.',
          isSecret ? 'ARN value references a secretsmanager entry' : '',
        ].join(' ');
        const paramOpts = {
          Name: paramName,
          Value: paramValue,
          Type: 'String',
          Overwrite: true,
          Description: paramDescription,
        };
        yield putSsmParameter_default(paramOpts, awsTags);
        console.log(`ssm parameter ${paramName} created`);
      }
    });
  DeployConfig2.update = (opts) =>
    __async(void 0, null, function* () {
      const { deployConfig, appPrefix, param, value } = opts;
      const newDeployConfig = DeployConfigData_default.parse(
        __spreadProps(__spreadValues({}, deployConfig), {
          [param]: value,
        }),
      );
      yield (0, DeployConfig2.syncToSsm)(deployConfig, appPrefix, {
        [param]: value,
      });
      return newDeployConfig;
    });
  DeployConfig2.deleteParam = (deployConfig, appPrefix, param) =>
    __async(void 0, null, function* () {
      const value = (0, DeployConfig2.flatten)(deployConfig)[param];
      if (value === void 0) {
        throw new Error(`${param} doesn't exist`);
      }
      if (value.startsWith('arn:aws:secretsmanager')) {
        yield deleteSecrets_default([value]);
      }
      const paramPath = [appPrefix, param].join('/');
      yield deleteSsmParameters_default([paramPath]);
    });
  DeployConfig2.wipeExisting = (ssmPrefix, ignoreMissing = true) =>
    __async(void 0, null, function* () {
      let existingConfig;
      try {
        existingConfig = yield (0, DeployConfig2.fromSsmParams)(
          ssmPrefix,
          true,
        );
      } catch (err) {
        if (err instanceof AppNotFound_default) {
          if (ignoreMissing) {
            return;
          }
          throw new AppNotFound_default(
            `No configuration found using prefix ${ssmPrefix}`,
          );
        } else {
          throw err;
        }
      }
      const flattened = (0, DeployConfig2.flatten)(existingConfig);
      yield wipeConfig_default(ssmPrefix, flattened);
    });
})(DeployConfig || (DeployConfig = {}));
var deployConfig_default = DeployConfig;

// src/commands/helpers/bye.ts
var bye = (msg = 'bye!', exitCode = 0) => {
  console.log(msg);
  process.exit(exitCode);
};
var bye_default = bye;

// src/commands/helpers/exitWithError.ts
var exitWithError = (msg) => {
  bye_default(msg, 1);
};
var exitWithError_default = exitWithError;

// src/commands/helpers/exitWithSuccess.ts
var exitWithSuccess = (msg) => {
  bye_default(msg);
};
var exitWithSuccess_default = exitWithSuccess;

// src/commands/operations/appsOperation.ts
var appsOperation = (cmd) =>
  __async(void 0, null, function* () {
    var _a;
    const apps = yield getAppList_default(cmd.ssmRootPrefix);
    if (!apps.length) {
      exitWithError_default(
        `No app configurations found using ssm root prefix ${cmd.ssmRootPrefix}`,
      );
    }
    const appData = {};
    const tableColumns = ['App'];
    for (let i = 0; i < apps.length; i++) {
      const app = apps[i];
      appData[app] = [];
    }
    if (cmd.fullStatus) {
      tableColumns.push(
        'Infra Stack',
        'Stack Status',
        'Config Drift',
        'caccl-deploy Version',
      );
      const cfnStacks = yield getCfnStacks_default(cmd.cfnStackPrefix);
      for (let i = 0; i < apps.length; i++) {
        const app = apps[i];
        const cfnStackName = cmd.getCfnStackName(app);
        const appPrefix = cmd.getAppPrefix(app);
        const deployConfig = yield deployConfig_default.fromSsmParams(
          appPrefix,
        );
        appData[app].push(deployConfig.infraStackName);
        const cfnStack = cfnStacks.find((s) => {
          return (
            s.StackName === cfnStackName && s.StackStatus !== 'DELETE_COMPLETE'
          );
        });
        if (!cfnStack || !cfnStack.Outputs) {
          appData[app].push('', '', '');
          continue;
        }
        let configDrift = '?';
        const cfnStackDeployConfigHashOutput = cfnStack.Outputs.find((o) => {
          return o.OutputKey && o.OutputKey.startsWith('DeployConfigHash');
        });
        if (cfnStackDeployConfigHashOutput) {
          const deployConfigHash = deployConfig_default.toHash(deployConfig);
          const cfnOutputValue = cfnStackDeployConfigHashOutput.OutputValue;
          configDrift = cfnOutputValue !== deployConfigHash ? 'yes' : 'no';
        }
        appData[app].push(cfnStack.StackStatus, configDrift);
        const cfnStackCacclDeployVersion = cfnStack.Outputs.find((o) => {
          return o.OutputKey && o.OutputKey.startsWith('CacclDeployVersion');
        });
        appData[app].push(
          (_a =
            cfnStackCacclDeployVersion == null
              ? void 0
              : cfnStackCacclDeployVersion.OutputValue) != null
            ? _a
            : 'N/A',
        );
      }
    }
    const tableData = Object.keys(appData).map((app) => {
      return [app, ...appData[app]];
    });
    exitWithSuccess_default(
      (0, import_table.table)([tableColumns, ...tableData]),
    );
  });
var appsOperation_default = appsOperation;

// src/commands/addAppsCommand.ts
var addAppsCommand = (cli) => {
  return cli
    .command('apps')
    .option(
      '--full-status',
      'show the full status of each app including CFN stack and config state',
    )
    .description('list available app configurations')
    .action(appsOperation_default);
};
var addAppsCommand_default = addAppsCommand;

// src/commands/addConnectCommand.ts
var import_untildify = __toESM(require('untildify'));

// src/commands/operations/connectOperation.ts
var import_yn = __toESM(require('yn'));
var connectOperation = (cmd) =>
  __async(void 0, null, function* () {
    const opts = cmd.opts();
    const assumedRole = cmd.getAssumedRole();
    if (!opts.list && !opts.service) {
      exitWithError_default('One of `--list` or `--service` is required');
    }
    const deployConfig = yield cmd.getDeployConfig(assumedRole);
    const services = /* @__PURE__ */ new Set();
    ['dbOptions', 'cacheOptions'].forEach((optsKey) => {
      const serviceOptions = deployConfig[optsKey];
      if (serviceOptions) {
        services.add(serviceOptions.engine);
      }
    });
    if ((0, import_yn.default)(deployConfig.docDb)) {
      exitWithError_default(
        [
          'Deployment configuration is out-of-date',
          'Replace `docDb*` with `dbOptions: {...}`',
        ].join('\n'),
      );
    }
    if (opts.list) {
      exitWithSuccess_default(
        ['Valid `--service=` options:', ...services].join('\n  '),
      );
    }
    if (!services.has(opts.service)) {
      exitWithError_default(`'${opts.service}' is not a valid option`);
    }
    const cfnStackName = cmd.getCfnStackName();
    const cfnStackExports = yield getCfnStackExports_default(cfnStackName);
    const { bastionHostAz, bastionHostId, bastionHostIp, dbPasswordSecretArn } =
      cfnStackExports;
    try {
      yield sendSSHPublicKey_default({
        instanceAz: bastionHostAz,
        instanceId: bastionHostId,
        sshKeyPath: opts.publicKey,
      });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : `Could not send SSH public key: ${err}`;
      exitWithError_default(message);
    }
    let endpoint;
    let localPort;
    let clientCommand;
    if (['mysql', 'docdb'].includes(opts.service)) {
      endpoint = cfnStackExports.dbClusterEndpoint;
      const password = yield resolveSecret_default(dbPasswordSecretArn);
      if (opts.service === 'mysql') {
        localPort = opts.localPort || '3306';
        clientCommand = `mysql -uroot -p${password} --port ${localPort} -h 127.0.0.1`;
      } else {
        localPort = opts.localPort || '27017';
        const tlsOpts =
          '--ssl --sslAllowInvalidHostnames --sslAllowInvalidCertificates';
        clientCommand = `mongo ${tlsOpts} --username root --password ${password} --port ${localPort}`;
      }
    } else if (opts.service === 'redis') {
      endpoint = cfnStackExports.cacheEndpoint;
      localPort = opts.localPort || '6379';
      clientCommand = `redis-cli -p ${localPort}`;
    } else {
      exitWithError_default(`not sure what to do with ${opts.service}`);
    }
    const tunnelCommand = [
      'ssh -f -L',
      `${opts.localPort || localPort}:${endpoint}`,
      '-o StrictHostKeyChecking=no',
      `${EC2_INSTANCE_CONNECT_USER_default}@${bastionHostIp}`,
      `sleep ${opts.sleep}`,
    ].join(' ');
    if (opts.quiet) {
      exitWithSuccess_default(tunnelCommand);
    }
    exitWithSuccess_default(
      [
        `Your public key, ${opts.publicKey}, has temporarily been placed on the bastion instance`,
        'You have ~60s to establish the ssh tunnel',
        '',
        `# tunnel command:
${tunnelCommand}`,
        `# ${opts.service} client command:
${clientCommand}`,
      ].join('\n'),
    );
  });
var connectOperation_default = connectOperation;

// src/commands/addConnectCommand.ts
var addConnectCommand = (cli) => {
  return cli
    .command('connect')
    .description("connect to an app's peripheral services (db, redis, etc)")
    .appOption()
    .option('-l, --list', 'list the things to connect to')
    .option(
      '-s, --service <string>',
      'service to connect to; use `--list` to see what is available',
    )
    .option(
      '-k, --public-key <string>',
      'path to the ssh public key file to use',
      (0, import_untildify.default)('~/.ssh/id_rsa.pub'),
    )
    .option(
      '--local-port <string>',
      'attach tunnel to a non-default local port',
    )
    .option('-q, --quiet', 'output only the ssh tunnel command')
    .option(
      '-S, --sleep <string>',
      'keep the tunnel alive for this long without activity',
      '60',
    )
    .action(connectOperation_default);
};
var addConnectCommand_default = addConnectCommand;

// src/commands/operations/deleteOperation.ts
var deleteOperation = (cmd) =>
  __async(void 0, null, function* () {
    const cfnStackName = cmd.getCfnStackName();
    if (yield cfnStackExists_default(cfnStackName)) {
      exitWithError_default(
        [
          `You must first run "caccl-deploy stack -a ${cmd.app} destroy" to delete`,
          `the deployed ${cfnStackName} CloudFormation stack before deleting it's config.`,
        ].join('\n'),
      );
    }
    try {
      console.log(
        `This will delete all deployment configuation for ${cmd.app}`,
      );
      if (!(cmd.yes || (yield confirm_default('Are you sure?')))) {
        exitWithSuccess_default();
      }
      if (!(yield confirmProductionOp_default(cmd.yes))) {
        exitWithSuccess_default();
      }
      yield deployConfig_default.wipeExisting(cmd.getAppPrefix(), false);
      exitWithSuccess_default(`${cmd.app} configuration deleted`);
    } catch (err) {
      if (err instanceof AppNotFound_default) {
        exitWithError_default(`${cmd.app} app configuration not found!`);
      }
    }
  });
var deleteOperation_default = deleteOperation;

// src/commands/addDeleteCommand.ts
var addDeleteCommand = (cli) => {
  return cli
    .command('delete')
    .description('delete an app configuration')
    .appOption()
    .action(deleteOperation_default);
};
var addDeleteCommand_default = addDeleteCommand;

// src/commands/operations/execOperation.ts
var execOperation = (cmd) =>
  __async(void 0, null, function* () {
    const cfnStackName = cmd.getCfnStackName();
    const { appOnlyTaskDefName, clusterName, serviceName } =
      yield getCfnStackExports_default(cfnStackName);
    if (!cmd.yes && !(yield cmd.stackVersionDiffCheck())) {
      exitWithSuccess_default();
    }
    if (!(yield confirmProductionOp_default(cmd.yes))) {
      exitWithSuccess_default();
    }
    console.log(
      `Running command '${
        cmd.opts().command
      }' on service ${serviceName} using task def ${appOnlyTaskDefName}`,
    );
    const taskArn = yield execTask_default({
      clusterName,
      serviceName,
      taskDefName: appOnlyTaskDefName,
      command: cmd.opts().command,
      environment: cmd.opts().env,
    });
    exitWithSuccess_default(`Task ${taskArn} started`);
  });
var execOperation_default = execOperation;

// src/commands/addExecCommand.ts
var addExecCommand = (cli) => {
  return cli
    .command('exec')
    .description('execute a one-off task using the app image')
    .appOption()
    .requiredOption('-c, --command <string>', 'the app task command to run')
    .option(
      '-e, --env <value>',
      'add or override container environment variables',
      (e, collected) => {
        const [k, v] = e.split('=');
        return collected.concat([
          {
            name: k,
            value: v,
          },
        ]);
      },
      [],
    )
    .action(execOperation_default);
};
var addExecCommand_default = addExecCommand;

// src/commands/operations/imagesOperation.ts
var import_moment = __toESM(require('moment'));
var import_table2 = require('table');
var imagesOperation = (cmd) =>
  __async(void 0, null, function* () {
    const assumedRole = cmd.getAssumedRole();
    const opts = cmd.opts();
    if (cmd.ecrAccessRoleArn !== void 0) {
      assumedRole.setAssumedRoleArn(cmd.ecrAccessRoleArn);
    }
    const images = yield getRepoImageList_default(
      assumedRole,
      opts.repo,
      opts.all,
    );
    const region = getCurrentRegion_default();
    const includeThisTag = (tag) => {
      return (
        opts.all ||
        looksLikeSemver_default(tag) ||
        ['master', 'stage'].includes(tag)
      );
    };
    const data = images
      .filter((image) => {
        return !!image.imageTags && !!image.registryId;
      })
      .map((image) => {
        const tags = image.imageTags;
        const account = image.registryId;
        const imageTags = tags.filter(includeThisTag).join('\n');
        const imageArns = tags
          .reduce((collect, t) => {
            if (includeThisTag(t)) {
              collect.push(
                createEcrArn_default({
                  repoName: opts.repo,
                  imageTag: t,
                  account,
                  region,
                }),
              );
            }
            return collect;
          }, [])
          .join('\n');
        return [
          (0, import_moment.default)(image.imagePushedAt).format(),
          imageTags,
          imageArns,
        ];
      });
    if (data.length) {
      const tableOutput = (0, import_table2.table)([
        ['Pushed On', 'Tags', 'ARNs'],
        ...data,
      ]);
      exitWithSuccess_default(tableOutput);
    }
    exitWithError_default('No images found');
  });
var imagesOperation_default = imagesOperation;

// src/commands/addImagesCommand.ts
var addImagesCommand = (cli) => {
  return cli
    .command('images')
    .description('list the most recent available ECR images for an app')
    .requiredOption(
      '-r --repo <string>',
      'the name of the ECR repo; use `caccl-deploy app repos` for available repos',
    )
    .option(
      '-A --all',
      'show all images; default is to show only semver-tagged releases',
    )
    .action(imagesOperation_default);
};
var addImagesCommand_default = addImagesCommand;

// src/commands/operations/newOperation.ts
var import_chalk2 = __toESM(require('chalk'));
var import_figlet2 = __toESM(require('figlet'));
var newOperation = (cmd) =>
  __async(void 0, null, function* () {
    const opts = cmd.opts();
    const assumedRole = cmd.getAssumedRole();
    if (cmd.ecrAccessRoleArn !== void 0) {
      assumedRole.setAssumedRoleArn(cmd.ecrAccessRoleArn);
    }
    const existingApps = yield getAppList_default(cmd.ssmRootPrefix);
    let appName;
    try {
      appName = cmd.app || (yield promptAppName_default());
    } catch (err) {
      if (err instanceof UserCancel_default) {
        exitWithSuccess_default();
      }
      throw err;
    }
    const appPrefix = cmd.getAppPrefix(appName);
    if (existingApps.includes(appName)) {
      const cfnStackName = cmd.getCfnStackName(appName);
      if (yield cfnStackExists_default(cfnStackName)) {
        exitWithError_default('A deployed app with that name already exists');
      } else {
        console.log(`Configuration for ${cmd.app} already exists`);
      }
      if (cmd.yes || (yield confirm_default('Overwrite?'))) {
        if (!(yield confirmProductionOp_default(cmd.yes))) {
          exitWithSuccess_default();
        }
        yield deployConfig_default.wipeExisting(appPrefix);
      } else {
        exitWithSuccess_default();
      }
    }
    let importedConfig;
    if (opts.import !== void 0) {
      importedConfig = /^http(s):\//.test(opts.import)
        ? yield deployConfig_default.fromUrl(opts.import)
        : deployConfig_default.fromFile(opts.import);
    }
    let deployConfig;
    try {
      deployConfig = yield deployConfig_default.generate(
        assumedRole,
        importedConfig,
      );
    } catch (err) {
      if (err instanceof UserCancel_default) {
        exitWithSuccess_default();
      } else if (err instanceof NoPromptChoices_default) {
        exitWithError_default(
          [
            'Something went wrong trying to generate your config: ',
            err.message,
          ].join('\n'),
        );
      }
      throw err;
    }
    yield deployConfig_default.syncToSsm(deployConfig, appPrefix);
    exitWithSuccess_default(
      [
        import_chalk2.default.yellowBright(
          import_figlet2.default.textSync(`${appName}!`),
        ),
        '',
        'Your new app deployment configuration is created!',
        'Next steps:',
        `  * modify or add settings with 'caccl-deploy update -a ${appName} [...]'`,
        `  * deploy the app stack with 'caccl-deploy stack -a ${appName} deploy'`,
        '',
      ].join('\n'),
    );
  });
var newOperation_default = newOperation;

// src/commands/addNewCommand.ts
var addNewCommand = (cli) => {
  return cli
    .command('new')
    .description('create a new app deploy config via import and/or prompts')
    .appOption(true)
    .option(
      '-i --import <string>',
      'import new deploy config from a json file or URL',
    )
    .description('create a new app configuration')
    .action(newOperation_default);
};
var addNewCommand_default = addNewCommand;

// src/commands/operations/releaseOperation.ts
var releaseOperation = (cmd) =>
  __async(void 0, null, function* () {
    const assumedRole = cmd.getAssumedRole();
    if (cmd.ecrAccessRoleArn !== void 0) {
      assumedRole.setAssumedRoleArn(cmd.ecrAccessRoleArn);
    }
    const deployConfig = yield cmd.getDeployConfig(assumedRole);
    const cfnStackName = cmd.getCfnStackName();
    let cfnExports;
    try {
      cfnExports = yield getCfnStackExports_default(cfnStackName);
      ['taskDefName', 'clusterName', 'serviceName'].forEach((exportValue) => {
        if (cfnExports[exportValue] === void 0) {
          throw new Error(`Incomplete app stack: missing ${exportValue}`);
        }
      });
    } catch (err) {
      if (
        err instanceof Error &&
        (err instanceof CfnStackNotFound_default ||
          err.message.includes('Incomplete'))
      ) {
        exitWithError_default(err.message);
      }
      throw err;
    }
    const repoArn = parseEcrArn_default(deployConfig.appImage);
    if (repoArn.imageTag === cmd.imageTag && !cmd.yes) {
      const confirmMsg = `${cmd.app} is already using image tag ${cmd.imageTag}`;
      (yield confirm_default(`${confirmMsg}. Proceed?`)) ||
        exitWithSuccess_default();
    }
    console.log(`Checking that an image exists with the tag ${cmd.imageTag}`);
    const imageTagExists2 = yield imageTagExists_default(
      assumedRole,
      repoArn.repoName,
      cmd.imageTag,
    );
    if (!imageTagExists2) {
      exitWithError_default(
        `No image with tag ${cmd.imageTag} in ${repoArn.repoName}`,
      );
    }
    console.log(`Checking ${cmd.imageTag} is the latest tag`);
    const isLatestTag2 = yield isLatestTag_default(
      assumedRole,
      repoArn.repoName,
      cmd.imageTag,
    );
    if (!isLatestTag2 && !cmd.yes) {
      console.log(`${cmd.imageTag} is not the most recent release`);
      (yield confirm_default('Proceed?')) || exitWithSuccess_default();
    }
    const newAppImage = createEcrArn_default(
      __spreadProps(__spreadValues({}, repoArn), {
        imageTag: cmd.imageTag,
      }),
    );
    const { taskDefName, appOnlyTaskDefName, clusterName, serviceName } =
      cfnExports;
    if (!cmd.yes && !(yield cmd.stackVersionDiffCheck())) {
      exitWithSuccess_default();
    }
    if (!(yield confirmProductionOp_default(cmd.yes))) {
      exitWithSuccess_default();
    }
    console.log(`Updating ${cmd.app} task definitions to use ${newAppImage}`);
    const newTaskDefArn = yield updateTaskDefAppImage_default(
      taskDefName,
      newAppImage,
      'AppContainer',
    );
    yield updateTaskDefAppImage_default(
      appOnlyTaskDefName,
      newAppImage,
      'AppOnlyContainer',
    );
    console.log('Updating stored deployment configuration');
    yield deployConfig_default.update({
      deployConfig,
      appPrefix: cmd.getAppPrefix(),
      param: 'appImage',
      value: newAppImage,
    });
    if (cmd.deploy) {
      console.log(`Restarting the ${serviceName} service...`);
      yield restartEcsService_default({
        cluster: clusterName,
        service: serviceName,
        newTaskDefArn,
        wait: true,
      });
      exitWithSuccess_default('done.');
    }
    exitWithSuccess_default(
      [
        'Redployment skipped',
        'WARNING: service is out-of-sync with stored deployment configuration',
      ].join('\n'),
    );
  });
var releaseOperation_default = releaseOperation;

// src/commands/addReleaseCommand.ts
var addReleaseCommand = (cli) => {
  return cli
    .command('release')
    .description('release a new version of an app')
    .appOption()
    .requiredOption(
      '-i --image-tag <string>',
      'the docker image version tag to release',
    )
    .option(
      '--no-deploy',
      "Update the Fargate Task Definition but don't restart the service",
    )
    .action(releaseOperation_default);
};
var addReleaseCommand_default = addReleaseCommand;

// src/commands/operations/reposOperation.ts
var import_table3 = require('table');
var reposOperation = (cmd) =>
  __async(void 0, null, function* () {
    const assumedRole = cmd.getAssumedRole();
    if (cmd.ecrAccessRoleArn !== void 0) {
      assumedRole.setAssumedRoleArn(cmd.ecrAccessRoleArn);
    }
    const repos = yield getRepoList_default(assumedRole);
    const data = repos.map((r) => {
      return [r];
    });
    if (data.length) {
      const tableOutput = (0, import_table3.table)([
        ['Respository Name'],
        ...data,
      ]);
      exitWithSuccess_default(tableOutput);
    }
    exitWithError_default('No ECR repositories found');
  });
var reposOperation_default = reposOperation;

// src/commands/addReposCommand.ts
var addReposCommand = (cli) => {
  return cli
    .command('repos')
    .description('list the available ECR repositories')
    .action(reposOperation_default);
};
var addReposCommand_default = addReposCommand;

// src/commands/operations/restartOperation.ts
var restartOperation = (cmd) =>
  __async(void 0, null, function* () {
    const cfnStackName = cmd.getCfnStackName();
    let cfnExports;
    try {
      cfnExports = yield getCfnStackExports_default(cfnStackName);
    } catch (err) {
      if (err instanceof CfnStackNotFound_default) {
        exitWithError_default(err.message);
      }
      throw err;
    }
    const { clusterName, serviceName } = cfnExports;
    console.log(`Restarting service ${serviceName} on cluster ${clusterName}`);
    if (!(yield confirmProductionOp_default(cmd.yes))) {
      exitWithSuccess_default();
    }
    yield restartEcsService_default({
      cluster: clusterName,
      service: serviceName,
      wait: true,
    });
    exitWithSuccess_default('done');
  });
var restartOperation_default = restartOperation;

// src/commands/addRestartCommand.ts
var addRestartCommand = (cli) => {
  return cli
    .command('restart')
    .description('no changes; just force a restart')
    .appOption()
    .action(restartOperation_default);
};
var addRestartCommand_default = addRestartCommand;

// src/commands/operations/scheduleOperation.ts
var import_table4 = require('table');
var scheduleOperation = (cmd) =>
  __async(void 0, null, function* () {
    const opts = cmd.opts();
    const assumedRole = cmd.getAssumedRole();
    const deployConfig = yield cmd.getDeployConfig(assumedRole);
    const existingTasks = deployConfig.scheduledTasks || {};
    const existingTaskIds = Object.keys(existingTasks);
    if (opts.list) {
      if (existingTaskIds.length) {
        const tableRows = existingTaskIds.map((id) => {
          const taskSettings = existingTasks[id];
          const { command, schedule, description } = taskSettings;
          return [id, schedule, command, description];
        });
        const tableOutput = (0, import_table4.table)([
          ['ID', 'Schedule', 'Command', 'Description'],
          ...tableRows,
        ]);
        exitWithSuccess_default(tableOutput);
      }
      exitWithSuccess_default('No scheduled tasks configured');
    } else if (opts.delete) {
      if (!existingTaskIds.includes(cmd.delete)) {
        exitWithError_default(`No scheduled task with id ${cmd.delete}`);
      }
      const existingTask = existingTasks[cmd.delete];
      if (
        !(
          cmd.yes ||
          (yield confirm_default(`Delete scheduled task ${opts.delete}?`))
        )
      ) {
        exitWithSuccess_default();
      }
      const existingTaskParams = Object.keys(existingTask);
      for (let i = 0; i < existingTaskParams.length; i++) {
        yield deployConfig_default.deleteParam(
          deployConfig,
          cmd.getAppPrefix(),
          `scheduledTasks/${opts.delete}/${existingTaskParams[i]}`,
        );
      }
      exitWithSuccess_default(`Scheduled task ${opts.delete} deleted`);
    } else if (!(opts.taskSchedule && opts.taskCommand)) {
      exitWithError_default('Invalid options. See `--help` output');
    }
    const taskId = opts.taskId || Math.random().toString(36).substring(2, 16);
    const taskDescription = opts.taskDescription || '';
    const { taskCommand, taskSchedule } = opts;
    if (!validSSMParamName_default(taskId)) {
      exitWithError_default(
        `Invalid ${taskId} value; '/^([a-z0-9:/_-]+)$/i' allowed only`,
      );
    }
    if (
      existingTaskIds.some((t) => {
        return t === taskId;
      })
    ) {
      exitWithError_default(
        `A schedule task with id ${taskId} already exists for ${opts.app}`,
      );
    }
    const params = {
      [`scheduledTasks/${taskId}/description`]: taskDescription,
      [`scheduledTasks/${taskId}/schedule`]: taskSchedule,
      [`scheduledTasks/${taskId}/command`]: taskCommand,
    };
    yield deployConfig_default.syncToSsm(
      deployConfig,
      cmd.getAppPrefix(),
      params,
    );
    exitWithSuccess_default('task scheduled');
  });
var scheduleOperation_default = scheduleOperation;

// src/commands/addScheduleCommand.ts
var addScheduleCommand = (cli) => {
  return cli
    .command('schedule')
    .description(
      'create a scheduled task that executes the app image with a custom command',
    )
    .appOption()
    .option('-l, --list', 'list the existing scheduled tasks')
    .option(
      '-t, --task-id <string>',
      'give the task a string id; by default one will be generated',
    )
    .option(
      '-d, --task-description <string>',
      'description of what the task does',
    )
    .option('-D, --delete <string>', 'delete a scheduled task')
    .option(
      '-s, --task-schedule <string>',
      'a cron expression, e.g. "0 4 * * *"',
    )
    .option('-c, --task-command <string>', 'the app task command to run')
    .action(scheduleOperation_default);
};
var addScheduleCommand_default = addScheduleCommand;

// src/commands/operations/showOperation.ts
var showOperation = (cmd) =>
  __async(void 0, null, function* () {
    if (cmd.sha) {
      exitWithSuccess_default((yield cmd.getDeployConfig()).toHash());
    }
    exitWithSuccess_default(
      (yield cmd.getDeployConfig(cmd.keepSecretArns)).toString(true, cmd.flat),
    );
  });
var showOperation_default = showOperation;

// src/commands/addShowCommand.ts
var addShowCommand = (cli) => {
  return cli
    .command('show')
    .description("display an app's current configuration")
    .appOption()
    .option('-f --flat', 'display the flattened, key: value form of the config')
    .option('-s --sha', 'output a sha1 hash of the current configuration')
    .option(
      '--keep-secret-arns',
      'show app environment secret value ARNs instead of dereferencing',
    )
    .action(showOperation_default);
};
var addShowCommand_default = addShowCommand;

// src/commands/operations/stackOperation.ts
var import_child_process2 = require('child_process');
var import_tempy = __toESM(require('tempy'));

// src/shared/helpers/generateVersion.ts
var import_child_process = require('child_process');

// package.json
var package_default = {
  name: 'caccl-deploy',
  version: '0.15.0',
  description: 'A cli tool for managing ECS/Fargate app deployments',
  files: ['dist', 'cdk.json'],
  main: './dist/index.js',
  module: './dist/index.mjs',
  exports: {
    require: './dist/index.js',
    import: './dist/index.mjs',
  },
  types: './dist/index.d.ts',
  bin: {
    'caccl-deploy': 'dist/cli.js',
  },
  scripts: {
    test: 'jest',
    prettier: 'npx prettier --write --ignore-path .gitignore "**/*.{ts,js}"',
    prepare: 'husky install',
    'build-lib': 'tsup src/index.ts --format cjs,esm --dts-resolve',
    'build-cdk':
      'tsup cdk/cdk.ts && rsync -r cdk/assets dist/ && rsync cdk/.npmignore dist/ && rsync cdk/cdk.json dist/',
    'build-cli': 'tsup src/cli.ts',
    build: 'npm run build-lib && npm run build-cdk && npm run build-cli',
  },
  keywords: ['DCE', 'CLI', 'AWS', 'ECS'],
  'lint-staged': {
    '**/*.{ts,js}': [
      'npx prettier --write --ignore-path .gitignore',
      'npx eslint --fix',
    ],
  },
  author: 'Jay Luker',
  license: 'ISC',
  dependencies: {
    'aws-cdk': '~2.41.0',
    'aws-cdk-lib': '~2.41.0',
    'aws-sdk': '^2.1156.0',
    'camel-case': '^4.1.2',
    chalk: '4.1.2',
    commander: '6.2.1',
    conf: '^10.2.0',
    constructs: '~10.1.97',
    figlet: '^1.5.2',
    flat: '^5.0.2',
    moment: '^2.29.3',
    'node-fetch': '2.6.7',
    'object-hash': '^3.0.0',
    prompts: '^2.4.2',
    semver: '^7.3.7',
    'source-map-support': '^0.5.21',
    table: '^6.8.0',
    tempy: '1.0.1',
    'ts-node': '^10.9.1',
    untildify: '^4.0.0',
    yargs: '^17.7.2',
    yn: '4.0.0',
    zod: '^3.22.4',
  },
  devDependencies: {
    '@types/figlet': '^1.5.8',
    '@types/flat': '^5.0.5',
    '@types/node': '^18.7.16',
    '@types/object-hash': '^2.2.1',
    '@types/prompts': '^2.4.9',
    '@types/semver': '^7.5.8',
    '@typescript-eslint/eslint-plugin': '^5.36.2',
    '@typescript-eslint/parser': '^5.36.2',
    eslint: '^8.23.0',
    'eslint-config-airbnb-base': '^15.0.0',
    'eslint-config-prettier': '^8.5.0',
    'eslint-formatter-table': '^7.32.1',
    'eslint-import-resolver-typescript': '^3.5.1',
    'eslint-plugin-cdk': '^1.8.0',
    'eslint-plugin-import': '^2.26.0',
    'eslint-plugin-jest': '^27.0.2',
    husky: '^8.0.1',
    jest: '^28.1.3',
    'lint-staged': '^13.0.2',
    prettier: '^2.7.1',
    tsup: '^8.0.2',
    typescript: '^4.8.3',
  },
  jest: {
    verbose: true,
    testMatch: ['**/test/**/*.jest.js'],
  },
};

// src/shared/helpers/generateVersion.ts
var getCommandResult = (cmd) => {
  return (0, import_child_process.execSync)(cmd, {
    stdio: 'pipe',
    cwd: __dirname,
  })
    .toString()
    .trim();
};
var generateVersion = () => {
  const packageVersion = package_default.version;
  if (process.env.CACCL_DEPLOY_VERSION !== void 0) {
    return process.env.CACCL_DEPLOY_VERSION;
  }
  const version = [`package=${packageVersion}`];
  let inGitRepo = false;
  try {
    const gitLsThisFile = getCommandResult(`git ls-files ${__filename}`);
    inGitRepo = gitLsThisFile !== '';
  } catch (err) {
    if (
      err instanceof Error &&
      !err.message.toLowerCase().includes('not a git repository')
    ) {
      console.log(err);
    }
  }
  if (inGitRepo) {
    try {
      const gitTag = getCommandResult('git describe --exact-match --abbrev=0');
      version.push(`tag=${gitTag}`);
    } catch (err) {
      if (
        err instanceof Error &&
        !err.message.includes('no tag exactly matches')
      ) {
        console.log(err);
      }
    }
    try {
      const gitBranch = getCommandResult('git branch --show-current');
      if (gitBranch.length > 0) {
        version.unshift(`branch=${gitBranch}`);
      }
    } catch (err) {
      console.log(err);
    }
  }
  return version.join(':');
};
var generateVersion_default = generateVersion;

// src/commands/constants/CACCL_DEPLOY_VERSION.ts
var CACCL_DEPLOY_VERSION = generateVersion_default();
var CACCL_DEPLOY_VERSION_default = CACCL_DEPLOY_VERSION;

// src/commands/helpers/isProdAccount.ts
var import_aws16 = __toESM(require_aws());
var isProdAccount = () =>
  __async(void 0, null, function* () {
    const prodAccounts = conf.get('productionAccounts');
    const accountId = yield (0, import_aws16.getAccountId)();
    return prodAccounts && prodAccounts.includes(accountId);
  });
var isProdAccount_default = isProdAccount;

// src/commands/operations/stackOperation.ts
var stackOperation = (cmd) =>
  __async(void 0, null, function* () {
    const deployConfig = yield cmd.getDeployConfig(true);
    const deployConfigHash = (yield cmd.getDeployConfig()).toHash();
    const cfnStackName = cmd.getCfnStackName();
    const stackExists = yield cfnStackExists_default(cfnStackName);
    const { vpcId, ecsClusterName, albLogBucketName } =
      yield getCfnStackExports_default(deployConfig.infraStackName);
    const cdkStackProps = {
      vpcId,
      ecsClusterName,
      albLogBucketName,
      cacclDeployVersion: CACCL_DEPLOY_VERSION_default,
      deployConfigHash,
      stackName: cfnStackName,
      awsAccountId: yield getAccountId_default(),
      awsRegion: process.env.AWS_REGION || 'us-east-1',
      deployConfig,
    };
    const envAdditions = {
      AWS_REGION: process.env.AWS_REGION || 'us-east-1',
      CDK_DISABLE_VERSION_CHECK: 'true',
    };
    const cdkArgs = [...cmd.args];
    if (!cdkArgs.length) {
      cdkArgs.push('list');
    } else if (cdkArgs[0] === 'dump') {
      exitWithSuccess_default(JSON.stringify(cdkStackProps, null, '  '));
    } else if (cdkArgs[0] === 'info') {
      if (!stackExists) {
        exitWithError_default(
          `Stack ${cfnStackName} has not been deployed yet`,
        );
      }
      const stackExports = yield getCfnStackExports_default(cfnStackName);
      exitWithSuccess_default(JSON.stringify(stackExports, null, '  '));
    } else if (cdkArgs[0] === 'changeset') {
      cdkArgs.shift();
      cdkArgs.unshift('deploy', '--no-execute');
    }
    if (cmd.profile !== void 0) {
      cdkArgs.push('--profile', cmd.profile);
      envAdditions.AWS_PROFILE = cmd.profile;
    }
    if (
      cmd.yes &&
      (cdkArgs.includes('deploy') || cdkArgs.includes('changeset'))
    ) {
      cdkArgs.push('--require-approval-never');
    }
    if (
      ['deploy', 'destroy', 'changeset'].some((c) => {
        return cdkArgs.includes(c);
      })
    ) {
      if (stackExists && !cmd.yes && !(yield cmd.stackVersionDiffCheck())) {
        exitWithSuccess_default();
      }
      if (!(yield confirmProductionOp_default(cmd.yes))) {
        exitWithSuccess_default();
      }
    }
    if (
      cdkStackProps.deployConfig.dbOptions &&
      !cdkStackProps.deployConfig.dbOptions.removalPolicy
    ) {
      cdkStackProps.deployConfig.dbOptions.removalPolicy =
        (yield isProdAccount_default()) ? 'RETAIN' : 'DESTROY';
    }
    yield import_tempy.default.write.task(
      JSON.stringify(cdkStackProps, null, 2),
      (tempPath) =>
        __async(void 0, null, function* () {
          envAdditions.CDK_STACK_PROPS_FILE_PATH = tempPath;
          const execOpts = {
            stdio: 'inherit',
            // exec the cdk process in the cdk directory
            cwd: __dirname,
            // path.join(__dirname, 'cdk'),
            // inject our additional env vars
            env: __spreadValues(__spreadValues({}, process.env), envAdditions),
          };
          try {
            (0,
            import_child_process2.execSync)(['node_modules/.bin/cdk', ...cdkArgs].join(' '), execOpts);
            exitWithSuccess_default('done!');
          } catch (err) {
            const message =
              err instanceof Error
                ? err.message
                : `Error while executing CDK: ${err}`;
            exitWithError_default(message);
          }
        }),
    );
  });
var stackOperation_default = stackOperation;

// src/commands/addStackCommand.ts
var addStackCommand = (cli) => {
  return cli
    .command('stack')
    .description("diff, deploy, or delete the app's AWS resources")
    .appOption()
    .action(stackOperation_default);
};
var addStackCommand_default = addStackCommand;

// src/commands/operations/updateOperation.ts
var updateOperation = (cmd) =>
  __async(void 0, null, function* () {
    const deployConfig = yield cmd.getDeployConfig(true);
    if (!(yield confirmProductionOp_default(cmd.yes))) {
      exitWithSuccess_default();
    }
    if (cmd.args.length > 2) {
      exitWithError_default('Too many arguments!');
    }
    try {
      if (cmd.delete) {
        const [param] = cmd.args;
        yield deployConfig.delete(cmd.getAppPrefix(), param);
      } else {
        const [param, value] = cmd.args;
        if (!validSSMParamName_default(param)) {
          throw new Error(`Invalid param name: '${param}'`);
        }
        yield deployConfig.update(cmd.getAppPrefix(), param, value);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : `${err}`;
      exitWithError_default(`Something went wrong: ${message}`);
    }
  });
var updateOperation_default = updateOperation;

// src/commands/addUpdateCommand.ts
var addUpdateCommand = (cli) => {
  return cli
    .command('update')
    .description('update (or delete) a single deploy config setting')
    .appOption()
    .option(
      '-D --delete',
      'delete the named parameter instead of creating/updating',
    )
    .action(updateOperation_default);
};
var addUpdateCommand_default = addUpdateCommand;

// src/commands/classes/CacclDeployCommander.ts
var import_chalk3 = __toESM(require('chalk'));
var import_commander = require('commander');
var import_yn2 = __toESM(require('yn'));

// src/shared/helpers/warnAboutVersionDiff.ts
var import_semver = __toESM(require('semver'));
var warnAboutVersionDiff = (versionString1, versionString2) => {
  var _a, _b, _c, _d;
  if (
    [versionString1, versionString2].filter((v) => {
      return v.includes('branch=');
    }).length === 1
  ) {
    return true;
  }
  const v1 =
    (_b =
      (_a = versionString1.match(new RegExp('^package=(?<version>[^:]+)'))) ==
      null
        ? void 0
        : _a.groups) == null
      ? void 0
      : _b.version;
  const v2 =
    (_d =
      (_c = versionString2.match(new RegExp('^package=(?<version>[^:]+)'))) ==
      null
        ? void 0
        : _c.groups) == null
      ? void 0
      : _d.version;
  if (!v1 || !v2) return true;
  if (v1 === v2) return false;
  if (!import_semver.default.valid(v1) || !import_semver.default.valid(v2)) {
    return true;
  }
  return !import_semver.default.satisfies(v1, `${v2.slice(0, -1)}x`);
};
var warnAboutVersionDiff_default = warnAboutVersionDiff;

// src/commands/constants/CACCL_DEPLOY_NON_INTERACTIVE.ts
var { CACCL_DEPLOY_NON_INTERACTIVE = false } = process.env;
var CACCL_DEPLOY_NON_INTERACTIVE_default = CACCL_DEPLOY_NON_INTERACTIVE;

// src/commands/helpers/initAwsProfile.ts
var initAwsProfile = (profile) => {
  try {
    initProfile_default(profile);
    return profile;
  } catch (err) {
    if (err instanceof AwsProfileNotFound_default) {
      exitWithError_default(err.message);
    } else {
      throw err;
    }
  }
  return profile;
};
var initAwsProfile_default = initAwsProfile;

// src/commands/classes/CacclDeployCommander.ts
var CacclDeployCommander = class _CacclDeployCommander extends import_commander.Command {
  /**
   * custom command creator
   * @param {string} name
   */
  createCommand(name) {
    const cmd = new _CacclDeployCommander(name)
      .passCommandToAction()
      .storeOptionsAsProperties()
      .commonOptions();
    return cmd;
  }
  /**
   * Convenience method for getting the combined root prefix plus app name
   * used for the SSM Paramter Store parameter names
   * @param {string} appName
   */
  getAppPrefix(appName) {
    if (
      this.ssmRootPrefix === void 0 ||
      (this.app === void 0 && appName === void 0)
    ) {
      throw Error('Attempted to make an ssm prefix with undefined values');
    }
    return `${this.ssmRootPrefix}/${appName || this.app}`;
  }
  /**
   * Convenience method for getting the name of the app's CloudFormation stack
   * @param {string} appName
   */
  getCfnStackName(appName) {
    if (
      this.cfnStackPrefix === void 0 ||
      (this.app === void 0 && appName === void 0)
    ) {
      throw Error(
        'Attempted to make a cloudformation stack name with undefined values',
      );
    }
    return `${this.cfnStackPrefix}${appName || this.app}`;
  }
  /**
   * Retruns the DeployConfig object representing the subcommand's
   *
   * @param {boolean} keepSecretArns - if true, for any parameter store values
   * that reference secretsmanager entries, preserve the secretsmanager ARN
   * value rather than dereferencing
   */
  getDeployConfig(assumedRole, keepSecretArns) {
    return __async(this, null, function* () {
      const appPrefix = this.getAppPrefix();
      try {
        const deployConfig = yield deployConfig_default.fromSsmParams(
          appPrefix,
          keepSecretArns,
        );
        return deployConfig;
      } catch (err) {
        if (err instanceof AppNotFound_default) {
          exitWithError_default(`${this.app} app configuration not found!`);
        }
      }
      return deployConfig_default.generate(assumedRole);
    });
  }
  /**
   * Will add another confirm prompt that warns if the deployed stack's
   * version is more than a patch version different from the cli tool.
   *
   * @return {CacclDeployCommander}
   * @memberof CacclDeployCommander
   */
  stackVersionDiffCheck() {
    return __async(this, null, function* () {
      const cfnStackName = this.getCfnStackName();
      const cfnExports = yield getCfnStackExports_default(cfnStackName);
      const stackVersion = cfnExports.cacclDeployVersion;
      const cliVersion = CACCL_DEPLOY_VERSION_default;
      if (
        cliVersion === stackVersion ||
        !warnAboutVersionDiff_default(stackVersion, cliVersion)
      ) {
        return true;
      }
      const confirmMsg = `Stack deployed with ${import_chalk3.default.redBright(
        stackVersion,
      )}; you are using ${import_chalk3.default.redBright(
        cliVersion,
      )}. Proceed?`;
      return confirm_default(confirmMsg, false);
    });
  }
  /**
   * For assigning some common options to all commands
   *
   * @return {CacclDeployCommander}
   * @memberof CacclDeployCommander
   */
  commonOptions() {
    return this.option(
      '--profile <string>',
      'activate a specific aws config/credential profile',
      initAwsProfile_default,
    )
      .option(
        '--ecr-access-role-arn <string>',
        'IAM role ARN for cross account ECR repo access',
        conf.get('ecrAccessRoleArn'),
      )
      .requiredOption(
        '--ssm-root-prefix <string>',
        'The root prefix for ssm parameter store entries',
        conf.get('ssmRootPrefix'),
      )
      .requiredOption(
        '--cfn-stack-prefix <string>',
        'cloudformation stack name prefix, e.g. "CacclDeploy-"',
        conf.get('cfnStackPrefix'),
      )
      .option(
        '-y --yes',
        'non-interactive, yes to everything, overwrite existing, etc',
        (0, import_yn2.default)(CACCL_DEPLOY_NON_INTERACTIVE_default),
      );
  }
  /**
   * Add the `--app` option to a command
   *
   * @param {boolean} optional - unless true the resulting command option
   *  will be required
   * @return {CacclDeployCommander}
   * @memberof CacclDeployCommander
   */
  appOption(optional) {
    return optional
      ? this.option('-a --app <string>', 'name of the app to work with')
      : this.requiredOption(
          '-a --app <string>',
          'name of the app to work with',
        );
  }
  getAssumedRole() {
    if (!this.assumedRole) {
      this.assumedRole = new AssumedRole_default();
    }
    return this.assumedRole;
  }
};
var CacclDeployCommander_default = CacclDeployCommander;

// src/commands/helpers/byeWithCredentialsError.ts
var byeWithCredentialsError = () => {
  exitWithError_default(
    [
      'Looks like there is a problem with your AWS credentials configuration.',
      'Did you run `aws configure`? Did you set a region? Default profile?',
    ].join('\n'),
  );
};
var byeWithCredentialsError_default = byeWithCredentialsError;

// src/cli.ts
var main = () =>
  __async(exports, null, function* () {
    if (!isConfigured_default() && process.env.NODE_ENV !== 'test') {
      byeWithCredentialsError_default();
    }
    const { description: packageDescription } = package_default;
    if (!conf.get('ssmRootPrefix')) {
      console.log(
        import_chalk4.default.greenBright(
          import_figlet3.default.textSync('Caccl-Deploy!'),
        ),
      );
      console.log(
        [
          'It looks like this is your first time running caccl-deploy. ',
          `A preferences file has been created at ${import_chalk4.default.yellow(
            conf.path,
          )}`,
          'with the following default values:',
          '',
          ...Object.entries(configDefaults).map(([k, v]) => {
            return `  - ${import_chalk4.default.yellow(
              k,
            )}: ${import_chalk4.default.bold(JSON.stringify(v))}`;
          }),
          '',
          'Please see the docs for explanations of these settings',
        ].join('\n'),
      );
      CACCL_DEPLOY_NON_INTERACTIVE_default ||
        (yield confirm_default('Continue?', true)) ||
        exitWithSuccess_default();
      setConfigDefaults();
    }
    const cli = new CacclDeployCommander_default()
      .version(CACCL_DEPLOY_VERSION_default)
      .description([packageDescription, `config: ${conf.path}`].join('\n'));
    addAppsCommand_default(cli);
    addDeleteCommand_default(cli);
    addNewCommand_default(cli);
    addScheduleCommand_default(cli);
    addConnectCommand_default(cli);
    addExecCommand_default(cli);
    addImagesCommand_default(cli);
    addReleaseCommand_default(cli);
    addShowCommand_default(cli);
    addUpdateCommand_default(cli);
    addReposCommand_default(cli);
    addRestartCommand_default(cli);
    addStackCommand_default(cli);
  });
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
