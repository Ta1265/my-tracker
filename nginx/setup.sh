# #!/bin/bash

# ################
# # Description:
# # 1. Installs Nginx, certbot, 
# # 2. Generates a strong Diffie-Hellman group
# # 3. Generates an SSL certificate using certbot with --webroot plugin. 
# # 4. Creates an Nginx configuration file for the HTTPS server block and starts Nginx. 
# ################

echo "Installing Nginx and certbot"

sudo yum update
sudo sudo yum install -y certbot # install cert bot for Let's Encrypt

sudo yum install -y nginx # Install Nginx, -y to answer yes to all prompts

sudo rm /etc/nginx/sites-enabled/default # Remove the default Nginx site page

sudo mkdir -p /etc/letsencrypt/live/tubesock.xyz/ # Create directory for SSL certificate files

if [ ! -f /etc/letsencrypt/live/tubesock.xyz/fullchain.pem ] || [ ! -f /etc/letsencrypt/live/tubesock.xyz/privkey.pem ]; then
  # Map all HTTP requests for .well-known/acme-challenge
  sudo mkdir -p /var/lib/letsencrypt/.well-known/acme-challenge/
  sudo chown -R nginx:nginx /var/lib/letsencrypt/

  if [ ! -f /etc/ssl/certs/dhparam.pem]; then
    echo "Generating new Diffie-Hellman group"
    # Generate group to use for DHE ciphersuites
    sudo openssl dhparam -out /etc/ssl/certs/dhparam.pem 2048
  fi

  echo "Copying Nginx with HTTP configuration file to serve .well-known/acme-challenge"
  sudo cp nginx/nginx-certbot.conf /etc/nginx/nginx.conf # Copy the Nginx configuration file

  echo "Starting Nginx before running certbot" 
  sudo systemctl start nginx
  sudo systemctl reload nginx

  sudo nginx -t # Test Nginx configuration

  echo "Running certbot to generate SSL certificate"
  # Run certbot to generate SSL certificate, using --webroot plugin to bind to port 80
  sudo certbot certonly \
    --agree-tos \
    --register-unsafely-without-email \
    --webroot \
    -w /var/lib/letsencrypt/ \
    -d tubesock.xyz \
    -d www.tubesock.xyz
fi


echo "Copying Nginx with SLL configuration file"
sudo cp nginx/nginx.conf /etc/nginx/nginx.conf # Copy the Nginx configuration file

sudo systemctl start nginx
sudo systemctl reload nginx

sudo nginx -t # Test Nginx configuration
# sudo systemctl stop nginx || true # Stop nginx if it is running, to allow certbot to bind to port 80 with --webroot plugin

echo "Setup complete"
