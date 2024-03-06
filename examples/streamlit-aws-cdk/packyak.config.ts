import {
  AuthMode,
  Domain,
  DynamoDBNessieVersionStore,
  NessieECSCatalog,
  UniformCluster,
  Workspace,
  AllocationStrategy,
  ComputeUnit,
  FleetCluster,
} from "@packyak/aws-cdk";
import {
  InstanceClass,
  InstanceSize,
  InstanceType,
  Vpc,
} from "aws-cdk-lib/aws-ec2";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { App, RemovalPolicy, Stack } from "aws-cdk-lib/core";

const stage = process.env.STAGE ?? "personal";
const removalPolicy = RemovalPolicy.DESTROY;

const lakeHouseName = `packyak-example-${stage}`;

const app = new App();

const stack = new Stack(app, lakeHouseName);
const vpc = new Vpc(stack, "Vpc");

const versionStore = new DynamoDBNessieVersionStore(stack, "VersionStore", {
  versionStoreName: `${lakeHouseName}-version-store`,
});

const myRepoBucket = new Bucket(stack, "MyCatalogBucket", {
  removalPolicy,
});

const myCatalog = new NessieECSCatalog(stack, "MyCatalog", {
  vpc,
  warehouseBucket: myRepoBucket,
  catalogName: lakeHouseName,
  removalPolicy,
  versionStore,
});

// create a workspace
const workspace = new Workspace(stack, "Workspace", {
  vpc,
  removalPolicy,
});
const sam = workspace.addHome({
  username: "sam",
  uid: "2001",
});

const m5n8xlarge = InstanceType.of(InstanceClass.M5, InstanceSize.XLARGE8);

const sparkUniform = new UniformCluster(stack, "UniformCluster", {
  clusterName: "spark-uniform",
  vpc,
  catalogs: {
    spark_catalog: myCatalog,
  },
  extraJavaOptions: {
    "-Djdk.httpclient.allowRestrictedHeaders": "host",
  },
  enableSSMAgent: true,
  managedScalingPolicy: {
    computeLimits: {
      unitType: ComputeUnit.INSTANCE_FLEET_UNITS,
      minimumCapacityUnits: 10,
      maximumCapacityUnits: 100,
    },
  },
  primaryInstanceGroup: {
    instanceType: m5n8xlarge,
  },
  coreInstanceGroup: {
    instanceType: m5n8xlarge,
    instanceCount: 10,
  },
});

const sparkFleet = new FleetCluster(stack, "SparkFleet", {
  clusterName: "spark-fleet",
  vpc,
  catalogs: {
    spark_catalog: myCatalog,
  },
  extraJavaOptions: {
    "-Djdk.httpclient.allowRestrictedHeaders": "host",
  },
  enableSSMAgent: true,
  managedScalingPolicy: {
    computeLimits: {
      unitType: ComputeUnit.INSTANCE_FLEET_UNITS,
      minimumCapacityUnits: 10,
      maximumCapacityUnits: 100,
    },
  },
  primaryInstanceFleet: {
    name: "primary",
    instanceTypes: [
      {
        instanceType: m5n8xlarge,
      },
    ],
  },
  coreInstanceFleet: {
    name: "core",
    instanceTypes: [
      {
        instanceType: m5n8xlarge,
      },
    ],
  },
  taskInstanceFleets: [
    {
      name: "memory-intensive-spot",
      allocationStrategy: AllocationStrategy.PRICE_CAPACITY_OPTIMIZED,
      // we want at least 10 spot m5n8xlarge
      targetSpotCapacity: 10 * 10,
      targetOnDemandCapacity: 0,
      instanceTypes: [
        {
          instanceType: m5n8xlarge,
          bidPriceAsPercentageOfOnDemandPrice: 10,
          // if we can get it at 1/10th the price, give us 10x the capacity
          weightedCapacity: 10,
        },
        {
          instanceType: m5n8xlarge,
          // if we can get it at 1/2th the price, give us 2x the capacity
          bidPriceAsPercentageOfOnDemandPrice: 50,
          weightedCapacity: 5,
        },
        {
          instanceType: m5n8xlarge,
          // otherwise, give us the 10 we asked for
          bidPriceAsPercentageOfOnDemandPrice: 100,
          weightedCapacity: 10,
        },
      ],
    },
  ],
});

// spark.mount(workspace.ssm);
sparkFleet.mount(sam);

const sparkSQL = sparkFleet.jdbc({
  port: 10000,
});

const domain = new Domain(stack, "Domain", {
  domainName: `streamlit-example-aws-cdk-${stage}`,
  vpc,
  authMode: AuthMode.IAM,
  removalPolicy,
});

domain.addUserProfile("sam");

// allow the SageMaker domain to connect to the Spark's JDBC Hive service
sparkSQL.allowFrom(domain);

// allow the SageMaker domain to connect to the Spark's Ivy service
sparkFleet.allowLivyFrom(domain);

// allow the SageMaker domain to start a session on the Spark cluster
sparkFleet.grantStartSSMSession(domain);

// spark.connections.allowFrom(domain.sageMakerSg, Port.tcp(443));

// spark.allowHttpsFrom(domain.sageMakerSg);

// const site = new StreamlitSite(stack, "StreamlitSite", {
//   lakeHouse,
//   home: "app/home.py",
// });

// stack.addOutputs({
//   NessieUrl: lakeHouse.nessie.serviceUrl,
//   // SiteUrl: site.url,
// });
