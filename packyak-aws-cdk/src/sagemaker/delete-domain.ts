import {
  CloudFormationCustomResourceEvent,
  CloudFormationCustomResourceResponse,
} from "aws-lambda";

import { DeleteFileSystemCommand, EFSClient } from "@aws-sdk/client-efs";
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
} from "@aws-sdk/client-sagemaker";

const efs = new EFSClient();
const sagemaker = new SageMakerClient();

export const handler = async (
  event: CloudFormationCustomResourceEvent,
): Promise<CloudFormationCustomResourceResponse> => {
  console.log(JSON.stringify(event, null, 2));
  const fileSystemId = event.ResourceProperties.FileSystemId;
  const domainId = event.ResourceProperties.DomainId;
  const removalPolicy: string = event.ResourceProperties.RemovalPolicy;

  if (
    event.RequestType === "Delete" &&
    removalPolicy.toLowerCase() === "destroy"
  ) {
    let nextToken: string | undefined = undefined;
    while (true) {
      const response: ListSpacesResponse | undefined = await retry(() =>
        sagemaker.send(
          new ListSpacesCommand({
            DomainIdEquals: domainId,
            NextToken: nextToken,
          }),
        ),
      );
      if (!response?.Spaces?.length) {
        break;
      }
      nextToken = response.NextToken;
      await Promise.all(
        response.Spaces.map(async (space) => {
          if (space.SpaceName) {
            await stopAndDeleteSpace(domainId, space.SpaceName);
          }
        }),
      );
    }

    await retry(
      () =>
        efs.send(new DeleteFileSystemCommand({ FileSystemId: fileSystemId })),
      {
        // if the file system is not found, we're done
        okErrorCodes: ["FileSystemNotFound"],
      },
    );
  }

  return {
    ...event,
    Status: "SUCCESS",
    PhysicalResourceId: domainId,
  };
};

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * List all Apps in the Space and delete them
 */
async function stopAndDeleteSpace(domainId: string, spaceName: string) {
  await deleteApps();
  await deleteSpace();

  async function deleteApps() {
    let nextToken: string | undefined = undefined;
    while (true) {
      const apps = await retry(() =>
        sagemaker.send(
          new ListAppsCommand({
            DomainIdEquals: domainId,
            SpaceNameEquals: spaceName,
            NextToken: nextToken,
          }),
        ),
      );
      if (!apps?.Apps?.length) {
        break;
      }
      await Promise.all(
        apps.Apps.map(async (app) => {
          if (app.Status !== "Deleted") {
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
                await sleep(2000);
              }
            }
          }
        }),
      );
    }
  }

  async function deleteSpace() {
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

    if (space?.Status !== SpaceStatus.Deleting) {
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
