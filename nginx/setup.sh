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


# Create empty files for SSL certificate files so that Nginx can start
sudo mkdir -p /etc/letsencrypt/live/tubesock.xyz # Create directory for SSL certificate files
sudo touch /etc/letsencrypt/live/tubesock.xyz/fullchain.pem
sudo touch /etc/letsencrypt/live/tubesock.xyz/privkey.pem
sudo touch /etc/letsencrypt/live/tubesock.xyz/chain.pem

# Generate place holder SSL certificate files
sudo openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout /etc/letsencrypt/live/tubesock.xyz/privkey.pem \
  -out /etc/letsencrypt/live/tubesock.xyz/fullchain.pem \
  -subj "/CN=tubesock.xyz"

sudo cp /etc/letsencrypt/live/tubesock.xyz/fullchain.pem /etc/letsencrypt/live/tubesock.xyz/chain.pem

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
sudo systemctl start nginx
sudo systemctl reload nginx

echo "Setup complete"
 


# map all HTTP requests for .well-known/acme-challenge
# sudo mkdir -p /var/lib/letsencrypt/.well-known
# sudo chgrp nginx /var/lib/letsencrypt
# sudo chmod g+s /var/lib/letsencrypt

# sudo mkdir /etc/nginx/snippets/
# sudo mkdir /etc/nginx/sites-available/
# sudo mkdir /etc/nginx/sites-enabled

# ################
# # Create snippets
# ################
# # create letsencrypt configuration file
# sudo bash -c 'cat > /etc/nginx/snippets/letsencrypt.conf <<EOF
# location ^~ /.well-known/acme-challenge/ {
#   allow all;
#   root /var/lib/letsencrypt/;
#   default_type "text/plain";
#   try_files \$uri =404;
# }
# EOF'

# # create SSL configuration file
# sudo bash -c 'cat > /etc/nginx/snippets/ssl.conf <<EOF
# ssl_dhparam /etc/ssl/certs/dhparam.pem;

# ssl_session_timeout 1d;
# ssl_session_cache shared:SSL:10m;
# ssl_session_tickets off;

# ssl_protocols TLSv1.2 TLSv1.3;
# ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
# ssl_prefer_server_ciphers on;

# ssl_stapling on;
# ssl_stapling_verify on;
# resolver 8.8.8.8 8.8.4.4 valid=300s;
# resolver_timeout 30s;

# add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
# add_header X-Frame-Options SAMEORIGIN;
# add_header X-Content-Type-Options nosniff;
# EOF'


# # Create the HTTP server block (will be used when we generate the SSL certificate)
# sudo bash -c 'cat > /etc/nginx/sites-available/tubesock.xyz.conf.http <<EOF
# server {
#   listen 80;
#   server_name tubesock.xyz www.tubesock.xyz;

#   include snippets/letsencrypt.conf;

#   location / { 
#     proxy_set_header X-Forwarded-For \$remote_addr;
#     proxy_set_header Host \$http_host;
#     proxy_pass "http://127.0.0.1:3000";
#   }
# }
# EOF'

# # create the HTTPS server block(will be used after the generate the SSL certificate)
# sudo bash -c 'cat > /etc/nginx/sites-available/tubesock.xyz.conf.https <<EOF
# server {
#   listen 80;
#   server_name tubesock.xyz www.tubesock.xyz;

#   include snippets/letsencrypt.conf;

#   return 301 https://www.tubesock.xyz;
# }

# server {
#   listen 443 ssl http2;
#   server_name tubesock.xyz;

#   ssl_certificate /etc/letsencrypt/live/tubesock.xyz/fullchain.pem;
#   ssl_certificate_key /etc/letsencrypt/live/tubesock.xyz/privkey.pem;
#   ssl_trusted_certificate /etc/letsencrypt/live/tubesock.xyz/chain.pem;

#   include snippets/ssl.conf;
#   include snippets/letsencrypt.conf;

#   location / {
#     proxy_set_header  X-Forwarded-For \$remote_addr;
#     proxy_set_header  Host \$http_host;
#     proxy_pass        "http://127.0.0.1:3000";
#   }
# }

# EOF'

# # sudo rm /etc/nginx/sites-enabled/tubesock.xyz.conf.https 2>/dev/null || true
# # sudo rm /etc/nginx/sites-enabled/tubesock.xyz.conf.http 2>/dev/null || true

# # Check if SSL certificate files exist
# if [ -f /etc/letsencrypt/live/tubesock.xyz/fullchain.pem ]; then
#   echo "SSL certificate files already exists, Using HTTPS configuration"
#   # If SSL certificate files exist, use the HTTPS configuration
#   # symlink to sites-enabled to be used by nginx
#   sudo ln -s /etc/nginx/sites-available/tubesock.xyz.conf.https /etc/nginx/sites-enabled/

#   # Remove the HTTP configuration in case we symlinked it before
#   sudo rm /etc/nginx/sites-enabled/tubesock.xyz.conf.http 2>/dev/null || true

#   echo "Restarting Nginx" 
#   sudo systemctl restart nginx
# else
#   echo "SSL certificate files do not exist, Using HTTP configuration"
#   # If SSL certificate files do not exist, use the HTTP configuration so we can generate it
#   # symlink to sites-enabled to be used by nginx
#   sudo ln -s /etc/nginx/sites-available/tubesock.xyz.conf.http /etc/nginx/sites-enabled/

#   echo "Restarting Nginx"
#   sudo systemctl restart nginx
#   echo "Running certbot to generate SSL certificate"
#   # run certbot to generate the SSL certificate
#   sudo certbot certonly --agree-tos --email tayloranderson1265@gmail.com.com --webroot -w /var/lib/letsencrypt/ -d tubesock.xyz -d www.tubesock.xyz

#   echo "SSL certificate generated, Switching to HTTPS configuration, removing HTTP configuration"
#   # symlink to sites-enabled to be used by nginx
#   sudo mkdir /etc/nginx/sites-enabled
#   sudo ln -s /etc/nginx/sites-available/tubesock.xyz.conf.https /etc/nginx/sites-enabled/
  
#   # Remove the HTTP config symlink used before
#   sudo rm /etc/nginx/sites-enabled/tubesock.xyz.conf.http
  
#   echo "Restarting Nginx"
  
#   sudo systemctl restart nginx
  
# fi

# sudo systemctl reload nginx



# # Enable new server block by symlink to sites-enabled directory
# sudo ln -s /etc/nginx/sites-available/tubesock.xyz.conf /etc/nginx/sites-enabled/

# # Restart nginx for changes to take effect
# sudo systemctl restart nginx

