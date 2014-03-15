#!/bin/bash
set -e

echo "Info: using node version `node --version`"

mkdir -p /tmp/devmontest
cp -r initialApp/* /tmp/devmontest

pushd /tmp/devmontest
npm install connect
popd

node devmon.js /tmp/devmontest &
PID=$!

sleep 3s

echo -e "\nFor this test, please add the following to your /etc/hosts file, mapped to 127.0.0.1:"
echo "    example.com"
echo "    devmon.example.com"

echo -e "\nYou should see Hello world at example.com:5000."
echo -e "\nPress enter to test code updates."

read nothing

echo -e "\nTarring and sending new app."

pushd testApp
tar -cvf ../test.tar .
popd
curl -X POST -F code=@test.tar http://devmon.example.com:5000/__update_code__

echo -e "\nYou should see New kid on the block at example.com:5000."
echo -e "\nPress enter to exit."

read nothing

kill -2 $PID
wait $PID
