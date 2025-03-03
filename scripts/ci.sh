#!/bin/bash -x

./scripts/ci_generate_certificate.sh

mkdir screenshots

npm ci

git clone https://github.com/dataTimeSpace/vuforia-spatial-toolbox-userinterface
pushd vuforia-spatial-toolbox-userinterface
npm run pre-test-setup
popd

git clone https://github.com/dataTimeSpace/test-spatialToolbox spatialToolbox

cd addons

git clone https://github.com/dataTimeSpace/pop-up-onboarding-addon
git clone https://github.com/dataTimeSpace/vuforia-spatial-edge-agent-addon
git clone https://github.com/dataTimeSpace/vuforia-spatial-remote-operator-addon

for i in `ls ./`; do
  echo $i
  cd $i
  npm ci
  npm uninstall --no-save @ffmpeg-installer/ffmpeg fsevents
  cd ..
done

cd ..
