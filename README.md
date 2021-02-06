# cloud-fd

Commands for working with files in cloud storage.

## Install

```bash
npm install --save cloud-fs
```

## Configure

### AWS

TODO

aws.json:
```json
{
    todo configuration
}

or env vars:

export AWS:CONFIG1=...
export AWS:CONFIG2=...

```

### Azure storage

TODO
### Digital Ocean Spaces

TODO

### Google Cloud Storage

TODO

## List files

```bash
cloud-ls vendor:/path/to/directory
```

## Copy a file

```bash
cloud-cp vendorA:/path/to/file.txt vendorB:/path/to/file.txt
```

## Delete a file

```bash
cloud-rm vendor:/path/to/file.txt
```

