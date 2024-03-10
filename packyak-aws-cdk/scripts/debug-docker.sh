

cat <<EOF > /lib/udev/rules.d/71-nvidia-dev-char.rules
# This will create /dev/char symlinks to all device nodes
ACTION=="add", DEVPATH=="/bus/pci/drivers/nvidia", RUN+="/usr/bin/nvidia-ctk system 	create-dev-char-symlinks --create-all"
EOF

sudo nvidia-ctk system create-dev-char-symlinks --create-all

cat <<EOF > /etc/docker/daemon.json
{
    "exec-opts": [
        "native.cgroupdriver=cgroupfs"
    ],
    "runtimes": {
        "nvidia": {
            "args": [],
            "path": "nvidia-container-runtime"
        }
    }
}
EOF
    

sudo systemctl restart docker

docker run --rm --runtime=nvidia --gpus all \
    --device=/dev/nvidia-uvm \
    --device=/dev/nvidia-uvm-tools \
    --device=/dev/nvidia-modeset \
    --device=/dev/nvidiactl \
    --device=/dev/nvidia0 \
    ubuntu nvidia-smi


docker run --rm --runtime=nvidia --gpus all \
    --device=/dev/nvidia-uvm \
    --device=/dev/nvidia-uvm-tools \
    --device=/dev/nvidia0 \
    ubuntu nvidia-smi

sudo docker run --rm --runtime=nvidia --gpus all ubuntu nvidia-smi
sudo docker run --rm --gpus all ubuntu nvidia-smi

