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


sudo mkdir /etc/nginx
sudo mkdir /etc/nginx/sites-available
sudo mkdir /etc/nginx/sites-available/node
sudo mkdir /etc/nginx/sites-enabled
sudo mkdir /etc/nginx/snippets

# map all HTTP requests for .well-known/acme-challenge
sudo mkdir -p /var/lib/letsencrypt/.well-known
# change permissions
sudo chgrp www-data /var/lib/letsencrypt
sudo chmod g+s /var/lib/letsencrypt

# generate dhparam.pem
sudo openssl dhparam -out /etc/ssl/certs/dhparam.pem 2048

# create SSL configuration file
sudo bash -c 'cat > /etc/nginx/snippets/ssl.conf <<EOF
ssl_dhparam /etc/ssl/certs/dhparam.pem;

ssl_session_timeout 1d;
ssl_session_cache shared:SSL:10m;
ssl_session_tickets off;

ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers on;

ssl_stapling on;
ssl_stapling_verify on;
resolver 8.8.8.8 8.8.4.4 valid=300s;
resolver_timeout 30s;

add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Frame-Options SAMEORIGIN;
add_header X-Content-Type-Options nosniff;
EOF'


# create a new Nginx configuration
sudo bash -c 'cat > /etc/nginx/nginx.conf <<EOF
server {
  listen 80 http2;
  server_name tubesock.xyz www.tubesock.xyz;

  include snippets/letsencrypt.conf;
  
  # direct to lets encrypt files
  location ^~ /.well-known/acme-challenge/ {
    allow all;
    root /var/lib/letsencrypt/;
    default_type "text/plain";
    try_files $uri =404;
  }

  location / {
    return 301 https://$host$request_uri;
  }

}

server {
  listen 443 ssl http2;
  server_name tubesock.xyz www.tubesock.xyz;

  # SSL configurations
  ssl_certificate /etc/letsencrypt/live/tubesock.xyz/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/tubesock.xyz/privkey.pem;
  ssl_trusted_certificate /etc/letsencrypt/live/tubesock.xyz/chain.pem;

  ssl_dhparam /etc/ssl/certs/dhparam.pem;

  ssl_session_timeout 1d;
  ssl_session_cache shared:SSL:10m;
  ssl_session_tickets off;

  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
  ssl_prefer_server_ciphers on;

  ssl_stapling on;
  ssl_stapling_verify on;
  resolver 8.8.8.8 8.8.4.4 valid=300s;
  resolver_timeout 30s;

  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
  add_header X-Frame-Options SAMEORIGIN;
  add_header X-Content-Type-Options nosniff;

  # direct to lets encrypt files
  location ^~ /.well-known/acme-challenge/ {
    allow all;
    root /var/lib/letsencrypt/;
    default_type "text/plain";
    try_files $uri =404;
  }

  # direct to next app on port 3000
  location / {
      proxy_set_header   X-Forwarded-For $remote_addr;
      proxy_set_header   Host $http_host;
      proxy_pass         "http://127.0.0.1:3000";
  }
}
EOF'

# Create nginx docker file
sudo bash -c 'cat > Dockerfile.nginx <<EOF
FROM nginx:1.15-alpine

WORKDIR /app

EOF'

# Stop and remove the existing Docker container if there is one
sudo docker stop my-nginx-container || true
sudo docker rm my-nginx-container || true

# Build the Docker image
sudo docker build -t my-nginx-container -f Dockerfile.nginx .

# Run the Docker container
sudo docker run -p 443:443 \
-v /etc/letsencrypt:/etc/letsencrypt \
-v /var/lib/letsencrypt:/var/lib/letsencrypt \
-v /etc/nginx/nginx.conf:/etc/nginx/nginx.conf \
--name my-nginx-container my-nginx-container