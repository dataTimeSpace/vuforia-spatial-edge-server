FROM node:20-alpine
LABEL maintainer="jhobin@datatime.space"
RUN mkdir -p /usr/src/
COPY . /usr/src/vuforia-spatial-edge-server
WORKDIR /usr/src/vuforia-spatial-edge-server/addons/vuforia-spatial-remote-operator-addon
RUN npm ci --omit=dev
WORKDIR /usr/src/vuforia-spatial-edge-server/addons/vuforia-spatial-core-addon
RUN npm ci --omit=dev
WORKDIR /usr/src/vuforia-spatial-edge-server/addons/pop-up-onboarding-addon
RUN npm ci --omit=dev
WORKDIR /usr/src/vuforia-spatial-edge-server/addons/onshape-addon
RUN npm ci --omit=dev
WORKDIR /usr/src/vuforia-spatial-edge-server/addons/vuforia-spatial-edge-agent-addon
RUN npm ci --omit=dev
WORKDIR /usr/src/vuforia-spatial-edge-server
RUN npm ci --omit=dev
HEALTHCHECK CMD node scripts/healthcheck.js --spatialToolboxPath=spatialToolbox
CMD npm start --spatialToolboxPath=spatialToolbox
