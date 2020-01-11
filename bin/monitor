#!/bin/bash

set -e

URL="${URL:-https://tools.wmflabs.org/video-cut-tool-back-end}"
PING_TIME=90

echo "Video Cut Tool Back End Monitoring Script"
echo "We will ping $URL every $PING_TIME seconds to ensure it does not crash."
echo "Beginning in 5 seconds."
sleep 5

while true 
do
    echo -e "\nPinging $URL"
    if ! curl -s $URL >/dev/null
    then
        echo "Host is DOWN. Expecting crash, restarting webservice."
        webservice --backend=kubernetes nodejs restart
    else
        echo "Host is UP."
    fi
    echo "Waiting $PING_TIME seconds till next ping."
    sleep $PING_TIME
done