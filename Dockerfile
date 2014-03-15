# Dockerfile to build Python and Node.js Devmon Containers
# @appcubator

# Set the base image to Ubuntu
FROM ubuntu

# File Author / Maintainer
MAINTAINER Appcubator

# Add the application resources URL
RUN echo "deb http://archive.ubuntu.com/ubuntu/ raring main universe" >> /etc/apt/sources.list

# Update the sources list
RUN apt-get update

# Install basic applications
RUN apt-get install -y tar zip git curl nano emacs vim wget dialog net-tools build-essential

# Install Python and Basic Python Tools
RUN apt-get install -y python python-dev python-distribute python-pip

# Install Node.js via NVM
RUN curl https://raw.github.com/creationix/nvm/master/install.sh | sh
RUN nvm install 0.10

# Add and build devmon
RUN mkdir /devmon /app
ADD . /devmon
RUN cd /devmon && sh build.sh /app


WORKDIR /devmon
CMD node devmon.js /app

