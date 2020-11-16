# caccl-deploy

This package provides a CLI and an [aws-cdk](https://aws.amazon.com/cdk/) library of constructs for deploying apps to AWS Elastic Container Service (ECS). It was created for Nodejs/React [CACCL](https://github.com/harvard-edtech/caccl) apps but will someday hopefully work for any webapp that can run via a Docker image and sit behind an nginx proxy and AWS Application Load Balancer.

### Requirements

- nodejs ≥ v10
- the `aws-cdk` package installed globally: `npm install -g aws-cdk@latest`
- a docker image that runs your CACCL app
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

There are three possible settings in the `config.json`:

- `ssmRootPrefix` (string) - this determines the root namespace for all SSM Parameter Store entries controlled by `caccl-deploy`. For instance, the default value of `/caccl-deploy` means that the program will only look for parameters whose names begin with that string, and newly created app configurations will be created with a namespace of `/caccl-deploy/my-new-app`. See the section below on Parameters & Secrets for more detail.
- `cfnStackPrefix` (string) - this determines the prefix for all CloudFormation stacks controlled by `caccl-deploy`. For example, if you create an app called "foo-app" it will be provisioned with the CFn stack "CacclDeploy-foo-app".
- `ecrAccessRoleArn` (string) - the ARN of an IAM role for allowing cross-account access to ECR repositories and images. This setting is necessary for situations in which you have multiple AWS accounts but only use ECR repos/images in one of them. See the section below on ECR Repositories

### Deployment configuration

The deployment configuration for an app can be represented as JSON but is stored in a flattened state in AWS Parameter Store as separate entries beneath an app namespace. For example, this snippet of a JSON-serialized configuration for an app called "my-app"...

```
{
  ...
  "notifications": {
    "email": [ "somebody@example.edu" ],
    "slack": "https://hooks.slack.com/services/abc/123/xyz"
  }
  ...
}

```

... would be stored as two Parameter Store entries:

- `/caccl-deploy/my-app/notifications/email/0`
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
		"email": [
			"somebody@example.edu"
		]
	},
  "tags": {
    "AppName": "my-app",
    "DeployedUsing": "caccl-deploy"
  },
  "taskCount": "1",
  "taskCpu": "256",
  "taskMemoryLimit": "512",
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

`notifications.email.[0-n]` - these email addresses will be subscribed to the stack's SNS topic for alert notifications.

`tags` - a set of key value pairs. these will be assigned to the CloudFormation stack and by extension all the resources in the stack (for resource types that support this (which is most)).

`taskCount` - how many concurrent tasks should the Fargate service run. Default is "1".

`taskCpu`/`taskMemoryLimit` - these control the amount of CPU and memory resources assigned to each task. Default is "256" and "512" respectively. See the [ECS docs](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html#task_size) for the constraints on these values, but as a general rule it's typical to have a 1:2 ratio of cpu:memory.

`docDb` - does the app need a DocumentDB cluster? If "true" one will be provisioned and its connection details and credentials injected into the container environment. See the DocumentDB section below for more info.

`docDbInstanceCount` - Default is "1". Production apps should use "2" to allow for multi-az replication.

`docDbInstanceType` - Default should be fine for dev/stage apps. Consider a "db.r5.large" for production.

`docDbProfiler` - Enable the DocDB cluster's slow query profiling option. The default threshold for what's considered a slow query is 500ms.

`gitRepoVolume` - You can ignore this unless you have the very edge case situation in which your app needs a private git repo to be checked out to an attached volume. In which case set the mount path with `appContainerPath` and the `repoUrlSecretArn` with the ARN of a SecretsManager entry containing the full url of the github repo, including username and password.

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

### DocumentDB`
