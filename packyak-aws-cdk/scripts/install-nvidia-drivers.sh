#!/bin/bash
set -ex

# see: https://github.com/amazonlinux/amazon-linux-2023/issues/538

TOKEN=$(curl -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" -s)
INSTANCE_TYPE=$(curl -s http://169.254.169.254/latest/meta-data/instance-type -H "X-aws-ec2-metadata-token: $TOKEN")
echo "EC2 Instance Type: $INSTANCE_TYPE"

if [[ $INSTANCE_TYPE == g* ]] || [[ $INSTANCE_TYPE == p* ]]; then
    sudo yum install -y cmake gcc docker kernel-devel-$(uname -r)
    BASE_URL=https://us.download.nvidia.com/tesla
    DRIVER_VERSION=515.105.01
    sudo curl -fSsl -O $BASE_URL/$DRIVER_VERSION/NVIDIA-Linux-x86_64-$DRIVER_VERSION.run
    sudo chmod +x NVIDIA-Linux-x86_64-$DRIVER_VERSION.run 
    sudo dnf install -y kernel-modules-extra
    sudo ./NVIDIA-Linux-x86_64-$DRIVER_VERSION.run -s -a --accept-license
    sudo curl -s -L https://nvidia.github.io/libnvidia-container/stable/rpm/nvidia-container-toolkit.repo | tee /etc/yum.repos.d/nvidia-container-toolkit.repo
    sudo yum install -y nvidia-container-toolkit
    sudo nvidia-ctk runtime configure --runtime=docker
    sudo systemctl restart docker
    sudo rm -rf ./NVIDIA-Linux-x86_64-$DRIVER_VERSION.run
else
    echo "This is not a GPU instance, skipping NVIDIA driver installation."
fi

#WARNING: nvidia-installer was forced to guess the X library path '/usr/lib64' and X module path '/usr/lib64/xorg/modules'; these paths were not queryable from the system.  If X fails to find the NVIDIA X driver
#         module, please install the `pkg-config` utility and the X.Org SDK/development package for your distribution and reinstall the driver.


#WARNING: Unable to determine the path to install the libglvnd EGL vendor library config files. Check that you have pkg-config and the libglvnd development libraries installed, or specify a path with
#         --glvnd-egl-config-path.