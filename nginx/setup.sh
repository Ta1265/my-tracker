#!/bin/bash

# Update package lists
sudo apt-get update

# Install Nginx
sudo apt-get install -y nginx

# Remove the default Nginx configuration
sudo rm /etc/nginx/sites-enabled/default

# Create a new Nginx configuration
sudo cp ./nginx/nginx.config /etc/nginx/sites-available/node

# symlink to sites-enabled to be used by nginx
sudo ln -s /etc/nginx/sites-available/node /etc/nginx/sites-enabled/

# Test the configuration
sudo nginx -t

# Reload Nginx to apply the changes
sudo systemctl reload nginx


# setup ssl
sudo openssl dhparam -out /etc/ssl/certs/dhparam.pem 2048

# map all HTTP requests for .well-known/acme-challenge
sudo mkdir -p /var/lib/letsencrypt/.well-known
sudo chgrp www-data /var/lib/letsencrypt
sudo chmod g+s /var/lib/letsencrypt