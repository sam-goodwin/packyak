#!/bin/bash

# https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html#installing-with-yum-or-dnf

curl -s -L https://nvidia.github.io/libnvidia-container/stable/rpm/nvidia-container-toolkit.repo | \
  sudo tee /etc/yum.repos.d/nvidia-container-toolkit.repo

sudo yum install -y nvidia-container-toolkit

# https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html#configuring-docker

sudo nvidia-ctk runtime configure --runtime=docker

# (CRITICAL) this set the value "no-cgroups = false" in /etc/nvidia-container-runtime/config.toml
# without this YARN docker containers will fail with "Failed to initialize NVML: Unknown Error"
sudo nvidia-ctk config --set nvidia-container-cli.no-cgroups=false -i

sudo systemctl restart docker