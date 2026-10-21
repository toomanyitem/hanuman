# Linux build machine for Hanuman releases: Linux x64/arm64 installers, the
# Windows installer (through wine) and the CLI bundle. Used by
# scripts/hanuman/release-docker.sh so a Mac (or any Docker host) can build
# what a Linux machine would, without installing rpm or wine on the host.
FROM --platform=linux/amd64 node:22-bookworm

# rpm: rpmbuild for the .rpm targets. wine64 + wine32: electron-builder runs
# rcedit-ia32.exe through wine to stamp the icon and version into the .exe.
RUN dpkg --add-architecture i386 \
  && apt-get update \
  && apt-get install -y --no-install-recommends rpm wine wine64 wine32:i386 xvfb xauth \
  && rm -rf /var/lib/apt/lists/*

# Create the wine prefix once so builds don't start from a half-initialised one.
ENV WINEDEBUG=-all
RUN xvfb-run -a wineboot -i && wineserver -w

# The source is bind-mounted from the host and owned by another user.
RUN git config --global --add safe.directory '*'

COPY build.sh /usr/local/bin/hanuman-release-build
ENTRYPOINT ["hanuman-release-build"]
