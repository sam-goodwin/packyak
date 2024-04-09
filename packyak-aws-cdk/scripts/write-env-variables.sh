#!/bin/bash

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --*=*) 
            key=$(echo $1 | sed 's/--//;s/=.*//')
            value=$(echo $1 | sed 's/[^=]*=//')
            echo export $key="$value" >> /etc/profile
            ;;
        --*) 
            key=$(echo $1 | sed 's/--//')
            value=$2
            echo export $key="$value" >> /etc/profile
            shift ;;
        *) echo "Unknown parameter passed: $1"; exit 1 ;;
    esac
    shift
done
