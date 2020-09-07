# gambitprofit-api-backend
Private backend code for the GambitProfit API. 

**This repo must stay private**

---

## Description of folders

- backend-api: The models which perform calculations to populate the calculated fields in Strapi. Zip this up and drop it in /opt/strapi/app/api/gambit-plays
- update-from-gambitrewards-script: The script which updates the API data automatically, pulling from GambitRewards.com. Designed to be run on AWS Lambda.
- notifier-script: The script which regularly polls the GambitProfit API and notifies multiple channels when a good bet is found. Designed to be run on AWS lambda, and triggered by the updater script.
