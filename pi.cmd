@echo off
docker run -it --rm -v "%CD%:/workspace" pi-cli %*
