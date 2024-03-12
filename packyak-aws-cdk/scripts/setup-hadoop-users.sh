#!/bin/bash


# Check if the user yarn exists, if not, create it
if id "yarn" &>/dev/null; then
    echo "User yarn exists, proceeding."
else
    echo "User yarn does not exist, creating user."
    sudo adduser yarn
fi


# Define the groups to be checked and potentially created
groups=("docker" "hadoop" "hdfsadmingroup" "hdfs" "spark")

# Loop through each group and create it if it doesn't already exist
for group in "${groups[@]}"; do
    if getent group "$group" > /dev/null; then
        echo "Group $group already exists."
    else
        sudo groupadd "$group"
        echo "Group $group created."
    fi
done
