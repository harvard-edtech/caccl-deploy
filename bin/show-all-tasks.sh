#!/bin/bash

# Function to print formatted output with proper column widths
print_row() {
    printf "%-12s %-10s %-32s %-60s %-20s\n" "$1" "$2" "$3" "$4" "$5"
}

# Header
print_row "LAUNCH_TYPE" "STATUS" "TASK_ID" "TASK_DEFINITION" "CLUSTER"
print_row "$(printf '%.12s' "------------")" "$(printf '%.10s' "----------")" "$(printf '%.32s' "--------------------------------")" "$(printf '%.60s' "------------------------------------------------------------")" "$(printf '%.20s' "--------------------")"

# Get all ECS clusters
for cluster in $(aws ecs list-clusters --query 'clusterArns[]' --output text); do
    cluster_name=$(basename $cluster)
    
    # Get all tasks in this cluster
    tasks=$(aws ecs list-tasks --cluster $cluster --query 'taskArns[]' --output text)
    
    if [ -n "$tasks" ]; then
        # Describe tasks to get detailed information
        aws ecs describe-tasks --cluster $cluster --tasks $tasks --query 'tasks[].[taskDefinitionArn,taskArn,launchType,lastStatus]' --output text | while read task_def task_arn launch_type status; do
            # Extract just the task definition name (without revision)
            task_def_name=$(basename $task_def | cut -d: -f1)
            
            # Extract just the task ID
            task_id=$(basename $task_arn)
            
            print_row "$launch_type" "$status" "$task_id" "$task_def_name" "$cluster_name"
        done
    fi
done
