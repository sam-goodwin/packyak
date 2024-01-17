---
slug: what-is-a-lakehouse
title: What is a Lakehouse?
author: sam
tags: [lakehouse, data lake, data warehouse, delta lake, iceberg, hudi]
---

Source: Delta Lake's [Lakehouse: A New Generation of Open Platforms that Unify Data Warehousing and Advanced Analytics paper](http://cidrdb.org/cidr2021/papers/cidr2021_paper17.pdf)

> In this paper, we discuss the following technical question: is it possible to turn data lakes based on standard open data formats, such as Parquet and ORC, into high-performance systems that can provide both the performance and management features of data warehouses and fast, direct I/O from advanced analytics workloads? We argue that this type of system design, which we refer to as a Lakehouse (Fig. 1), is both feasible and is already showing evidence of success, in various forms, in the industry. As more business applications start relying on operational data and on advanced analytics, we believe the Lakehouse is a compelling design point that can eliminate some of the top challenges with data warehousing.

# Evolution

1. Data Warehouse - load data directly from operational systems into a large data warehouse. Benefit from a transactional databases, managed file system and optimized file formats. Suffer from proprietary formats and coupling to the DB (and usually of compute and storage)
2. Data Lake - store data in files and store in a distributed file system (HDFS) or object store (S3). Works well for storing unstructured data but quickly gets out of hand due to the lack of versioning, transactions and structure around how to update data.
3. Two-tier Data Lake + Warehouse - stage data in the data lake and then ETL into the warehouse. Choose what goes in warehouse and what stays in the lake. Introduces data delays between source and the warehouse where it is queried and requires extra processing steps that can introduce bugs, staleness, cost and time.
4. LakeHouse - store all data in an infinitely scalable object store/file system, use open formats like Parquet, Orc to efficiently store data optimized for columnar queries, support transactions that update data, automatically compact files into larger/smaller files to optimized query speed.

# Problems with Data Lakes and Data Warehouses

- Reliability

> Continuous engineering is required to ETL data between the two systems and make it available to high-performance decision support and BI.

- Data Staleness

> The data in the warehouse is stale compared to that of the data lake, with new data frequently taking days to load. This is a step back compared to the first generation of analytics systems, where new operational data was immediately available for queries. According to a survey by Dimensional Research and Fivetran, 86% of analysts use out-of-date data, and 62% report waiting on engineering resources numerous times per month [47].

- Advanced Analytics

> Traditionally, data lakes have managed data as “just a bunch of files” in semi-structured formats, making it hard to offer some of the key management features that simplify ETL/ELT in data warehouses, such as transactions, rollbacks to old table versions, and zero-copy cloning.

- Unstructured and Structured data

Machine learning pipelines often require access to the raw files, both structured and unstructured. Videos, audio streams, etc. as well as SQL tables. Connecting to a large centralized DB over ODBC is inefficient.

Most ML models already rely on data frames which abstract away the underlying file format. There's no need for proprietary data formats in proprietary SQL databases when all data can be stored in an object store using open formats.

- Total cost of ownership

> Unlike BI queries, which extract a small amount of data, these systems need to process large datasets using complex non-SQL code. Reading this data via ODBC/JDBC is inefficient, and there is no way to directly access the internal warehouse proprietary formats. For these use cases, warehouse vendors recommend exporting data to files, which further increases complexity and staleness (adding a third ETL step!). Alternatively, users can run these systems against data lake data in open formats. However, they then lose rich management features from data warehouses, such as ACID transactions, data versioning, and indexing.

# Data Lakes

> Traditionally, data lakes have managed data as “just a bunch of files” in semi-structured formats, making it hard to offer some of the key management features that simplify ETL/ELT in data warehouses, such as transactions, rollbacks to old table versions, and zero-copy cloning.

> However, a recent family of systems such as Delta Lake [10] and Apache Iceberg [7] provide transactional views of a data lake, and enable these
> management features.

> Of course, organizations still have to do the hard work of writing ETL/ELT logic to create curated datasets with a Lakehouse, but there are fewer ETL steps overall, and analysts can also easily and performantly query the raw data tables if they
> wish to, much like in first-generation analytics platforms.

Basically, data lakes are elastic file systems with infinite storage mechanisms, usually hosted on an object store like S3, but this loses the benefits of a true file system like random access, transactions that isolate changes and queries, versioning of schemas, etc.

Lakehouses provide a layer on top of that.

# Lakehouse motivations

> First, the top problem reported by enterprise data users today is usually data quality and reliability [47, 48]. Implementing correct data pipelines is intrinsically difficult, but today’s two-tier data architectures with a separate lake and warehouse add extra complexity that exacerbates this problem.

> Second, more and more business applications require up-to-date data, but today’s architectures increase data staleness by having a separate staging area for incoming data before the warehouse and using periodic ETL/ELT jobs to load it.

> Third, a large fraction of data is now unstructured in many industries [22] as organizations collect images, sensor data, documents, etc. Organizations need easy-to-use systems to manage this data, but SQL data warehouses and their API do not easily support it

> Finally, most organizations are now deploying machine learning and data science applications, but these are not well served by data warehouses and lakes. As discussed before, these applications need to process large amounts of data with non-SQL code, so they cannot run efficiently over ODBC/JDBC.

> As advanced analytics systems continue to develop, we believe that giving them direct access to data in an open format will be the most effective way to support them. In addition, ML and data science applications suffer from the same data management problems that classical applications do, such as data quality, consistency, and isolation [17, 27, 31], so there is immense value in bringing DBMS features to their data.

# Open Formats enable Machine Learning

Machine Learning tools use Data Frames as the core abstraction. Data Frames support most formats, including Parquet, Orc, etc.

# Lakehouse SQL performance

Files are stored in object stores like S3 and use specialized formats like Parquet.

These objects are then indexed in a catalog which defines their schema and manages a list of data "partitions".

This comes at the cost of performance without tuning. If the number of files grows too large, then the query system needs to fetch a lot of files which each have overhead. To solve this, Lakehouses run "compaction" on objects to regularly reduce the number of files. It is a balance between number of files and size of files.

# Two-tier data lake + warehouse

> Virtually all the major data warehouses have added support for external tables in Parquet and ORC format [12, 14, 43, 46]. This allows warehouse users to also query the data lake from the same SQL engine, but it does not make data lake tables easier to manage and it does not remove the ETL complexity, staleness, and advanced analytics challenges for data in the warehouse.

E.g. Redshift Spectrum

> In practice, these connectors also often perform poorly because the SQL engine is mostly optimized for its internal data format

> Second, there is also broad investment in SQL engines that run directly against data lake storage, such as Spark SQL, Presto, Hive, and AWS Athena [3, 11, 45, 50]. However, these engines alone cannot solve all the problems with data lakes and replace warehouses: data lakes still lack basic management features such as ACID transactions and efficient access methods such as indexes to match data warehouse performance.

# What is a Lakehouse

> We define a Lakehouse as a data management system based on lowcost and directly-accessible storage that also provides traditional sanalytical DBMS management and performance features such as sACID transactions, data versioning, auditing, indexing, caching, sand query optimization.

> Lakehouses thus combine the key benefits of data lakes and data warehouses: low-cost storage in an open format accessible by a variety of systems from the former, and powerful management and optimization features from the latter.

## Transactional Metadata Layer

> The first key idea we propose for implementing a Lakehouse is to have the system store data in a low-cost object store (e.g., Amazon S3) using a standard file format such as Apache Parquet, but implement a transactional metadata layer on top of the object store that defines which objects are part of a table version.

> This allows the system to implement management features such as ACID transactions or versioning within the metadata layer, while keeping the bulk of the data in the low-cost object store and allowing clients to directly read objects from this store using a standard file format in most cases.

Examples:

- Delta Lake (developed by DataBricks)
- Apache Iceberg (developed by Netflix)
- Apache Hudi (developed by Uber)

## SQL Performance

> Although a metadata layer adds management capabilities, it is not sufficient to achieve good SQL performance.

> Data warehouses use several techniques to get state-of-the-art performance, such as storing hot data on fast devices such as SSDs, maintaining statistics, building efficient access methods such as indexes, and co-optimizing the data format and compute engine.

> In a Lakehouse based on existing storage formats, it is not possible to change the format, but we show that it is possible to implement other optimizations that leave the data files unchanged, including caching, auxiliary data structures such as indexes and statistics, and data layout optimizations.

ML use Data Frames which, like SQL, allow for query planning and optimization techniques based on the Lakehouse metadata.

## Transactions

> Data lake storage systems such as S3 or HDFS only provide a low-level object store or filesystem interface where even simple operations, such as updating a table that spans multiple files, are not atomic. Organizations soon began designing richer data management layers over these systems, starting with Apache Hive ACID [33], which tracks which data files are part of a Hive table at a given table version using an OLTP DBMS and allows operations to update this set transactionally

## Schemas

> In addition, metadata layers are a natural place to implement data quality enforcement features. For example, Delta Lake implements schema enforcement to ensure that the data uploaded to a table matches its schema, and constraints API [24] that allows table owners to set constraints on the ingested data (e.g., country can only be one of a list of values).

## Access Control and Authorization

> Finally, metadata layers are a natural place to implement governance features such as access control and audit logging. For example, a metadata layer can check whether a client is allowed to access a table before granting it credentials to read the raw data in the table from a cloud object store, and can reliably log all accesses.

## Open Problems

> Delta Lake, Iceberg and Hudi only support transactions on one table at a time.

> Delta Lake to store its transaction log in the same object store that it runs over (e.g., S3) in order to simplify management (removing the need to run a separate storage system) and offer high availability and high read bandwidth to the log (the same as the object store). However, this limits the rate of transactions/second it can support due to object stores’ high latency. A design using a faster storage system for the metadata may be preferable in some cases.

This may be an opportunity for AWS S3 Direct - trade-off multi-AZ availability for an order of magnitude improvement in latency. Can always replicate files into a high availability bucket.

> Optimizing the format of transaction logs and the size of objects managed are also open questions.

# How to achieve high performance

## Caching

> When using a transactional metadata layer such as Delta Lake, it is safe for a Lakehouse system to cache files from the cloud object store on faster storage devices such as SSDs and RAM on the processing nodes. Running transactions can easily determine when cached files are still valid to read. Moreover, the cache can be in a transcoded format that is more efficient for the query engine to run on, matching any optimizations that would be used in a traditional “closed-world” data warehouse engine. For example, our cache at Databricks partially decompresses the Parquet data it loads.

## Auxiliary Data (similar to a Read Model)

Basically: create an index on the data to help inform the query planner on whether it needs to process a specific file or help optimize how it processes a file.

Examples:

- Bloom filter based index
- Min-max statistics for each data file to enable data skipping
- Many more can be imagined

> Even though a Lakehouse needs to expose the base table storage format for direct I/O, it can maintain other data that helps optimize queries in auxiliary files that it has full control over.

> maintain column min-max statistics for each data file in the table within the same Parquet file used to store the transaction log, which enables data skipping optimizations when the base data is clustered by particular columns.

## Data Layout

> Data layout plays a large role in access performance. Even when we fix a storage format such as Parquet, there are multiple layout decisions that can be optimized by the Lakehouse system.

> The most obvious is record ordering: which records are clustered together and hence easiest to read together. In Delta Lake, we support ordering records using individual dimensions or spacefilling curves such as Z-order [39] and Hilbert curves to provide locality across multiple dimensions.

> One can also imagine new formats that support placing columns in different orders within each data file, choosing compression strategies differently for various groups of records, or other strategies [28].

> In typical workloads, most queries tend to be concentrated against a “hot” subset of the data, which the Lakehouse can cache using the same optimized data structures as a closed-world data warehouse to provide competitive performance.

> For “cold” data the a cloud object store, the main determinant of performance is likely to be the amount of data read per query. In that case, the combination of data layout optimizations (which cluster co-accessed data) and auxiliary data structures such as zone maps (which let the engine rapidly figure out what ranges of the data files to read) can allow a Lakehouse system to minimize I/O the same way a closed-world proprietary data warehouse would, despite running against a standard open file format.

## Opportunities

1. Build a better/faster storage format designed for the Lakehouse architecture of Object Store + Caching + Auxillary indexes

> One clear direction that we have not explored yet is designing new data lake storage formats that will work better in this use case, e.g., formats that provide more flexibility for the Lakehouse system to implement data layout optimizations or indexes over or are simply better suited to modern hardware. Of course, such new formats may take a while for processing engines to adopt, limiting the number of clients that can read from them, but designing a high quality directly-accessible open format for next generation workloads is an important research problem.

2. Design better caching strategies or auxillary data structures/indexes

> Even without changing the data format, there are many types of caching strategies, auxiliary data structures and data layout strategies to explore for Lakehouses [4, 49, 53]. Determining which ones are likely to be most effective for massive datasets in cloud object stores is an open question.

3. Sprinkle in Serverless compute ... (vague)

> Finally, another exciting research direction is determining when and how to use serverless computing systems to answer queries [41] and optimizing the storage, metadata layer, and query engine designs to minimize latency in this case.
