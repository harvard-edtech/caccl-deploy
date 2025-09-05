/* eslint-disable class-methods-use-this */
/* eslint-disable camelcase */
import {
  type ICloudAssemblySource,
  StackSelectionStrategy,
  type StackSelector,
  Toolkit,
} from '@aws-cdk/toolkit-lib';
import { Args, Flags } from '@oclif/core';
import { App, CfnOutput } from 'aws-cdk-lib';
import yn from 'yn';

import {
  cfnStackExists,
  getAccountId,
  getCfnStackExports,
} from '../aws/index.js';
import { BaseCommand } from '../base.js';
import CacclDeployStack from '../cdk/lib/classes/CacclDeployStack.js';
import {
  confirmProductionOp,
  stackVersionDiffCheck,
} from '../configPrompts/index.js';
import CACCL_DEPLOY_VERSION from '../constants/CACCL_DEPLOY_VERSION.js';
import DeployConfig from '../deployConfig/index.js';
import isProdAccount from '../helpers/isProdAccount.js';
import {
  type CacclDeployStackProps,
  type CacclDeployStackPropsData,
} from '../types/index.js';

// eslint-disable-next-line no-use-before-define
export default class Stack extends BaseCommand<typeof Stack> {
  static override description =
    "diff, deploy, or delete the app's AWS resources";

  static override examples = ['<%= config.bin %> <%= command.id %>'];

  static override args = {
    stackSubcommand: Args.string({
      default: 'list',
      description:
        'CDK subcommand to execute: diff | deploy | delete | list | synth | changeset | dump | info',
      required: false,
    }),
  };

  static override flags = {
    app: Flags.string({
      char: 'a',
      description: 'name of the app to work with',
      env: 'CACCL_DEPLOY_APP',
      required: true,
    }),
  };

  static override strict = false;

  private async createCdkApp(
    stackPropsData: CacclDeployStackPropsData,
  ): Promise<App> {
    const {
      albLogBucketName,
      awsAccountId,
      awsRegion,
      cacclDeployVersion,
      deployConfig,
      deployConfigHash,
      ecsClusterName,
      stackName,
      vpcId,
    } = stackPropsData;

    const stackProps: CacclDeployStackProps = {
      albLogBucketName,
      appEnvironment: deployConfig.appEnvironment ?? {},
      cacheOptions: deployConfig.cacheOptions,
      certificateArn: deployConfig.certificateArn,
      dbOptions: deployConfig.dbOptions,
      ecsClusterName,
      enableExecuteCommand: yn(deployConfig.enableExecuteCommand),
      env: {
        account: awsAccountId,
        region: awsRegion,
      },
      firewallSgId: deployConfig.firewallSgId,
      lbOptions: deployConfig.lbOptions,
      notifications: deployConfig.notifications ?? {},
      scheduledTasks: deployConfig.scheduledTasks,
      stackName,
      tags: {
        caccl_deploy_stack_name: stackName,
        ...deployConfig.tags,
      },
      taskCount: Number(deployConfig.taskCount ?? 1),
      taskDefProps: {
        appImage: deployConfig.appImage,
        gitRepoVolume: deployConfig.gitRepoVolume,
        logRetentionDays: deployConfig.logRetentionDays,
        proxyImage: deployConfig.proxyImage,
        taskCpu: deployConfig.taskCpu,
        taskMemory: deployConfig.taskMemory,
      },
      vpcId,
    };

    // docDb config backwards compatibility
    if (yn(deployConfig.docDb)) {
      stackProps.dbOptions = {
        engine: 'docdb',
        instanceCount: deployConfig.docDbInstanceCount,
        instanceType: deployConfig.docDbInstanceType,
        profiler: deployConfig.docDbProfiler,
      };
    }

    const app = new App({
      context: {
        '@aws-cdk/aws-rds:lowercaseDbIdentifier': false,
      },
    });

    const stack = new CacclDeployStack(app, stackName, stackProps);

    new CfnOutput(stack, 'DeployConfigHash', {
      exportName: `${stackName}-deploy-config-hash`,
      value: deployConfigHash,
    });

    new CfnOutput(stack, 'CacclDeployVersion', {
      exportName: `${stackName}-caccl-deploy-version`,
      value: cacclDeployVersion,
    });

    return app;
  }

  private async initializeToolkit(profile?: string): Promise<Toolkit> {
    const toolkitConfig: any = {
      ioHost: {
        // Configure output handling
        onData: (data: Buffer) => {
          this.log(data.toString());
        },
      },
    };

    // Configure AWS SDK to use the specified profile
    if (profile) {
      process.env.AWS_PROFILE = profile;
    }

    // Set AWS region
    if (!process.env.AWS_REGION) {
      process.env.AWS_REGION = 'us-east-1';
    }

    return new Toolkit(toolkitConfig);
  }

  private async executeCdkCommand(
    toolkit: Toolkit,
    cloudAssembly: ICloudAssemblySource,
    stackSelection: StackSelector,
  ): Promise<void> {
    // Destructure flags
    const { profile, yes } = this.context;

    // Execute the requested CDK operation
    switch (this.args.stackSubcommand) {
      case 'list': {
        const stacks = await toolkit.list(cloudAssembly, {
          stacks: { strategy: StackSelectionStrategy.ALL_STACKS },
        });
        for (const stack of stacks) {
          this.log(stack.id);
        }

        break;
      }

      case 'synth': {
        // The synth already happened when we created the cloud assembly
        // Output the synthesized template
        const stack = await toolkit.list(cloudAssembly, {
          stacks: stackSelection,
        });
        if (stack[0]) {
          this.log(JSON.stringify(stack[0], null, 2));
        }

        break;
      }

      case 'diff': {
        await toolkit.diff(cloudAssembly, {
          stacks: stackSelection,
          strict: false,
        });
        break;
      }

      case 'deploy':
      case 'changeset': {
        const deployOptions: any = {
          execute: this.args.stackSubcommand === 'deploy',
          requireApproval: yes ? 'never' : 'broadening',
          stacks: stackSelection,
        };

        if (profile) {
          deployOptions.profile = profile;
        }

        await toolkit.deploy(cloudAssembly, deployOptions);
        break;
      }

      case 'destroy': {
        const destroyOptions: any = {
          force: yes,
          stacks: stackSelection,
        };

        if (profile) {
          destroyOptions.profile = profile;
        }

        await toolkit.destroy(cloudAssembly, destroyOptions);
        break;
      }

      default: {
        this.exitWithError(`Unknown subcommand: ${this.args.stackSubcommand}`);
      }
    }
  }

  public async run(): Promise<void> {
    // Destructure flags
    const { profile, yes } = this.context;

    // get this without resolved secrets for passing to cdk
    const deployConfig = await this.getDeployConfig(profile, true);

    // get it again with resolved secrets so we can make our hash
    const deployConfigHash = DeployConfig.toHash(
      await this.getDeployConfig(profile),
    );

    /**
     * Get the important ids/names from our infrastructure stack:
     *   - id of the vpc
     *   - name of the ECS cluster
     *   - name of the S3 bucket where the load balancer will send logs
     */
    const cfnStackName = this.getCfnStackName();
    const stackExists = await cfnStackExists(cfnStackName, profile);
    const { albLogBucketName, ecsClusterName, vpcId } =
      await getCfnStackExports(deployConfig.infraStackName, profile);

    /**
     * Create an object structure with all the info
     * the CDK stack operation will need
     */
    const awsAccountId = await getAccountId(profile);
    const cdkStackProps: CacclDeployStackPropsData = {
      albLogBucketName,
      awsAccountId,
      awsRegion: process.env.AWS_REGION || 'us-east-1',
      cacclDeployVersion: CACCL_DEPLOY_VERSION,
      deployConfig,
      deployConfigHash,
      ecsClusterName,
      stackName: cfnStackName,
      vpcId,
    };

    // Handle special commands that don't require CDK Toolkit
    switch (this.args.stackSubcommand) {
      case 'dump': {
        this.exitWithSuccess(JSON.stringify(cdkStackProps, null, '  '));
        return;
      }

      case 'info': {
        if (!stackExists) {
          this.exitWithError(`Stack ${cfnStackName} has not been deployed yet`);
        }

        const stackExports = await getCfnStackExports(cfnStackName, profile);
        this.exitWithSuccess(JSON.stringify(stackExports, null, '  '));
        return;
      }
    }

    // Set removal policy based on production account
    if (
      cdkStackProps.deployConfig.dbOptions &&
      !cdkStackProps.deployConfig.dbOptions.removalPolicy
    ) {
      cdkStackProps.deployConfig.dbOptions.removalPolicy = (await isProdAccount(
        this.context,
      ))
        ? 'RETAIN'
        : 'DESTROY';
    }

    // Check version and confirm production operations
    if (
      ['changeset', 'deploy', 'destroy'].includes(this.args.stackSubcommand)
    ) {
      // check that we're not using a wildly different version of the cli
      if (
        stackExists &&
        !yes &&
        !(await stackVersionDiffCheck(this.getCfnStackName(), profile))
      ) {
        this.exitWithSuccess();
        return;
      }

      // production failsafe if we're actually changing anything
      if (!(await confirmProductionOp(this.context))) {
        this.exitWithSuccess();
        return;
      }
    }

    try {
      // Initialize the CDK Toolkit
      const toolkit = await this.initializeToolkit(profile);

      // Create the CDK app with our stack
      const app = await this.createCdkApp(cdkStackProps);

      // Synthesize the cloud assembly
      const cloudAssembly = await toolkit.fromAssemblyBuilder(async () => {
        return app.synth();
      });

      // Define stack selection
      const stackSelection = {
        patterns: [cfnStackName],
        strategy: StackSelectionStrategy.PATTERN_MUST_MATCH,
      };

      await this.executeCdkCommand(toolkit, cloudAssembly, stackSelection);

      this.exitWithSuccess('done!');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : `Error while executing CDK: ${error}`;
      this.exitWithError(message);
    }
  }
}
