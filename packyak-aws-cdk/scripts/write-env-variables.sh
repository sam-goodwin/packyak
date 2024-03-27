#!/bin/bash

ENV_DIR=/mnt/packyak
ENV_FILE=$ENV_DIR/.bashrc

# Create the /mnt/shared directory with 755 permissions
rm -rf $ENV_DIR
mkdir -p $ENV_DIR
chmod 755 $ENV_DIR

# This makes new files have 644 and new directories have 755 permissions by default
umask 022

# Create the ENV_FILE file with explicit permissions
touch $ENV_FILE
chmod 644 $ENV_FILE
chown root:root $ENV_FILE

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --*=*) 
            key=$(echo $1 | sed 's/--//;s/=.*//')
            value=$(echo $1 | sed 's/[^=]*=//')
            echo export $key="$value" >> $ENV_FILE
            ;;
        --*) 
            key=$(echo $1 | sed 's/--//')
            value=$2
            echo export $key="$value" >> $ENV_FILE
            shift ;;
        *) echo "Unknown parameter passed: $1"; exit 1 ;;
    esac
    shift
done
