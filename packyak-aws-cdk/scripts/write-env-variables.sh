#!/bin/bash

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
            sudo echo export $key="$value" >> $ENV_FILE
            ;;
        --*) 
            key=$(echo $1 | sed 's/--//')
            value=$2
            sudo echo export $key="$value" >> $ENV_FILE
            shift ;;
        *) echo "Unknown parameter passed: $1"; exit 1 ;;
    esac
    shift
done
