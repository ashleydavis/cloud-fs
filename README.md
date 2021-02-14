# cloud-fs

Commands for working with files in cloud storage.

PROTOTYPING. WORK IN PROGRESS

# Install

```bash
npm install -g @codecapers/cloud-fs
```

# Configure

To use `cloud-fs` you need to configure it to connect to your cloud storage account.

## AWS

Install the [AWS CLI tool](https://aws.amazon.com/cli/).

Use the AWS CLI tool to [authenticate with your AWS account](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-quickstart.html) by running this command:

```bash
aws configure
```

Or set your AWS API key in environment variables:

```bash
export AWS_ACCESS_KEY_ID=<your-aws-access-key>
export AWS_SECRET_ACCESS_KEY=<your-aws-secret-key>
export AWS_REGION=<your-aws-region>
```

Or on Windows:

```bash
set AWS_ACCESS_KEY_ID=<your-aws-access-key>
set AWS_SECRET_ACCESS_KEY=<your-aws-secret-key>
set AWS_REGION=<your-aws-region>
```


## Azure storage

Set the following environment variable to the connection string for your Azure storage account:

```bash
export AZURE_STORAGE_CONNECTION_STRING=<Azure-storage-connection-string>
```

Or on Windows:

```bash
set AZURE_STORAGE_CONNECTION_STRING=<Azure-storage-connection-string>
```

# Usage
## List files

Listing files at the root shows cloud vendors:

```bash
> cloud ls /
az/  aws/  local/
```

Listing files within a particular cloud vendor:

```bash
> cloud ls /aws/mybucket
file1  file2  file3 etc
```
## Copy a file

Copying a file from one vendor to another:

```bash
cloud cp /vendorA/path/to/file.txt /vendorB/path/to/dest/dir
```

For example, from Azure to AWS:

```bash
cloud cp /az/src-dir/file.txt /aws/dest-dir/
```

**! Existing files are not overwritten.**

## Copy a directory

Copying a whole directory full of files from one vendor to another:

```bash
cloud cp /vendorA/path/to/dir/ /vendorB/path/to/dest/dir/
```

For example, copying an Azure storage account to an AWS S3 bucket:

```bash
cloud cp /az/ /aws/
```

**! Existing files are not overwritten.**

## Interactive CLI

Run the `cloud` command by itself to start the interactive CLI:

```bash
> cloud
```

Now enter commands at the `cloud>` prompt:

```
cloud> ls
cloud> cp az/ aws/
```

You can even change directories:

```bash
cloud> cd aws/some/path
cloud> cp ./ /az/some/dest/dir
```


# Future

- Support GCP
- Support Digital Ocean Spaces
- Deleting, moving and renaming files
- Listing the tree of files
- Copy files in parallel.