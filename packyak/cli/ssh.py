from typing import Any
import click
import subprocess
import time
import boto3
import os
import re
import collections


from packyak.cli.cli import cli


@cli.command()
@click.argument(
    "instance-id",
    type=str,
    # prompt="What is the EC2 Instance ID of the instance you wish to tunnel to?",
    # help="The EC2 Instance ID of the instance you wish to tunnel to",
)
@click.option(
    "--ssh-key",
    default="~/.ssh/id_rsa",
    help="Path to the the SSH public key to copy to the remote host. Default: ~/.ssh/id_rsa.pub",
)
@click.option(
    "-L",
    "port_forwards",
    # type=(str | list[str]),
    multiple=True,
    help="Ports to forward. Default: 9000:localhost:22",
)
@click.option("-v", "--verbose", type=str, is_flag=True)
@click.option(
    "--profile", type=str, help="AWS CLI profile to use when authenticating to SSM"
)
def ssh(
    instance_id: str,
    ssh_key: str = "~/.ssh/id_rsa",
    # todo: what port forwarding to i need for VS Code Remote SSH
    port_forwards: list[str] = ["9001:localhost:22"],
    verbose: bool = False,
    profile: str | None = None,
):
    """
    Establishes a secure tunnel to an EC2 instance.

    instance-id: The EC2 Instance ID of the instance you wish to tunnel to.

    --ssh-public-key: Path to the SSH public key to copy to the remote host. Default: ~/.ssh/id_rsa.pub

    -L: Ports to forward. Default: 9001:localhost:22
    """

    if profile is not None:
        os.environ["AWS_PROFILE"] = profile

    def log(message: str):
        if verbose:
            print(message)

    log(f"{time.ctime()} sm-connect-ssh-proxy: Connecting to: {instance_id}")
    # print(f"{time.ctime()} sm-connect-ssh-proxy: Extra args: {extra_ssh_args}")

    ssm_client = boto3.client("ssm")
    instance_info = ssm_client.describe_instance_information(
        Filters=[{"Key": "InstanceIds", "Values": [instance_id]}]
    )
    if not instance_info["InstanceInformationList"]:
        log("No instance information found.")
        instance_status = "Offline"
    else:
        instance_status = instance_info["InstanceInformationList"][0]["PingStatus"]
    log(f"Instance status: {instance_status}")

    if instance_status != "Online":
        log("Error: Instance is offline.")
        return

    with open(os.path.expanduser(f"{ssh_key}.pub"), "r") as file:
        ssh_pub_key = file.read().strip()

    current_region = boto3.session.Session().region_name
    log(f"Will use AWS Region: {current_region}")

    aws_cli_version = subprocess.check_output(
        ["aws", "--version"], stderr=subprocess.STDOUT
    ).decode()
    log(f"AWS CLI version (should be v2): {aws_cli_version}")

    commands = [
        f'echo "{ssh_pub_key}" > /etc/ssh/authorized_keys',
        f'echo "{ssh_pub_key}" > /root/.ssh/authorized_keys',
    ]

    send_command_response = ssm_client.send_command(
        InstanceIds=[instance_id],
        DocumentName="AWS-RunShellScript",
        Comment="Copy public key for SSH helper",
        Parameters={"commands": commands},
        TimeoutSeconds=30,
    )
    command_id = send_command_response["Command"]["CommandId"]
    log(f"Got command ID: {command_id}")

    # time.sleep(5)  # Wait a bit to prevent InvocationDoesNotExist error

    for _ in range(15):
        try:
            output = ssm_client.get_command_invocation(
                CommandId=command_id, InstanceId=instance_id
            )
            log(f"Command status: {output['Status']}")
            if output["Status"] not in ["Pending", "InProgress"]:
                log(f"Command output: {output.get('StandardOutputContent', '')}")
                if output.get("StandardErrorContent"):
                    log(f"Command error: {output['StandardErrorContent']}")
                break
        except ssm_client.exceptions.InvocationDoesNotExist:
            pass
        time.sleep(0.1)

    if output["Status"] != "Success":  # type: ignore
        log("Error: Command didn't finish successfully in time")
        return

    log(f"{time.ctime()} sm-connect-ssh-proxy: Starting SSH over SSM proxy")

    proxy_command = (
        "aws ssm start-session "
        + "--reason 'PackYak SSH' "
        + f"--region '{current_region}' "
        + f"--target '{instance_id}' "
        + "--document-name AWS-StartSSHSession "
        + "--parameters portNumber=%p"
    )

    # Start with the base SSH command
    command = ["ssh", "-4"]

    # Add each SSH option prefixed by '-o'
    for option in [
        "User=root",
        f"IdentityFile={ssh_key}",
        "IdentitiesOnly=yes",
        f"ProxyCommand={proxy_command}",
        "ServerAliveInterval=15",
        "ServerAliveCountMax=3",
        "PasswordAuthentication=no",
        "StrictHostKeyChecking=no",
        "UserKnownHostsFile=/dev/null",
    ]:
        command.extend(["-o", option])

    # Add each port forward prefixed by '-L'
    for port in port_forwards:
        command.extend(["-L", port])

    # Finally, add the instance ID
    command.append(instance_id)

    log(" ".join(command))  # Debugging: log the command

    # Execute the command
    process = subprocess.run(
        command,
        check=True,
    )
    return process.stdout, process.stderr


class Host:
    def __init__(self, name: str, props: dict[str, Any]):
        self.name = name
        self.props = props


def parse_ssh_config(file_path: str = "~/.ssh/config") -> list[Host]:
    """Parse the SSH config file and return a list of Host objects with kwargs for each property."""
    hosts = []

    def parse_key_value(line: str) -> tuple[str, str] | None:
        split = re.split(r"\s+", line.strip(), maxsplit=1)
        if len(split) == 2:
            return split[0], split[1]
        else:
            return None

    with open(file_path, "r") as f:
        lines = f.readlines()

        queue_lines = collections.deque(lines)

        hosts: list[Host] = []

        while queue_lines:
            line = queue_lines.popleft()

            if line.startswith("Host "):
                parsed_host = parse_key_value(line)
                if parsed_host is None:
                    raise ValueError(
                        "Failed to parse host name from SSH config line:\n{line}"
                    )
                host = Host(name=parsed_host[1], props={})
                hosts.append(host)

                # now collect all of its key-value props
                while queue_lines:
                    # Peek at the next line without removing it from the queue
                    line = queue_lines[0]
                    if line.startswith("Host "):
                        # have found a new host, we're done
                        break
                    else:
                        key_value = parse_key_value(line)
                        if key_value is not None:
                            host.props[key_value[0]] = key_value[1]

    return hosts
