# DocumentDB Upgrade Playbook

This guide documents the current workflow for upgrading a DocumentDB 3.6 cluster to 5.0 using a blue/green pattern with endpoint overrides and AWS DMS. It should also apply to future major version upgrades.

## General Approach

Keep the app pointed at the current (blue) DocumentDB endpoint while you deploy a new 5.0 (green) cluster in the same stack. Use AWS DMS to replicate data from blue to green (full load + CDC), validate the green cluster, then remove the endpoint override to cut over traffic.

## Assumptions

- You will set `dbOptions.clusterEndpointOverride` to the current blue endpoint during the migration.
- You will set `dbOptions.removalPolicy` to `RETAIN` so the blue cluster is preserved when it is removed from the stack.
- DMS tasks will be created manually in the AWS console.

## Notes on Deploying

The examples below use `caccl-deploy stack ... changeset` instead of `deploy` to prepare a change set for inspection in the CloudFormation console. This is a safer workflow than relying on `cdk diff` alone.

If you prefer, you can use `./bin/docdb-config-for-upgrade.sh` for the update steps instead of running each `caccl-deploy update ...` command manually.

## Migration Steps

### 1. Preparation

1. Take a snapshot of the blue cluster.
2. Set the cluster endpoint override to the current blue endpoint:

```bash
caccl-deploy update --app <app> dbOptions/clusterEndpointOverride <host:port>
```

3. Ensure database deletion policy is `RETAIN`:

```bash
caccl-deploy update --app <app> dbOptions/removalPolicy RETAIN
```

4. Prepare and apply the change set:

```bash
caccl-deploy stack --app <app> diff
...
caccl-deploy stack --app <app> changeset
```

### 2. Combined stack update: orphan blue + create green

1. Update the DocDB engine and parameter group versions for the new green cluster. Example for 5.0:

```bash
caccl-deploy update --app <app> dbOptions/engineVersion 5.0.0
caccl-deploy update --app <app> dbOptions/parameterGroupFamily docdb5.0
caccl-deploy update --app <app> dbOptions/docdbUseVersionSuffix true
 caccl-deploy update --app <app> lbOptions/targetDeregistrationDelay 5
```

2. Inspect the diff; you should see the blue resources marked as `orphan` and new green resources added.

```bash
caccl-deploy stack --app <app> diff
...
caccl-deploy stack --app <app> changeset
```

This deploy takes time (20-30 minutes) while the green cluster provisions. The blue cluster continues to operate uninterrupted because the app is still using the override endpoint.

Result:

- Blue cluster continues running but is now out-of-band, i.e. is not managed by CloudFormation and will not be impacted by subsequent deployments.
- Green cluster is fully CloudFormation-managed.
- App still uses blue.

### 3. Replication

1. Create DMS endpoints for the blue and green clusters:

```bash
./bin/dms-docdb-endpoints.sh --app <app> --db-name <db-name>
```

2. (Optional) Create the DMS replication instance if one does not already exist for the VPC:

```bash
./bin/create-dms-instance.sh --infra-stack <infra-stack>
```

3. Create the DMS replication task in the AWS console:

- Task identifier: `<app>-full-load-cdc`
- Source endpoint: blue
- Target endpoint: green
- Task mode: Provisioned
- Task type: Migrate & Replicate
- Target table prep: Do nothing
- Stop task after full load: Do not stop
- Include LOB columns: Do not include
- Data validation: Off
- Table mappings: Selection rule to include all tables
- Premigration assessment: Off
- Task startup: Manually later

4. Start the DMS task and wait for full load to complete and CDC lag to stabilize.

### 4. Cutover

1. Remove the endpoint override:

```bash
caccl-deploy update -D --app <app> dbOptions/clusterEndpointOverride
```

2. Prepare and apply the change set:

```bash
caccl-deploy stack --app <app> diff
...
caccl-deploy stack --app <app> changeset
```

This will update the task definition and roll the ECS service to the green cluster. The app uses a rolling deploy with a deregistration delay to avoid dropping active connections.

### 5. Cleanup

1. QA/test the redeployed app.
2. Stop and delete the DMS task and endpoints.
3. Reset the load balancer deregistration delay:

```bash
caccl-deploy update --app <app> -D lbOptions/targetDeregistrationDelay
```
4. Delete the old blue cluster when you are comfortable to do so (after a final snapshot if desired).

### Final state

- Green 5.0 cluster is fully CloudFormation-managed.
- Blue is removed.
- No MVU.
- No reverse DMS.
- No CloudFormation import.
- No downtime.

## Prerequisites

- AWS CLI configured with credentials for the target account.
- DMS replication instance created in the VPC you want to use.
- DMS certificate imported (global or RDS combined CA bundle).
- DocumentDB CA bundle available locally for client connections (if you need to connect).

## DMS Helper Scripts

- Create replication instance: `./bin/create-dms-instance.sh --infra-stack <infra-stack>`
- Create endpoints: `./bin/dms-docdb-endpoints.sh --app <app> --db-name <db-name>`

The blue endpoint is read from the override export and the blue password secret ARN is reused for the green endpoint.

## Verify Full Load and Migration

After the task starts, confirm that the full load completes and CDC is running:

- Check the DMS task status is `running` and the full load is marked as complete.
- In task statistics, confirm row counts are non-zero and trending to expected totals.
- For a representative sample of collections, compare document counts and run spot checks on key documents.
- Watch for error or warning messages in task logs; resolve data type or truncation warnings before cutover.
- If CDC is enabled, verify that new writes on the source appear on the target within the expected latency window.

### View CDC Latency Metrics

AWS DMS publishes replication lag metrics to CloudWatch. The most useful are `CDCLatencySource` and `CDCLatencyTarget` (seconds).

To view them in the console:

1. Open CloudWatch -> Metrics.
2. Choose the `AWS/DMS` namespace.
3. Select metrics by `ReplicationTaskIdentifier` or `ReplicationInstanceIdentifier`.
4. Add `CDCLatencySource` and `CDCLatencyTarget` to the graph and set the period to match your expected lag.
