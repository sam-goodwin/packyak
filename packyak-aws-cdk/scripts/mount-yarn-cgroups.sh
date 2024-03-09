#!/bin/bash
set -ex

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --emr-version) EMR_VERSION="$2"; shift ;;
        *) echo "Unknown parameter passed: $1"; exit 1 ;;
    esac
    shift
done

if [ -z "$EMR_VERSION" ]; then
    echo "Error: EMR_VERSION is not set."
    exit 1
fi


if [ "$EMR_VERSION" -eq "7" ]; then
    sudo mkdir -p /yarn-cgroup/devices
    sudo mount -t cgroup -o devices cgroupv1-devices /yarn-cgroup/devices
    sudo chmod a+rwx -R /yarn-cgroup
else
    sudo chmod a+rwx -R /sys/fs/cgroup/cpu,cpuacct
    sudo chmod a+rwx -R /sys/fs/cgroup/devices
fi

 
