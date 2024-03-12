#!/bin/bash

set -ex

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --file-system-id) FILE_SYSTEM_ID="$2"; shift ;;
        --mount-point) MOUNT_POINT="$2"; shift ;;
        --access-point-id) ACCESS_POINT_ID="$2"; shift ;;
        --user) USERNAME="$2"; shift ;;
        --uid) USER_ID="$2"; shift ;;
        --gid) GROUP_ID="$2"; shift ;;
        *) echo "Unknown parameter passed: $1"; exit 1 ;;
    esac
    shift
done

check_variable() {
    if [ -z "${!1}" ]; then
        echo "Error: $1 is undefined."
        exit 1
    fi
}

check_variable FILE_SYSTEM_ID
check_variable MOUNT_POINT
check_variable USERNAME
check_variable GROUP_ID
check_variable USER_ID

sudo yum check-update -y
sudo yum upgrade -y
sudo yum install -y amazon-efs-utils nfs-utils
sudo yum install -y openssl-devel bzip2-devel libffi-devel zlib-devel xz-devel sqlite-devel readline-devel

if ! getent group $GROUP_ID &>/dev/null; then
  echo "Group with GID $GROUP_ID does not exist, creating group."
  sudo groupadd --gid $GROUP_ID ${USERNAME}
else
  echo "Group with GID $GROUP_ID already exists, proceeding."
fi

# create the user if it doe not exist
if id "$USERNAME" &>/dev/null; then
    echo "User ${USERNAME} exists, proceeding to mount EFS."
else
    echo "User ${USERNAME} does not exist, creating user."
    sudo adduser --uid ${USER_ID} --gid ${GROUP_ID} ${USERNAME}

    # user needs to be able to run docker
    sudo usermod -aG docker ${USERNAME}
    sudo usermod -aG hadoop ${USERNAME}
    sudo usermod -aG hdfsadmingroup ${USERNAME}
    sudo usermod -aG hdfs ${USERNAME}
    sudo usermod -aG spark ${USERNAME}

    # allow yarn to access the user's files that allow read access at the group level  
    sudo usermod -aG ${USERNAME} yarn
fi

# TODO: add ssh pub keys, set them up in the bootstrap
# TODO: remove ssm-user from the sudoers file
# result: now i can't log in as tyler by adding my ssh key ..

sudo mkdir -p ${MOUNT_POINT}
sudo chown ${USERNAME}:${GROUP_ID} ${MOUNT_POINT}
sudo chmod 750 ${MOUNT_POINT}

sudo mkdir -p ${MOUNT_POINT}/.ssh
sudo chown ${USERNAME}:${GROUP_ID} ${MOUNT_POINT}/.ssh
sudo chmod 750 ${MOUNT_POINT}/.ssh

#####
# Resolve this EC2 machine's Subnet and find the most appropriate EFS MountTarget
#####
# see: https://aws.amazon.com/about-aws/whats-new/2021/03/amazon-emr-now-supports-amazon-ec2-instance-metadata-service-v2/
TOKEN=$(curl -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" -s)
INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id -H "X-aws-ec2-metadata-token: $TOKEN")
MAC=$(curl -s http://169.254.169.254/latest/meta-data/mac -H "X-aws-ec2-metadata-token: $TOKEN")
# Fetch the instance's subnet ID using the instance metadata service
SUBNET=$(curl -s http://169.254.169.254/latest/meta-data/network/interfaces/macs/$MAC/subnet-id -H "X-aws-ec2-metadata-token: $TOKEN")
MOUNT_TARGETS=$(aws efs describe-mount-targets --file-system-id $FILE_SYSTEM_ID --output json)
MOUNT_TARGET_IP=$(python -c "
file_system_id = '$FILE_SYSTEM_ID'
subnet_id = '$SUBNET'
mount_targets = ${MOUNT_TARGETS}['MountTargets']
if not mount_targets or len(mount_targets) == 0:
    print(file_system_id)
else:
    matching_targets = [mt for mt in mount_targets if mt['SubnetId'] == subnet_id]
    if matching_targets:
        print(matching_targets[0]['IpAddress'])
    else:
        print(mount_targets[0]['IpAddress'])
")

PARAMS=""

if [ ! -z "$MOUNT_TARGET_IP" ]; then
  PARAMS="mounttargetip=$MOUNT_TARGET_IP"
fi
if [ ! -z "${ACCESS_POINT_ID}" ]; then
  PARAMS="$PARAMS,accesspoint=${ACCESS_POINT_ID}"
fi
if [ ! -z "$PARAMS" ]; then
  PARAMS=",$PARAMS"
fi


# see: https://docs.aws.amazon.com/efs/latest/ug/mounting-fs-mount-helper-ec2-linux.html

# file-system-id:/ efs-mount-point efs _netdev,noresvport,tls,iam,accesspoint=access-point-id 0 0

# Modify the section for adding the mount point to /etc/fstab
echo "${FILE_SYSTEM_ID}:/ ${MOUNT_POINT} efs _netdev,noresvport,tls,iam${PARAMS} 0 0" | sudo tee -a /etc/fstab

# mount the newly added file system
sudo mount ${MOUNT_POINT}

echo Mounted ${MOUNT_POINT} successfully.