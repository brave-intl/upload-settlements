# upload settelments
this repo facilitates the uploading of transactions to eyeshade

run this command to upload to eyeshade production
```
node index.js --file ./settlements/2021-03-02 --url "https://eyeshade.bsg.bravesoftware.com" --auth "$(kubectl --context bsg-sandbox -n eyeshade-staging get secrets/env -o json | jq -r '.data.ALLOWED_PUBLISHERS_TOKENS' | base64 -d)"
```

## notes

there are often transactions that are created by other settlement tools that never finish. these are pretty standard and are put into rejected-* files
