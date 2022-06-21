# gambitprofit-api-backend
Backend code for the GambitProfit API. 

---

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
(well, we're not using MongoDB anymore!)