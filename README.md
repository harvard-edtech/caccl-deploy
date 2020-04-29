# caccl-deploy

This package tries to provide a simple (yet opinionated) method of deploying
CACCL apps to AWS Elastic Container Service (ECS).

### Requirements

* nodejs ≥ v10
* a nodejs/react app built using the CACCL library
* one of the following:
    * docker installed locally
    * an existing docker image of the app
* an AWS account with create/update privileges for the following services and/or resources:
    * VPC
    * Elastic Load Balancer
    * ECS
    * IAM Role
    * Cloudwatch Log Group
    * Cloudformation
