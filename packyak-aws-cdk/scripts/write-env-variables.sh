#!/bin/bash

set -e

ENV_FILE=/etc/profile.d/packyak.sh

sudo touch $ENV_FILE

# Create the ENV_FILE file with explicit permissions
sudo touch $ENV_FILE
sudo chmod 644 $ENV_FILE
sudo chown root:root $ENV_FILE
sudo chmod +x $ENV_FILE

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --*=*) 
            key=$(echo $1 | sed 's/--//;s/=.*//')
            value=$(echo $1 | sed 's/[^=]*=//')
            echo export $key="$value" | sudo tee -a $ENV_FILE > /dev/null
            ;;
        --*) 
            key=$(echo $1 | sed 's/--//')
            value=$2
            echo export $key="$value" | sudo tee -a $ENV_FILE > /dev/null
            shift ;;
        *) echo "Unknown parameter passed: $1"; exit 1 ;;
    esac
    shift
done
