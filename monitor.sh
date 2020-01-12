#!/bin/bash

set -e

case "$1" in
    start)
        echo "Starting monitoring.."
        chmod +x `dir "$0"`/bin/monitor.sh
        jstart `dirname "$0"`/bin/monitor.sh
        echo "Monitoring script started."
        ;;
    stop)
        echo "Stopping monitoring script.."
        jstop monitor
        ;;
    restart)
        echo "Restarting monitoring script.."
        jstop monitor
        jstart `dirname "$0" /bin/monitor.sh`
        ;;
    *)
        echo "./monitor.sh <start/stop/restart>"
        ;;
esac