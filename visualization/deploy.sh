#!/bin/bash
rm -r /var/www/ttv/*
echo "Removed /var/www/ttv/*"
cp -r ./* /var/www/ttv
echo "Copied web interface to http://localhost/ttv"

