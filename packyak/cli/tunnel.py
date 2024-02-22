import click
import subprocess
import time
import boto3
import os

from .cli import cli


@cli.command()
@click.argument(
    "instance-id",
    type=str,
    # prompt="What is the EC2 Instance ID of the instance you wish to tunnel to?",
    # help="The EC2 Instance ID of the instance you wish to tunnel to",
)
@click.option(
    "--ssh-public-key",
    default="~/.ssh/id_rsa.pub",
    help="Path to the the SSH public key to copy to the remote host. Default: ~/.ssh/id_rsa.pub",
)
@click.option(
    "-L",
    "port_forwards",
    type=list[str],
    multiple=True,
    help="Ports to forward. Default: 9000:localhost:9000",
)
def tunnel(
    instance_id: str,
    ssh_public_key: str = "~/.ssh/id_rsa",
    # todo: what port forwarding to i need for VS Code Remote SSH
    port_forwards: list[str] = ["9000:localhost:9000"],
):
    print(f"{time.ctime()} sm-connect-ssh-proxy: Connecting to: {instance_id}")
    # print(f"{time.ctime()} sm-connect-ssh-proxy: Extra args: {extra_ssh_args}")

    ssm_client = boto3.client("ssm")
    instance_info = ssm_client.describe_instance_information(
        Filters=[{"Key": "InstanceIds", "Values": [instance_id]}]
    )
    instance_status = instance_info["InstanceInformationList"][0]["PingStatus"]
    print(f"Instance status: {instance_status}")

    if instance_status != "Online":
        print("Error: Instance is offline.")
        return

    ssh_key = os.path.expanduser(ssh_public_key)
    with open(f"{ssh_key}.pub", "r") as file:
        ssh_pub_key = file.read().strip()

    current_region = boto3.session.Session().region_name
    print(f"Will use AWS Region: {current_region}")

    aws_cli_version = subprocess.check_output(
        ["aws", "--version"], stderr=subprocess.STDOUT
    ).decode()
    print(f"AWS CLI version (should be v2): {aws_cli_version}")

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
    print(f"Got command ID: {command_id}")

    # time.sleep(5)  # Wait a bit to prevent InvocationDoesNotExist error

    for _ in range(15):
        try:
            output = ssm_client.get_command_invocation(
                CommandId=command_id, InstanceId=instance_id
            )
            print(f"Command status: {output['Status']}")
            if output["Status"] not in ["Pending", "InProgress"]:
                print(f"Command output: {output.get('StandardOutputContent', '')}")
                if output.get("StandardErrorContent"):
                    print(f"Command error: {output['StandardErrorContent']}")
                break
        except ssm_client.exceptions.InvocationDoesNotExist:
            pass
        time.sleep(1)

    if output["Status"] != "Success":
        print("Error: Command didn't finish successfully in time")
        return

    print(f"{time.ctime()} sm-connect-ssh-proxy: Starting SSH over SSM proxy")

    proxy_command = f"aws ssm start-session --reason 'Local user started SageMaker SSH Helper' --region '{current_region}' --target '{instance_id}' --document-name AWS-StartSSHSession --parameters portNumber=%p"
    ssh_command = f'ssh -4 -o User=root -o IdentityFile="{ssh_key}" -o IdentitiesOnly=yes -o ProxyCommand="{proxy_command}" -o ServerAliveInterval=15 -o ServerAliveCountMax=3 -o PasswordAuthentication=no -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null {extra_ssh_args} {instance_id}'
    subprocess.run(ssh_command, shell=True)
