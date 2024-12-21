#!/bin/bash

################
# Description:
# 1. Installs Nginx, certbot, 
# 2. Generates a strong Diffie-Hellman group
# 3. Generates an SSL certificate using certbot with --webroot plugin. 
# 4. Creates an Nginx configuration file for the HTTPS server block and starts Nginx. 
################

echo "Installing Nginx and certbot"
sudo yum update
sudo sudo yum install -y certbot # install cert bot for Let's Encrypt

sudo yum install -y nginx # Install Nginx, -y to answer yes to all prompts

sudo rm /etc/nginx/sites-enabled/default # Remove the default Nginx site page

sudo cp nginx/nginx.conf /etc/nginx/nginx.conf # Copy the Nginx configuration file

echo "Generating Diffie-Hellman group"
# Generate group to use for DHE ciphersuites
sudo openssl dhparam -out /etc/ssl/certs/dhparam.pem 2048

# Map all HTTP requests for .well-known/acme-challenge
sudo mkdir -p /var/lib/letsencrypt/.well-known
sudo chgrp nginx /var/lib/letsencrypt
sudo chmod g+s /var/lib/letsencrypt

# sudo systemctl stop nginx || true # Stop nginx if it is running, to allow certbot to bind to port 80 with --webroot plugin

echo "Running certbot to generate SSL certificate"
# Run certbot to generate SSL certificate, using --webroot plugin to bind to port 80
sudo certbot certonly \
  --agree-tos \
  --register-unsafely-without-email \
  --webroot \
  -w /var/lib/letsencrypt/ \
  -d tubesock.xyz \
  -d www.tubesock.xyz

# echo "Starting Nginx" 
# sudo systemctl start nginx
# sudo systemctl reload nginx

echo "Setup complete"
 




