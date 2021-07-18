# gambitprofit-api-backend
Private backend code for the GambitProfit API. 

**This repo must stay private**

---

## Description of folders

- backend-api: The models which perform calculations to populate the calculated fields in Strapi. Zip this up and drop it in /opt/strapi/app/api/gambit-plays
- update-from-gambitrewards-script: The script which updates the API data automatically, pulling from GambitRewards.com. Designed to be run in the Docker container.
- notifier-script: The script which regularly polls the GambitProfit API and notifies multiple channels when a good bet is found. Designed to be run on AWS lambda, and triggered by the updater script. Currently it's broken!

## How does our Docker tagging system work:
- **ALL pushes** get a docker image built with a tag like sha-xxxxxx. This is useful for testing versions.
- **ALL releases** get a docker image built with a tag like 1.x.x. This is useful for production usage.
- **ALL releases** also update the "latest" tag. This is useful for production usage where auto updates are enabled.

## Caveat with MongoDB
MongoDB 5.0 and above only supports Sandy Bridge and newer Intel CPUs. KVM64 CPUs don't work, so make sure to pass through the host cpu. 
Otherwise, you will get errors like this:
```angular2html
mongo_1       | /usr/local/bin/docker-entrypoint.sh: line 381:    26 Illegal instruction     (core dumped) "${mongodHackedArgs[@]}" --fork
```