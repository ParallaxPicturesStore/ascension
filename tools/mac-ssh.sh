#!/usr/bin/env bash
# SSH to MacinCloud - pass command as argument
# Usage: ./mac-ssh.sh "command to run"
export SSHPASS='hvj70804rpd'
sshpass -p "$SSHPASS" ssh -o StrictHostKeyChecking=accept-new -o PreferredAuthentications=password -o PubkeyAuthentication=no user290137@eu444.macincloud.com "$@"
