import {
  DynamoDBNessieVersionStore,
  NessieECSCatalog,
  UniformCluster,
  Workspace,
  ComputeUnit,
  DagsterService,
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

const lakeHouseName = `sam-test-${stage}`;

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

const dagster = new DagsterService(stack, "DagsterService", {
  vpc,
  removalPolicy,
});

const m5_xlarge = InstanceType.of(InstanceClass.M5, InstanceSize.XLARGE);
const m5_4xlarge = InstanceType.of(InstanceClass.M5, InstanceSize.XLARGE4);
const g5_4xlarge = InstanceType.of(InstanceClass.G5, InstanceSize.XLARGE4);
// const g5_12xlarge = InstanceType.of(InstanceClass.G5, InstanceSize.XLARGE12);

const spark = new UniformCluster(stack, "UniformCluster", {
  removalPolicy,
  clusterName: "spark-uniform",
  vpc,
  catalogs: {
    spark_catalog: myCatalog,
  },
  extraJavaOptions: {
    "-Djdk.httpclient.allowRestrictedHeaders": "host",
  },
  installGitHubCLI: true,
  enableSSMAgent: true,
  enableDocker: true,
  installDockerCompose: true,
  additionalTrustedRegistries: ["library", "centos"],
  managedScalingPolicy: {
    computeLimits: {
      unitType: ComputeUnit.VCPU,
      minimumCapacityUnits: 1,
      maximumCapacityUnits: 100,
    },
  },
  primaryInstanceGroup: {
    name: "primary",
    instanceType: m5_4xlarge,
  },
  coreInstanceGroup: {
    name: "core-gpu",
    instanceType: m5_4xlarge,
    instanceCount: 1,
  },
  environment: {
    DAGSTER_DB_SECRET_ARN: dagster.databaseSecret.secretArn,
    DAGSTER_PG_USERNAME: "admin",
    DAGSTER_PG_HOST: dagster.database.clusterEndpoint.hostname,
    DAGSTER_PG_PORT: dagster.database.clusterEndpoint.port.toString(),
  },
});

dagster.databaseSecret.grantRead(spark);
dagster.allowDBAccessFrom(spark);

// const sparkFleet = new FleetCluster(stack, "SparkFleet", {
//   clusterName: "spark-fleet",
//   vpc,
//   catalogs: {
//     spark_catalog: myCatalog,
//   },
//   extraJavaOptions: {
//     "-Djdk.httpclient.allowRestrictedHeaders": "host",
//   },
//   enableSSMAgent: true,
//   managedScalingPolicy: {
//     computeLimits: {
//       unitType: ComputeUnit.INSTANCE_FLEET_UNITS,
//       minimumCapacityUnits: 1,
//       maximumCapacityUnits: 100,
//     },
//   },
//   primaryInstanceFleet: {
//     name: "primary",
//     targetOnDemandCapacity: 1,
//     instanceTypes: [
//       {
//         instanceType: m5xlarge,
//       },
//     ],
//   },
//   coreInstanceFleet: {
//     name: "core",
//     targetOnDemandCapacity: 1,
//     instanceTypes: [
//       {
//         instanceType: m5xlarge,
//       },
//     ],
//   },
//   taskInstanceFleets: [
//     {
//       name: "memory-intensive-spot",
//       allocationStrategy: AllocationStrategy.PRICE_CAPACITY_OPTIMIZED,
//       targetSpotCapacity: 1,
//       targetOnDemandCapacity: 0,
//       instanceTypes: [
//         {
//           instanceType: m5xlarge,
//           // if we can get it at 1/2th the price, give us 2x the capacity
//           bidPriceAsPercentageOfOnDemandPrice: 50,
//           weightedCapacity: 5,
//         },
//       ],
//     },
//   ],
// });

// spark.mount(workspace.ssm);
spark.mount(sam);

// const sparkSQL = spark.jdbc({
//   port: 10000,
// });

// const domain = new Domain(stack, "Domain", {
//   domainName: `streamlit-example-aws-cdk-${stage}`,
//   vpc,
//   authMode: AuthMode.IAM,
//   removalPolicy,
// });

// domain.addUserProfile("sam");

// // allow the SageMaker domain to connect to the Spark's JDBC Hive service
// sparkSQL.allowFrom(domain);

// // allow the SageMaker domain to connect to the Spark's Ivy service
// spark.allowLivyFrom(domain);

// // allow the SageMaker domain to start a session on the Spark cluster
// spark.grantStartSSMSession(domain);

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
