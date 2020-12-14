# caccl-deploy

This package provides a CLI and an [aws-cdk](https://aws.amazon.com/cdk/) library of constructs for deploying apps to AWS Elastic Container Service (ECS). It was created for Nodejs/React [CACCL](https://github.com/harvard-edtech/caccl) apps but will someday hopefully work for any webapp that can run via a Docker image and sit behind an nginx proxy and AWS Application Load Balancer.

### Requirements

- nodejs ≥ v10
- a docker image that runs your app on port 8080
- the [awscli tool](https://aws.amazon.com/cli/) installed and configured
- an AWS Certificate Manager certificate. You probably want one that matches the hostname you have in mind for the app.
- an AWS account with create/update privileges for the following services and/or resources:
  - VPC
  - Elastic Load Balancer
  - ECS
  - IAM Role
  - Cloudwatch Logs
  - Cloudformation
  - S3
  - SNS
  - SSM Parameter Store
  - SecretsManager
  - Lambda (if using slack notifications)

### How does it work? / What does it do?

`caccl-deploy` lets you to do two main things:

- create and manage the deployment configuration for containerized apps
- provision, deploy and update those apps on ECS/Fargate

There are also a couple of subcommands for
An "app" is considered to be a Nodejs/React app that has been packaged as a Docker image. The "deployment" of the app will consist of an Application Load Balancer, a Fargate Service, and a Fargate Task with, in most cases, two containers: an nginx reverse proxy and the app itself.

As part of this app deployment, `caccl-deploy` will create and manage a deployment configuration. This configuration will be stored in a combination of SSM Parameter Store entries and SecretsManager entries. The configuration consists of:

- the name of the CloudFormation stack containing your underlying infrastructure (VPC, ECS Cluster)
- the ARN of an ACM ssl certificate
- one of either
	- the ARN of a Docker image in an ECR repository
	- the name of an image in, e.g., DockerHub
- a set of 0 or more environment variables your app needs
- a set of 0 or more AWS resource tags
- various task provisioning settings, such as number of CPUs, memory, number of tasks, etc

### Install & Getting Started

For the typical use case `caccl-deploy` should be installed globally.

`npm install -g caccl-deploy`

If you are developing `caccl-deploy` you'll want to `git clone` the repo and do:

`npm install && npm link`

##### awscli

If you have not already, make sure to install [awscli](https://aws.amazon.com/cli/) and run `aws configure` to configure your AWS credentials. Otherwise `caccl-deploy` will complain and refuse to run.
`
### Quick command summary

These are all executed via the `caccl-deploy` cli. For example, `caccl-deploy new`. Execute `caccl-deploy` with no options or with the `-h|--help` flag to show the list of subcommands. Use the `-h|--help` flag on any of the subcommands to show the options available.

`new` - create a new app configuration via import or CLI prompts or a combination of both

`apps` - list existing app configurations

`delete` - remove an app configuration

`show` - output an app's configuration data

`update` - modify or delete a single setting in an app's configuration

`repos` - list your available ECR repositories

`images` - list the available images in an ECR repository

`stack` - do stuff with the app's CDK-based CloudFormation stack

`release` - update an app's Docker image and restart the Fargate service

`restart` - restart an app's Fargate service

### Configuring `caccl-deploy`

The `caccl-deploy` cli has it's own configuration file for providing default values to options common to many of the subcommands. The location of the file is dependent on your system. For instance, on Linux, mine is at `~/.config/caccl-deploy-nodejs/config.json`.

The first time you run `caccl-deploy` (or if its config file is not present) there is an initialization sequence that will create the file with a couple of necessary settings and prompt you to confirm.

```
   ____               _       ____             _             _
  / ___|__ _  ___ ___| |     |  _ \  ___ _ __ | | ___  _   _| |
 | |   / _` |/ __/ __| |_____| | | |/ _ \ '_ \| |/ _ \| | | | |
 | |__| (_| | (_| (__| |_____| |_| |  __/ |_) | | (_) | |_| |_|
  \____\__,_|\___\___|_|     |____/ \___| .__/|_|\___/ \__, (_)
                                        |_|            |___/
It looks like this is your first time running caccl-deploy.
A preferences file has been created at ~/.config/caccl-deploy-nodejs/config.json
with the following default values:

  - ssmRootPrefix: /caccl-deploy
  - cfnStackPrefix: CacclDeploy-

Please see the docs for explanations of these settings
✖ Continue … yes
```

There are four possible settings in the `config.json`:

- `ssmRootPrefix` (string) - this determines the root namespace for all SSM Parameter Store entries controlled by `caccl-deploy`. For instance, the default value of `/caccl-deploy` means that the program will only look for parameters whose names begin with that string, and newly created app configurations will be created with a namespace of `/caccl-deploy/my-new-app`. See the section below on Parameters & Secrets for more detail.
- `cfnStackPrefix` (string) - this determines the prefix for all CloudFormation stacks controlled by `caccl-deploy`. For example, if you create an app called "foo-app" it will be provisioned with the CFn stack "CacclDeploy-foo-app".
- `ecrAccessRoleArn` (string) - the ARN of an IAM role for allowing cross-account access to ECR repositories and images. This setting is necessary for situations in which you have multiple AWS accounts but only use ECR repos/images in one of them. See the section below on ECR Repositories.
- `productionAccouts` (array) - if you want an additional, loud warning prompt when performing operations on a production account, include its account id (as a string) here.

### Deployment configuration

The deployment configuration for an app can be represented as JSON but is stored in a flattened state in AWS Parameter Store as separate entries beneath an app namespace. For example, this snippet of a JSON-serialized configuration for an app called "my-app"...

```
{
  ...
  "notifications": {
    "email": "somebody@example.edu",
    "slack": "https://hooks.slack.com/services/abc/123/xyz"
  }
  ...
}

```

... would be stored as two Parameter Store entries:

- `/caccl-deploy/my-app/notifications/email`
- `/caccl-deploy/my-app/notifications/slack`

To view the JSON-serialized configuration you can use the `caccl-deploy show` subcommand, e.g. `caccl-deploy show --app my-app`. Add the `--flat` option to that command to view a flattend version of the JSON.

##### Complete configuration example

```
{
  // These are required
  "infraStackName": "my-infra-stack",
  "appImage": "arn:aws:ecr:us-east-1:123456789012:repository/hdce/my-app-image:1.0.0",
  "certificateArn": "arn:aws:acm:us-east-1:123456789012:certificate/172b09cc-84a8-4d9d-a463-c1fc0f19a3fd",

  // Everything else is optional or has defaults
  "appEnvironment": {
    "FOO": "barbar",
    "WOOF": "12345",
    "BAZ": "blarg"
  },
  "notifications": {
    "slack": "https://hooks.slack.com/services/abc/123/xyz",
    "email": "somebody@example.edu",
  },
  "tags": {
    "AppName": "my-app",
    "DeployedUsing": "caccl-deploy"
  },
  "taskCount": "1",
  "taskCpu": "256",
  "taskMemory": "512",
  "docDb": "false",
  "docDbInstanceCount": "1",
  "docDbInstanceType": "t3.medium",
  "docDbProfiler": "true",
  "gitRepoVolume": {
    "appContainerPath": "/app/volume",
    "repoUrlSecretArn": "arn:aws:secretsmanager:us-east-1:123456789012:secret:/caccl-deploy/my-app/git-repo-url"
  }
}

```

##### Config setting explanations

First the required values.

`infraStackName` - this tells `caccl-deploy` what set of shared infrastructure resources your app will be deployed into. For this setting you just want the string value of the CloudFormation stack name. The companion project, [dce-ecs-infra]() is what we use to build out that infrastructure.

`appImage` - this tells `caccl-deploy` where to find your app's Docker image. This value should be the ARN of an ECR repo plus an image tag. It's also possible to use a DockerHub name:tag combo, but some of the `caccl-deploy` subcommands (`release` for example) are not compatible with that use.

`certificateArn` - one of the components of the app provisioning that `caccl-deploy` creates is a Application Load Balancer. You will need to create (or import) an ACM certificate so that it can be attached to the load balancer. This value should be the full ARN of that certfiicate.

Now the optional stuff.

`appEnvironment` - a set of key value pairs that will be injected into your app's runtime container environment. You'll probably have some of these. Note that the actual values of these are always stored as SecretsManager entries, and your ECS Fargate Task Definition will be created with the ARN values of those secrets. `caccl-deploy` manages the registering/resolving for you, so when you run `caccl-deploy show --app my-app` the output will contain the raw, dereferenced strings. You can add the `--no-resolve-secrets` flag to see the actual ARN values.

`notifications.slack` - a slack webhook URL. If configured this will result in a Lambda function being added to your stack and subscribed to the stack's SNS topic for alert notifications.

`notifications.email` - an email address for subscribing to the stack's SNS topic for alerts and other notifications. This setting also supports a list of addresses, which would be represented as `notifications.email.[0-n]`. In other words, the following configuration is also supported:

```
{
  "notifications": {
    "email": [
      "foo@example.com",
      "bar@example.com"
    ]
  }
}
```
_**Important**_: The configured address(es) will redceive a confirmation message and must confirm to complete the subscription.

`tags` - a set of key value pairs. these will be assigned to the CloudFormation stack and by extension all the resources in the stack (for resource types that support this (which is most)).

`taskCount` - how many concurrent tasks should the Fargate service run. Default is "1".

`taskCpu` - the amount of CPU units assigned to each task. Default is "256", which is equivalent to 1 virtual CPU (vCPU). See note below.

`taskMemory` - memory in MB assigned to each task. Default is "512". See note below.

`docDb` - does the app need a DocumentDB cluster? If "true" one will be provisioned and its connection details and credentials injected into the container environment. See the DocumentDB section below for more info.

`docDbInstanceCount` - Default is "1". Production apps should use "2" to allow for multi-az replication.

`docDbInstanceType` - Default should be fine for dev/stage apps. Consider a "db.r5.large" for production.

`docDbProfiler` - Enable the DocDB cluster's slow query profiling option. The default threshold for what's considered a slow query is 500ms.

`gitRepoVolume` - You can ignore this unless you have the very edge case situation in which your app needs a private git repo to be checked out to an attached volume. In which case set the mount path with `appContainerPath` and the `repoUrlSecretArn` with the ARN of a SecretsManager entry containing the full url of the github repo, including username and password.

##### A note about `taskCpu` and `taskMemory`

These values are closely related, and setting one affects the set of valid choices for the other. See the [ECS docs](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html#task_size) for the constraints on these values.

For dev/staging apps the defaults are almost always going to be fine. An exception might be if you're trying to load test something, in which case it's going to depend on what you're trying to test. As a general rule it's typical to have a 1:2 ratio of cpu:memory. For instance, a production app might have "2048" for `taskCpu` and "4096" for `taskMemory`.

### Parameters & appEnvironment Secrets

`caccl-deploy` stores app deployment configurations in AWS Parameter Store as a set of individual parameters using a namespace hierarchy. This is fairly common approach and has been [written](https://medium.com/nordcloud-engineering/ssm-parameter-store-for-keeping-secrets-in-a-structured-way-53a25d48166a) up in [various](https://aws.amazon.com/blogs/mt/organize-parameters-by-hierarchy-tags-or-amazon-cloudwatch-events-with-amazon-ec2-systems-manager-parameter-store/) places.

The exception is values that are part of your `appEnvironment` settings. For each variable defined in `appEnvironment`, `caccl-deploy` creates a corresponding SecretsManager entry and then stores the ARN of the secret as the value of the Parameter store entry. Yes, this is a bit convoluted, but the creation, updating and deletion of these settings should be handled seamlessly by the program.

### ECR Repositories

Some of `caccl-deploy`'s functionality assumes the existence of ECR repositories. For instance, the `repos` subcommand will output a list of available repositories, and the `images` subcommand will provide a list of images/tags within a given repository.

DCE uses [dce-ecr-action](https://github.com/harvard-edtech/dce-ecr-action) to create and push images to ECR respositories using Github Actions.

##### Cross account ECR access setup

In situations where you have multiple AWS accounts (e.g. "production" vs "development") but keep all your ECR repos in one of them, cross-account access is necessary for two reasons:

1. when Fargate tasks execute in the production account they need to be able to pull images from the development account's ECR repositories
1. `caccl-deploy` provides a `--profile` option for working with multiple AWS accounts. Some subcommand processes need to access and manipulate resources in the production account, but also access the ECR repositories in the development account. Rather than juggling multiple aws-sdk API clients, one for each account, the `caccl-deploy` code can create a single client connection and use a cross-account access IAM role when necessary.

There are two parts to setting this up. For the purposes of this README lets assume you have a "production" account and a "development" account, and your ECR repos are managed in the "development" account.

1. To allow image pulling from production tasks all ECR repos need to have the following in their permission policies:

```
{
  "Version": "2008-10-17",
  "Statement": [
    {
      "Sid": "AllowPushPull",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::[production account id]:root"
      },
      "Action": [
        "ecr:BatchCheckLayerAvailability",
        "ecr:BatchGetImage",
        "ecr:CompleteLayerUpload",
        "ecr:GetDownloadUrlForLayer",
        "ecr:InitiateLayerUpload",
        "ecr:PutImage",
        "ecr:UploadLayerPart"
      ]
    }
  ]
}
```

2. For `caccl-deploy` to work with multiple accounts there needs to be an IAM role that it can assume in the account containing the ECR repos. This role needs to have ECR permissions (the AmazonEC2ContainerRegistryPowerUser managed policy is good), and in its Trust Relationship settings you'll need this policy document:

```
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": [
          "arn:aws:iam::[production account id]:root"
        ]
      },
      "Action": "sts:AssumeRole",
    }
  ]
}
```

Once this role is created its ARN should be added to your `caccl-deploy` configuration file. See "Configuring caccl-deploy" above.

### DocumentDB

For apps that require a DocumentDB instance include `"docDb": "true"` int your deploy configuration. You can add to an existing configuration using the `update` command.

`caccl-deploy update -a [app name] docDb true`

By default you will get a single instance of type "t3.medium". We turn slow query profiling on by default.

A shell script, `bin/docdb.sh` is provided to assist in accessing the resulting database. It might work out of the box or at least be useful as a starting point.

---

### Example scenarios

##### Create a new app from scratch

1. Run `caccly-deploy new`. You will be prompted for the following values. **Note**: all except the app name can be changed prior to the actual deployment:
    - The name of your app. This should be unique for the AWS account.
    - The base infrastructure stack into which your app will be deployed. If there's only one available it will be selected for you.
    - The full ARN identifier of your AWS Certificate Manager entry.
    - The ECR repository where your app's images are registered
    - The ECR image tag to use. If you don't see the one you want, just pick one; you can change it later.
    - Any AWS resource tags to apply to your app's CloudFormation stack
    - Any environment variables that should be injected into the container's runtime environment.
1. Optionally, run `caccl-deploy update --app [your app name] [setting] [value]` to add or update the generated deployment configuration.
1. Optionally, run `caccl-deploy stack --app [your app name] diff` to sanity check and see the list of resources that will be created by the CDK/CloudFormation process.
1. Run `caccl-deploy stack --app [your app name] deploy` to deploy the app. After a few minutes your app should be available and running.
1. The output from the previous command should include the hostname of your app's load balancer. Head over to Route53 and create a alias record that points your (sub)domain to the load balancer.

##### Create a new app by "cloning" the configuration for an existing app

Let's say you had an existing app called "fooapp-stage" and you wanted to create a new development instance called "fooapp-dev" with the only difference being the name of the app (i.e. the container image and all the environment variables would be the same).

1. Run `caccl-deploy show --app fooapp-stage > fooapp-dev.json` to export the existing app's config to a file.
1. Run `caccl-deploy new --app fooapp-dev -i $(pwd)/fooapp-dev.json` to import the configuration for the new app.
1. Proceed with steps 2-x from the previous scenario.

##### Update an environment variable for an existing app

Let's say your app had a couple of environment variables that needed to be changed, `API_KEY` and `API_SECRET`.

1. Run `caccl-deploy show --app [your app name]` to review your app's current configuration and environment variables.
    - Remember that, by default, `caccl-deploy` will dereference and display the raw string values of your environment variables. To see the ARNs of the SecretsManager entries you can add the `--no-resolve-secrets` flag to the above command.
1. Update the `API_KEY` variable to the app environment: `caccl-deploy update --app [your app name] appEnvironment/API_KEY my-api-key`
1. Update the `API_SECRET` variable to the app environment: `caccl-deploy update --app [your app name] appEnvironment/API_SECRET 12345abcdef`
1. Run `caccl-deploy restart --app [your app name]`

Note that the final step is only a `restart` vs a `stack ... deploy`. This is because we're only changing the values of _existing_ environment variables, i.e., we're not adding anything _new_ to the app's CloudFormation stack. If you were adding a new environment variable you would need to run a `stack ... deploy` command as shown in the next scenario.

##### Add a new environment variable to an existing app

In this example we're going to add a new variable, `API_BASE_URL`, to an existing configuration.

1. Run `caccl-deploy show --app [your app name]` to review your app's current configuration and environment variables.
    - Remember that, by default, `caccl-deploy` will dereference and display the raw string values of your environment variables. To see the ARNs of the SecretsManager entries you can add the `--no-resolve-secrets` flag to the above command.
1. Add the `API_BASE_URL` value to the app environment: `caccl-deploy update --app [your app name] appEnvironment/API_BASE_URL https://api.example.edu/v1`
1. Review the app's stack changes `caccl-deploy stack --app [your app name] diff`
1. Deploy the app's stack changes `caccl-deploy stack --app [your app name] deploy`. _**WARNING**_ this will restart the app.

Note that you do not need a separate `restart` action in this case. The `stack ... deploy` action will do that for you as a result of the changes to the Fargate Task Definition.

---

### Subommands & Options Details

```
Usage: caccl-deploy [options] [command]

A cli tool for managing ECS/Fargate app deployments

Options:
  -V, --version      output the version number
  -h, --help         display help for command

Commands:
  apps [options]     list available app configurations
  new [options]      create a new app configuration
  delete [options]   delete an app configuration
  show [options]     display an app's current configuration
  update [options]   update (or delete) a single deploy config setting
  repos [options]    list the available ECR repositories
  images [options]   list the most recent available ECR images for an app
  stack [options]    diff, deploy, or delete the app's AWS resources
  restart [options]  no changes; just force a restart
  release [options]  release a new version of an app
  help [command]     display help for command
```

#### Common Options

`-V`/`--version`: This will output a generated string with the installed package version. In development context (i.e., if running from a git checkout) the version string will also include the current commit hash and branch name.

`-h`/`--help`: show usage info for the program or any subcommand

`-y`/`--yes`: for any option that would normally prompt for confirmation, including production account failsafe confirmations, adding this option will assume "yes" for all prompts. Should really be used carefully and perhaps only in some kind of scripted operation context. For subcommands that don't actually modify resources this flag does nothing.

`--profile`: this controls which set of credentials will be used for interactions with AWS. `caccl-deploy` does not manage these credentials for you; it is assumed you have the `awscli` program installed and configured.

`--ssm-root-prefix`, `--cfn-stack-prefix`, `--ecr-access-role-arn`: these are command-line args that correspond to the settings described in "Configuring caccl-deploy" above.

#### Subcommands

#### apps

This will list the existing app configurations found using the provided or configured SSM parameter name prefix.

- `--full-status` - enables the output of additional information. If the app configuration has a corresponding CloudFormation stack (i.e., it's been deployed) then 3 additional columns will be generated:
    * "Infra Stack": shows the name of the shared infrastructure stack the app is or will be deployed to
    * "Stack Status": shows the current status of the Cloudformation stack, e.g. "UPDATE_COMPLETE".
    * "Config Drift": a "yes" value means that the app's current deployment configuration is not in sync with the Cloudformation deployment.

---

#### new

This command allows you to create a new app configuration in a few ways:

* from scratch with prompts for the required options
* import from a json file using the `-i` option, with prompts for any missing, required values
* import from a URL (json response) using the `-i` option, with prompts for any missing, required values

The required options (also described above in the section on "Config setting explanations") which will need to be provided via prompt or included in your imported json, are:

- `infraStackName` - this is the name of the CloudFormation stack that holds the shared infrastructure (VPC, ECS cluster). If not provided, the process will allow you to select from a list of available infrastructure stacks in the AWS account being used.

- `certificateARN` - the full ARN of an ACM certificate entry. This certificate will be used for the load balancer's HTTPS listener.

- `appImage` - the id of your app's Docker image.

The process will also prompt you to add any desired AWS resource tags and app environment variables.

When finished the process stores the deployment configuration settings in Parameter Store (and SecretsManager for any app environment variable values) using a namespace formed from your `ssmRootPrefix` and the app name.

##### options

- `-a`/`--app` - the name of the app. You will be prompted for this value if not provided. This should be unique for the AWS account being used. Otherwise you will be prompted to first wipe any existing configuration for the specified app name.
- `-i`/`--import` - use this option to import existing configuration settings (in json form) from a file or url.

---

#### show

Display the current deployment configuration for an app. The process fetches the relevant Parameter Store entries based on the `/[ssmRootPrefx]/[app name]` namespace and assembles them into a json object and outputs to stdout.

##### options

- `-a`/`--app` (required) - the name of the app
- `-f`/`--flat` - show the flattened version of the configuration data.
- `--no-resolve-secrets` - by default the output will include the actual, dereferenced values of app environment variables stored in SecretsManager. Use this option to see the ARNs of the SecretsManger entries instead.

---

#### delete

Remove an app configuration entirely. This wipes out all Parameter Store entries for a app, including any referenced SecretsManager entries.

##### options

- `-a`/`--app` (required) - the name of the app

---

#### update

This subcommands allows adding, updating or deleting a single configuration setting.

For adding or updating use the form `caccl-deploy update -a [app name] [param] [value]`.

To delete a setting use the `-D` flag, like `caccl-deploy update -a [app name] -D [param]`.

For nested values, like an app environment variable, use the full path to the setting. For instance, to update the value of the `FOOBAR` environment variable you would use `caccl-deploy update -a [app name] appEnvironment/FOOBAR baz`.

##### options

- `-a`/`--app` (required) - the name of the app

---

#### repos

Displays a list of the available ECR repositories. See details above about cross-account ECR stuff.

---

#### images

Given a respository, this command lists its avaialble images. Use this command to get the value for your configuration's `appImage` setting.

##### options

- `-r`/`--repository` - the name of the ECR repository. Use the `repos` command to get the available list.
- `-A`/`--all` - By default the `images` command will only show those images that have been tagged with a semver-looking value, e.g. "1.0.0". Use this option to display all the available images, including those identified only by their git commit sha.

---

_The commands below all perform operations on the actual deployed resources_

---

#### stack

This subcommand acts as a wrapper for the `cdk` program (part of the [aws-cdk](https://aws.amazon.com/cdk/) library), which it spawns as a subprocess after setting up several variables in the process execution environment. Any valild `cdk` subcommand can be used, the default being `cdk list`. The most common operations will be `list`, `diff`, `deploy`, and `destroy`.

##### options

- `-a`/`--app` (required) - the name of the app

---

#### restart

This subcommand executes a forced redeploy of your app's ECS Fargate service without changes to any of the service or task settings. You would typically use this in a development context where, for instance, you're not switching to a new image tag but the app's current image ("stage") has been updated. Another use case would be if during development you change the value of an environment variable but you want to skip doing a full `stack deploy`.

_**IMPORTANT**_, any changes you have made to app environment variables or the app's container images (including the nginx proxy server) will be present when the service restarts.

##### options

- `-a`/`--app` (required) - the name of the app

---

#### release

This subcommand combines an change to the app's Docker image (i.e. switching to a new version tag) with a service restart.

For example, say your app's `appImage` was set to `arn:aws:ecr:us-east-1:123456789012:repository/hdce/tool-playground:1.0.0` and you wanted to release the image tagged `1.1.0`, you would do:

`caccl-deploy release -a my-app -i 1.1.0`

The `-i` input value is validated against the list of tags available in the repo indicated by your full image id. You will also be prompted to confirm if the tag is not for the most recent image available in the repository.

##### options

- `-a`/`--app` (required) - the name of the app
- `-i`/`--image-tag` (required) - the new image release tag. This can be any value shown in the output of the `images` subcommand.

---

### Development

As for the code here's an overview of what's where and what does what.

##### `index.js`

This is the main cli script that defines the `caccl-deploy` command and subcommands. It uses the [commander.js](https://github.com/tj/commander.js) library, making use of some of the provided hooks and overrides to customize how the command actions and options are implemented.

##### `./cdk/*`

The code in this directory is where the cdk app, stack and constructs are implemented. It's possible in theory to use this code directly via the cdk's own `cdk` command, but the expectation is that it be executed via the `caccl-deploy stack` subcommand, which sets up several important environment variables based on whichever app's deployment configuration is loaded.

##### `./cdk/cdk.json`

This file tells the cdk how to execute the cdk code.

##### `./cdk/cdk.context.json`

This file is generated by cdk and contains data about the VPC infrastructure. It _**should not**_ be added to version control.

##### `./cdk/index.ts`

This is the "main" script for the cdk code. It picks up the environment variables set by the `caccl-deploy stack` subcommand wrapper, fetches the deploy configuration from Parameter Store, and runs whatever cdk subcommand is requested (list, diff, deploy, etc).

##### `./cdk/lib/*`

These are the cdk construct classes that define the AWS resources that make up each app's stack.
