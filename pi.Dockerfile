FROM node:20-alpine
RUN npm install -g @earendil-works/pi-coding-agent
WORKDIR /workspace
ENTRYPOINT ["pi"]
