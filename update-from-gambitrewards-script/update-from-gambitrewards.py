############## HOW TO USE ##############
# Run on AWS Lambda using main() function as handler. Set environment variables (ENCRYPTED) to hold credentials.

import json, requests, re, os
# from time import sleep
# import logging
# import http

# # Debug logging
# http.client.HTTPConnection.debuglevel = 1
# logging.basicConfig()
# logging.getLogger().setLevel(logging.DEBUG)
# req_log = logging.getLogger('requests.packages.urllib3')
# req_log.setLevel(logging.DEBUG)
# req_log.propagate = True

#################### DEFINE VARIABLES HERE! ####################
# Gambit Rewards JWT token endpoint
LOGIN_URL = "https://api-production.gambitrewards.com/api/v1/user/login/"
# Gambit Rewards general matches endpoint
MATCHES_ENDPOINT = "https://api-production.gambitrewards.com/api/v1/matches/"
# Gambit Rewards credentials
USERNAME = os.environ['GAMBIT_USERNAME']
PASSWORD = os.environ['GAMBIT_PASSWORD']

# API endpoint
API_ENDPOINT = "https://hfj9ocdja8.execute-api.eu-west-1.amazonaws.com/"
# API backend credentials
API_USERNAME = os.environ['API_USERNAME']
API_PASSWORD = os.environ['API_PASSWORD']
#################################################################

def getMatches():
    with requests.Session() as s:
        # Log into Gambit Rewards
        log = s.post(LOGIN_URL, json={"auth":{"email":USERNAME,"password":PASSWORD}})

        print("Logged in to GambitRewards successfully")

        # Fetch JWT from Gambit
        authtoken = eval(log.content)["jwt"]

        # Grab all the matches from Gambit
        matches = s.get(MATCHES_ENDPOINT, headers={"Authorization": authtoken})

        matches_response = json.loads(matches.content)
        print("Matches response from GambitRewards: " + matches_response)

        print("Collected matches")

        print("Creating payload: Stage 1")
        games = {}
        for item in matches_response["items"]:
            games[item["id"]] = {"name": item["name"], "datetime": item["datetime"]}

        print("Creating payload: Stage 2")
        for id, deets in games.items():
            match_request = MATCHES_ENDPOINT + id
           
            game_spec = s.get(match_request, headers={"Authorization": authtoken})

            game_spec_response = json.loads(game_spec.content)
            # only post games with 3 or less teams (so we don't end up with nascar etc games)
            if len(game_spec_response["item"]["bet_types_matches"][0]["match_lines"]) <= 3:
                # If there is a "Play the odds" option, we don't want it - only grab the "Pick the winner" option
                if(len(game_spec_response["item"]["bet_types_matches"]) > 1):
                    if(game_spec_response["item"]["bet_types_matches"][1]["bet_type"]["label"] == "Pick the Winner"):
                        deets["ptw"] = [{"description": game_spec_response["item"]["bet_types_matches"][1]["match_lines"][0]["description"], "payout": game_spec_response["item"]["bet_types_matches"][1]["match_lines"][0]["payout"]}, {"description": game_spec_response["item"]["bet_types_matches"][1]["match_lines"][1]["description"], "payout": game_spec_response["item"]["bet_types_matches"][1]["match_lines"][1]["payout"]}]
                        try:
                            deets["ptw"].append({"description": game_spec_response["item"]["bet_types_matches"][1]["match_lines"][2]["description"], "payout": game_spec_response["item"]["bet_types_matches"][1]["match_lines"][2]["payout"]})
                        except:
                            pass
                    else:
                        deets["ptw"] = [{"description":
                                             game_spec_response["item"]["bet_types_matches"][0]["match_lines"][0][
                                                 "description"],
                                         "payout": game_spec_response["item"]["bet_types_matches"][0]["match_lines"][0][
                                             "payout"]}, {"description":
                                                              game_spec_response["item"]["bet_types_matches"][0][
                                                                  "match_lines"][1]["description"], "payout":
                                                              game_spec_response["item"]["bet_types_matches"][0][
                                                                  "match_lines"][1]["payout"]}]
                        try:
                            deets["ptw"].append({"description":
                                                     game_spec_response["item"]["bet_types_matches"][0]["match_lines"][
                                                         2]["description"], "payout":
                                                     game_spec_response["item"]["bet_types_matches"][0]["match_lines"][
                                                         2]["payout"]})
                        except:
                            pass
                # If there isn't a "Play the odds" option, great! Let's just grab "Pick the winner"
                else:
                    deets["ptw"] = [{"description": game_spec_response["item"]["bet_types_matches"][0]["match_lines"][0]["description"], "payout": game_spec_response["item"]["bet_types_matches"][0]["match_lines"][0]["payout"]},{"description": game_spec_response["item"]["bet_types_matches"][0]["match_lines"][1]["description"], "payout": game_spec_response["item"]["bet_types_matches"][0]["match_lines"][1]["payout"]}]
                    try:
                        deets["ptw"].append({"description": game_spec_response["item"]["bet_types_matches"][0]["match_lines"][2]["description"], "payout": game_spec_response["item"]["bet_types_matches"][0]["match_lines"][2]["payout"]})
                    except:
                        pass
            else:
                blacklist.append(id)
    return games

def update(key, value, payload_upd):
    if len(value["ptw"]) == 3:
        counter = -1
        for item in value["ptw"]:
            counter += 1
            if item["description"] == "Draw":
                break
        
        draw_reward = value["ptw"][counter]
        value["ptw"].pop(counter)

        PlayDate = value["datetime"][0:19] + value["datetime"][23:]

        payload_upd.append({"Calc": {"HighRisk":{}, "MedRisk":{}, "NoRisk":{}}, "Draw": {"Reward": float(draw_reward["payout"])}, "PlayDate": PlayDate, "PlayUrl": "https://app.gambitrewards.com/match/" + key, "Team1": {"Name": value["ptw"][0]["description"], "Reward": float(value["ptw"][0]["payout"])}, "Team2": {"Name": value["ptw"][1]["description"], "Reward": float(value["ptw"][1]["payout"])}})
            
    else:    

        PlayDate = value["datetime"][0:19] + value["datetime"][23:]
        payload_upd.append({"Calc": {"HighRisk":{}, "MedRisk":{}, "NoRisk":{}}, "Draw": {}, "PlayDate": PlayDate, "PlayUrl": "https://app.gambitrewards.com/match/" + key, "Team1": {"Name": value["ptw"][0]["description"], "Reward": float(value["ptw"][0]["payout"])}, "Team2": {"Name": value["ptw"][1]["description"], "Reward": float(value["ptw"][1]["payout"])}})

    return payload_upd

def cleanUp():
    games = getMatches()
    print("Creating payload: Stage 3")
    print("Games pulled from GambitRewards: " + games)
    
    payload = []
    payload_upd = []
    ids_upd = []

    for key, value in games.items():
        checkdupe = requests.get(API_ENDPOINT + "gambit-plays?PlayUrl=" + "https://app.gambitrewards.com/match/" + key)
        # Update Check!
        if checkdupe.json() != []:
            payload_upd = update(key, value, payload_upd)
            ids_upd.append(checkdupe.json()[0]["_id"])
            continue

        try:
            print(len(value["ptw"]))
        except KeyError:
            continue
        if len(value["ptw"]) == 3:
            counter = -1
            for item in value["ptw"]:
                counter += 1
                if item["description"] == "Draw":
                    break
            
            draw_reward = value["ptw"][counter]
            value["ptw"].pop(counter)

            PlayDate = value["datetime"][0:19] + value["datetime"][23:]

            payload.append({"Calc": {"HighRisk":{}, "MedRisk":{}, "NoRisk":{}}, "Draw": {"Reward": float(draw_reward["payout"])}, "PlayDate": PlayDate, "PlayUrl": "https://app.gambitrewards.com/match/" + key, "Team1": {"Name": value["ptw"][0]["description"], "Reward": float(value["ptw"][0]["payout"])}, "Team2": {"Name": value["ptw"][1]["description"], "Reward": float(value["ptw"][1]["payout"])}})
            
        elif len(value["ptw"]) < 3:    

            PlayDate = value["datetime"][0:19] + value["datetime"][23:]
            payload.append({"Calc": {"HighRisk":{}, "MedRisk":{}, "NoRisk":{}}, "Draw": {}, "PlayDate": PlayDate, "PlayUrl": "https://app.gambitrewards.com/match/" + key, "Team1": {"Name": value["ptw"][0]["description"], "Reward": float(value["ptw"][0]["payout"])}, "Team2": {"Name": value["ptw"][1]["description"], "Reward": float(value["ptw"][1]["payout"])}})
        
    
    return payload, payload_upd, ids_upd

# AWS Lambda handler function
blacklist = []
def main(event, context):
    payload, payload_upd, ids_upd = cleanUp()

    pl = json.dumps(payload)

    log_file = open("/tmp/log-out.json", "w")

    # Log into API backend
    api_log = requests.post(API_ENDPOINT + "auth/local", json={"identifier": API_USERNAME, "password": API_PASSWORD})

    # Fetch JWT from API
    api_log_response = api_log.json()
    api_authtoken = api_log_response["jwt"]
    print("Successfully logged into API backend")

    for item in payload:
        if item["PlayUrl"].split("/")[-1] not in blacklist:
            pl = json.dumps(item)
            unixfy_post = requests.post(API_ENDPOINT + "gambit-plays", data=json.dumps(item), headers={"Authorization": "Bearer " + api_authtoken, "Content-Type": "application/json; charset=utf-8"})
            # Log the output into logfile
            log_file.write(str(unixfy_post.status_code) + " ")
            print(unixfy_post.text)
            #print(unixfy_post.json())

    counter = 0
    for item in payload_upd:
        pl = json.dumps(item)
        unixfy_put = requests.put(API_ENDPOINT + "gambit-plays/" + ids_upd[counter], data=json.dumps(item), headers={"Authorization": "Bearer " + api_authtoken, "Content-Type": "application/json; charset=utf-8"})
        counter +=1
        log_file.write(str(unixfy_put.status_code) + " ")
        print(unixfy_put.text)
        #print(unixfy_put.json())
        #sleep(7200)

    log_file.close()
    print("Script ending")

