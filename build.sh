# this script gets run from its directory
# first argument is the directory in which child app will live, assume there's already a package.json there

npm install
sudo pip install butterfly
sudo npm install -g node-inspector
cp -r initialApp/* $1
cd $1
npm install 

