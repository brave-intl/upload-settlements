# upload settelments
this repo facilitates the uploading of transactions to eyeshade

run this command to upload to eyeshade production
```
node index.js --file ./settlement-folder/contributions-clean-signed-finished.json ./settlement-folder/paypal-settlement-complete.json ./settlement-folder/referrals-clean-signed-finished.json --url "https://eyeshade.mercury.basicattentiontoken.org/" --auth=$(heroku config:get -a bat-eyeshade ALLOWED_PUBLISHERS_TOKENS)

node index.js --file=./settlement-folder/contributions-clean-signed-finished.json ./settlement-folder/paypal-settlement-complete.json ./settlement-folder/referrals-clean-signed-finished.json --url "https://eyeshade.bsg.brave.com" --auth "$(kubectl --context bsg-production -n eyeshade-prod get secrets/env -o json | jq -r '.data.ALLOWED_PUBLISHERS_TOKENS' | base64 -d)"
```

## notes

there are often transactions that are created by other settlement tools that never finish. these are pretty standard and are put into rejected-* files
