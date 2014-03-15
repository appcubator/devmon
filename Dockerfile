# Dockerfile to build Python and Node.js Devmon Containers
# @appcubator

FROM ubuntu
MAINTAINER Appcubator

RUN echo "deb http://archive.ubuntu.com/ubuntu/ raring main universe" >> /etc/apt/sources.list
RUN apt-get update
RUN apt-get install -y tar zip man-db git curl nano emacs vim wget dialog net-tools build-essential

# Install Python and Basic Python Tools
RUN apt-get install -y python python-dev python-distribute python-pip

# Setup users
ADD ./sudoers /etc/sudoers
RUN chmod 0440 /etc/sudoers && chown 0:0 /etc/sudoers && groupadd ubuntu && useradd -s /bin/bash -m -g ubuntu -d /home/ubuntu ubuntu

# Install Node.js via NVM
RUN su -c "touch .profile && curl https://raw.github.com/creationix/nvm/master/install.sh | sh" -l ubuntu
RUN su -c "nvm install 0.10" -l ubuntu

# Add and build devmon
RUN mkdir /devmon /app && chown ubuntu:ubuntu /devmon /app
ADD . /devmon
RUN su -c "cd /devmon && nvm use 0.10 && sh build.sh /app" -l ubuntu


WORKDIR /devmon
CMD su -c "nvm use 0.10 && node devmon.js /app" -l ubuntu

