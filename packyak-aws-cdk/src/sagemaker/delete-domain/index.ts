import {
  CloudFormationCustomResourceEvent,
  CloudFormationCustomResourceResponse,
} from "aws-lambda";

import {
  DeleteFileSystemCommand,
  EFSClient,
  DescribeMountTargetsCommand,
  DeleteMountTargetCommand,
  MountTargetDescription,
} from "@aws-sdk/client-efs";
import {
  DeleteAppCommand,
  DeleteSpaceCommand,
  DescribeAppCommand,
  DescribeSpaceCommand,
  ListAppsCommand,
  ListSpacesCommand,
  ListSpacesResponse,
  SageMakerClient,
  SpaceStatus,
  SpaceDetails,
} from "@aws-sdk/client-sagemaker";

const efs = new EFSClient();
const sagemaker = new SageMakerClient();

export async function handler(
  event: CloudFormationCustomResourceEvent,
): Promise<CloudFormationCustomResourceResponse> {
  console.log(JSON.stringify(event, null, 2));
  const fileSystemId = event.ResourceProperties.FileSystemId;
  const domainId = event.ResourceProperties.DomainId;
  const removalPolicy: string = event.ResourceProperties.RemovalPolicy;
  if (typeof domainId !== "string" && !domainId.trim()) {
    return {
      ...event,
      Status: "FAILED",
      Reason: "DomainId is required",
      PhysicalResourceId: "none",
    };
  }

  if (
    event.RequestType === "Delete" &&
    removalPolicy.toLowerCase() === "destroy"
  ) {
    await stopAndDeleteSpaces();
    await deleteFileSystemAndMountTargets();
  }

  return {
    ...event,
    Status: "SUCCESS",
    PhysicalResourceId: domainId,
  };

  async function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function deleteFileSystemAndMountTargets() {
    let nextToken: string | undefined = undefined;
    const mountTargets: MountTargetDescription[] = [];
    while (true) {
      console.log(
        `Listing Mount Targets in FileSystem: ${fileSystemId}`,
        nextToken,
      );
      // find all the mount targets we need to delete
      const mountTargetsResponse = await retry(
        () =>
          efs.send(
            new DescribeMountTargetsCommand({
              FileSystemId: fileSystemId,
              Marker: nextToken,
            }),
          ),
        {
          okErrorCodes: [
            "MountTargetNotFound",
            "FileSystemNotFound",
            "AccessPointNotFound",
          ],
        },
      );
      if (!mountTargetsResponse?.MountTargets?.length) {
        console.log("No Mount Targets found, breaking.");
        break;
      }
      console.log(
        `Found ${mountTargetsResponse.MountTargets.length} Mount Targets`,
        mountTargetsResponse,
      );

      mountTargets.push(...mountTargetsResponse.MountTargets);
      nextToken = mountTargetsResponse.NextMarker;
      if (nextToken === undefined) {
        console.log("No more Mount Targets, breaking.");
        break;
      }
    }

    // call delete o all those mount targets
    // this will return early (before the resource is deleted)
    console.log(`Deleting ${mountTargets.length} mount targets`, mountTargets);
    await Promise.all(
      mountTargets.map(async (mountTarget) => {
        if (mountTarget.MountTargetId) {
          await retry(
            () =>
              efs.send(
                new DeleteMountTargetCommand({
                  MountTargetId: mountTarget.MountTargetId,
                }),
              ),
            {
              okErrorCodes: ["MountTargetNotFound"],
              retryableErrorCodes: ["DependencyTimeout"],
            },
          );
        }
      }),
    );

    // now, wait until all the mount targets are gone
    while (true) {
      console.log(
        `Waiting for all mount targets to be deleted in FileSystem: ${fileSystemId}`,
      );
      const response = await retry(() =>
        efs.send(
          new DescribeMountTargetsCommand({ FileSystemId: fileSystemId }),
        ),
      );
      if (!response?.MountTargets?.length) {
        break;
      } else {
        console.log(
          `Found ${response.MountTargets.length} mount targets`,
          response.MountTargets,
        );
        await sleep(2000);
      }
    }

    // now that all mount targets have been removed, we can finally delete the file system
    console.log(`Deleting file system ${fileSystemId}`);
    await retry(
      () =>
        efs.send(new DeleteFileSystemCommand({ FileSystemId: fileSystemId })),
      {
        okErrorCodes: ["FileSystemNotFound"],
      },
    );
  }

  async function stopAndDeleteSpaces() {
    const spaces: SpaceDetails[] = [];
    let nextToken: string | undefined = undefined;
    while (true) {
      console.log(`Listing Spaces in Domain ${domainId}`);
      const response: ListSpacesResponse | undefined = await retry(() =>
        sagemaker.send(
          new ListSpacesCommand({
            DomainIdEquals: domainId,
            NextToken: nextToken,
          }),
        ),
      );
      nextToken = response?.NextToken;
      if (!response?.Spaces?.length) {
        console.log("No Spaces found, breaking.");
        break;
      }
      console.log(`Found ${response.Spaces.length} Spaces`, response.Spaces);
      spaces.push(...response.Spaces);
      if (nextToken === undefined) {
        console.log("No more Spaces, breaking.");
        break;
      }
    }

    console.log(`Deleting ${spaces.length} Spaces`, spaces);
    await Promise.all(
      spaces.map(async (space) => {
        if (space.SpaceName) {
          await stopAndDeleteSpace(domainId, space.SpaceName);
        }
      }),
    );
  }

  /**
   * List all Apps in the Space and delete them
   */
  async function stopAndDeleteSpace(domainId: string, spaceName: string) {
    await deleteApps();
    await deleteSpace();

    async function deleteApps() {
      let nextToken: string | undefined = undefined;
      const apps = [];
      while (true) {
        console.log(`Listing Apps in Space ${spaceName}`);
        const response = await retry(
          () =>
            sagemaker.send(
              new ListAppsCommand({
                DomainIdEquals: domainId,
                SpaceNameEquals: spaceName,
                NextToken: nextToken,
              }),
            ),
          {
            okErrorCodes: ["ResourceNotFound"],
          },
        );
        nextToken = response?.NextToken;
        if (!response?.Apps?.length) {
          console.log("No Apps found, breaking.");
          break;
        }
        apps.push(...response.Apps);
        if (nextToken === undefined) {
          console.log("No more Apps, breaking.");
          break;
        }
      }
      console.log(`Deleting ${apps.length} Apps`, apps);
      await Promise.all(
        apps.map(async (app) => {
          if (app.Status !== "Deleted") {
            console.log(
              `Deleting App ${app.AppName} in Space ${app.SpaceName}`,
            );
            const response = await retry(
              () =>
                sagemaker.send(
                  new DeleteAppCommand({
                    DomainId: domainId,
                    AppName: app.AppName!,
                    AppType: app.AppType!,
                    SpaceName: app.SpaceName!,
                  }),
                ),
              {
                okErrorCodes: ["ResourceNotFound"],
              },
            );
            if (response === undefined) {
              return;
            }
            while (true) {
              console.log(
                `Waiting for App ${app.AppName} in Space ${app.SpaceName} to be deleted`,
              );
              const status = await retry(
                () =>
                  sagemaker.send(
                    new DescribeAppCommand({
                      DomainId: domainId,
                      AppName: app.AppName!,
                      AppType: app.AppType!,
                      SpaceName: app.SpaceName!,
                    }),
                  ),
                {
                  okErrorCodes: ["ResourceNotFound"],
                },
              );
              if (
                status === undefined ||
                status.Status === "Deleted" ||
                status.Status === "Failed"
              ) {
                return;
              } else {
                console.log(
                  `App ${app.AppName} in Space ${app.SpaceName} is ${status.Status}`,
                );
                await sleep(2000);
              }
            }
          }
        }),
      );
    }

    async function deleteSpace() {
      console.log(`Deleting Space ${spaceName}`);
      const space = await retry(
        () =>
          sagemaker.send(
            new DescribeSpaceCommand({
              DomainId: domainId,
              SpaceName: spaceName,
            }),
          ),
        {
          okErrorCodes: ["ResourceNotFound"],
        },
      );

      console.log(`Space ${spaceName} Status: ${space?.Status}`);
      if (space?.Status !== SpaceStatus.Deleting) {
        console.log(`Deleting Space ${spaceName}`);
        await retry(
          () =>
            sagemaker.send(
              new DeleteSpaceCommand({
                DomainId: domainId,
                SpaceName: spaceName,
              }),
            ),
          {
            okErrorCodes: ["ResourceNotFound"],
          },
        );
      }
      while (true) {
        console.log(`Waiting for Space ${spaceName} to be deleted`);
        const status = await retry(
          () =>
            sagemaker.send(
              new DescribeSpaceCommand({
                DomainId: domainId,
                SpaceName: spaceName,
              }),
            ),
          {
            retriesLeft: 5,
            interval: 1000,
            okErrorCodes: ["ResourceNotFound"],
          },
        );
        if (status === undefined) {
          return;
        } else if (status.Status === SpaceStatus.Delete_Failed) {
          throw new Error(`Failed to delete Space ${spaceName}`);
        } else {
          console.log(
            `Space ${spaceName} is ${status.Status}. Waiting for 2s and then checking agian.`,
          );
          await sleep(2000);
        }
      }
    }
  }

  async function retry<T>(
    fn: () => Promise<T>,
    {
      retriesLeft = 5,
      interval = 1000,
      retryableErrorCodes = [
        "InternalServerError",
        "InternalFailure",
        "ServiceUnavailable",
        "ThrottlingException",
      ],
      okErrorCodes,
    }: {
      retriesLeft?: number;
      interval?: number;
      retryableErrorCodes?: string[];
      okErrorCodes?: string[];
    } = {},
  ): Promise<T | undefined> {
    try {
      return await fn();
    } catch (err: any) {
      if (retriesLeft === 0) {
        throw err;
      }
      if (okErrorCodes?.includes(err.name)) {
        return undefined;
      }
      if (retryableErrorCodes?.includes(err.name)) {
        await new Promise((resolve) => setTimeout(resolve, interval));
        return retry(fn, {
          retriesLeft: retriesLeft - 1,
          interval,
          retryableErrorCodes,
        });
      }
      throw err;
    }
  }
}
