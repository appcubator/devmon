# this script gets run from its directory
# first argument is the directory in which child app will live, assume there's already a package.json there
set -e

npm install
sudo pip install butterfly
sudo env "PATH=$PATH" npm install -g node-inspector
cp -r initialApp/* $1
cd $1
npm install 

