#!/bin/bash

pnpm run build
pnpm pack --out=package.tgz
pnpm publish --access=public

