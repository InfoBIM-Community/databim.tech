FROM node:22-alpine

WORKDIR /app

# Python and the tools that build the wheels of the project's own packages
# (brasidatacenter, ontobdc) from their source every time the app starts.
RUN apk add --no-cache python3 py3-pip \
    && python3 -m venv /opt/wheel-build \
    && /opt/wheel-build/bin/pip install --no-cache-dir build setuptools wheel "hatchling>=1.27"
ENV PATH="/opt/wheel-build/bin:${PATH}" \
    SYSTEM_OBDC_PATH="/workspace/system.obdc"

# The lockfile pins every dependency to the versions the tests ran with. Every addon
# declares its own dependencies in its own package.json (npm workspaces), so the manifest
# of each addon the checkout has goes in before the install; the glob adds one for every
# addon that is there and ignores the ones it does not have. --parents keeps the addon
# directory of every manifest, which is where npm looks for the workspace.
COPY --parents src/./package.json src/./package-lock.json src/./addon/*/package.json ./

RUN npm ci --no-audit --no-fund


COPY src/. ./
COPY system.obdc /workspace/system.obdc

EXPOSE 5173

CMD ["npm", "run", "dev"]
