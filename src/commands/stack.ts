/* eslint-disable class-methods-use-this */
/* eslint-disable camelcase */
import {
  type IIoHost,
  NonInteractiveIoHost,
  StackSelectionStrategy,
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

  /**
   * Creates the CDK App with the CacclDeployStack
   * @author Benedikt Arnarsson
   * @param stackPropsData CacclDeployStackPropsData the stack props for constructing the CDK app
   * @returns App the CDK app which we will perform the subcommands on
   */
  private createCdkApp(stackPropsData: CacclDeployStackPropsData): App {
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

  /**
   * Creates a custom IoHost for handling CDK Toolkit output
   * @author Benedikt Arnarsson
   * @returns IIoHost defines how the CDK toolkit will perform I/O for notifications/messages
   */
  private createIoHost(): IIoHost {
    return new NonInteractiveIoHost();
  }

  /**
   * Initialize the CDK Toolkit with proper configuration
   * @author Benedikt Arnarsson
   * @param [profile] string the AWS profile used to execute the CDK operations, default to "default"
   * @returns Promise<Toolkit> the AWS CDK Toolkit for executing CDK operations
   */
  private async initializeToolkit(profile?: string): Promise<Toolkit> {
    // Configure AWS SDK to use the specified profile
    if (profile) {
      process.env.AWS_PROFILE = profile;
    }

    // Set AWS region
    if (!process.env.AWS_REGION) {
      process.env.AWS_REGION = 'us-east-1';
    }

    return new Toolkit({
      ioHost: this.createIoHost(),
    });
  }

  /**
   * Build the CDK stack properties data
   * @author Benedikt Arnarsson
   * @param opts options for building the stack props
   * @returns CacclDeployStackPropsData the stack props to be passed into the CDK toolkit for subcommands/operations
   */
  private async buildStackPropsData(opts: {
    cfnStackName: string;
    deployConfig: any;
    deployConfigHash: string;
    profile?: string;
  }): Promise<CacclDeployStackPropsData> {
    const { cfnStackName, deployConfig, deployConfigHash, profile } = opts;
    const { albLogBucketName, ecsClusterName, vpcId } =
      await getCfnStackExports(deployConfig.infraStackName, profile);

    const awsAccountId = await getAccountId(profile);

    return {
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
  }

  /**
   * Handle special commands that don't require CDK operations
   * @author Benedikt Arnarsson
   * @param opts options for handleSpecialCommands
   * @param opts.cdkStackProps CacclDeployStackPropsData information for the CACCL deploy stack
   * @param opts.cfnStackName string name of the CloudFormation stack which the command is operating on
   * @param [opts.profile] string AWS profile to execute the command with, defaults to "default"
   * @param opts.stackExists boolean whether the AWS stack exists or not
   * @returns Promise<boolean> the success status of the command
   */
  private async handleSpecialCommands(opts: {
    cdkStackProps: CacclDeployStackPropsData;
    cfnStackName: string;
    profile?: string;
    stackExists: boolean;
  }): Promise<boolean> {
    const { cdkStackProps, cfnStackName, profile, stackExists } = opts;
    switch (this.args.stackSubcommand) {
      case 'dump': {
        this.exitWithSuccess(JSON.stringify(cdkStackProps, null, '  '));
        return true;
      }

      case 'info': {
        if (!stackExists) {
          this.exitWithError(`Stack ${cfnStackName} has not been deployed yet`);
        }

        const stackExports = await getCfnStackExports(cfnStackName, profile);
        this.exitWithSuccess(JSON.stringify(stackExports, null, '  '));
        return true;
      }

      default: {
        return false;
      }
    }
  }

  /**
   * Perform pre-deployment checks
   * @author Benedikt Arnarsson
   * @param stackExists boolean indicating whether the stack exists
   * @param cfnStackName string the stack's CloudFormation name
   * @param [profile] string for the AWS profile, defaults to "default"
   * @returns Promise<boolean> whether deployment checks passed or not
   */
  private async performPreDeploymentChecks(
    stackExists: boolean,
    cfnStackName: string,
    profile?: string,
  ): Promise<boolean> {
    const { yes } = this.context;

    if (
      ['changeset', 'deploy', 'destroy'].includes(this.args.stackSubcommand)
    ) {
      // check that we're not using a wildly different version of the cli
      if (
        stackExists &&
        !yes &&
        !(await stackVersionDiffCheck(cfnStackName, profile))
      ) {
        return false;
      }

      // production failsafe if we're actually changing anything
      if (!(await confirmProductionOp(this.context))) {
        return false;
      }
    }

    return true;
  }

  /**
   * Execute CDK operations using the toolkit
   * @author Benedikt Arnarsson
   * @param toolkit Toolkit AWS CDK toolkit for executing subcommands
   * @param app App AWS CDK App for executing subcommands on
   * @param cfnStackName string CloudFormation name of the stack
   * @returns Promise<void>
   */
  private async executeCdkOperation(
    toolkit: Toolkit,
    app: App,
    cfnStackName: string,
  ): Promise<void> {
    const { yes } = this.context;

    // Synthesize the cloud assembly
    const assembly = app.synth();

    // Use fromCdkApp with the temp directory as the CDK app
    const cloudAssembly = await toolkit.fromAssemblyBuilder(async () => {
      return assembly;
    });

    // Define stack selection
    const stackSelection = {
      patterns: [cfnStackName],
      strategy: StackSelectionStrategy.PATTERN_MUST_MATCH,
    };

    // Execute the requested CDK operation
    switch (this.args.stackSubcommand) {
      case 'list': {
        const stacks = await toolkit.list(cloudAssembly, {
          stacks: {
            patterns: [],
            strategy: StackSelectionStrategy.ALL_STACKS,
          },
        });
        for (const stack of stacks) {
          this.log(stack.id);
        }

        break;
      }

      case 'synth': {
        // Output the synthesized template
        const stack = assembly.getStackByName(cfnStackName);
        this.log(JSON.stringify(stack.template, null, 2));
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

        await toolkit.deploy(cloudAssembly, deployOptions);
        break;
      }

      case 'destroy': {
        const destroyOptions: any = {
          force: yes,
          stacks: stackSelection,
        };

        await toolkit.destroy(cloudAssembly, destroyOptions);
        break;
      }

      default: {
        this.exitWithError(`Unknown subcommand: ${this.args.stackSubcommand}`);
      }
    }
  }

  public async run(): Promise<void> {
    const { profile } = this.context;

    // Get deployment configuration
    const deployConfig = await this.getDeployConfig(profile, true);
    const deployConfigHash = DeployConfig.toHash(
      await this.getDeployConfig(profile),
    );

    // Get stack information
    const cfnStackName = this.getCfnStackName();
    const stackExists = await cfnStackExists(cfnStackName, profile);

    // Build stack properties
    const cdkStackProps = await this.buildStackPropsData({
      cfnStackName,
      deployConfig,
      deployConfigHash,
      profile,
    });

    // Handle special commands
    const handled = await this.handleSpecialCommands({
      cdkStackProps,
      cfnStackName,
      profile,
      stackExists,
    });
    if (handled) return;

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

    // Perform pre-deployment checks
    const shouldContinue = await this.performPreDeploymentChecks(
      stackExists,
      cfnStackName,
      profile,
    );
    if (!shouldContinue) {
      this.exitWithSuccess();
      return;
    }

    try {
      // Initialize the CDK Toolkit
      const toolkit = await this.initializeToolkit(profile);

      // Create the CDK app with our stack
      const app = this.createCdkApp(cdkStackProps);

      // Execute the CDK operation
      await this.executeCdkOperation(toolkit, app, cfnStackName);

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
